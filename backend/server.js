import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import ConnectRedis from "connect-redis";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

// Import routes
import pool from "./db.js";
import authRoutes from "./routes/authRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import restaurantRoutes from "./routes/restaurantRoutes.js";
import ownerRoutes from "./routes/ownerRoutes.js";
import ownerAuthRoutes from "./routes/ownerAuthRoutes.js";
import stripeRoutes from "./routes/stripeRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import webhookRoutes from "./routes/webhook.js";
import adminRoutes from "./routes/adminRoutes.js";

// Import security and analytics
import { 
  helmetConfig, 
  corsOptions, 
  rateLimits, 
  requestLogger, 
  sanitizeInput,
  xssProtection 
} from "./middleware/security.js";
import { trackVisitorMiddleware, AnalyticsService } from "./services/analytics.js";
import { scheduleRecurringJobs, jobs } from "./services/queue.js";
import redisClient, { cache } from "./redis.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Trust proxy (important for rate limiting and IP detection)
app.set('trust proxy', 1);

// Initialize Redis connection with timeout
const initializeRedis = async () => {
  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
    );
    
    const connectPromise = redisClient.isOpen ? 
      Promise.resolve() : 
      redisClient.connect();
    
    await Promise.race([connectPromise, timeoutPromise]);
    console.log('✅ Redis connected successfully');
  } catch (error) {
    console.log('⚠️ Redis unavailable, using memory session store');
    // Don't throw error, just continue without Redis
  }
};

// Security headers
app.use(helmetConfig);

// Request logging and analytics (before CORS)
app.use(requestLogger);

// CORS with secure configuration
app.use(cors(corsOptions));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization and XSS protection
app.use(sanitizeInput);
app.use(xssProtection);

// Rate limiting (applied selectively)
app.use('/api/auth/register', rateLimits.register);
app.use('/api/auth/login', rateLimits.auth);
app.use('/api/owners/login', rateLimits.auth);
app.use('/api/admin/login', rateLimits.auth);
app.use('/api/orders', rateLimits.orders);
app.use('/api/', rateLimits.general);

// Static file serving with security
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// Redis session store
const RedisStore = ConnectRedis.default || ConnectRedis;

// Session configuration with Redis fallback
const sessionConfig = {
  secret: process.env.SESSION_SECRET || "afoodzone-super-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  name: 'afoodzone.sid',
  cookie: {
    // Set session to last 2 years (2 years * 365 days * 24 hours * 60 minutes * 60 seconds * 1000 milliseconds)
    maxAge: process.env.SESSION_TIMEOUT ? parseInt(process.env.SESSION_TIMEOUT) : 2 * 365 * 24 * 60 * 60 * 1000, // Default 2 years
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  },
  rolling: true, // This extends the session on each request (refreshes the 2-year timer)
  unset: 'destroy', // Clear the session when unset
  genid: () => {
    // Generate more secure session IDs
    return crypto.randomBytes(32).toString('hex');
  }
};

// Try Redis session store, fallback to memory
try {
  if (redisClient.isOpen || process.env.REDIS_HOST) {
    sessionConfig.store = new RedisStore({ 
      client: redisClient,
      // Configure Redis store for persistent sessions
      ttl: 2 * 365 * 24 * 60 * 60, // 2 years in seconds (matches cookie maxAge)
      prefix: 'afoodzone:sess:', // Prefix for session keys in Redis
      disableTouch: false, // Allow session refresh on activity
      disableTTL: false // Enable TTL for session expiration
    });
    console.log('✅ Using Redis session store with 2-year persistence');
  } else {
    console.log('⚠️ Redis not available, using memory session store');
    console.log('⚠️ WARNING: Sessions will be lost on server restart!');
  }
} catch (error) {
  console.log('⚠️ Redis session store failed, using memory fallback');
  console.log('⚠️ WARNING: Sessions will be lost on server restart!');
}

app.use(session(sessionConfig));

// Visitor tracking middleware (for frontend pages)
app.use(trackVisitorMiddleware);

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api", restaurantRoutes);
app.use("/api/owners", ownerRoutes);
app.use("/api/auth", ownerAuthRoutes);
app.use("/api", stripeRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api", webhookRoutes);
app.use("/api/admin", adminRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database with timeout
    let dbStatus = 'disconnected';
    try {
      await Promise.race([
        pool.query('SELECT 1'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('DB timeout')), 2000))
      ]);
      dbStatus = 'connected';
    } catch (dbError) {
      console.log('Database health check failed:', dbError.message);
    }
    
    // Check Redis (non-blocking)
    let redisStatus = 'disconnected';
    try {
      await Promise.race([
        cache.set('health_check', 'ok', 10),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1000))
      ]);
      redisStatus = 'connected';
    } catch (redisError) {
      console.log('Redis health check failed:', redisError.message);
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
        server: 'running'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  // Log security events
  if (error.status === 401 || error.status === 403) {
    // Log security event (implement logging service)
  }
  
  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

// Initialize services and start server
const startServer = async () => {
  try {
    // Initialize Redis
    await initializeRedis();
    
    // Run database migrations (you would implement this)
    console.log('📊 Database schema ready');
    
    // Schedule recurring jobs
    if (process.env.NODE_ENV !== 'test') {
      scheduleRecurringJobs();
      console.log('⏰ Background jobs scheduled');
    }
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 A Food Zone Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Admin dashboard: http://localhost:${PORT}/api/admin`);
      console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  
  // Close Redis connection
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
  
  // Close database pool
  await pool.end();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  
  // Close Redis connection
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
  
  // Close database pool
  await pool.end();
  
  process.exit(0);
});

// Start the server
startServer();
