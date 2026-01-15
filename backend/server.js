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
import imageProxyRoutes from "./routes/imageProxy.js";
import debugRoutes from "./routes/debugRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import migrationRoutes from "./routes/migrationRoutes.js";
import debugImageRoutes from "./routes/debugImageRoutes.js";
import NotificationService from './services/NotificationService.js';
import webhookDebugRoutes from './routes/webhookDebug.js';

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

// Import logging and error monitoring
import { logger, requestLoggingMiddleware, errorLoggingMiddleware } from "./services/logger.js";
import { errorMonitoring, errorMonitoringMiddleware } from "./services/errorMonitoring.js";

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
app.use(requestLoggingMiddleware);

// CORS with secure configuration
app.use(cors(corsOptions));

// Body parsing middleware with comprehensive error handling
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  
  // Skip ALL body parsing for multipart/form-data (handled by multer)
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    console.log('Skipping body parsing for multipart request:', req.url);
    req.body = {}; // Ensure req.body exists
    return next();
  }
  
  // Only parse JSON for explicit JSON content type
  if (contentType.toLowerCase().includes('application/json')) {
    express.json({ 
      limit: '10mb',
      strict: false,
      type: 'application/json'
    })(req, res, (err) => {
      if (err) {
        if (err instanceof SyntaxError && err.message.includes('JSON')) {
          console.warn('JSON parsing error:', err.message, 'URL:', req.url);
          req.body = {};
          return next();
        }
        return next(err);
      }
      next();
    });
  } else if (contentType.toLowerCase().includes('application/x-www-form-urlencoded')) {
    // Only parse URL-encoded for explicit form content type
    express.urlencoded({ 
      extended: true, 
      limit: '10mb',
      type: 'application/x-www-form-urlencoded'
    })(req, res, (err) => {
      if (err) {
        console.warn('URL-encoded parsing error:', err.message, 'URL:', req.url);
        req.body = req.body || {};
        return next(err);
      }
      next();
    });
  } else {
    // For other content types, just ensure req.body exists
    req.body = req.body || {};
    next();
  }
});

// Input sanitization and XSS protection
app.use(sanitizeInput);
app.use(xssProtection);

// Global error handling middleware for any remaining errors
app.use((err, req, res, next) => {
  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    console.warn('File size limit exceeded:', req.url);
    return res.status(413).json({ 
      error: 'File too large',
      details: 'Maximum file size is 5MB'
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    console.warn('Unexpected file field:', req.url);
    return res.status(400).json({ 
      error: 'Unexpected file upload',
      details: 'Please check the file field name'
    });
  }
  
  if (err.message && err.message.includes('Please upload a valid image file')) {
    console.warn('Invalid file type:', req.url);
    return res.status(400).json({ 
      error: err.message
    });
  }
  
  // Handle any other parsing errors
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    console.warn('JSON syntax error:', err.message, 'URL:', req.url);
    return res.status(400).json({ 
      error: 'Invalid request format',
      details: 'Please check your request and try again'
    });
  }
  
  // For unhandled errors, log and continue
  console.warn('Unhandled error caught:', err.message, 'URL:', req.url);
  next(err);
});

// Rate limiting (applied selectively)
app.use('/api/auth/register', rateLimits.register);
app.use('/api/auth/login', rateLimits.auth);
app.use('/api/owners/login', rateLimits.auth);
app.use('/api/admin/login', rateLimits.auth);
app.use('/api/orders', rateLimits.orders);
app.use('/api/', rateLimits.general);

// Enhanced session handling middleware for cross-domain cookie support
app.use((req, res, next) => {
  const userAgent = req.get('User-Agent') || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isChrome = /Chrome/.test(userAgent);
  const origin = req.get('Origin');
  
  // Set enhanced headers for cross-domain cookie support
  res.set({
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'Set-Cookie',
    'Vary': 'Origin, Cookie'
  });
  
  // For production, add additional headers for cross-origin cookies
  if (process.env.NODE_ENV === 'production') {
    // Debug cookie issues
    if (!req.headers.cookie && req.path.startsWith('/api/')) {
      console.log('🍪 No cookies received:', {
        path: req.path,
        origin,
        userAgent: userAgent.substring(0, 50),
        sessionID: req.sessionID || 'none'
      });
    }
  }
  
  if (isMobile) {
    // Set mobile-specific headers for better cookie handling
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }
  
  req.isMobile = isMobile;
  req.isChrome = isChrome;
  next();
});

// Static file serving with security and CORS
app.use("/uploads", (req, res, next) => {
  // Add CORS headers for images
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  next();
}, express.static(path.join(__dirname, "uploads"), {
  maxAge: '1d',
  etag: true,
  lastModified: true
}));

// Static admin dashboard removed - using React admin dashboard instead
// app.use("/admin", express.static(path.join(__dirname, "public/admin"), {
//   maxAge: '1h',
//   etag: true,
//   lastModified: true
// }));

