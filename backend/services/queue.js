import Bull from 'bull';
import redisClient from '../redis.js';
import pool from '../db.js';
import { cache } from '../redis.js';

// Shared Redis configuration with better error handling
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxLoadingTimeout: 1000,
};

// Create job queues with error handling
export const emailQueue = new Bull('email processing', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const analyticsQueue = new Bull('analytics processing', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 2,
  },
});

export const notificationQueue = new Bull('notification processing', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 100,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

export const cleanupQueue = new Bull('cleanup processing', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 10,
  },
});

// Add error handling for all queues
const queues = [emailQueue, analyticsQueue, notificationQueue, cleanupQueue];

queues.forEach(queue => {
  queue.on('error', (error) => {
    console.error(`Queue ${queue.name} error:`, error.message);
  });
  
  queue.on('failed', (job, err) => {
    console.error(`Job ${job.id} in ${queue.name} failed:`, err.message);
  });
});

// Email processing jobs
emailQueue.process('welcome-email', async (job) => {
  const { user, userType } = job.data;
  
  try {
    // In production, integrate with email service like SendGrid, AWS SES, etc.
    console.log(`📧 Sending welcome email to ${user.email} (${userType})`);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Log email sent
    await pool.query(
      'INSERT INTO email_logs (recipient, subject, type, status, sent_at) VALUES ($1, $2, $3, $4, NOW())',
      [user.email, `Welcome to A Food Zone`, 'welcome', 'sent']
    );
    
    return { success: true, message: 'Welcome email sent successfully' };
  } catch (error) {
    console.error('Welcome email error:', error);
    throw error;
  }
});

emailQueue.process('order-confirmation', async (job) => {
  const { order, customer, restaurants } = job.data;
  
  try {
    console.log(`📧 Sending order confirmation to ${customer.email} for order #${order.id}`);
    
    // Send customer confirmation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Send notifications to restaurant owners
    for (const restaurant of restaurants) {
      console.log(`📧 Sending new order notification to ${restaurant.owner_email}`);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Log emails
    await pool.query(
      'INSERT INTO email_logs (recipient, subject, type, status, sent_at) VALUES ($1, $2, $3, $4, NOW())',
      [customer.email, `Order Confirmation #${order.id}`, 'order-confirmation', 'sent']
    );
    
    return { success: true, message: 'Order confirmation emails sent' };
  } catch (error) {
    console.error('Order confirmation email error:', error);
    throw error;
  }
});

emailQueue.process('password-reset', async (job) => {
  const { email, resetToken, userType } = job.data;
  
  try {
    console.log(`📧 Sending password reset email to ${email}`);
    
    // In production, send actual email with reset link
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&type=${userType}`;
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    await pool.query(
      'INSERT INTO email_logs (recipient, subject, type, status, sent_at) VALUES ($1, $2, $3, $4, NOW())',
      [email, 'Password Reset Request', 'password-reset', 'sent']
    );
    
    return { success: true, resetLink };
  } catch (error) {
    console.error('Password reset email error:', error);
    throw error;
  }
});

// Analytics processing jobs
analyticsQueue.process('daily-analytics', async (job) => {
  const { date } = job.data;
  
  try {
    console.log(`📊 Processing daily analytics for ${date}`);
    
    // Aggregate daily data from Redis to database
    const analytics = {
      date,
      unique_visitors: await cache.scard(`analytics:unique_visitors:${date}`),
      page_views: await cache.get(`analytics:page_views:${date}`) || 0,
      registrations: await cache.get(`analytics:registrations:${date}`) || 0,
      orders: await cache.get(`analytics:orders:${date}`) || 0,
      revenue: (await cache.get(`analytics:revenue:${date}`) || 0) / 100,
      platform_fees: (await cache.get(`analytics:platform_fees:${date}`) || 0) / 100,
      active_restaurants: await cache.scard(`analytics:active_restaurants:${date}`)
    };
    
    // Store in database
    await pool.query(`
      INSERT INTO daily_analytics 
      (date, unique_visitors, page_views, registrations, orders, revenue, platform_fees, active_restaurants)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (date) DO UPDATE SET
        unique_visitors = EXCLUDED.unique_visitors,
        page_views = EXCLUDED.page_views,
        registrations = EXCLUDED.registrations,
        orders = EXCLUDED.orders,
        revenue = EXCLUDED.revenue,
        platform_fees = EXCLUDED.platform_fees,
        active_restaurants = EXCLUDED.active_restaurants,
        updated_at = NOW()
    `, [
      analytics.date,
      analytics.unique_visitors,
      analytics.page_views,
      analytics.registrations,
      analytics.orders,
      analytics.revenue,
      analytics.platform_fees,
      analytics.active_restaurants
    ]);
    
    return { success: true, analytics };
  } catch (error) {
    console.error('Daily analytics processing error:', error);
    throw error;
  }
});

// Notification processing jobs
notificationQueue.process('send-notification', async (job) => {
  const { type, recipient, data } = job.data;
  
  try {
    console.log(`🔔 Processing ${type} notification for ${recipient.type} ${recipient.id}`);
    
    if (recipient.type === 'customer') {
      await pool.query(`
        INSERT INTO customer_notifications (user_id, type, title, message, data)
        VALUES ($1, $2, $3, $4, $5)
      `, [recipient.id, data.type, data.title, data.message, JSON.stringify(data.metadata || {})]);
    } else if (recipient.type === 'owner') {
      await pool.query(`
        INSERT INTO notifications (owner_id, order_id, type, title, message, data)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [recipient.id, data.orderId, data.type, data.title, data.message, JSON.stringify(data.metadata || {})]);
    }
    
    return { success: true, message: 'Notification sent successfully' };
  } catch (error) {
    console.error('Notification processing error:', error);
    throw error;
  }
});

