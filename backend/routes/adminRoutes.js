import express from 'express';
import bcryptjs from 'bcryptjs';
import pool from '../db.js';
import { AnalyticsService } from '../services/analytics.js';
import { getQueueStats } from '../services/queue.js';
import { cache } from '../utils/cache.js';
import { rateLimits, validators, handleValidationErrors } from '../middleware/security.js';
import { logger } from '../services/logger.js';

const router = express.Router();

// Admin authentication middleware
const requireAdminAuth = async (req, res, next) => {
  try {
    if (!req.session.adminId) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    
    // Verify admin still exists and is active
    const adminResult = await pool.query(
      'SELECT id, username, email, role, is_active FROM platform_admins WHERE id = $1 AND is_active = true',
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

// Get single order by ID (for demo checkout and admin use)
router.get('/orders/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get order with details and items
    const orderResult = await pool.query(`
      SELECT 
        o.*,
        u.name as customer_name,
        u.email as customer_email,
        COUNT(DISTINCT oi.id) as total_items,
        COUNT(DISTINCT r.id) as restaurants_count,
        STRING_AGG(DISTINCT r.name, ', ') as restaurant_names
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN restaurants r ON r.id = COALESCE(oi.restaurant_id, (SELECT restaurant_id FROM dishes WHERE id = oi.dish_id))
      WHERE o.id = $1
      GROUP BY o.id, u.name, u.email
    `, [id]);
    
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Get order items with restaurant info
    const itemsResult = await pool.query(`
      SELECT 
        oi.*,
        r.name as restaurant_name,
        r.phone_number as restaurant_phone
      FROM order_items oi
      LEFT JOIN restaurants r ON oi.restaurant_id = r.id
      WHERE oi.order_id = $1
      ORDER BY oi.id
    `, [id]);
    
    const order = orderResult.rows[0];
    order.items = itemsResult.rows;
    
    res.json(order);
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({ error: 'Failed to get order details' });
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

// Get support messages for admin dashboard
router.get('/support-messages', requireAdminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all', priority = 'all' } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (status !== 'all') {
      paramCount++;
      whereClause += ` AND sm.status = $${paramCount}`;
      params.push(status);
    }
    
    if (priority !== 'all') {
      paramCount++;
      whereClause += ` AND sm.priority = $${paramCount}`;
      params.push(priority);
    }
    
    // Get support messages with user details
    const messagesResult = await pool.query(`
      SELECT 
        sm.id,
        sm.user_id,
        sm.user_email,
        sm.user_phone,
        sm.subject,
        sm.message,
        sm.status,
        sm.priority,
        sm.admin_response,
        sm.admin_id,
        sm.created_at,
        sm.updated_at,
        sm.responded_at,
        u.name as user_name,
        a.username as admin_username
      FROM support_messages sm
      LEFT JOIN users u ON sm.user_id = u.id
      LEFT JOIN platform_admins a ON sm.admin_id = a.id
      ${whereClause}
      ORDER BY 
        CASE sm.priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END,
        sm.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, limit, offset]);
    
    // Get total count and status summary
    const countResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'viewed' THEN 1 END) as viewed,
        COUNT(CASE WHEN status = 'responded' THEN 1 END) as responded,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed
      FROM support_messages sm
      ${whereClause}
    `, params);
    
    res.json({
      messages: messagesResult.rows,
      summary: countResult.rows[0],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      }
    });
  } catch (error) {
    logger.error('Support messages list error:', error);
    res.status(500).json({ error: 'Failed to load support messages' });
  }
});

