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

// CORS configuration — explicit allowlist only, no wildcards
export const corsOptions = {
  origin: function (origin, callback) {
    // Explicit allowlist — add new domains here or via ALLOWED_ORIGINS env var
    const allowedOrigins = new Set([
      // Development
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',

      // Production
      'https://orderdabaly.com',
      'https://www.orderdabaly.com',
      'https://app.orderdabaly.com',
      'https://admin.orderdabaly.com',
      'https://orderdabaly.netlify.app',
      'https://main--orderdabaly.netlify.app',

      // Environment-configured origins (comma-separated list supported)
      ...( process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
            : [] ),

      // Legacy env vars
      process.env.FRONTEND_URL,
      process.env.CLIENT_URL,
      process.env.ADMIN_URL,
    ].filter(Boolean));

    // Allow server-to-server requests (no Origin header)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.has(origin)) {
      return callback(null, origin);
    }

    callback(new Error(`CORS policy: origin ${origin} is not allowed`));
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

// Shared password rule: min 8 chars, uppercase, lowercase, digit.
// Used by all registration and password-reset flows.
export function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  return { valid: true, error: null };
}

// Input validation helpers
export const validators = {
  // Email validation
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  // Password validation (express-validator chain — uses same rule as validatePassword)
  password: body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, and a number'),

  // Admin password validation — same standard rule
  adminPassword: body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, and a number'),
  
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