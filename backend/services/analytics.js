import { cache } from '../redis.js';
import pool from '../db.js';

export class AnalyticsService {
  
  // Track visitor activity
  static async trackVisitor(req) {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent') || 'Unknown';
      const dateKey = new Date().toISOString().split('T')[0];
      const hourKey = new Date().getHours();
      
      // Track unique daily visitors
      await cache.sadd(`analytics:unique_visitors:${dateKey}`, ip);
      
      // Track page views
      await cache.incr(`analytics:page_views:${dateKey}`);
      
      // Track hourly distribution
      await cache.incr(`analytics:hourly:${dateKey}:${hourKey}`);
      
      // Track current online users (expires in 5 minutes)
      await cache.set(`analytics:online:${ip}`, Date.now(), 300);
      
    } catch (error) {
      console.error('Visitor tracking error:', error);
    }
  }
  
  // Track new user registration
  static async trackRegistration(userId, userType = 'customer') {
    try {
      const dateKey = new Date().toISOString().split('T')[0];
      await cache.incr(`analytics:registrations:${dateKey}`);
      await cache.incr(`analytics:registrations:${userType}:${dateKey}`);
    } catch (error) {
      console.error('Registration tracking error:', error);
    }
  }
  
  // Track restaurant owner registration
  static async trackRestaurantOwnerRegistration(ownerId) {
    try {
      const dateKey = new Date().toISOString().split('T')[0];
      await cache.incr(`analytics:restaurant_owners:${dateKey}`);
    } catch (error) {
      console.error('Restaurant owner tracking error:', error);
    }
  }
  
  // Track order creation
  static async trackOrder(orderData) {
    try {
      const dateKey = new Date().toISOString().split('T')[0];
      await cache.incr(`analytics:orders:${dateKey}`);
      await cache.incr(`analytics:revenue:${dateKey}`, Math.round(orderData.total * 100)); // Store in cents
      await cache.incr(`analytics:platform_fees:${dateKey}`, Math.round((orderData.platform_fee || 0) * 100));
    } catch (error) {
      console.error('Order tracking error:', error);
    }
  }
  
  // Track restaurant activity
  static async trackRestaurantActivity(restaurantId, action) {
    try {
      const dateKey = new Date().toISOString().split('T')[0];
      await cache.incr(`analytics:restaurant_activity:${dateKey}`);
      await cache.incr(`analytics:restaurant_activity:${dateKey}:${action}`);
      await cache.sadd(`analytics:active_restaurants:${dateKey}`, restaurantId.toString());
    } catch (error) {
      console.error('Restaurant activity tracking error:', error);
    }
  }
  
  // Get comprehensive analytics data
  static async getAnalytics(startDate, endDate) {
    try {
      const analytics = {
        daily_stats: [],
        summary: {
          total_visitors: 0,
          total_page_views: 0,
          total_registrations: 0,
          total_orders: 0,
          total_revenue: 0
        }
      };
      
      const dates = this.getDateRange(startDate, endDate);
      
      for (const date of dates) {
        const visitors = await cache.scard(`analytics:unique_visitors:${date}`);
        const pageViews = parseInt(await cache.get(`analytics:page_views:${date}`) || 0);
        const registrations = parseInt(await cache.get(`analytics:registrations:${date}`) || 0);
        const orders = parseInt(await cache.get(`analytics:orders:${date}`) || 0);
        const revenue = parseInt(await cache.get(`analytics:revenue:${date}`) || 0) / 100; // Convert from cents
        
        analytics.daily_stats.push({
          date,
          visitors,
          page_views: pageViews,
          registrations,
          orders,
          revenue
        });
        
        analytics.summary.total_visitors += visitors;
        analytics.summary.total_page_views += pageViews;
        analytics.summary.total_registrations += registrations;
        analytics.summary.total_orders += orders;
        analytics.summary.total_revenue += revenue;
      }
      
      return analytics;
    } catch (error) {
      console.error('Analytics retrieval error:', error);
      return { daily_stats: [], summary: {} };
    }
  }
  
  // Get real-time metrics
  static async getRealTimeMetrics() {
    try {
      const dateKey = new Date().toISOString().split('T')[0];
      
      // Get current online users
      const onlinePattern = 'analytics:online:*';
      const onlineKeys = await cache.keys ? await cache.keys(onlinePattern) : [];
      const currentOnline = onlineKeys.length;
      
      // Get today's metrics
      const visitorsToday = await cache.scard(`analytics:unique_visitors:${dateKey}`);
      const pageViewsToday = parseInt(await cache.get(`analytics:page_views:${dateKey}`) || 0);
      const ordersToday = parseInt(await cache.get(`analytics:orders:${dateKey}`) || 0);
      const revenueToday = parseInt(await cache.get(`analytics:revenue:${dateKey}`) || 0) / 100;
      
      return {
        current_online: currentOnline,
        visitors_today: visitorsToday,
        page_views_today: pageViewsToday,
        orders_today: ordersToday,
        revenue_today: revenueToday
      };
    } catch (error) {
      console.error('Real-time metrics error:', error);
      return {
        current_online: 0,
        visitors_today: 0,
        page_views_today: 0,
        orders_today: 0,
        revenue_today: 0
      };
    }
  }
  
  // Get user growth data
  static async getUserGrowth(days = 30) {
    try {
      const growth = [];
      const today = new Date();
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        
        const registrations = parseInt(await cache.get(`analytics:registrations:${dateKey}`) || 0);
        growth.push({
          date: dateKey,
          new_users: registrations
        });
      }
      
      return growth;
    } catch (error) {
      console.error('User growth error:', error);
      return [];
    }
  }
  
  // Get top performing restaurants
  static async getTopRestaurants(limit = 10) {
    try {
      const result = await pool.query(`
        SELECT 
          r.id,
          r.name,
          r.image_url,
          COUNT(DISTINCT o.id) as total_orders,
          COALESCE(SUM(oi.price * oi.quantity), 0) as total_revenue,
          COUNT(DISTINCT o.user_id) as unique_customers,
          AVG(oi.price * oi.quantity) as avg_order_value
        FROM restaurants r
        LEFT JOIN order_items oi ON r.id = COALESCE(oi.restaurant_id, (SELECT restaurant_id FROM dishes WHERE id = oi.dish_id))
        LEFT JOIN orders o ON oi.order_id = o.id AND o.status IN ('paid', 'completed')
        WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY r.id, r.name, r.image_url
        HAVING COUNT(DISTINCT o.id) > 0
        ORDER BY total_revenue DESC, total_orders DESC
        LIMIT $1
      `, [limit]);
      
      return result.rows;
    } catch (error) {
      console.error('Top restaurants error:', error);
      return [];
    }
  }
  
  // Helper method to generate date range
  static getDateRange(startDate, endDate) {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    while (start <= end) {
      dates.push(start.toISOString().split('T')[0]);
      start.setDate(start.getDate() + 1);
    }
    
    return dates;
  }
}

// Middleware to track visitor activity
export const trackVisitorMiddleware = async (req, res, next) => {
  // Only track GET requests to avoid tracking API calls
  if (req.method === 'GET' && !req.originalUrl.startsWith('/api/')) {
    // Run tracking in background to not block request
    setImmediate(() => {
      AnalyticsService.trackVisitor(req);
    });
  }
  next();
};