// Update support message status and response
router.put('/support-messages/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, admin_response } = req.body;
    
    // Validation
    const validStatuses = ['pending', 'in_progress', 'viewed', 'responded', 'resolved', 'closed'];
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      values.push(status);
    }
    
    if (priority) {
      paramCount++;
      updates.push(`priority = $${paramCount}`);
      values.push(priority);
    }
    
    if (admin_response !== undefined) {
      paramCount++;
      updates.push(`admin_response = $${paramCount}`);
      values.push(admin_response);
      
      paramCount++;
      updates.push(`admin_id = $${paramCount}`);
      values.push(req.admin.id);
      
      // Set responded_at and change status to 'responded' if providing a response
      if (admin_response && admin_response.trim()) {
        updates.push(`responded_at = CURRENT_TIMESTAMP`);
        // Auto-change status to 'responded' if not already set
        if (!status) {
          paramCount++;
          updates.push(`status = $${paramCount}`);
          values.push('responded');
        }
      }
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    
    paramCount++;
    values.push(id);
    
    const query = `
      UPDATE support_messages 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Support message not found' });
    }
    
    logger.info('Support message updated', { 
      messageId: id, 
      adminId: req.admin.id, 
      updates: { status, priority, hasResponse: !!admin_response } 
    });
    
    res.json({
      success: true,
      message: 'Support message updated successfully',
      supportMessage: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Error updating support message:', error);
    res.status(500).json({ error: 'Failed to update support message' });
  }
});

// Get support message statistics
router.get('/support-stats', requireAdminAuth, async (req, res) => {
  try {
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN status = 'viewed' THEN 1 END) as viewed_count,
        COUNT(CASE WHEN status = 'responded' THEN 1 END) as responded_count,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_count,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_count,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as today_count,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_count,
        AVG(CASE 
          WHEN responded_at IS NOT NULL AND created_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (responded_at - created_at))/3600 
        END) as avg_response_time_hours
      FROM support_messages
    `);
    
    res.json({
      success: true,
      stats: statsResult.rows[0]
    });
    
  } catch (error) {
    logger.error('Error fetching support stats:', error);
    res.status(500).json({ error: 'Failed to fetch support statistics' });
  }
});

// Delete support message
router.delete('/support-messages/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if the message exists
    const checkResult = await pool.query('SELECT id FROM support_messages WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Support message not found' });
    }
    
    // Delete the message
    await pool.query('DELETE FROM support_messages WHERE id = $1', [id]);
    
    logger.info('Support message deleted', { 
      messageId: id, 
      adminId: req.admin.id 
    });
    
    res.json({
      success: true,
      message: 'Support message deleted successfully'
    });
    
  } catch (error) {
    logger.error('Error deleting support message:', error);
    res.status(500).json({ error: 'Failed to delete support message' });
  }
});

