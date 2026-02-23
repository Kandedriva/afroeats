import express from "express";
import pool from "../db.js";
import { requireDriverAuth, requireApprovedDriver } from "../middleware/driverAuth.js";

const router = express.Router();

// Middleware to fix CORS headers for driver routes
const fixDriverCORS = (req, res, next) => {
  const origin = req.get('Origin');
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'https://orderdabaly.com',
    'https://www.orderdabaly.com',
    'https://orderdabaly.netlify.app'
  ];

  const corsOrigin = allowedOrigins.includes(origin) ? origin : (origin || 'http://localhost:3000');

  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');

  next();
};

// Apply CORS fix to all driver routes
router.use(fixDriverCORS);

/**
 * GET /api/drivers/available-orders
 * List all available delivery orders for drivers to claim
 * Requires: Approved driver
 */
router.get("/available-orders", requireApprovedDriver, async (req, res) => {
  try {
    // Get orders that:
    // 1. Are paid and confirmed (status = 'received')
    // 2. Are delivery orders (delivery_type = 'delivery')
    // 3. Have a delivery record with status 'available'
    // 4. Don't have a driver assigned yet

    const ordersResult = await pool.query(`
      SELECT
        o.id as order_id,
        o.total,
        o.delivery_address,
        o.delivery_phone,
        o.order_details,
        o.created_at,
        dd.id as delivery_id,
        dd.pickup_location,
        dd.delivery_location,
        dd.distance_miles,
        dd.total_delivery_fee,
        dd.driver_payout,
        COALESCE(
          json_agg(
            json_build_object(
              'restaurant_id', r.id,
              'restaurant_name', r.name,
              'restaurant_address', r.address,
              'restaurant_phone', r.phone_number
            )
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) as restaurants
      FROM orders o
      INNER JOIN driver_deliveries dd ON o.id = dd.order_id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN restaurants r ON oi.restaurant_id = r.id
      WHERE o.status = 'received'
        AND o.delivery_type = 'delivery'
        AND dd.status = 'available'
        AND dd.driver_id IS NULL
      GROUP BY o.id, dd.id
      ORDER BY o.created_at ASC
    `);

    res.json({ success: true, orders: ordersResult.rows });
  } catch (err) {
    console.error('Available orders error:', err);
    res.status(500).json({ error: "Failed to get available orders" });
  }
});

/**
 * POST /api/drivers/claim-order/:orderId
 * Claim an available delivery order
 * Requires: Approved driver
 */
router.post("/claim-order/:orderId", requireApprovedDriver, async (req, res) => {
  const { orderId } = req.params;
  const driverId = req.driver.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if order is still available and lock the row
    const deliveryCheck = await client.query(
      `SELECT id, status, driver_id
       FROM driver_deliveries
       WHERE order_id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (deliveryCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: "Delivery not found"
      });
    }

    const delivery = deliveryCheck.rows[0];

    if (delivery.status !== 'available' || delivery.driver_id !== null) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: "Order is no longer available or already claimed"
      });
    }

    const deliveryId = delivery.id;

    // Assign driver and update status to 'claimed'
    await client.query(
      `UPDATE driver_deliveries
       SET driver_id = $1, status = 'claimed', claimed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [driverId, deliveryId]
    );

    // Update order with driver assignment
    await client.query(
      `UPDATE orders
       SET driver_id = $1, driver_claimed_at = NOW()
       WHERE id = $2`,
      [driverId, orderId]
    );

    // Create driver notification
    await client.query(
      `INSERT INTO driver_notifications (driver_id, order_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        driverId,
        orderId,
        'order_claimed',
        'Order Claimed Successfully! 🎉',
        `You have claimed order #${orderId}. Head to the restaurant to pick up the food.`,
        JSON.stringify({ orderId, deliveryId })
      ]
    );

    // Create customer notification
    await client.query(
      `INSERT INTO customer_notifications (user_id, order_id, type, title, message)
       SELECT user_id, $1, $2, $3, $4 FROM orders WHERE id = $1 AND user_id IS NOT NULL`,
      [
        orderId,
        'driver_assigned',
        'Driver Assigned! 🚗',
        `A driver has been assigned to your order and will pick it up soon.`
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: "Order claimed successfully",
      orderId,
      deliveryId
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Claim order error:', err);
    res.status(500).json({ error: "Failed to claim order" });
  } finally {
    client.release();
  }
});

/**
 * GET /api/drivers/my-deliveries
 * Get driver's active and completed deliveries
 * Requires: Approved driver
 * Query params: ?status=active|completed|all
 */
