import express from 'express';
import bcryptjs from 'bcryptjs';
import pool from '../db.js';
import { AnalyticsService } from '../services/analytics.js';
import { getQueueStats } from '../services/queue.js';
import { cache } from '../utils/cache.js';
import { rateLimits, validators, handleValidationErrors } from '../middleware/security.js';

const router = express.Router();

// Admin authentication middleware
const requireAdminAuth = async (req, res, next) => {
  try {
    if (!req.session.adminId) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    
    // Verify admin still exists and is active
    const adminResult = await pool.query(
      'SELECT id, username, role, is_active FROM platform_admins WHERE id = $1 AND is_active = true',
      [req.session.adminId]
    );
    
    if (adminResult.rows.length === 0) {
      req.session.destroy();
      return res.status(401).json({ error: 'Admin account not found or inactive' });
    }
    
    req.admin = adminResult.rows[0];
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Admin login
router.post('/login', rateLimits.auth, [
  validators.email,
  validators.adminPassword,
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check if admin exists
    const adminResult = await pool.query(
      'SELECT * FROM platform_admins WHERE email = $1 AND is_active = true',
      [email]
    );
    
    if (adminResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid credentials'
      });
    }
    
    const admin = adminResult.rows[0];
    
    // Verify password
    const isValidPassword = await bcryptjs.compare(password, admin.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Invalid credentials'
      });
    }
    
    // Set session
    req.session.adminId = admin.id;
    req.session.adminRole = admin.role;
    
    // Update last login
    await pool.query(
      'UPDATE platform_admins SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2',
      [req.ip, admin.id]
    );
    
    res.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current admin info
router.get('/me', requireAdminAuth, async (req, res) => {
  try {
    res.json({
      id: req.admin.id,
      username: req.admin.username,
      email: req.admin.email || 'No email',
      role: req.admin.role
    });
  } catch (error) {
    console.error('Get admin info error:', error);
    res.status(500).json({ error: 'Failed to get admin info' });
  }
});