// System quick actions
// Clear Redis cache
router.post('/system/clear-cache', requireAdminAuth, async (req, res) => {
  try {
    // Clear all Redis cache keys (be careful with this in production)
    await cache.flushall();
    
    logger.info('Redis cache cleared', { adminId: req.admin.id });
    
    res.json({
      success: true,
      message: 'Redis cache cleared successfully'
    });
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Generate system report
router.get('/system/report', requireAdminAuth, async (req, res) => {
  try {
    // Get current system status
    const systemHealthRes = await fetch(`${req.protocol}://${req.get('host')}/api/admin/system`, {
      headers: {
        'Cookie': req.headers.cookie
      }
    });
    const systemHealth = await systemHealthRes.json();

    // Get dashboard data
    const dashboardRes = await fetch(`${req.protocol}://${req.get('host')}/api/admin/dashboard`, {
      headers: {
        'Cookie': req.headers.cookie
      }
    });
    const dashboardData = await dashboardRes.json();

    const report = {
      generated_at: new Date().toISOString(),
      generated_by: req.admin.username,
      system_health: systemHealth,
      overview: dashboardData,
      summary: {
        total_users: dashboardData.overview.total_users,
        total_restaurants: dashboardData.overview.total_restaurants,
        total_orders: dashboardData.overview.total_orders,
        system_status: systemHealth.status,
        database_status: systemHealth.database.status,
        redis_status: systemHealth.redis.status
      }
    };
    
    logger.info('System report generated', { adminId: req.admin.id });
    
    res.json({
      success: true,
      report: report
    });
  } catch (error) {
    logger.error('Error generating system report:', error);
    res.status(500).json({ error: 'Failed to generate system report' });
  }
});

// Restart services (placeholder - in real production, this might restart specific services)
router.post('/system/restart', requireAdminAuth, async (req, res) => {
  try {
    // In a real system, you might restart specific services
    // For now, we'll just log the action and clear cache
    await cache.flushall();
    
    logger.warn('System restart requested', { adminId: req.admin.id });
    
    res.json({
      success: true,
      message: 'Services restart initiated. Cache cleared as part of restart process.'
    });
  } catch (error) {
    logger.error('Error restarting services:', error);
    res.status(500).json({ error: 'Failed to restart services' });
  }
});

// View system logs
router.get('/system/logs', requireAdminAuth, async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { limit = 100 } = req.query;
    
    const logsDir = path.join(process.cwd(), 'logs');
    const today = new Date().toISOString().split('T')[0];
    
    const logTypes = ['info', 'warn', 'error'];
    const logs = [];
    
    for (const type of logTypes) {
      const logFile = path.join(logsDir, `${today}-${type}.log`);
      try {
        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            if (line.trim()) {
              try {
                const logEntry = JSON.parse(line);
                logs.push({ ...logEntry, type });
              } catch {
                logs.push({ message: line, type, timestamp: new Date().toISOString() });
              }
            }
          });
        }
      } catch (err) {
        // Ignore file read errors
      }
    }
    
    // Sort by timestamp and limit
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const limitedLogs = logs.slice(0, parseInt(limit));
    
    logger.info('System logs viewed', { adminId: req.admin.id, logCount: limitedLogs.length });
    
    res.json({
      success: true,
      logs: limitedLogs,
      total_count: logs.length,
      returned_count: limitedLogs.length
    });
  } catch (error) {
    logger.error('Error retrieving system logs:', error);
    res.status(500).json({ error: 'Failed to retrieve system logs' });
  }
});

// Get restaurant contacts for admin
router.get('/restaurant-contacts', requireAdminAuth, async (req, res) => {
  try {
    const contactsResult = await pool.query(`
      SELECT 
        r.id,
        r.name,
        r.image_url,
        r.address,
        r.phone_number as phone,
        r.delivery_fee,
        ro.id as owner_id,
        ro.name as owner_name,
        ro.email as owner_email,
        ro.subscribed,
        ro.has_active_subscription,
        ro.is_subscribed,
        CASE 
          WHEN ro.id IS NOT NULL THEN true 
          ELSE false 
        END as is_active
      FROM restaurants r
      LEFT JOIN restaurant_owners ro ON r.owner_id = ro.id
      ORDER BY r.name ASC
    `);
    
    res.json({
      success: true,
      contacts: contactsResult.rows
    });
    
  } catch (error) {
    logger.error('Error fetching restaurant contacts:', error);
    res.status(500).json({ error: 'Failed to fetch restaurant contacts' });
  }
});

// ============================================
// DRIVER MANAGEMENT ENDPOINTS
// ============================================

/**
 * GET /api/admin/drivers
 * List all drivers with optional status filter
 * Query params: ?status=pending|approved|rejected|suspended|all
 */