router.get("/my-deliveries", requireApprovedDriver, async (req, res) => {
  const driverId = req.driver.id;
  const { status } = req.query; // 'active', 'completed', or 'all'

  try {
    let query = `
      SELECT
        dd.id as delivery_id,
        dd.status,
        dd.total_delivery_fee,
        dd.driver_payout,
        dd.distance_miles,
        dd.pickup_location,
        dd.delivery_location,
        dd.claimed_at,
        dd.picked_up_at,
        dd.in_transit_at,
        dd.delivered_at,
        dd.driver_notes,
        o.id as order_id,
        o.total as order_total,
        o.delivery_phone,
        o.order_details,
        o.created_at as order_created_at
      FROM driver_deliveries dd
      INNER JOIN orders o ON dd.order_id = o.id
      WHERE dd.driver_id = $1
    `;

    if (status === 'active') {
      query += ` AND dd.status IN ('claimed', 'picked_up', 'in_transit')`;
    } else if (status === 'completed') {
      query += ` AND dd.status IN ('delivered', 'cancelled')`;
    }

    query += ` ORDER BY dd.created_at DESC LIMIT 50`;

    const result = await pool.query(query, [driverId]);

    res.json({ success: true, deliveries: result.rows });
  } catch (err) {
    console.error('My deliveries error:', err);
    res.status(500).json({ error: "Failed to get deliveries" });
  }
});

/**
 * POST /api/drivers/update-delivery-status
 * Update delivery status (picked_up → in_transit → delivered)
 * Requires: Approved driver
 * Body: { deliveryId, status, notes? }
 */
router.post("/update-delivery-status", requireApprovedDriver, async (req, res) => {
  const { deliveryId, status, notes } = req.body;
  const driverId = req.driver.id;

  // Valid status transitions
  const validStatuses = ['picked_up', 'in_transit', 'delivered', 'cancelled'];

  if (!deliveryId || !status) {
    return res.status(400).json({ error: "Missing deliveryId or status" });
  }

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: "Invalid status",
      valid_statuses: validStatuses
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify delivery belongs to this driver
    const deliveryCheck = await client.query(
      `SELECT order_id, status as current_status
       FROM driver_deliveries
       WHERE id = $1 AND driver_id = $2`,
      [deliveryId, driverId]
    );

    if (deliveryCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: "Delivery not found or unauthorized" });
    }

    const orderId = deliveryCheck.rows[0].order_id;

    // Update delivery status with timestamp
    const timestampField = status === 'picked_up' ? 'picked_up_at' :
                          status === 'in_transit' ? 'in_transit_at' :
                          status === 'delivered' ? 'delivered_at' :
                          status === 'cancelled' ? 'cancelled_at' : null;

    let updateQuery = `
      UPDATE driver_deliveries
      SET status = $1, updated_at = NOW()
    `;

    const queryParams = [status, deliveryId];

    if (timestampField) {
      updateQuery += `, ${timestampField} = NOW()`;
    }

    if (notes) {
      updateQuery += `, driver_notes = $3`;
      queryParams.push(notes);
    }

    updateQuery += ` WHERE id = $2`;

    await client.query(updateQuery, queryParams);

    // Update order status and timestamps based on delivery status
    if (status === 'picked_up') {
      await client.query(
        `UPDATE orders SET driver_picked_up_at = NOW() WHERE id = $1`,
        [orderId]
      );
    } else if (status === 'delivered') {
      await client.query(
        `UPDATE orders
         SET status = 'delivered', driver_delivered_at = NOW()
         WHERE id = $1`,
        [orderId]
      );

      // Get delivery details for earnings record
      const deliveryData = await client.query(
        `SELECT driver_payout, total_delivery_fee, platform_commission
         FROM driver_deliveries WHERE id = $1`,
        [deliveryId]
      );

      const { driver_payout, total_delivery_fee, platform_commission } = deliveryData.rows[0];

      // Create earnings record (will be paid out later via Stripe)
      await client.query(
        `CREATE TABLE IF NOT EXISTS driver_earnings (
          id SERIAL PRIMARY KEY,
          driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
          delivery_id INTEGER NOT NULL REFERENCES driver_deliveries(id) ON DELETE CASCADE,
          order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          delivery_fee DECIMAL(10, 2) NOT NULL,
          driver_payout DECIMAL(10, 2) NOT NULL,
          platform_commission DECIMAL(10, 2) NOT NULL,
          stripe_transfer_id VARCHAR(255),
          payout_status VARCHAR(20) DEFAULT 'pending',
          paid_at TIMESTAMP,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )`
      );

      await client.query(
        `INSERT INTO driver_earnings (driver_id, delivery_id, order_id, delivery_fee, driver_payout, platform_commission, payout_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [driverId, deliveryId, orderId, total_delivery_fee, driver_payout, platform_commission]
      );

      // Update driver stats
      await client.query(
        `UPDATE drivers
         SET completed_deliveries = completed_deliveries + 1,
             total_deliveries = total_deliveries + 1,
             total_earnings = total_earnings + $2
         WHERE id = $1`,
        [driverId, driver_payout]
      );
    }

    // Create customer notification
    const notificationMessages = {
      picked_up: { title: 'Order Picked Up! 📦', message: 'Your order has been picked up by the driver and is on the way!' },
      in_transit: { title: 'Order On The Way! 🚗', message: 'Your order is on its way to you!' },
      delivered: { title: 'Order Delivered! 🎉', message: 'Your order has been delivered. Enjoy your meal!' },
      cancelled: { title: 'Delivery Cancelled ❌', message: 'Your delivery has been cancelled.' }
    };

    const notification = notificationMessages[status];

    if (notification) {
      await client.query(
        `INSERT INTO customer_notifications (user_id, order_id, type, title, message)
         SELECT user_id, $1, $2, $3, $4 FROM orders WHERE id = $1 AND user_id IS NOT NULL`,
        [
          orderId,
          `delivery_${status}`,
          notification.title,
          notification.message
        ]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Delivery status updated to ${status}`
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update delivery status error:', err);
    res.status(500).json({ error: "Failed to update status" });
  } finally {
    client.release();
  }
});