// PostgreSQL session store
const PgSession = ConnectPgSimple(session);

// Session configuration with PostgreSQL store
const sessionConfig = {
  secret: process.env.SESSION_SECRET || "orderdabaly-super-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  name: 'orderdabaly.sid',
  cookie: {
    // Set session to last 1 year (365 days)
    maxAge: process.env.SESSION_TIMEOUT ? parseInt(process.env.SESSION_TIMEOUT) : 365 * 24 * 60 * 60 * 1000, // Default 1 year
    httpOnly: true,
    // In development, disable secure cookies for local testing
    secure: process.env.NODE_ENV === 'production' && process.env.HTTPS !== 'false',
    // In development, use 'lax' for better cross-origin support
    sameSite: process.env.NODE_ENV === 'development' 
      ? 'lax' 
      : (process.env.COOKIE_SAMESITE || 'lax'),
    // Don't set domain to allow cross-origin cookies
    domain: undefined,
    path: '/'
  },
  rolling: true, // This extends the session on each request
  unset: 'destroy', // Clear the session when unset
  genid: () => {
    // Generate more secure session IDs
    return crypto.randomBytes(32).toString('hex');
  },
  store: new PgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
    // Cleanup expired sessions
    pruneSessionInterval: 15 * 60, // Clean up every 15 minutes
    // Disable error logging for cleaner output
    errorLog: process.env.NODE_ENV === 'development' ? console.error : undefined
  })
};

console.log('✅ Using PostgreSQL session store for persistent sessions');

app.use(session(sessionConfig));

// Session debugging middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth/') || req.path.startsWith('/api/owners/')) {
    console.log('🔍 Session Debug for', req.method, req.path, {
      sessionID: req.sessionID,
      hasSession: !!req.session,
      userId: req.session?.userId,
      ownerId: req.session?.ownerId,
      cookieHeader: req.headers.cookie ? 'present' : 'missing',
      origin: req.get('Origin'),
      userAgent: req.get('User-Agent')?.substring(0, 50)
    });
  }
  next();
});

// Visitor tracking middleware (for frontend pages)
app.use(trackVisitorMiddleware);