// Admin logout
router.post('/logout', requireAdminAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Get dashboard overview
router.get('/dashboard', requireAdminAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Get real-time metrics
    const realTimeMetrics = await AnalyticsService.getRealTimeMetrics();
    
    // Get database counts (adapted for current schema)
    const countsResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE) as users_today,
        (SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as users_this_week,
        (SELECT COUNT(*) FROM restaurants) as total_restaurants,
        (SELECT 0) as restaurants_today,
        (SELECT 0) as restaurants_this_week,
        (SELECT COUNT(*) FROM orders WHERE status IN ('paid', 'completed')) as total_orders,
        (SELECT COUNT(*) FROM orders WHERE status IN ('paid', 'completed') AND created_at >= CURRENT_DATE) as orders_today,
        (SELECT COUNT(*) FROM orders WHERE status IN ('paid', 'completed') AND created_at >= CURRENT_DATE - INTERVAL '7 days') as orders_this_week,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status IN ('paid', 'completed')) as total_revenue,
        (SELECT COALESCE(SUM(total), 0) FROM orders WHERE status IN ('paid', 'completed') AND created_at >= CURRENT_DATE) as revenue_today,
        (SELECT COALESCE(SUM(platform_fee), 0) FROM orders WHERE status IN ('paid', 'completed')) as total_platform_fees,
        (SELECT COALESCE(SUM(platform_fee), 0) FROM orders WHERE status IN ('paid', 'completed') AND created_at >= CURRENT_DATE) as platform_fees_today
    `);
    
    const counts = countsResult.rows[0];
    
    // Get queue stats
    const queueStats = await getQueueStats();
    
    // Get top restaurants
    const topRestaurants = await AnalyticsService.getTopRestaurants(5);
    
    // Calculate growth rates
    const yesterdayVisitors = await cache.scard(`analytics:unique_visitors:${yesterday}`);
    const todayVisitors = realTimeMetrics.visitors_today;
    const visitorGrowth = yesterdayVisitors > 0 
      ? (((todayVisitors - yesterdayVisitors) / yesterdayVisitors) * 100).toFixed(1)
      : 0;
    
    const dashboard = {
      overview: {
        total_users: parseInt(counts.total_users),
        users_today: parseInt(counts.users_today),
        users_this_week: parseInt(counts.users_this_week),
        total_restaurants: parseInt(counts.total_restaurants),
        restaurants_today: parseInt(counts.restaurants_today),
        restaurants_this_week: parseInt(counts.restaurants_this_week),
        total_orders: parseInt(counts.total_orders),
        orders_today: parseInt(counts.orders_today),
        orders_this_week: parseInt(counts.orders_this_week),
        total_revenue: parseFloat(counts.total_revenue),
        revenue_today: parseFloat(counts.revenue_today),
        total_platform_fees: parseFloat(counts.total_platform_fees),
        platform_fees_today: parseFloat(counts.platform_fees_today)
      },
      realtime: {
        ...realTimeMetrics,
        visitor_growth: visitorGrowth
      },
      top_restaurants: topRestaurants,
      system: {
        queues: queueStats,
        cache_status: 'connected', // You could add actual Redis health check
        database_status: 'connected'
      }
    };
    
    res.json(dashboard);
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// Get detailed analytics
router.get('/analytics', requireAdminAuth, async (req, res) => {
  try {
    const { start_date, end_date, period = '7' } = req.query;
    
    const endDate = end_date || new Date().toISOString().split('T')[0];
    const startDate = start_date || new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const analytics = await AnalyticsService.getAnalytics(startDate, endDate);
    const userGrowth = await AnalyticsService.getUserGrowth(parseInt(period));
    
    res.json({
      analytics,
      user_growth: userGrowth,
      period: { start: startDate, end: endDate }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// Get users list with pagination
router.get('/users', requireAdminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = 'all' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (search) {
      paramCount++;
      whereClause += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    if (status !== 'all') {
      paramCount++;
      whereClause += ` AND (CASE WHEN $${paramCount} = 'active' THEN created_at IS NOT NULL ELSE created_at IS NULL END)`;
      params.push(status);
    }
    
    // Get users with order statistics
    const usersResult = await pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.created_at,
        u.address,
        u.phone,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total), 0) as total_spent,
        MAX(o.created_at) as last_order_date
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id AND o.status IN ('paid', 'completed')
      ${whereClause}
      GROUP BY u.id, u.name, u.email, u.created_at, u.address, u.phone
      ORDER BY u.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, limit, offset]);
    
    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      ${whereClause}
    `, params);
    
    res.json({
      users: usersResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// Get restaurants list with pagination
router.get('/restaurants', requireAdminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', status = 'all' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (search) {
      paramCount++;
      whereClause += ` AND (r.name ILIKE $${paramCount} OR ro.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }
    
    // Get restaurants with statistics (simplified for current schema)
    const restaurantsResult = await pool.query(`
      SELECT 
        r.id,
        r.name,
        r.address,
        r.phone_number,
        r.image_url,
        ro.name as owner_name,
        ro.email as owner_email,
        COALESCE(
          (SELECT COUNT(*) FROM dishes d WHERE d.restaurant_id = r.id), 
          0
        ) as total_dishes,
        COALESCE(
          (SELECT COUNT(*) FROM orders o 
           JOIN order_items oi ON o.id = oi.order_id 
           JOIN dishes d ON oi.dish_id = d.id 
           WHERE d.restaurant_id = r.id AND o.status IN ('paid', 'completed')), 
          0
        ) as total_orders
      FROM restaurants r
      JOIN restaurant_owners ro ON r.owner_id = ro.id
      ${whereClause}
      ORDER BY r.name
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, limit, offset]);
    
    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(DISTINCT r.id) as total
      FROM restaurants r
      JOIN restaurant_owners ro ON r.owner_id = ro.id
      ${whereClause}
    `, params);
    
    res.json({
      restaurants: restaurantsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Restaurants list error:', error);
    res.status(500).json({ error: 'Failed to load restaurants' });
  }
});

// Get orders list with pagination and filters
router.get('/orders', requireAdminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all', period = '30' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (status !== 'all') {
      paramCount++;
      whereClause += ` AND o.status = $${paramCount}`;
      params.push(status);
    }
    
    if (period !== 'all') {
      paramCount++;
      whereClause += ` AND o.created_at >= CURRENT_DATE - INTERVAL '${parseInt(period)} days'`;
    }
    
    // Get orders with details
    const ordersResult = await pool.query(`
      SELECT 
        o.id,
        o.total,
        o.platform_fee,
        o.status,
        o.delivery_type,
        o.created_at,
        o.paid_at,
        u.name as customer_name,
        u.email as customer_email,
        COUNT(DISTINCT oi.id) as total_items,
        COUNT(DISTINCT r.id) as restaurants_count,
        STRING_AGG(DISTINCT r.name, ', ') as restaurant_names
      FROM orders o
      JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN restaurants r ON r.id = COALESCE(oi.restaurant_id, (SELECT restaurant_id FROM dishes WHERE id = oi.dish_id))
      ${whereClause}
      GROUP BY o.id, o.total, o.platform_fee, o.status, o.delivery_type, o.created_at, o.paid_at, u.name, u.email
      ORDER BY o.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, limit, offset]);
    
    // Get total count and revenue
    const summaryResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total), 0) as total_revenue,
        COALESCE(SUM(o.platform_fee), 0) as total_fees
      FROM orders o
      JOIN users u ON o.user_id = u.id
      ${whereClause}
    `, params);
    
    res.json({
      orders: ordersResult.rows,
      summary: summaryResult.rows[0],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(summaryResult.rows[0].total_orders),
        pages: Math.ceil(summaryResult.rows[0].total_orders / limit)
      }
    });
  } catch (error) {
    console.error('Orders list error:', error);
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

// Get system health and monitoring
router.get('/system', requireAdminAuth, async (req, res) => {
  try {
    // Database health check
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    const dbLatency = Date.now() - dbStart;
    
    // Redis health check
    const redisStart = Date.now();
    await cache.set('health_check', 'ok', 10);
    const redisLatency = Date.now() - redisStart;
    
    // Get queue statistics
    const queueStats = await getQueueStats();
    
    // Get recent error logs (you would implement error logging)
    const recentErrors = []; // Implement error log retrieval
    
    // Get system metrics
    const systemMetrics = {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      version: process.version,
      platform: process.platform
    };
    
    res.json({
      status: 'healthy',
      database: {
        status: 'connected',
        latency: dbLatency
      },
      redis: {
        status: 'connected',
        latency: redisLatency
      },
      queues: queueStats,
      system: systemMetrics,
      recent_errors: recentErrors,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('System health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get platform settings (for future use)
router.get('/settings', requireAdminAuth, async (req, res) => {
  try {
    const settingsResult = await pool.query(`
      SELECT key, value, description, category 
      FROM platform_settings 
      ORDER BY category, key
    `);
    
    const settings = settingsResult.rows.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = {};
      }
      acc[setting.category][setting.key] = {
        value: setting.value,
        description: setting.description
      };
      return acc;
    }, {});
    
    res.json(settings);
  } catch (error) {
    // If settings table doesn't exist, return defaults
    res.json({
      general: {
        platform_name: { value: 'A Food Zone', description: 'Platform name' },
        platform_fee_rate: { value: '5.0', description: 'Platform fee percentage' }
      },
      email: {
        smtp_enabled: { value: 'false', description: 'Enable email sending' }
      }
    });
  }
});

export default router;