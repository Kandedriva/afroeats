// Simple in-memory cache utility (replaces Redis functionality)

class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
    this.sets = new Map();
  }

  // Get data from cache
  async get(key) {
    try {
      if (this.cache.has(key)) {
        const data = this.cache.get(key);
        return typeof data === 'string' ? data : JSON.stringify(data);
      }
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Set data in cache with TTL
  async set(key, value, ttl = 3600) {
    try {
      const dataToStore = typeof value === 'string' ? value : value;
      this.cache.set(key, dataToStore);
      
      // Clear existing timer
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
      }
      
      // Set expiration timer
      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.timers.delete(key);
      }, ttl * 1000);
      
      this.timers.set(key, timer);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  // Set with expiration (Redis setEx equivalent)
  async setEx(key, ttl, value) {
    return this.set(key, value, ttl);
  }

  // Delete from cache
  async del(key) {
    try {
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }
      return this.cache.delete(key);
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  // Set expiration for existing key
  async expire(key, ttl) {
    try {
      if (!this.cache.has(key)) return false;
      
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
      }
      
      const timer = setTimeout(() => {
        this.cache.delete(key);
        this.timers.delete(key);
      }, ttl * 1000);
      
      this.timers.set(key, timer);
      return true;
    } catch (error) {
      console.error('Cache expire error:', error);
      return false;
    }
  }

  // Get TTL for key
  async ttl(key) {
    try {
      if (!this.timers.has(key)) return -1;
      // This is a simplified implementation
      return 300; // Return a default value
    } catch (error) {
      console.error('Cache TTL error:', error);
      return -1;
    }
  }

  // Increment counter
  async incr(key, amount = 1) {
    try {
      const current = parseInt(this.cache.get(key) || '0');
      const newValue = current + amount;
      this.cache.set(key, newValue.toString());
      return newValue;
    } catch (error) {
      console.error('Cache incr error:', error);
      return 0;
    }
  }

  // Add to set
  async sAdd(key, member) {
    try {
      if (!this.sets.has(key)) {
        this.sets.set(key, new Set());
      }
      const set = this.sets.get(key);
      const sizeBefore = set.size;
      set.add(member);
      return set.size - sizeBefore;
    } catch (error) {
      console.error('Cache sAdd error:', error);
      return 0;
    }
  }

  // Get set members count
  async sCard(key) {
    try {
      if (!this.sets.has(key)) return 0;
      return this.sets.get(key).size;
    } catch (error) {
      console.error('Cache sCard error:', error);
      return 0;
    }
  }

  // Get keys by pattern (simplified)
  async keys(pattern) {
    try {
      const keys = Array.from(this.cache.keys());
      if (pattern === '*') return keys;
      
      // Simple pattern matching
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return keys.filter(key => regex.test(key));
    } catch (error) {
      console.error('Cache keys error:', error);
      return [];
    }
  }
}

// Create memory cache instance
const memoryCache = new MemoryCache();

// Cache helper functions (compatible with Redis implementation)
export const cache = {
  // Get data from cache
  get: async (key) => {
    try {
      const data = await memoryCache.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      // If parsing fails, return as string
      return await memoryCache.get(key);
    }
  },

  // Set data in cache with TTL (default 1 hour)
  set: async (key, value, ttl = 3600) => {
    try {
      return await memoryCache.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  },

  // Delete from cache
  del: async (key) => {
    return await memoryCache.del(key);
  },

  // Clear cache by pattern
  clearPattern: async (pattern) => {
    try {
      const keys = await memoryCache.keys(pattern);
      for (const key of keys) {
        await memoryCache.del(key);
      }
      return true;
    } catch (error) {
      console.error('Cache clear pattern error:', error);
      return false;
    }
  },

  // Increment counter
  incr: async (key, ttl = 86400) => {
    try {
      const value = await memoryCache.incr(key);
      if (value === 1) {
        await memoryCache.expire(key, ttl);
      }
      return value;
    } catch (error) {
      console.error('Cache incr error:', error);
      return 0;
    }
  },

  // Add to set
  sadd: async (key, member, ttl = 86400) => {
    try {
      const result = await memoryCache.sAdd(key, member);
      await memoryCache.expire(key, ttl);
      return result;
    } catch (error) {
      console.error('Cache sadd error:', error);
      return 0;
    }
  },

  // Get set members count
  scard: async (key) => {
    try {
      return await memoryCache.sCard(key);
    } catch (error) {
      console.error('Cache scard error:', error);
      return 0;
    }
  },

  // Get keys by pattern
  keys: async (pattern) => {
    try {
      return await memoryCache.keys(pattern);
    } catch (error) {
      console.error('Cache keys error:', error);
      return [];
    }
  },

  // TTL method
  ttl: async (key) => {
    return await memoryCache.ttl(key);
  },

  // Expire method
  expire: async (key, ttl) => {
    return await memoryCache.expire(key, ttl);
  }
};

console.log('✅ Using memory-based cache (Redis removed for deployment)');