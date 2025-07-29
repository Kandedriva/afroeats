import Redis from 'redis';

// Redis availability flag
let redisAvailable = false;

// Redis configuration with improved persistence and retry settings
const redisConfig = {
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    reconnectStrategy: (retries) => {
      // More aggressive reconnection for session persistence
      if (retries > 10) {
        console.log('⚠️ Redis unavailable after 10 attempts, sessions may be lost');
        return false;
      }
      // Exponential backoff: 1s, 2s, 4s, 8s, then 10s max
      return Math.min(retries * 1000, 10000);
    },
    connectTimeout: 10000, // 10 seconds to connect
    commandTimeout: 5000   // 5 seconds for commands
  },
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  // Enable key expiration notifications (helpful for debugging)
  legacyMode: false
};

// Create Redis client
const redisClient = Redis.createClient(redisConfig);

// Error handling with less verbose logging
redisClient.on('error', (err) => {
  if (err.code === 'ECONNREFUSED') {
    if (redisAvailable) {
      console.log('⚠️ Redis connection lost, falling back to memory');
      redisAvailable = false;
    }
  } else {
    console.error('Redis Client Error:', err.message);
  }
});

redisClient.on('connect', () => {
  console.log('✅ Redis Client Connected');
  redisAvailable = true;
});

redisClient.on('ready', () => {
  console.log('✅ Redis Client Ready');
  redisAvailable = true;
});

// Connect to Redis with better error handling
const connectRedis = async () => {
  try {
    if (!redisClient.isOpen && redisAvailable !== false) {
      await redisClient.connect();
      redisAvailable = true;
      return true;
    }
    return redisClient.isOpen;
  } catch (error) {
    redisAvailable = false;
    return false;
  }
};

// Cache helper functions
export const cache = {
  // Get data from cache
  get: async (key) => {
    try {
      if (!redisAvailable) return null;
      const connected = await connectRedis();
      if (!connected) return null;
      
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      redisAvailable = false;
      return null;
    }
  },

  // Set data in cache with TTL (default 1 hour)
  set: async (key, value, ttl = 3600) => {
    try {
      if (!redisAvailable) return false;
      const connected = await connectRedis();
      if (!connected) return false;
      
      await redisClient.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      redisAvailable = false;
      return false;
    }
  },

  // Delete from cache
  del: async (key) => {
    try {
      if (!redisAvailable) return false;
      const connected = await connectRedis();
      if (!connected) return false;
      
      await redisClient.del(key);
      return true;
    } catch (error) {
      redisAvailable = false;
      return false;
    }
  },

  // Clear cache by pattern
  clearPattern: async (pattern) => {
    try {
      if (!redisAvailable) return false;
      const connected = await connectRedis();
      if (!connected) return false;
      
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    } catch (error) {
      redisAvailable = false;
      return false;
    }
  },

  // Increment counter (for analytics)
  incr: async (key, ttl = 86400) => {
    try {
      if (!redisAvailable) return 0;
      const connected = await connectRedis();
      if (!connected) return 0;
      
      const value = await redisClient.incr(key);
      if (value === 1) {
        await redisClient.expire(key, ttl);
      }
      return value;
    } catch (error) {
      redisAvailable = false;
      return 0;
    }
  },

  // Add to set
  sadd: async (key, member, ttl = 86400) => {
    try {
      if (!redisAvailable) return 0;
      const connected = await connectRedis();
      if (!connected) return 0;
      
      const result = await redisClient.sAdd(key, member);
      await redisClient.expire(key, ttl);
      return result;
    } catch (error) {
      redisAvailable = false;
      return 0;
    }
  },

  // Get set members count
  scard: async (key) => {
    try {
      if (!redisAvailable) return 0;
      const connected = await connectRedis();
      if (!connected) return 0;
      
      return await redisClient.sCard(key);
    } catch (error) {
      redisAvailable = false;
      return 0;
    }
  },

  // Add keys method for compatibility
  keys: async (pattern) => {
    try {
      if (!redisAvailable) return [];
      const connected = await connectRedis();
      if (!connected) return [];
      
      return await redisClient.keys(pattern);
    } catch (error) {
      redisAvailable = false;
      return [];
    }
  }
};

export default redisClient;