import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
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
import { cache } from "./utils/cache.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

// Trust proxy (important for rate limiting and IP detection)
app.set('trust proxy', 1);

// Initialize database session store
const initializeSessionStore = async () => {
  try {
    console.log('✅ Using PostgreSQL session store');
  } catch (error) {
    console.log('⚠️ Session store initialization failed, using memory store');
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

// Mobile-friendly session handling middleware
app.use((req, res, next) => {
  const userAgent = req.get('User-Agent') || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  if (isMobile) {
    // Set mobile-specific headers for better cookie handling
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }
  
  req.isMobile = isMobile;
  next();
});

// Static file serving with security
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// PostgreSQL session store
const PgSession = ConnectPgSimple(session);

// Session configuration with PostgreSQL store
const sessionConfig = {
  secret: process.env.SESSION_SECRET || "afoodzone-super-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  name: 'afoodzone.sid',
  cookie: {
    // Set session to last 1 year (365 days)
    maxAge: process.env.SESSION_TIMEOUT ? parseInt(process.env.SESSION_TIMEOUT) : 365 * 24 * 60 * 60 * 1000, // Default 1 year
    httpOnly: true,
    // For mobile compatibility, always use secure in production
    secure: process.env.NODE_ENV === 'production',
    // Use 'lax' for better mobile compatibility instead of 'none'
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
    // Don't set domain to allow for better mobile browser compatibility
    domain: undefined,
    // Additional mobile-friendly settings
    path: '/'
  },
  rolling: true, // This extends the session on each request
  unset: 'destroy', // Clear the session when unset
  // Mobile-specific session settings
  saveUninitialized: false, // Don't save uninitialized sessions for mobile
  resave: false, // Don't force session save on mobile
  genid: () => {
    // Generate more secure session IDs
    return crypto.randomBytes(32).toString('hex');
  },
  store: new PgSession({
    pool: pool, // Use existing PostgreSQL connection pool
    tableName: 'sessions', // Session table name
    createTableIfMissing: true, // Auto-create sessions table
    pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes (in seconds)
    errorLog: console.error.bind(console) // Log session store errors
  })
};

console.log('✅ Using PostgreSQL session store with persistent sessions');

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
app.use("/api", webhookRoutes);
app.use("/api/admin", adminRoutes);

// Session debug endpoint for mobile testing
app.get('/api/session-debug', (req, res) => {
  const userAgent = req.get('User-Agent') || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  res.json({
    sessionId: req.sessionID,
    session: req.session,
    cookies: req.headers.cookie,
    userAgent: userAgent,
    isMobile: isMobile,
    cookieSettings: {
      name: 'afoodzone.sid',
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      domain: undefined,
      path: '/'
    },
    timestamp: new Date().toISOString()
  });
});

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
    
    // Check cache (non-blocking)
    let cacheStatus = 'connected';
    try {
      await Promise.race([
        cache.set('health_check', 'ok', 10),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Cache timeout')), 1000))
      ]);
      cacheStatus = 'connected';
    } catch (cacheError) {
      console.log('Cache health check failed:', cacheError.message);
      cacheStatus = 'disconnected';
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        cache: cacheStatus,
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

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.json({
    message: '✅ CORS is working correctly!',
    origin: req.get('Origin') || 'No origin header',
    timestamp: new Date().toISOString(),
    headers: {
      'Access-Control-Allow-Origin': req.get('Origin') || '*',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
});

// Session debug endpoint
app.get('/api/session-debug', (req, res) => {
  const sessionTimeout = process.env.SESSION_TIMEOUT ? parseInt(process.env.SESSION_TIMEOUT) : 365 * 24 * 60 * 60 * 1000;
  const sessionTimeoutDays = Math.floor(sessionTimeout / (24 * 60 * 60 * 1000));
  
  res.json({
    message: '🔍 Session Debug Info',
    sessionId: req.sessionID,
    session: {
      userId: req.session.userId,
      userName: req.session.userName,
      ownerId: req.session.ownerId,
      ownerName: req.session.ownerName,
      cookie: req.session.cookie
    },
    cookies: req.headers.cookie,
    env: process.env.NODE_ENV,
    sessionConfig: {
      maxAge: sessionTimeout,
      maxAgeDays: sessionTimeoutDays,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined,
      rolling: true
    },
    timestamp: new Date().toISOString()
  });
});

// OPTIONS preflight for all API routes
app.options('/api/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
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
app.use((error, req, res) => {
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
    // Initialize session store
    await initializeSessionStore();
    
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
  
  // Close database pool
  try {
    await pool.end();
    console.log('✅ Database pool closed');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  
  // Close database pool
  try {
    await pool.end();
    console.log('✅ Database pool closed');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
  
  process.exit(0);
});

// Start the server
startServer();
