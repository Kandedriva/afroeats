/**
 * Centralized Error Handling Utility
 *
 * Provides standardized error responses and error handling middleware
 * for the OrderDabaly API
 */

// Standard error codes
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Business logic
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  INVALID_STATE: 'INVALID_STATE',

  // External services
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  STRIPE_ERROR: 'STRIPE_ERROR',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',

  // System errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
};

/**
 * Custom Application Error class
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = ErrorCodes.INTERNAL_SERVER_ERROR, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Distinguishes operational errors from programming errors
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Standardized API response builder
 */
export class ApiResponse {
  static success(data, message = 'Success', meta = null) {
    const response = {
      success: true,
      message,
      data,
    };

    if (meta) {
      response.meta = meta;
    }

    return response;
  }

  static error(message, code = ErrorCodes.INTERNAL_SERVER_ERROR, details = null) {
    const response = {
      success: false,
      error: {
        message,
        code,
        timestamp: new Date().toISOString(),
      },
    };

    if (details) {
      response.error.details = details;
    }

    return response;
  }

  static paginated(data, pagination) {
    return {
      success: true,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        hasMore: pagination.page < Math.ceil(pagination.total / pagination.limit),
      },
    };
  }
}

/**
 * Common error factory functions
 */
export const Errors = {
  // Authentication errors
  unauthorized(message = 'Authentication required') {
    return new AppError(message, 401, ErrorCodes.UNAUTHORIZED);
  },

  invalidCredentials(message = 'Invalid email or password') {
    return new AppError(message, 401, ErrorCodes.INVALID_CREDENTIALS);
  },

  forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(message, 403, ErrorCodes.FORBIDDEN);
  },

  sessionExpired(message = 'Your session has expired. Please log in again') {
    return new AppError(message, 401, ErrorCodes.SESSION_EXPIRED);
  },

  // Validation errors
  validationError(message, details = null) {
    return new AppError(message, 400, ErrorCodes.VALIDATION_ERROR, details);
  },

  invalidInput(field, message = null) {
    return new AppError(
      message || `Invalid input for field: ${field}`,
      400,
      ErrorCodes.INVALID_INPUT,
      { field }
    );
  },

  missingField(field) {
    return new AppError(
      `Missing required field: ${field}`,
      400,
      ErrorCodes.MISSING_REQUIRED_FIELD,
      { field }
    );
  },

  // Resource errors
  notFound(resource = 'Resource', id = null) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    return new AppError(message, 404, ErrorCodes.NOT_FOUND, { resource, id });
  },

  alreadyExists(resource, field = null, value = null) {
    const message = field
      ? `${resource} with ${field} '${value}' already exists`
      : `${resource} already exists`;
    return new AppError(message, 409, ErrorCodes.ALREADY_EXISTS, { resource, field, value });
  },

  conflict(message) {
    return new AppError(message, 409, ErrorCodes.CONFLICT);
  },

  // Business logic errors
  operationNotAllowed(message) {
    return new AppError(message, 403, ErrorCodes.OPERATION_NOT_ALLOWED);
  },

  invalidState(message, currentState = null, expectedState = null) {
    return new AppError(message, 400, ErrorCodes.INVALID_STATE, { currentState, expectedState });
  },

  // External service errors
  paymentFailed(message = 'Payment processing failed', details = null) {
    return new AppError(message, 402, ErrorCodes.PAYMENT_FAILED, details);
  },

  stripeError(message, stripeErrorCode = null) {
    return new AppError(message, 503, ErrorCodes.STRIPE_ERROR, { stripeErrorCode });
  },

  // System errors
  databaseError(message = 'Database operation failed', details = null) {
    return new AppError(message, 500, ErrorCodes.DATABASE_ERROR, details);
  },

  internalError(message = 'An unexpected error occurred') {
    return new AppError(message, 500, ErrorCodes.INTERNAL_SERVER_ERROR);
  },

  serviceUnavailable(service = 'Service', message = null) {
    return new AppError(
      message || `${service} is temporarily unavailable`,
      503,
      ErrorCodes.SERVICE_UNAVAILABLE,
      { service }
    );
  },
};

/**
 * Error handling middleware
 * Place this at the end of your middleware chain
 */
export function errorHandler(err, req, res, next) {
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected error occurred';
  let code = err.code || ErrorCodes.INTERNAL_SERVER_ERROR;
  let details = err.details || null;

  // Handle specific error types

  // PostgreSQL errors
  if (err.code && err.code.startsWith('23')) {
    // PostgreSQL constraint violations
    if (err.code === '23505') {
      // Unique constraint violation
      statusCode = 409;
      code = ErrorCodes.ALREADY_EXISTS;
      message = 'A record with this value already exists';
      details = { constraint: err.constraint, detail: err.detail };
    } else if (err.code === '23503') {
      // Foreign key violation
      statusCode = 400;
      code = ErrorCodes.VALIDATION_ERROR;
      message = 'Referenced record does not exist';
      details = { constraint: err.constraint, detail: err.detail };
    } else if (err.code === '23502') {
      // Not null violation
      statusCode = 400;
      code = ErrorCodes.MISSING_REQUIRED_FIELD;
      message = 'Required field is missing';
      details = { column: err.column };
    }
  }

  // Stripe errors
  if (err.type && err.type.includes('Stripe')) {
    statusCode = 503;
    code = ErrorCodes.STRIPE_ERROR;
    message = err.message || 'Payment processing error';
    details = { type: err.type, stripeCode: err.code };
  }

  // Multer errors (file upload)
  if (err.name === 'MulterError') {
    statusCode = 400;
    code = ErrorCodes.VALIDATION_ERROR;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds the allowed limit';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded';
    } else {
      message = 'File upload error: ' + err.message;
    }
  }

  // Express validator errors
  if (err.array && typeof err.array === 'function') {
    statusCode = 400;
    code = ErrorCodes.VALIDATION_ERROR;
    message = 'Validation failed';
    details = err.array();
  }

  // Log error for debugging (in development or for non-operational errors)
  if (process.env.NODE_ENV === 'development' || !err.isOperational) {
    console.error('❌ Error occurred:', {
      message: err.message,
      code,
      statusCode,
      stack: err.stack,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });
  }

  // Log to error monitoring service in production
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
    // TODO: Send to error monitoring service (e.g., Sentry)
    console.error('Unhandled error:', err);
  }

  // Don't leak sensitive error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  const responseDetails = isProduction && !err.isOperational ? null : details;
  const responseStack = isProduction ? undefined : err.stack;

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      ...(responseDetails && { details: responseDetails }),
      ...(responseStack && { stack: responseStack }),
      timestamp: new Date().toISOString(),
      path: req.path,
    },
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 * Use this to wrap your async route handlers to avoid try-catch blocks
 *
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await UserService.getAll();
 *   res.json(ApiResponse.success(users));
 * }));
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 * Place this before the error handler middleware
 */
export function notFoundHandler(req, res, next) {
  const error = new AppError(
    `Route ${req.method} ${req.originalUrl} not found`,
    404,
    ErrorCodes.NOT_FOUND
  );
  next(error);
}

/**
 * Validation helper for express-validator
 */
export function handleValidationErrors(req, res, next) {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new AppError(
      'Validation failed',
      400,
      ErrorCodes.VALIDATION_ERROR,
      errors.array()
    );
  }

  next();
}

export default {
  AppError,
  ApiResponse,
  ErrorCodes,
  Errors,
  errorHandler,
  asyncHandler,
  notFoundHandler,
  handleValidationErrors,
};
