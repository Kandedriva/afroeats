import { logger, LogCategory } from './logger.js';
import pool from '../db.js';

// Error categories for classification
const ErrorCategory = {
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  VALIDATION: 'validation',
  DATABASE: 'database',
  PAYMENT: 'payment',
  EXTERNAL_API: 'external_api',
  NETWORK: 'network',
  SYSTEM: 'system',
  BUSINESS_LOGIC: 'business_logic',
  UNKNOWN: 'unknown'
};

// Error severity levels
const ErrorSeverity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

class ErrorMonitoringService {
  constructor() {
    this.errorThresholds = {
      critical: 1,    // Alert immediately for critical errors
      high: 5,        // Alert after 5 high-severity errors in 10 minutes
      medium: 20,     // Alert after 20 medium-severity errors in 30 minutes
      low: 50         // Alert after 50 low-severity errors in 1 hour
    };
    
    this.recentErrors = new Map(); // Store recent errors for rate limiting
    this.initializeDatabase();
  }

  async initializeDatabase() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS error_logs (
          id SERIAL PRIMARY KEY,
          error_id VARCHAR(255) UNIQUE,
          category VARCHAR(50) NOT NULL,
          severity VARCHAR(20) NOT NULL,
          message TEXT NOT NULL,
          stack_trace TEXT,
          metadata JSONB DEFAULT '{}',
          user_id INTEGER,
          session_id VARCHAR(255),
          ip_address INET,
          user_agent TEXT,
          url VARCHAR(500),
          method VARCHAR(10),
          occurred_at TIMESTAMP DEFAULT NOW(),
          resolved BOOLEAN DEFAULT FALSE,
          resolution_notes TEXT,
          first_seen TIMESTAMP DEFAULT NOW(),
          last_seen TIMESTAMP DEFAULT NOW(),
          occurrence_count INTEGER DEFAULT 1
        )
      `);

      // Create indexes for performance
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
        CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
        CREATE INDEX IF NOT EXISTS idx_error_logs_occurred_at ON error_logs(occurred_at);
        CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
      `);

      console.log('✅ Error monitoring database initialized');
    } catch (error) {
      console.error('❌ Failed to initialize error monitoring database:', error);
    }
  }

  // Classify error based on type and context
  classifyError(error, context = {}) {
    const message = error.message?.toLowerCase() || '';
    const code = error.code || error.status;

    // Authentication errors
    if (code === 401 || message.includes('unauthorized') || message.includes('authentication')) {
      return { category: ErrorCategory.AUTHENTICATION, severity: ErrorSeverity.MEDIUM };
    }

    // Authorization errors
    if (code === 403 || message.includes('forbidden') || message.includes('authorization')) {
      return { category: ErrorCategory.AUTHORIZATION, severity: ErrorSeverity.MEDIUM };
    }

    // Validation errors
    if (code === 400 || message.includes('validation') || message.includes('invalid')) {
      return { category: ErrorCategory.VALIDATION, severity: ErrorSeverity.LOW };
    }

    // Database errors
    if (error.code?.startsWith('23') || message.includes('database') || message.includes('sql')) {
      const severity = error.code === '23505' ? ErrorSeverity.LOW : ErrorSeverity.HIGH; // Unique constraint vs other DB errors
      return { category: ErrorCategory.DATABASE, severity };
    }

    // Payment errors
    if (message.includes('stripe') || message.includes('payment') || context.category === 'payment') {
      return { category: ErrorCategory.PAYMENT, severity: ErrorSeverity.HIGH };
    }

    // Network errors
    if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
      return { category: ErrorCategory.NETWORK, severity: ErrorSeverity.MEDIUM };
    }

    // System errors
    if (code >= 500 || message.includes('internal server error')) {
      return { category: ErrorCategory.SYSTEM, severity: ErrorSeverity.CRITICAL };
    }

    return { category: ErrorCategory.UNKNOWN, severity: ErrorSeverity.MEDIUM };
  }

  // Generate unique error ID based on error characteristics
  generateErrorId(error, context = {}) {
    const errorString = `${error.name || 'Error'}-${error.message}-${context.url || ''}-${context.method || ''}`;
    return Buffer.from(errorString).toString('base64').substring(0, 32);
  }

  // Record error in database and logs
  async recordError(error, context = {}) {
    try {
      const { category, severity } = this.classifyError(error, context);
      const errorId = this.generateErrorId(error, context);
      
      const errorData = {
        error_id: errorId,
        category,
        severity,
        message: error.message || 'Unknown error',
        stack_trace: error.stack,
        metadata: JSON.stringify({
          name: error.name,
          code: error.code || error.status,
          ...context.metadata
        }),
        user_id: context.userId || null,
        session_id: context.sessionId || null,
        ip_address: context.ip || null,
        user_agent: context.userAgent?.substring(0, 500) || null,
        url: context.url || null,
        method: context.method || null
      };

      // Try to update existing error (increment occurrence count)
      const updateResult = await pool.query(`
        UPDATE error_logs 
        SET occurrence_count = occurrence_count + 1,
            last_seen = NOW(),
            metadata = $1
        WHERE error_id = $2
        RETURNING id
      `, [errorData.metadata, errorData.error_id]);

      if (updateResult.rows.length === 0) {
        // Insert new error
        await pool.query(`
          INSERT INTO error_logs (
            error_id, category, severity, message, stack_trace, metadata,
            user_id, session_id, ip_address, user_agent, url, method
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          errorData.error_id, errorData.category, errorData.severity,
          errorData.message, errorData.stack_trace, errorData.metadata,
          errorData.user_id, errorData.session_id, errorData.ip_address,
          errorData.user_agent, errorData.url, errorData.method
        ]);
      }

      // Log to file system
      logger.error(LogCategory.GENERAL, `${category.toUpperCase()}: ${error.message}`, {
        errorId,
        category,
        severity,
        stack: error.stack,
        ...context
      });

      // Check if we need to send alerts
      await this.checkAlertThresholds(category, severity);

      return errorId;
    } catch (dbError) {
      // Fallback to file logging if database fails
      logger.error(LogCategory.DATABASE, 'Failed to record error in database', {
        originalError: error.message,
        dbError: dbError.message,
        context
      });
    }
  }

  // Check if error frequency exceeds alert thresholds
  async checkAlertThresholds(category, severity) {
    try {
      const timeWindows = {
        critical: 1,    // 1 minute
        high: 10,       // 10 minutes
        medium: 30,     // 30 minutes
        low: 60         // 60 minutes
      };

      const window = timeWindows[severity] || 30;
      const threshold = this.errorThresholds[severity] || 10;

      const result = await pool.query(`
        SELECT COUNT(*) as error_count
        FROM error_logs
        WHERE category = $1 
          AND severity = $2 
          AND occurred_at >= NOW() - INTERVAL '${window} minutes'
      `, [category, severity]);

      const errorCount = parseInt(result.rows[0].error_count);

      if (errorCount >= threshold) {
        await this.sendAlert(category, severity, errorCount, window);
      }
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to check alert thresholds', {
        error: error.message
      });
    }
  }

  // Send alert (implement your preferred alerting method)
  async sendAlert(category, severity, count, timeWindow) {
    const alertMessage = `🚨 Error Alert: ${count} ${severity} errors in ${category} category within ${timeWindow} minutes`;
    
    // Log the alert
    logger.error(LogCategory.SECURITY, alertMessage, {
      category,
      severity,
      count,
      timeWindow,
      alert: true
    });

    // Here you could integrate with:
    // - Slack notifications
    // - Email alerts
    // - SMS alerts
    // - PagerDuty
    // - Discord webhooks
    
    console.error(alertMessage);
  }

  // Get error statistics
  async getErrorStats(hours = 24) {
    try {
      const stats = await pool.query(`
        SELECT 
          category,
          severity,
          COUNT(*) as count,
          SUM(occurrence_count) as total_occurrences,
          MIN(first_seen) as first_seen,
          MAX(last_seen) as last_seen
        FROM error_logs
        WHERE occurred_at >= NOW() - INTERVAL '${hours} hours'
        GROUP BY category, severity
        ORDER BY total_occurrences DESC
      `);

      const summary = await pool.query(`
        SELECT 
          COUNT(*) as unique_errors,
          SUM(occurrence_count) as total_occurrences,
          COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_errors,
          COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_errors,
          COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_errors,
          COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_errors
        FROM error_logs
        WHERE occurred_at >= NOW() - INTERVAL '${hours} hours'
      `);

      return {
        summary: summary.rows[0],
        breakdown: stats.rows,
        timeWindow: `${hours} hours`
      };
    } catch (error) {
      logger.error(LogCategory.DATABASE, 'Failed to get error stats', {
        error: error.message
      });
      return null;
    }
  }

  // Get recent critical errors
  async getCriticalErrors(limit = 10) {
    try {
      const result = await pool.query(`
        SELECT *
        FROM error_logs
        WHERE severity = 'critical'
          AND resolved = FALSE
        ORDER BY last_seen DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      logger.error(LogCategory.DATABASE, 'Failed to get critical errors', {
        error: error.message
      });
      return [];
    }
  }

  // Mark error as resolved
  async resolveError(errorId, resolutionNotes = null) {
    try {
      await pool.query(`
        UPDATE error_logs
        SET resolved = TRUE,
            resolution_notes = $1
        WHERE error_id = $2
      `, [resolutionNotes, errorId]);

      logger.info(LogCategory.GENERAL, `Error resolved: ${errorId}`, {
        errorId,
        resolutionNotes
      });
    } catch (error) {
      logger.error(LogCategory.DATABASE, 'Failed to resolve error', {
        errorId,
        error: error.message
      });
    }
  }

  // Clean old resolved errors
  async cleanOldErrors(daysToKeep = 30) {
    try {
      const result = await pool.query(`
        DELETE FROM error_logs
        WHERE resolved = TRUE
          AND occurred_at < NOW() - INTERVAL '${daysToKeep} days'
      `);

      logger.info(LogCategory.GENERAL, `Cleaned ${result.rowCount} old resolved errors`);
      return result.rowCount;
    } catch (error) {
      logger.error(LogCategory.DATABASE, 'Failed to clean old errors', {
        error: error.message
      });
      return 0;
    }
  }
}

// Create singleton instance
export const errorMonitoring = new ErrorMonitoringService();

// Express middleware for automatic error monitoring
export const errorMonitoringMiddleware = (error, req, res, next) => {
  const context = {
    userId: req.session?.userId,
    sessionId: req.sessionID,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    url: req.originalUrl,
    method: req.method,
    metadata: {
      body: req.body,
      params: req.params,
      query: req.query
    }
  };

  // Record error asynchronously to not block response
  setImmediate(() => {
    errorMonitoring.recordError(error, context);
  });

  next(error);
};

export { ErrorCategory, ErrorSeverity };
export default errorMonitoring;