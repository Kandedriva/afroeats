import { logger, LogCategory } from '../services/logger.js';
import pool from '../db.js';

// Performance metrics collection
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.slowQueryThreshold = 1000; // 1 second
    this.slowRequestThreshold = 2000; // 2 seconds
    this.initializeDatabase();
  }

  async initializeDatabase() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS performance_metrics (
          id SERIAL PRIMARY KEY,
          metric_type VARCHAR(50) NOT NULL,
          metric_name VARCHAR(100) NOT NULL,
          value NUMERIC NOT NULL,
          unit VARCHAR(20) DEFAULT 'ms',
          metadata JSONB DEFAULT '{}',
          recorded_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON performance_metrics(metric_type);
        CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded_at ON performance_metrics(recorded_at);
      `);

      console.log('✅ Performance monitoring database initialized');
    } catch (error) {
      console.error('❌ Failed to initialize performance monitoring:', error);
    }
  }

  // Record performance metric
  async recordMetric(type, name, value, unit = 'ms', metadata = {}) {
    try {
      await pool.query(`
        INSERT INTO performance_metrics (metric_type, metric_name, value, unit, metadata)
        VALUES ($1, $2, $3, $4, $5)
      `, [type, name, value, unit, JSON.stringify(metadata)]);

      logger.logPerformanceMetric(name, value, unit, { type, ...metadata });
    } catch (error) {
      logger.error(LogCategory.PERFORMANCE, 'Failed to record performance metric', {
        type, name, value, unit, error: error.message
      });
    }
  }

  // Get performance statistics
  async getStats(hours = 24) {
    try {
      const stats = await pool.query(`
        SELECT 
          metric_type,
          metric_name,
          COUNT(*) as count,
          AVG(value) as avg_value,
          MIN(value) as min_value,
          MAX(value) as max_value,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value) as median,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) as p95,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY value) as p99
        FROM performance_metrics
        WHERE recorded_at >= NOW() - INTERVAL '${hours} hours'
        GROUP BY metric_type, metric_name
        ORDER BY metric_type, avg_value DESC
      `);

      return stats.rows;
    } catch (error) {
      logger.error(LogCategory.PERFORMANCE, 'Failed to get performance stats', {
        error: error.message
      });
      return [];
    }
  }

  // Clean old metrics
  async cleanOldMetrics(daysToKeep = 7) {
    try {
      const result = await pool.query(`
        DELETE FROM performance_metrics
        WHERE recorded_at < NOW() - INTERVAL '${daysToKeep} days'
      `);

      logger.info(LogCategory.PERFORMANCE, `Cleaned ${result.rowCount} old performance metrics`);
      return result.rowCount;
    } catch (error) {
      logger.error(LogCategory.PERFORMANCE, 'Failed to clean old metrics', {
        error: error.message
      });
      return 0;
    }
  }
}

const performanceMonitor = new PerformanceMonitor();

// Request performance monitoring middleware
export const requestPerformanceMiddleware = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();

  res.on('finish', async () => {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;

    const metadata = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      contentLength: res.get('content-length') || 0,
      memoryDelta: memoryDelta,
      userId: req.session?.userId
    };

    // Record request duration
    await performanceMonitor.recordMetric(
      'request',
      `${req.method} ${req.route?.path || req.originalUrl}`,
      duration,
      'ms',
      metadata
    );

    // Log slow requests
    if (duration > performanceMonitor.slowRequestThreshold) {
      logger.warn(LogCategory.PERFORMANCE, `Slow request detected: ${duration}ms`, metadata);
    }
  });

  next();
};

// Database query performance monitoring
export const queryPerformanceWrapper = (originalQuery) => {
  return async function performanceWrappedQuery(...args) {
    const startTime = process.hrtime.bigint();
    const query = args[0];
    
    try {
      const result = await originalQuery.apply(this, args);
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      // Record query performance
      const queryType = query.trim().split(' ')[0].toUpperCase();
      await performanceMonitor.recordMetric(
        'database',
        `${queryType}_query`,
        duration,
        'ms',
        {
          query: query.substring(0, 200), // Truncate long queries
          rowCount: result.rowCount
        }
      );

      // Log slow queries
      if (duration > performanceMonitor.slowQueryThreshold) {
        logger.warn(LogCategory.PERFORMANCE, `Slow query detected: ${duration}ms`, {
          query: query.substring(0, 500),
          duration
        });
      }

      return result;
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      logger.error(LogCategory.DATABASE, `Query failed after ${duration}ms`, {
        query: query.substring(0, 500),
        error: error.message,
        duration
      });

      throw error;
    }
  };
};

// Memory usage monitoring
export const memoryMonitoringMiddleware = (req, res, next) => {
  const memUsage = process.memoryUsage();
  const memoryMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };

  // Record memory metrics periodically (every 100 requests)
  if (Math.random() < 0.01) { // 1% of requests
    performanceMonitor.recordMetric('system', 'memory_heap_used', memoryMB.heapUsed, 'MB');
    performanceMonitor.recordMetric('system', 'memory_rss', memoryMB.rss, 'MB');
  }

  // Warn about high memory usage
  if (memoryMB.heapUsed > 500) { // More than 500MB
    logger.warn(LogCategory.PERFORMANCE, 'High memory usage detected', memoryMB);
  }

  next();
};

// CPU monitoring
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();

export const cpuMonitoringMiddleware = (req, res, next) => {
  // Monitor CPU usage periodically (every 50 requests)
  if (Math.random() < 0.02) { // 2% of requests
    const currentCpuUsage = process.cpuUsage(lastCpuUsage);
    const currentTime = Date.now();
    const timeDiff = currentTime - lastCpuTime;

    if (timeDiff > 1000) { // Only calculate if more than 1 second has passed
      const cpuPercent = {
        user: (currentCpuUsage.user / 1000 / timeDiff) * 100,
        system: (currentCpuUsage.system / 1000 / timeDiff) * 100
      };

      performanceMonitor.recordMetric('system', 'cpu_user', cpuPercent.user, '%');
      performanceMonitor.recordMetric('system', 'cpu_system', cpuPercent.system, '%');

      // Warn about high CPU usage
      const totalCpu = cpuPercent.user + cpuPercent.system;
      if (totalCpu > 80) {
        logger.warn(LogCategory.PERFORMANCE, 'High CPU usage detected', {
          user: cpuPercent.user,
          system: cpuPercent.system,
          total: totalCpu
        });
      }

      lastCpuUsage = process.cpuUsage();
      lastCpuTime = currentTime;
    }
  }

  next();
};

// Response compression middleware (optimize payload size)
export const compressionOptimizationMiddleware = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function optimizedJson(data) {
    const startTime = Date.now();
    const originalSize = JSON.stringify(data).length;
    
    // Remove null/undefined values to reduce payload size
    const cleanData = removeNullUndefined(data);
    const optimizedSize = JSON.stringify(cleanData).length;
    
    const compressionTime = Date.now() - startTime;
    const compressionRatio = originalSize > 0 ? (1 - optimizedSize / originalSize) * 100 : 0;

    if (compressionRatio > 10 || originalSize > 10000) { // Log significant compressions or large payloads
      performanceMonitor.recordMetric('compression', 'response_optimization', compressionTime, 'ms', {
        originalSize,
        optimizedSize,
        compressionRatio: Math.round(compressionRatio),
        url: req.originalUrl
      });
    }

    return originalJson.call(this, cleanData);
  };

  next();
};

// Helper function to remove null/undefined values
function removeNullUndefined(obj) {
  if (Array.isArray(obj)) {
    return obj.map(removeNullUndefined).filter(item => item !== null && item !== undefined);
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = removeNullUndefined(value);
      }
    }
    return cleaned;
  }
  return obj;
}

// Health check with performance metrics
export const performanceHealthCheck = async () => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    performance: {
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: Math.round(process.uptime()),
      pid: process.pid
    }
  };
};

export { performanceMonitor };
export default performanceMonitor;