import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { body, param, query, validationResult } from 'express-validator';
import { cache } from '../utils/cache.js';

// Rate limiting configurations with fallback
export const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    // Use default memory store for now to avoid Redis hanging issues
    // store: undefined (uses default MemoryStore)
  });
};

// Different rate limits for different endpoints
export const rateLimits = {
  // General API rate limit
  general: createRateLimit(15 * 60 * 1000, 1000, 'Too many requests from this IP'),
  
  // Auth endpoints - stricter
  auth: createRateLimit(15 * 60 * 1000, 20, 'Too many authentication attempts'),
  
  // Registration - very strict
  register: createRateLimit(60 * 60 * 1000, 5, 'Too many registration attempts'),
  
  // Password reset - strict
  passwordReset: createRateLimit(15 * 60 * 1000, 3, 'Too many password reset attempts'),
  
  // Order creation - moderate (increased for development)
  orders: createRateLimit(5 * 60 * 1000, 100, 'Too many order attempts'),
  
  // File uploads - strict
  upload: createRateLimit(15 * 60 * 1000, 10, 'Too many upload attempts')
};

// Safari user-agent detection helper
const isSafariRequest = (userAgent) => {
  if (!userAgent) return false;
  return (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) ||
         (/WebKit/.test(userAgent) && !/Chrome/.test(userAgent)) ||
         /iPad|iPhone|iPod/.test(userAgent);
};

// CORS configuration with Safari/mobile browser compatibility
export const corsOptions = {
  origin: function (origin, callback) {
    // Get all possible frontend URLs from environment variables
    const allowedOrigins = [
      // Development origins
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      
      // Production origins from environment variables
      process.env.FRONTEND_URL,
      process.env.CLIENT_URL,
      process.env.ADMIN_URL,
      process.env.REACT_APP_FRONTEND_URL,
      
      // Specific production URLs
      'https://orderdabaly.com',
      'https://www.orderdabaly.com',
      'https://api.orderdabaly.com',
      'https://orderdabaly.netlify.app',
      'https://orderdabaly.vercel.app',
      
      // Auto-deployed Netlify URLs (common pattern)
      'https://main--orderdabaly.netlify.app',
      'https://deploy-preview-*--orderdabaly.netlify.app',
      
      // Backend service URLs (for admin dashboard and legacy support)
      'https://a-food-zone.onrender.com',
      'https://afro-restaurant-backend.onrender.com',
      
      // Support for both API and frontend subdomains
      'https://app.orderdabaly.com',
      'https://admin.orderdabaly.com'
    ].filter(Boolean); // Remove undefined values
    
    console.log('🌐 CORS Request from origin:', origin || 'NO_ORIGIN');
    console.log('🌐 Allowed origins:', allowedOrigins);
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    // Check for both undefined and "undefined" string
    if (!origin || origin === 'undefined') {
      console.log('✅ CORS: Allowing request with no origin (undefined)');
      return callback(null, true);
    }
    
    // Check if origin is in allowed list or matches Netlify deploy preview pattern
    const isAllowed = allowedOrigins.includes(origin) || 
                     (origin && (
                       origin.includes('--orderdabaly.netlify.app') ||
                       origin.includes('netlify.app') ||
                       origin.includes('vercel.app')
                     ));
    
    if (isAllowed) {
      console.log('✅ CORS: Origin allowed:', origin);
      callback(null, true);
    } else {
      console.log('❌ CORS: Origin rejected:', origin);
      console.log('💡 CORS: Add this origin to your environment variables if it should be allowed');
      
      // In development, be more lenient
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Development mode: Allowing origin anyway');
        callback(null, true);
      } else {
        // In production, be more lenient for image requests and known hosting platforms
        if (req && req.path && req.path.includes('/uploads/')) {
          console.log('🖼️ Allowing image request from:', origin);
          callback(null, true);
        } else {
          callback(new Error(`CORS policy violation: Origin ${origin} is not allowed`));
        }
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  // Enhanced headers for Safari/WebKit compatibility
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Pragma',
    'Cache-Control',
    'X-File-Name',
    'User-Agent',
    'DNT',
    'Sec-Fetch-Mode', 
    'Sec-Fetch-Site', 
    'Sec-Fetch-Dest',
    'X-Safari-No-Cache',
    'X-Webkit-CSP'
  ],
  // Expose additional headers for Safari image handling
  exposedHeaders: [
    'Set-Cookie', 
    'Content-Type', 
    'Content-Length', 
    'ETag', 
    'Last-Modified',
    'Cache-Control', 
    'Cross-Origin-Resource-Policy',
    'Access-Control-Allow-Origin'
  ],
  maxAge: 600, // Shorter cache for Safari compatibility (10 minutes)
  preflightContinue: false,
  optionsSuccessStatus: 204 // Safari prefers 204 for OPTIONS requests
};

// Helmet configuration for security headers
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
});

// Input validation helpers
export const validators = {
  // Email validation
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  // Password validation
  password: body('password')
    .isLength({ min: 12 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must be at least 12 characters with uppercase, lowercase, number, and special character (@$!%*?&)'),
  
  // Admin password validation (less strict)
  adminPassword: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  
  // Name validation
  name: body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-Z\s\-']+$/)
    .withMessage('Name must be 2-100 characters, letters only'),
  
  // Phone validation
  phone: body('phone')
    .optional()
    .matches(/^\+?[\d\s\-()]{10,15}$/)
    .withMessage('Please provide a valid phone number'),
  
  // Price validation
  price: body('price')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('Price must be between $0.01 and $10,000'),
  
  // Quantity validation
  quantity: body('quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100'),
  
  // ID parameter validation
  id: param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid ID parameter'),
  
  // Pagination validation
  page: query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be between 1 and 1000'),
  
  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  // Text content validation
  textContent: (field, maxLength = 1000) => 
    body(field)
      .optional()
      .trim()
      .isLength({ max: maxLength })
      .escape()
      .withMessage(`${field} must be less than ${maxLength} characters`),
  
  // Address validation
  address: body('address')
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Address must be 5-500 characters')
};

// Validation error handler
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// SQL injection prevention
export const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove potential SQL injection patterns
        obj[key] = obj[key].replace(/['";\\-]/g, '');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };
  
  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);
  
  next();
};

// XSS protection
export const xssProtection = (req, res, next) => {
  const escapeHtml = (text) => {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, (m) => map[m]);
  };
  
  const sanitizeObject = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = escapeHtml(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };
  
  if (req.body) sanitizeObject(req.body);
  next();
};

// Request logging for monitoring
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  res.on('finish', async () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip,
      userAgent: userAgent.substring(0, 200), // Limit length
      timestamp: new Date().toISOString()
    };
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`${logData.method} ${logData.url} - ${logData.status} - ${duration}ms`);
    }
    
    // Store metrics in Redis for analytics (non-blocking)
    setImmediate(async () => {
      try {
        const dateKey = new Date().toISOString().split('T')[0];
        await Promise.race([
          Promise.all([
            cache.incr(`analytics:requests:${dateKey}`),
            cache.incr(`analytics:requests:${dateKey}:${logData.method}`),
            cache.incr(`analytics:status:${dateKey}:${logData.status}`),
            cache.sadd(`analytics:unique_ips:${dateKey}`, ip)
          ]),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Analytics timeout')), 500))
        ]);
      } catch (error) {
        // Silently fail analytics to not block requests
      }
    });
  });
  
  next();
};