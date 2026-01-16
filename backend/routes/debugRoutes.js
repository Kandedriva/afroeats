import express from 'express';
import r2Storage from '../services/r2Storage.js';
import pool from '../db.js';
import { jobs } from '../services/queue.js';

const router = express.Router();

/**
 * Debug endpoint to test R2 URL generation
 * This endpoint helps verify that R2 URLs are being generated correctly in production
 */
router.get('/r2-url-test', (req, res) => {
  try {
    // Test URL generation with different scenarios
    const testKey = 'dish_images/test-image.jpg';
    
    const urlWithRequest = r2Storage.getPublicUrl(testKey, req);
    const urlWithoutRequest = r2Storage.getPublicUrl(testKey);
    
    const debugInfo = {
      environment: process.env.NODE_ENV,
      testKey: testKey,
      urlWithRequest: urlWithRequest,
      urlWithoutRequest: urlWithoutRequest,
      requestHeaders: {
        host: req.headers.host,
        'x-forwarded-host': req.headers['x-forwarded-host'],
        'x-forwarded-proto': req.headers['x-forwarded-proto'],
        origin: req.headers.origin,
        referer: req.headers.referer
      },
      environmentVars: {
        BACKEND_URL: process.env.BACKEND_URL || 'not set',
        RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL || 'not set',
        RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL || 'not set',
        HEROKU_APP_NAME: process.env.HEROKU_APP_NAME || 'not set',
        PORT: process.env.PORT || 'not set'
      },
      r2Config: {
        isConfigured: r2Storage.isConfigured(),
        bucketName: r2Storage.bucketName
      }
    };
    
    res.json(debugInfo);
  } catch (error) {
    res.status(500).json({
      error: 'Debug endpoint failed',
      message: error.message
    });
  }
});

/**
 * Debug endpoint to test order notifications
 * This endpoint helps verify that order notifications are working in demo mode
 */
router.post('/test-notification', async (req, res) => {
  try {
    console.log('🧪 Testing order notification system...');
    
    // Get a sample restaurant and owner
    const restaurantResult = await pool.query(`
      SELECT r.id, r.name, ro.id as owner_id, ro.name as owner_name, ro.email as owner_email
      FROM restaurants r 
      JOIN restaurant_owners ro ON r.owner_id = ro.id 
      LIMIT 1
    `);
    
    if (restaurantResult.rows.length === 0) {
      return res.status(400).json({ error: 'No restaurants found for testing' });
    }
    
    const restaurant = restaurantResult.rows[0];
    
    // Create a test notification
    const testOrderId = Math.floor(Math.random() * 1000) + 9000; // Random test order ID
    const notificationData = {
      type: 'new_order',
      title: `Test Order #${testOrderId}`,
      message: `Demo notification test for $25.99`,
      orderId: testOrderId,
      metadata: {
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        customerPhone: '555-0123',
        items: [
          { name: 'Test Dish 1', quantity: 2, price: 12.99 },
          { name: 'Test Dish 2', quantity: 1, price: 15.99 }
        ],
        total: '25.99',
        isGuestOrder: false,
        orderDate: new Date().toISOString()
      }
    };
    
    // Ensure notifications table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER REFERENCES restaurant_owners(id),
        order_id INTEGER,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSONB,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Insert test notification
    const notificationResult = await pool.query(`
      INSERT INTO notifications (owner_id, order_id, type, title, message, data, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id
    `, [
      restaurant.owner_id,
      testOrderId,
      'new_order',
      notificationData.title,
      notificationData.message,
      JSON.stringify(notificationData.metadata)
    ]);
    
    // Send via queue system
    await jobs.sendNotification('new_order', 
      { type: 'owner', id: restaurant.owner_id }, 
      notificationData
    );
    
    // Send test email
    await jobs.sendOrderConfirmation(
      { id: testOrderId, total: 25.99 },
      { name: 'Test Customer', email: 'test@example.com' },
      [restaurant]
    );
    
    console.log(`✅ Test notification sent to ${restaurant.name} (${restaurant.owner_email})`);
    
    res.json({
      success: true,
      message: 'Test notification sent successfully',
      details: {
        notificationId: notificationResult.rows[0].id,
        restaurant: restaurant.name,
        ownerEmail: restaurant.owner_email,
        testOrderId: testOrderId
      }
    });
    
  } catch (error) {
    console.error('❌ Test notification failed:', error);
    res.status(500).json({
      error: 'Test notification failed',
      message: error.message
    });
  }
});

// Test customer notification creation
router.post('/test-customer-notification', async (req, res) => {
  try {
    const userId = req.session?.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        error: 'No userId provided. Either log in or provide userId in request body.'
      });
    }

    // Ensure customer_notifications table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSONB DEFAULT '{}',
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create test notification
    const result = await pool.query(
      `INSERT INTO customer_notifications (user_id, order_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        userId,
        null, // No specific order
        'test_notification',
        'Test Notification 🧪',
        'This is a test notification to verify your notification system is working correctly!',
        JSON.stringify({
          testTime: new Date().toISOString(),
          source: 'debug-endpoint'
        })
      ]
    );

    res.json({
      success: true,
      message: 'Test notification created successfully!',
      notification: result.rows[0],
      instructions: 'Check your notifications page at /my-notifications to see this notification.'
    });
  } catch (error) {
    console.error('❌ Test customer notification failed:', error);
    res.status(500).json({
      error: 'Test customer notification failed',
      message: error.message,
      stack: error.stack
    });
  }
});

export default router;