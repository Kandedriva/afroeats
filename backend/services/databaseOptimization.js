import pool from '../db.js';
import { logger, LogCategory } from './logger.js';

class DatabaseOptimizationService {
  constructor() {
    this.slowQueryThreshold = 1000; // 1 second
    this.connectionWarningThreshold = 15; // 15 active connections
    this.cacheHitRatioThreshold = 0.95; // 95% cache hit ratio
  }

  // Wrap pool.query with performance monitoring
  async queryWithMonitoring(text, params = []) {
    const startTime = process.hrtime.bigint();
    const queryId = this.generateQueryId(text);
    
    try {
      const result = await pool.query(text, params);
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      // Log slow queries
      if (duration > this.slowQueryThreshold) {
        logger.warn(LogCategory.DATABASE, `Slow query detected: ${duration}ms`, {
          queryId,
          query: text.substring(0, 500),
          duration,
          rowCount: result.rowCount
        });
      }

      // Log query performance metrics
      logger.debug(LogCategory.DATABASE, `Query executed: ${duration}ms`, {
        queryId,
        duration,
        rowCount: result.rowCount,
        command: this.getQueryCommand(text)
      });

      return result;
    } catch (error) {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;

      logger.error(LogCategory.DATABASE, `Query failed after ${duration}ms`, {
        queryId,
        query: text.substring(0, 500),
        error: error.message,
        duration,
        sqlState: error.code
      });

      throw error;
    }
  }

  // Generate unique query ID for tracking
  generateQueryId(query) {
    const normalized = query.replace(/\s+/g, ' ').trim().substring(0, 100);
    return Buffer.from(normalized).toString('base64').substring(0, 16);
  }

  // Extract query command (SELECT, INSERT, etc.)
  getQueryCommand(query) {
    return query.trim().split(' ')[0].toUpperCase();
  }

  // Monitor database health
  async checkDatabaseHealth() {
    try {
      const checks = await Promise.all([
        this.checkConnectionPool(),
        this.checkCacheHitRatio(),
        this.checkLockWaits(),
        this.checkTableSizes(),
        this.checkSlowQueries(),
        this.checkIndexUsage()
      ]);

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          connectionPool: checks[0],
          cacheHitRatio: checks[1],
          lockWaits: checks[2],
          tableSizes: checks[3],
          slowQueries: checks[4],
          indexUsage: checks[5]
        }
      };

      // Determine overall health
      const hasWarnings = checks.some(check => check.status === 'warning');
      const hasErrors = checks.some(check => check.status === 'error');

      if (hasErrors) {
        health.status = 'unhealthy';
      } else if (hasWarnings) {
        health.status = 'degraded';
      }

