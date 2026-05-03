import * as Sentry from "@sentry/node";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { createServer } from "http";

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
import supportRoutes from "./routes/supportRoutes.js";
import NotificationService from './services/NotificationService.js';
import chatRoutes from "./routes/chatRoutes.js";
import socketService from "./services/socketService.js";
import driverAuthRoutes from "./routes/driverAuthRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import driverStripeRoutes from "./routes/driverStripeRoutes.js";
import refundRoutes from "./routes/refundRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import groceryRoutes from "./routes/groceryRoutes.js";
import groceryOwnerRoutes from "./routes/groceryOwnerRoutes.js";
import groceryCartRoutes from "./routes/groceryCartRoutes.js";
import { generateRecoveryToken, verifyRecoveryToken } from "./utils/recoveryToken.js";

// Import security and analytics
import { 
  helmetConfig, 
  corsOptions, 
  rateLimits, 
  requestLogger, 

} from "./middleware/security.js";
import { trackVisitorMiddleware, AnalyticsService } from "./services/analytics.js";
import { scheduleRecurringJobs, jobs } from "./services/queue.js";
import { cache } from "./utils/cache.js";

// Import logging and error monitoring
import { logger, requestLoggingMiddleware, errorLoggingMiddleware } from "./services/logger.js";
import { errorMonitoring, errorMonitoringMiddleware } from "./services/errorMonitoring.js";

dotenv.config();

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Drop 4xx errors — user mistakes, not application bugs
      const status = event.tags?.['http.status_code'] ?? event.extra?.statusCode;
      if (status >= 400 && status < 500) {
        return null;
      }
      return event;
    },
  });
}

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

// Sentry request handler — must be first middleware
app.use(Sentry.Handlers.requestHandler());

// Security headers
app.use(helmetConfig);

// Request logging and analytics (before CORS)
app.use(requestLogger);
app.use(requestLoggingMiddleware);

// CORS — explicit allowlist defined in middleware/security.js
app.use(cors(corsOptions));

// Body parsing middleware with comprehensive error handling
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';

  // CRITICAL: Skip body parsing for Stripe webhook endpoint
  // Stripe webhooks need the raw body buffer for signature verification
  if (req.url === '/api/webhook' || req.url.startsWith('/api/webhook?') ||
      req.url === '/api/webhooks/stripe' || req.url.startsWith('/api/webhooks/stripe?')) {
    console.log('⚡ Skipping body parsing for Stripe webhook:', req.url);
    return next();
  }

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
app.use('/api/orders/guest-track', rateLimits.auth);
app.use('/api/grocery/guest-track', rateLimits.auth);
app.use('/api/orders', rateLimits.orders);
app.use('/api/', rateLimits.general);

// Session handling middleware — device detection and cache control for mobile
app.use((req, res, next) => {
  const userAgent = req.get('User-Agent') || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  if (isMobile) {
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }

  req.isMobile = isMobile;
  req.isChrome = /Chrome/.test(userAgent);
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
  secret: process.env.SESSION_SECRET || (() => { throw new Error('SESSION_SECRET env var is required'); })(),
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
app.use("/api/support", supportRoutes);
app.use("/api/chat", chatRoutes);

// Driver routes
app.use("/api/drivers", driverAuthRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/drivers/stripe", driverStripeRoutes);

// Refund routes
app.use("/api/refunds", refundRoutes);

// Product routes (marketplace)
app.use("/api/products", productRoutes);

// Grocery owner routes
app.use("/api/grocery-owners", groceryOwnerRoutes);

// Grocery order routes
app.use("/api/grocery", groceryRoutes);

// Grocery cart routes (database-backed)
app.use("/api/grocery-cart", groceryCartRoutes);

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

if (process.env.NODE_ENV !== 'production') {
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
}

if (process.env.NODE_ENV !== 'production') {
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
}

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


if (process.env.NODE_ENV !== 'production') {
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
}

// Session recovery: accepts a HMAC-signed recovery token, creates a fresh session
app.post('/api/session-recover', async (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Recovery token is required' });
  }

  const payload = verifyRecoveryToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired recovery token' });
  }

  const { t: type, id } = payload;

  try {
    let accountRow = null;
    let sessionData = {};
    let responseData = {};

    if (type === 'user') {
      const result = await pool.query(
        'SELECT id, name, email, email_verified FROM users WHERE id = $1',
        [id]
      );
      accountRow = result.rows[0];
      if (!accountRow || accountRow.email_verified === false) {
        return res.status(401).json({ error: 'Account not found or not verified' });
      }
      sessionData = {
        userId: accountRow.id,
        userName: accountRow.name.split(' ')[0],
        userEmail: accountRow.email,
      };
      responseData = {
        user: { id: accountRow.id, name: accountRow.name, email: accountRow.email },
      };
    } else if (type === 'owner') {
      const result = await pool.query(
        'SELECT id, name, email, email_verified FROM restaurant_owners WHERE id = $1',
        [id]
      );
      accountRow = result.rows[0];
      if (!accountRow || accountRow.email_verified === false) {
        return res.status(401).json({ error: 'Account not found or not verified' });
      }
      sessionData = {
        ownerId: accountRow.id,
        ownerName: accountRow.name,
        ownerEmail: accountRow.email,
      };
      responseData = {
        owner: { id: accountRow.id, name: accountRow.name, email: accountRow.email },
      };
    } else if (type === 'grocery') {
      const result = await pool.query(
        'SELECT id, name, email, email_verified, active FROM grocery_store_owners WHERE id = $1',
        [id]
      );
      accountRow = result.rows[0];
      if (!accountRow || accountRow.email_verified === false || accountRow.active === false) {
        return res.status(401).json({ error: 'Account not found, not verified, or deactivated' });
      }
      sessionData = {
        groceryOwnerId: accountRow.id,
        groceryOwnerName: accountRow.name,
        groceryOwnerEmail: accountRow.email,
      };
      responseData = {
        groceryOwner: { id: accountRow.id, name: accountRow.name, email: accountRow.email },
      };
    } else {
      return res.status(400).json({ error: 'Unknown account type in token' });
    }

    req.session.regenerate((err) => {
      if (err) {
        console.error('Session recovery regenerate error:', err);
        return res.status(500).json({ error: 'Session creation failed' });
      }

      Object.assign(req.session, sessionData, {
        loginTime: new Date().toISOString(),
        recoveredAt: new Date().toISOString(),
      });

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session recovery save error:', saveErr);
          return res.status(500).json({ error: 'Session save failed' });
        }

        // Rotate the token so each recovery produces a fresh one
        const newToken = generateRecoveryToken(type, accountRow.id);

        res.json({
          success: true,
          recoveryToken: newToken,
          ...responseData,
        });
      });
    });
  } catch (err) {
    console.error('Session recovery error:', err);
    res.status(500).json({ error: 'Session recovery failed' });
  }
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

// Sentry error handler — must be before other error middleware
app.use(Sentry.Handlers.errorHandler());

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
    
    // Create HTTP server for Socket.IO
    const httpServer = createServer(app);

    // Initialize Socket.IO for real-time chat
    socketService.initialize(httpServer);

    // Start server
    httpServer.listen(PORT, () => {
      console.log(`🚀 OrderDabaly Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💬 Socket.IO enabled for real-time chat`);
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