router.get('/drivers', requireAdminAuth, async (req, res) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT
        d.id, d.name, d.email, d.phone,
        d.vehicle_type, d.vehicle_make, d.vehicle_model, d.vehicle_year,
        d.vehicle_color, d.license_plate,
        d.drivers_license_url, d.drivers_license_verified,
        d.approval_status, d.approved_at, d.rejection_reason,
        d.is_available, d.is_active,
        d.total_deliveries, d.completed_deliveries, d.cancelled_deliveries,
        d.average_rating, d.total_earnings,
        d.stripe_account_id, d.stripe_onboarding_complete,
        d.created_at, d.last_login_at
      FROM drivers d
    `;

    const params = [];
    if (status && status !== 'all') {
      query += ` WHERE d.approval_status = $1`;
      params.push(status);
    }

    query += ` ORDER BY d.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      drivers: result.rows
    });
  } catch (error) {
    logger.error('Error fetching drivers:', error);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

/**
 * GET /api/admin/drivers/:id
 * Get detailed driver information
 */
router.get('/drivers/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
        d.*,
        COUNT(DISTINCT dd.id) FILTER (WHERE dd.status = 'delivered') as successful_deliveries,
        COUNT(DISTINCT dd.id) FILTER (WHERE dd.status = 'cancelled') as cancelled_deliveries,
        AVG(dd.customer_rating) FILTER (WHERE dd.customer_rating IS NOT NULL) as avg_customer_rating
       FROM drivers d
       LEFT JOIN driver_deliveries dd ON d.id = dd.driver_id
       WHERE d.id = $1
       GROUP BY d.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Get recent deliveries
    const recentDeliveries = await pool.query(
      `SELECT
        dd.id, dd.order_id, dd.status, dd.total_delivery_fee, dd.driver_payout,
        dd.distance_miles, dd.claimed_at, dd.delivered_at,
        o.created_at as order_created_at
       FROM driver_deliveries dd
       JOIN orders o ON dd.order_id = o.id
       WHERE dd.driver_id = $1
       ORDER BY dd.created_at DESC
       LIMIT 10`,
      [id]
    );

    res.json({
      success: true,
      driver: result.rows[0],
      recent_deliveries: recentDeliveries.rows
    });
  } catch (error) {
    logger.error('Error fetching driver details:', error);
    res.status(500).json({ error: 'Failed to fetch driver details' });
  }
});

/**
 * POST /api/admin/drivers/:id/approve
 * Approve a pending driver application
 */
router.post('/drivers/:id/approve', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;

    const result = await pool.query(
      `UPDATE drivers
       SET approval_status = 'approved',
           approved_by = $1,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $2 AND approval_status = 'pending'
       RETURNING id, name, email, approval_status`,
      [adminId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Driver not found or not in pending status'
      });
    }

    const driver = result.rows[0];

    // Create driver notification
    await pool.query(
      `INSERT INTO driver_notifications (driver_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        'account_approved',
        'Account Approved! 🎉',
        'Congratulations! Your driver account has been approved. You can now start accepting delivery orders and earning money!',
        JSON.stringify({ approved_at: new Date().toISOString() })
      ]
    );

    logger.info(`Admin ${req.admin.username} approved driver ${driver.name} (ID: ${id})`);

    res.json({
      success: true,
      message: 'Driver approved successfully',
      driver
    });
  } catch (error) {
    logger.error('Error approving driver:', error);
    res.status(500).json({ error: 'Failed to approve driver' });
  }
});

/**
 * POST /api/admin/drivers/:id/reject
 * Reject a pending driver application
 * Body: { reason: string }
 */
router.post('/drivers/:id/reject', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.admin.id;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const result = await pool.query(
      `UPDATE drivers
       SET approval_status = 'rejected',
           rejection_reason = $1,
           approved_by = $2,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = $3 AND approval_status = 'pending'
       RETURNING id, name, email, approval_status`,
      [reason, adminId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Driver not found or not in pending status'
      });
    }

    const driver = result.rows[0];

    // Create driver notification
    await pool.query(
      `INSERT INTO driver_notifications (driver_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        'account_rejected',
        'Application Update',
        `Your driver application was not approved. Reason: ${reason}. If you believe this was a mistake, please contact support.`,
        JSON.stringify({ reason, rejected_at: new Date().toISOString() })
      ]
    );

    logger.info(`Admin ${req.admin.username} rejected driver ${driver.name} (ID: ${id}): ${reason}`);

    res.json({
      success: true,
      message: 'Driver rejected',
      driver
    });
  } catch (error) {
    logger.error('Error rejecting driver:', error);
    res.status(500).json({ error: 'Failed to reject driver' });
  }
});

