import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log levels
export const LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

// Log categories for better organization
export const LogCategory = {
  AUTH: 'auth',
  ORDER: 'order',
  PAYMENT: 'payment',
  DATABASE: 'database',
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  API: 'api',
  GENERAL: 'general'
};

class Logger {
  constructor() {
    this.logsDir = path.join(__dirname, '../logs');
    this.ensureLogsDirectory();
    this.currentDate = new Date().toISOString().split('T')[0];
  }

  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  formatLogEntry(level, category, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      category,
      message,
      ...metadata,
      pid: process.pid,
      environment: process.env.NODE_ENV || 'development'
    };

    return JSON.stringify(logEntry);
  }

  writeToFile(level, logEntry) {
    const date = new Date().toISOString().split('T')[0];
    const filename = `${date}-${level}.log`;
    const filepath = path.join(this.logsDir, filename);
    
    fs.appendFileSync(filepath, logEntry + '\n');
  }

  writeToConsole(level, category, message, metadata) {
    const colors = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[90m'  // Gray
    };

    const reset = '\x1b[0m';
    const color = colors[level] || '';
    
    const timestamp = new Date().toISOString();
    const prefix = `${color}[${timestamp}] ${level.toUpperCase()} [${category}]${reset}`;
    
    if (Object.keys(metadata).length > 0) {
      console.log(`${prefix} ${message}`, metadata);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  log(level, category, message, metadata = {}) {
    const logEntry = this.formatLogEntry(level, category, message, metadata);
    
    // Write to console in development
    if (process.env.NODE_ENV === 'development') {
      this.writeToConsole(level, category, message, metadata);
    }
    
    // Always write to file
    try {
      this.writeToFile(level, logEntry);
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }

  error(category, message, metadata = {}) {
    this.log(LogLevel.ERROR, category, message, metadata);
  }

  warn(category, message, metadata = {}) {
    this.log(LogLevel.WARN, category, message, metadata);
  }

  info(category, message, metadata = {}) {
    this.log(LogLevel.INFO, category, message, metadata);
  }

  debug(category, message, metadata = {}) {
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV === 'development') {
      this.log(LogLevel.DEBUG, category, message, metadata);
    }
  }

  // Specific logging methods for common use cases
  logAuthEvent(message, userId = null, metadata = {}) {
    this.info(LogCategory.AUTH, message, {
      userId,
      ...metadata
    });
  }

  logSecurityEvent(message, metadata = {}) {
    this.warn(LogCategory.SECURITY, message, {
      ...metadata,
      timestamp: Date.now()
    });
  }

  logDatabaseError(message, query = null, error = null, metadata = {}) {
    this.error(LogCategory.DATABASE, message, {
      query,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: error.code
      } : null,
      ...metadata
    });
  }

  logAPIRequest(req, res, duration) {
    const metadata = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')?.substring(0, 200),
      userId: req.session?.userId || null
    };

    if (res.statusCode >= 400) {
      this.warn(LogCategory.API, `HTTP ${res.statusCode} - ${req.method} ${req.originalUrl}`, metadata);
    } else {
      this.info(LogCategory.API, `HTTP ${res.statusCode} - ${req.method} ${req.originalUrl}`, metadata);
    }
  }

  logPerformanceMetric(name, value, unit = 'ms', metadata = {}) {
    this.info(LogCategory.PERFORMANCE, `Performance metric: ${name}`, {
      metric: name,
      value,
      unit,
      ...metadata
    });
  }

  logOrderEvent(orderId, event, metadata = {}) {
    this.info(LogCategory.ORDER, `Order ${orderId}: ${event}`, {
      orderId,
      event,
      ...metadata
    });
  }

  logPaymentEvent(orderId, event, amount = null, metadata = {}) {
    this.info(LogCategory.PAYMENT, `Payment for order ${orderId}: ${event}`, {
      orderId,
      event,
      amount,
      ...metadata
    });
  }

  // Error aggregation for monitoring
  aggregateErrors(hours = 24) {
    try {
      const files = fs.readdirSync(this.logsDir)
        .filter(file => file.endsWith('-error.log'))
        .slice(-hours); // Get recent error logs

      const errors = [];
      
      files.forEach(file => {
        const filePath = path.join(this.logsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line);
        
        lines.forEach(line => {
          try {
            const error = JSON.parse(line);
            errors.push(error);
          } catch (e) {
            // Skip malformed log entries
          }
        });
      });

      return errors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('Failed to aggregate errors:', error);
      return [];
    }
  }

  // Get log statistics
  getStats(hours = 24) {
    try {
      const stats = {
        errors: 0,
        warnings: 0,
        info: 0,
        debug: 0,
        categories: {}
      };

      const files = fs.readdirSync(this.logsDir)
        .filter(file => file.endsWith('.log'));

      files.forEach(file => {
        const filePath = path.join(this.logsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line);
        
        lines.forEach(line => {
          try {
            const entry = JSON.parse(line);
            const level = entry.level.toLowerCase();
            
            if (stats[level] !== undefined) {
              stats[level]++;
            }
            
            if (entry.category) {
              stats.categories[entry.category] = (stats.categories[entry.category] || 0) + 1;
            }
          } catch (e) {
            // Skip malformed entries
          }
        });
      });

      return stats;
    } catch (error) {
      console.error('Failed to get log stats:', error);
      return null;
    }
  }

  // Clean old log files
  cleanOldLogs(daysToKeep = 30) {
    try {
      const files = fs.readdirSync(this.logsDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      files.forEach(file => {
        const filePath = path.join(this.logsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned old log file: ${file}`);
        }
      });
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }
}

// Create and export singleton instance
export const logger = new Logger();

// Export middleware for Express
export const requestLoggingMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logAPIRequest(req, res, duration);
  });
  
  next();
};

// Error handling middleware
export const errorLoggingMiddleware = (error, req, res, next) => {
  const metadata = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')?.substring(0, 200),
    userId: req.session?.userId || null,
    body: req.body,
    params: req.params,
    query: req.query
  };

  logger.error(LogCategory.API, `Unhandled error: ${error.message}`, {
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code || error.status
    },
    ...metadata
  });

  next(error);
};

export default logger;