      return health;
    } catch (error) {
      logger.error(LogCategory.DATABASE, 'Database health check failed', {
        error: error.message
      });

      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  // Check connection pool status
  async checkConnectionPool() {
    try {
      const result = await pool.query(`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `);

      const stats = result.rows[0];
      const activeConnections = parseInt(stats.active_connections);
      const totalConnections = parseInt(stats.total_connections);

      let status = 'healthy';
      if (activeConnections > this.connectionWarningThreshold) {
        status = 'warning';
        logger.warn(LogCategory.DATABASE, `High connection count: ${activeConnections}`, stats);
      }

      return {
        status,
        message: `${activeConnections} active connections`,
        data: {
          total: totalConnections,
          active: activeConnections,
          idle: parseInt(stats.idle_connections)
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Connection pool check failed',
        error: error.message
      };
    }
  }

  // Check cache hit ratio
  async checkCacheHitRatio() {
    try {
      const result = await pool.query(`
        SELECT 
          round(
            (sum(blks_hit) * 100.0 / nullif(sum(blks_hit + blks_read), 0))::numeric, 
            2
          ) as cache_hit_ratio
        FROM pg_stat_database
        WHERE datname = current_database()
      `);

      const ratio = parseFloat(result.rows[0].cache_hit_ratio) / 100;
      let status = 'healthy';

      if (ratio < this.cacheHitRatioThreshold) {
        status = 'warning';
        logger.warn(LogCategory.DATABASE, `Low cache hit ratio: ${ratio * 100}%`);
      }

      return {
        status,
        message: `${(ratio * 100).toFixed(2)}% cache hit ratio`,
        data: { ratio }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Cache hit ratio check failed',
        error: error.message
      };
    }
  }

  // Check for lock waits
  async checkLockWaits() {
    try {
      const result = await pool.query(`
        SELECT count(*) as waiting_locks
        FROM pg_stat_activity 
        WHERE wait_event_type = 'Lock' 
        AND state = 'active'
      `);

      const waitingLocks = parseInt(result.rows[0].waiting_locks);
      let status = 'healthy';

      if (waitingLocks > 0) {
        status = 'warning';
        logger.warn(LogCategory.DATABASE, `${waitingLocks} queries waiting for locks`);
      }

      return {
        status,
        message: `${waitingLocks} waiting locks`,
        data: { waitingLocks }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Lock wait check failed',
        error: error.message
      };
    }
  }

  // Check table sizes
  async checkTableSizes() {
    try {
      const result = await pool.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10
      `);

      const largestTable = result.rows[0];
      const totalSize = result.rows.reduce((sum, row) => sum + parseInt(row.size_bytes), 0);

      return {
        status: 'healthy',
        message: `Largest table: ${largestTable?.tablename} (${largestTable?.size})`,
        data: {
          totalSize: this.formatBytes(totalSize),
          tables: result.rows.slice(0, 5).map(row => ({
            name: row.tablename,
            size: row.size
          }))
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Table size check failed',
        error: error.message
      };
    }
  }

  // Check for slow queries using pg_stat_statements
  async checkSlowQueries() {
    try {
      const result = await pool.query(`
        SELECT 
          round(mean_exec_time::numeric, 2) as avg_time_ms,
          calls,
          round(total_exec_time::numeric, 2) as total_time_ms,
          left(query, 100) as query_sample
        FROM pg_stat_statements 
        WHERE mean_exec_time > $1
        ORDER BY mean_exec_time DESC
        LIMIT 5
      `, [this.slowQueryThreshold]);

      const slowQueries = result.rows;
      let status = slowQueries.length > 0 ? 'warning' : 'healthy';

      if (slowQueries.length > 0) {
        logger.warn(LogCategory.DATABASE, `Found ${slowQueries.length} slow query patterns`);
      }

      return {
        status,
        message: `${slowQueries.length} slow query patterns found`,
        data: { slowQueries }
      };
    } catch (error) {
      // pg_stat_statements might not be enabled
      return {
        status: 'info',
        message: 'Query statistics not available (pg_stat_statements not enabled)',
        error: error.message
      };
    }
  }

  // Check index usage
  async checkIndexUsage() {
    try {
      const result = await pool.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan as times_used,
          pg_size_pretty(pg_relation_size(indexrelid)) as index_size
        FROM pg_stat_user_indexes 
        WHERE idx_scan = 0 
        AND schemaname = 'public'
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 10
      `);

      const unusedIndexes = result.rows;
      let status = 'healthy';

      if (unusedIndexes.length > 0) {
        status = 'info';
        logger.info(LogCategory.DATABASE, `Found ${unusedIndexes.length} unused indexes`);
      }

      return {
        status,
        message: `${unusedIndexes.length} unused indexes found`,
        data: { unusedIndexes }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Index usage check failed',
        error: error.message
      };
    }
  }

  // Optimize specific queries with caching
  async getCachedRestaurants() {
    const cacheKey = 'restaurants_with_dishes';
    const cachedData = await this.getFromCache(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    const query = `
      SELECT 
        r.id, r.name, r.address, r.phone_number, r.image_url,
        ro.name as owner_name,
        r.created_at,
        COUNT(d.id) as dish_count,
        COUNT(CASE WHEN d.is_available THEN 1 END) as available_dishes
      FROM restaurants r
      LEFT JOIN restaurant_owners ro ON r.owner_id = ro.id
      LEFT JOIN dishes d ON r.id = d.restaurant_id
      GROUP BY r.id, r.name, r.address, r.phone_number, r.image_url, ro.name, r.created_at
      ORDER BY r.created_at DESC
    `;

    const result = await this.queryWithMonitoring(query);
    
    // Cache for 5 minutes
    await this.setCache(cacheKey, result.rows, 300);
    
    return result.rows;
  }

  // Simple in-memory cache (in production, use Redis)
  cache = new Map();

  async getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  async setCache(key, data, ttlSeconds) {
    this.cache.set(key, {
      data,
      expires: Date.now() + (ttlSeconds * 1000)
    });
  }

  // Format bytes for display
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Maintenance operations
  async runMaintenance() {
    try {
      logger.info(LogCategory.DATABASE, 'Starting database maintenance');

      // Update table statistics
      await pool.query('ANALYZE');
      logger.info(LogCategory.DATABASE, 'Table statistics updated');

      // Refresh materialized views if they exist
      try {
        await pool.query('REFRESH MATERIALIZED VIEW restaurant_analytics');
        logger.info(LogCategory.DATABASE, 'Materialized views refreshed');
      } catch (error) {
        // Materialized view might not exist
        logger.debug(LogCategory.DATABASE, 'No materialized views to refresh');
      }

      // Clear old performance metrics (keep 7 days)
      const cleanupResult = await pool.query(`
        DELETE FROM performance_metrics 
        WHERE recorded_at < NOW() - INTERVAL '7 days'
      `);
      
      if (cleanupResult.rowCount > 0) {
        logger.info(LogCategory.DATABASE, `Cleaned up ${cleanupResult.rowCount} old performance metrics`);
      }

      logger.info(LogCategory.DATABASE, 'Database maintenance completed');
    } catch (error) {
      logger.error(LogCategory.DATABASE, 'Database maintenance failed', {
        error: error.message
      });
    }
  }
}

// Create singleton instance
export const dbOptimization = new DatabaseOptimizationService();

// Export optimized query wrapper
export const optimizedQuery = dbOptimization.queryWithMonitoring.bind(dbOptimization);

export default dbOptimization;