/**
 * POST /api/admin/drivers/:id/suspend
 * Suspend an approved driver
 * Body: { reason: string }
 */
router.post('/drivers/:id/suspend', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Suspension reason is required' });
    }

    const result = await pool.query(
      `UPDATE drivers
       SET approval_status = 'suspended',
           rejection_reason = $1,
           is_available = FALSE,
           updated_at = NOW()
       WHERE id = $2 AND approval_status = 'approved'
       RETURNING id, name, email, approval_status`,
      [reason, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Driver not found or not in approved status'
      });
    }

    const driver = result.rows[0];

    // Create driver notification
    await pool.query(
      `INSERT INTO driver_notifications (driver_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        'account_suspended',
        'Account Suspended ⚠️',
        `Your driver account has been suspended. Reason: ${reason}. Please contact support for more information.`,
        JSON.stringify({ reason, suspended_at: new Date().toISOString() })
      ]
    );

    logger.warn(`Admin ${req.admin.username} suspended driver ${driver.name} (ID: ${id}): ${reason}`);

    res.json({
      success: true,
      message: 'Driver suspended successfully',
      driver
    });
  } catch (error) {
    logger.error('Error suspending driver:', error);
    res.status(500).json({ error: 'Failed to suspend driver' });
  }
});

/**
 * POST /api/admin/drivers/:id/reactivate
 * Reactivate a suspended driver
 */
router.post('/drivers/:id/reactivate', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE drivers
       SET approval_status = 'approved',
           rejection_reason = NULL,
           updated_at = NOW()
       WHERE id = $1 AND approval_status = 'suspended'
       RETURNING id, name, email, approval_status`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Driver not found or not in suspended status'
      });
    }

    const driver = result.rows[0];

    // Create driver notification
    await pool.query(
      `INSERT INTO driver_notifications (driver_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        'account_reactivated',
        'Account Reactivated! ✅',
        'Your driver account has been reactivated. You can now start accepting deliveries again!',
        JSON.stringify({ reactivated_at: new Date().toISOString() })
      ]
    );

    logger.info(`Admin ${req.admin.username} reactivated driver ${driver.name} (ID: ${id})`);

    res.json({
      success: true,
      message: 'Driver reactivated successfully',
      driver
    });
  } catch (error) {
    logger.error('Error reactivating driver:', error);
    res.status(500).json({ error: 'Failed to reactivate driver' });
  }
});

/**
 * GET /api/admin/drivers/stats/summary
 * Get driver statistics summary
 */
router.get('/drivers/stats/summary', requireAdminAuth, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE approval_status = 'pending') as pending_drivers,
        COUNT(*) FILTER (WHERE approval_status = 'approved') as approved_drivers,
        COUNT(*) FILTER (WHERE approval_status = 'rejected') as rejected_drivers,
        COUNT(*) FILTER (WHERE approval_status = 'suspended') as suspended_drivers,
        COUNT(*) FILTER (WHERE is_available = TRUE AND approval_status = 'approved') as online_drivers,
        COUNT(DISTINCT dd.id) FILTER (WHERE dd.status = 'delivered' AND dd.delivered_at >= CURRENT_DATE) as deliveries_today,
        COALESCE(SUM(dd.total_delivery_fee) FILTER (WHERE dd.status = 'delivered' AND dd.delivered_at >= CURRENT_DATE), 0) as revenue_today
      FROM drivers d
      LEFT JOIN driver_deliveries dd ON d.id = dd.driver_id
    `);

    res.json({
      success: true,
      stats: stats.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching driver stats:', error);
    res.status(500).json({ error: 'Failed to fetch driver stats' });
  }
});

export default router;