// Cleanup jobs
cleanupQueue.process('cleanup-old-sessions', async (job) => {
  try {
    console.log('🧹 Cleaning up old sessions');
    
    // Clean up expired sessions (if using database sessions)
    await pool.query('DELETE FROM sessions WHERE expires < NOW()');
    
    // Clean up old Redis keys
    const oldKeys = await redisClient.keys('sess:*');
    for (const key of oldKeys) {
      const ttl = await redisClient.ttl(key);
      if (ttl === -1) { // Keys without expiration
        await redisClient.del(key);
      }
    }
    
    return { success: true, message: 'Old sessions cleaned up' };
  } catch (error) {
    console.error('Session cleanup error:', error);
    throw error;
  }
});

cleanupQueue.process('cleanup-old-analytics', async (job) => {
  try {
    console.log('🧹 Cleaning up old analytics data');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];
    
    // Clean up old Redis analytics keys
    const patterns = [
      `analytics:unique_visitors:*`,
      `analytics:page_views:*`,
      `analytics:requests:*`,
      `analytics:hourly_visitors:*`
    ];
    
    for (const pattern of patterns) {
      const keys = await redisClient.keys(pattern);
      for (const key of keys) {
        const keyDate = key.split(':').slice(-1)[0];
        if (keyDate < cutoffDateString) {
          await redisClient.del(key);
        }
      }
    }
    
    return { success: true, message: 'Old analytics data cleaned up' };
  } catch (error) {
    console.error('Analytics cleanup error:', error);
    throw error;
  }
});

// Schedule recurring jobs
export const scheduleRecurringJobs = () => {
  try {
    // Daily analytics processing at 1 AM
    analyticsQueue.add('daily-analytics', 
      { date: new Date().toISOString().split('T')[0] }, 
      { repeat: { cron: '0 1 * * *' } }
    );
    
    // Weekly session cleanup on Sundays at 2 AM
    cleanupQueue.add('cleanup-old-sessions', {}, 
      { repeat: { cron: '0 2 * * SUN' } }
    );
    
    // Monthly analytics cleanup on 1st at 3 AM
    cleanupQueue.add('cleanup-old-analytics', {}, 
      { repeat: { cron: '0 3 1 * *' } }
    );
    
    console.log('✅ Recurring jobs scheduled successfully');
  } catch (error) {
    console.error('⚠️ Failed to schedule recurring jobs:', error.message);
  }
};

// Queue monitoring
export const getQueueStats = async () => {
  const stats = {};
  
  const queues = [
    { name: 'email', queue: emailQueue },
    { name: 'analytics', queue: analyticsQueue },
    { name: 'notifications', queue: notificationQueue },
    { name: 'cleanup', queue: cleanupQueue }
  ];
  
  for (const { name, queue } of queues) {
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();
    
    stats[name] = {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length
    };
  }
  
  return stats;
};

// Export job creation helpers
export const jobs = {
  sendWelcomeEmail: (user, userType) => 
    emailQueue.add('welcome-email', { user, userType }),
  
  sendOrderConfirmation: (order, customer, restaurants) =>
    emailQueue.add('order-confirmation', { order, customer, restaurants }),
  
  sendPasswordReset: (email, resetToken, userType) =>
    emailQueue.add('password-reset', { email, resetToken, userType }),
  
  sendNotification: (type, recipient, data) =>
    notificationQueue.add('send-notification', { type, recipient, data }),
  
  processDailyAnalytics: (date) =>
    analyticsQueue.add('daily-analytics', { date })
};