/**
 * GET /api/drivers/earnings
 * Get driver earnings summary and history
 * Requires: Approved driver
 * Query params: ?period=today|week|month|all
 */
router.get("/earnings", requireApprovedDriver, async (req, res) => {
  const driverId = req.driver.id;
  const { period } = req.query; // 'today', 'week', 'month', 'all'

  try {
    let dateFilter = '';
    if (period === 'today') {
      dateFilter = `AND de.created_at >= CURRENT_DATE`;
    } else if (period === 'week') {
      dateFilter = `AND de.created_at >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (period === 'month') {
      dateFilter = `AND de.created_at >= CURRENT_DATE - INTERVAL '30 days'`;
    }

    // Ensure driver_earnings table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS driver_earnings (
        id SERIAL PRIMARY KEY,
        driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
        delivery_id INTEGER NOT NULL REFERENCES driver_deliveries(id) ON DELETE CASCADE,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        delivery_fee DECIMAL(10, 2) NOT NULL,
        driver_payout DECIMAL(10, 2) NOT NULL,
        platform_commission DECIMAL(10, 2) NOT NULL,
        stripe_transfer_id VARCHAR(255),
        payout_status VARCHAR(20) DEFAULT 'pending',
        paid_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get earnings summary
    const summaryResult = await pool.query(`
      SELECT
        COUNT(*) as total_deliveries,
        COALESCE(SUM(driver_payout), 0) as total_earnings,
        COALESCE(SUM(CASE WHEN payout_status = 'paid' THEN driver_payout ELSE 0 END), 0) as paid_earnings,
        COALESCE(SUM(CASE WHEN payout_status = 'pending' THEN driver_payout ELSE 0 END), 0) as pending_earnings
      FROM driver_earnings de
      WHERE driver_id = $1 ${dateFilter}
    `, [driverId]);

    // Get recent earnings
    const recentResult = await pool.query(`
      SELECT
        de.*,
        o.id as order_id,
        dd.delivered_at
      FROM driver_earnings de
      INNER JOIN driver_deliveries dd ON de.delivery_id = dd.id
      INNER JOIN orders o ON de.order_id = o.id
      WHERE de.driver_id = $1 ${dateFilter}
      ORDER BY de.created_at DESC
      LIMIT 20
    `, [driverId]);

    res.json({
      success: true,
      summary: summaryResult.rows[0],
      recent_earnings: recentResult.rows
    });

  } catch (err) {
    console.error('Driver earnings error:', err);
    res.status(500).json({ error: "Failed to get earnings" });
  }
});

/**
 * POST /api/drivers/toggle-availability
 * Toggle driver online/offline status
 * Requires: Approved driver
 */
router.post("/toggle-availability", requireApprovedDriver, async (req, res) => {
  const driverId = req.driver.id;

  try {
    const result = await pool.query(
      `UPDATE drivers
       SET is_available = NOT is_available, updated_at = NOW()
       WHERE id = $1
       RETURNING is_available`,
      [driverId]
    );

    res.json({
      success: true,
      is_available: result.rows[0].is_available,
      message: result.rows[0].is_available ? "You are now online" : "You are now offline"
    });
  } catch (err) {
    console.error('Toggle availability error:', err);
    res.status(500).json({ error: "Failed to update availability" });
  }
});

/**
 * GET /api/drivers/notifications
 * Get driver notifications
 * Requires: Driver auth
 */
router.get("/notifications", requireDriverAuth, async (req, res) => {
  const driverId = req.driver.id;
  const { unread_only } = req.query;

  try {
    let query = `
      SELECT * FROM driver_notifications
      WHERE driver_id = $1
    `;

    if (unread_only === 'true') {
      query += ` AND read = FALSE`;
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    const result = await pool.query(query, [driverId]);

    res.json({ success: true, notifications: result.rows });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

/**
 * POST /api/drivers/notifications/:id/mark-read
 * Mark notification as read
 * Requires: Driver auth
 */
router.post("/notifications/:id/mark-read", requireDriverAuth, async (req, res) => {
  const { id } = req.params;
  const driverId = req.driver.id;

  try {
    await pool.query(
      `UPDATE driver_notifications
       SET read = TRUE, read_at = NOW()
       WHERE id = $1 AND driver_id = $2`,
      [id, driverId]
    );

    res.json({ success: true, message: "Notification marked as read" });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

export default router;