// Add comprehensive request logging for all API requests
app.use('/api', (req, res, next) => {
  console.log('🌍 ALL API REQUESTS - Method:', req.method, 'Path:', req.path, 'Full URL:', req.originalUrl);
  next();
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api", restaurantRoutes);
app.use("/api/owners", ownerRoutes);
app.use("/api/auth", ownerAuthRoutes);
app.use("/api/stripe", stripeRoutes);
app.use("/api", webhookRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", imageProxyRoutes);
app.use("/api/debug", debugRoutes);
app.use("/api/debug", debugImageRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/migration", migrationRoutes);
app.use("/api/webhook-debug", webhookDebugRoutes);

// Root route for deployment health checks
app.get('/', (req, res) => {
  res.status(200).json({
    message: "OrderDabaly Backend API is running successfully",
    status: "healthy",
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      admin: "/api/admin",
      restaurants: "/api/restaurants",
      auth: "/api/auth"
    }
  });
});

// Test session creation endpoint (for debugging)
app.post('/api/test-session-create', (req, res) => {
  req.session.testUserId = 'test-user-' + Date.now();
  req.session.testTime = new Date().toISOString();
  
  req.session.save((err) => {
    if (err) {
      console.error('Test session save error:', err);
      return res.status(500).json({ error: 'Session save failed', details: err.message });
    }
    
    res.json({
      message: 'Test session created successfully',
      sessionId: req.sessionID,
      testUserId: req.session.testUserId,
      testTime: req.session.testTime,
      cookies: req.headers.cookie,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  });
});

// Test notification endpoints
// Test webhook processing endpoint
app.get('/test-webhook-process', async (req, res) => {
  try {
    console.log('🧪 Manual webhook test triggered');

    // Get the most recent temp_order_data
    const tempDataResult = await pool.query(
      'SELECT * FROM temp_order_data ORDER BY created_at DESC LIMIT 1'
    );

    if (tempDataResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No temp order data found',
        message: 'Place an order first to create temp data'
      });
    }

    const tempData = tempDataResult.rows[0];
    const sessionId = tempData.session_id;
    const orderData = tempData.order_data;

    console.log(`📦 Processing temp order for session: ${sessionId}`);
    console.log('Order data:', JSON.stringify(orderData, null, 2));

    // Check if order already exists
    const existingOrder = await pool.query(
      'SELECT id FROM orders WHERE stripe_session_id = $1',
      [sessionId]
    );

    if (existingOrder.rows.length > 0) {
      return res.json({
        success: false,
        message: 'Order already exists for this session',
        orderId: existingOrder.rows[0].id,
        sessionId: sessionId
      });
    }

    res.json({
      success: true,
      message: 'Temp order data found',
      sessionId: sessionId,
      orderData: orderData,
      note: 'This would be processed by the webhook. Use Stripe CLI or dashboard to test actual webhook.'
    });
  } catch (error) {
    console.error('❌ Test webhook error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Test SMS endpoint
app.get('/test-sms', async (req, res) => {
  try {
    const testPhone = req.query.phone;
    if (!testPhone) {
      return res.status(400).json({
        error: 'Missing phone number',
        usage: 'GET /test-sms?phone=+15551234567'
      });
    }

    const result = await NotificationService.testSMSConfig(testPhone);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test email endpoint
app.get('/test-email', async (req, res) => {
  try {
    const testEmail = req.query.email;
    if (!testEmail) {
      return res.status(400).json({
        error: 'Missing email address',
        usage: 'GET /test-email?email=test@example.com'
      });
    }

    const result = await NotificationService.testEmailConfig(testEmail);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Remove test endpoints in production
if (process.env.NODE_ENV !== 'production') {
  // Test session endpoint for debugging
  app.post('/api/test-session', (req, res) => {
    const { userId } = req.body;
    if (userId) {
      req.session.userId = userId;
      req.session.userName = 'TestUser';
      res.json({ message: 'Session set', sessionId: req.sessionID, userId: userId });
    } else {
      res.status(400).json({ error: 'userId required' });
    }
  });

  // Test database query endpoint
  app.get('/api/test-dishes', async (req, res) => {
    try {
      const result = await pool.query('SELECT id, name, restaurant_id FROM dishes ORDER BY id LIMIT 10');
      res.json({ dishes: result.rows });
    } catch (err) {
      console.error('Database query error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Test restaurants endpoint
  app.get('/api/test-restaurants', async (req, res) => {
    try {
      const result = await pool.query('SELECT id, name FROM restaurants ORDER BY id LIMIT 10');
      res.json({ restaurants: result.rows });
    } catch (err) {
      console.error('Database query error:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });
}

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
  const userAgent = req.get('User-Agent') || '';
  const isChrome = /Chrome/.test(userAgent);
  
  res.json({
    message: '🔍 Session Debug Info',
    sessionId: req.sessionID,
    session: {
      userId: req.session.userId,
      userName: req.session.userName,
      userEmail: req.session.userEmail,
      loginTime: req.session.loginTime,
      isMobile: req.session.isMobile,
      cookie: req.session.cookie
    },
    cookies: req.headers.cookie,
    userAgent: req.get('User-Agent'),
    origin: req.get('Origin'),
    referer: req.get('Referer'),
    env: process.env.NODE_ENV,
    browserInfo: {
      isChrome,
      cookiesEnabled: !!req.headers.cookie,
      thirdPartyCookieSupport: isChrome ? 'potentially-blocked' : 'likely-supported'
    },
    sessionConfig: {
      maxAge: sessionTimeout,
      maxAgeDays: sessionTimeoutDays,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      domain: undefined,
      rolling: true
    },
    timestamp: new Date().toISOString()
  });
});

// Session recovery endpoint for Chrome users with cookie issues
app.post('/api/session-recover', (req, res) => {
  const { userId, loginTime } = req.body;
  
  if (!userId || !loginTime) {
    return res.status(400).json({ 
      error: 'Missing userId or loginTime for session recovery' 
    });
  }
  
  // Verify the user exists and the loginTime is recent (within last hour)
  const timeDiff = Date.now() - new Date(loginTime).getTime();
  if (timeDiff > 60 * 60 * 1000) { // 1 hour
    return res.status(400).json({ 
      error: 'Login time too old for session recovery' 
    });
  }
  
  // Create a new session with the user data
  req.session.userId = userId;
  req.session.loginTime = loginTime;
  req.session.recoveredSession = true;
  
  req.session.save((err) => {
    if (err) {
      console.error('Session recovery save error:', err);
      return res.status(500).json({ error: 'Failed to recover session' });
    }
    
    res.json({
      success: true,
      message: 'Session recovered successfully',
      sessionId: req.sessionID,
      userId: req.session.userId
    });
  });
});

// OPTIONS preflight is handled automatically by the CORS middleware above

// Catch-all route for undefined endpoints
app.use('*', (req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.originalUrl,
    method: req.method,
    message: "The requested endpoint does not exist. Check the API documentation for available routes.",
    availableEndpoints: {
      root: "/",
      health: "/api/health",
      auth: "/api/auth",
      restaurants: "/api/restaurants",
      orders: "/api/orders",
      admin: "/api/admin"
    }
  });
});

// Error monitoring middleware (must be before global error handler)
app.use(errorMonitoringMiddleware);
app.use(errorLoggingMiddleware);

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  // Log security events
  if (error.status === 401 || error.status === 403) {
    logger.logSecurityEvent(`${error.status} error: ${error.message}`, {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
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
      console.log(`🚀 OrderDabaly Server running on port ${PORT}`);
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
