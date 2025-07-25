import express from "express";
import bcrypt from "bcrypt";
import pool from "../db.js";

const router = express.Router();

// 🔐 REGISTER
router.post("/register", async (req, res) => {
  const { name, email, password, secret_word, address, phone } = req.body;

  try {
    const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const hashedSecretWord = await bcrypt.hash(secret_word, saltRounds);

    // Try to insert with all fields, with graceful fallbacks
    let newUser;
    try {
      newUser = await pool.query(
        "INSERT INTO users (name, email, password, secret_word, address, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email",
        [name, email, hashedPassword, hashedSecretWord, address, phone]
      );
    } catch (err) {
      console.log("Trying user registration without some columns:", err.message);
      try {
        // Try with just secret_word (no address/phone)
        newUser = await pool.query(
          "INSERT INTO users (name, email, password, secret_word) VALUES ($1, $2, $3, $4) RETURNING id, name, email",
          [name, email, hashedPassword, hashedSecretWord]
        );
      } catch (err2) {
        // Fallback to basic registration if other columns don't exist
        console.log("Trying basic user registration:", err2.message);
        newUser = await pool.query(
          "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
          [name, email, hashedPassword]
        );
      }
    }

    req.session.userId = newUser.rows[0].id;
    req.session.userName = newUser.rows[0].name.split(" ")[0];

    res.status(201).json({ user: newUser.rows[0] });
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔑 LOGIN
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
  
    try {
      // 1. Check if user exists
      const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      if (userResult.rows.length === 0) {
        return res.status(400).json({ error: "Invalid email or password" });
      }
  
      const user = userResult.rows[0];
  
      // 2. Compare password with hashed password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid email or password" });
      }
  
      // 3. Set session data
      req.session.userId = user.id;
      req.session.userName = user.name.split(" ")[0]; // just first name for greeting
  
      // 4. Respond with user info (optional)
      res.json({ user: { id: user.id, name: user.name, email: user.email } });
  
    } catch (err) {
      console.error("Login Error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // in authRoutes.js
router.get("/me", async (req, res) => {
    if (req.session.userId) {
      try {
        // Get full user info from database
        const userResult = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [req.session.userId]);
        
        if (userResult.rows.length > 0) {
          res.json(userResult.rows[0]);
        } else {
          res.status(401).json({ error: "User not found" });
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        res.status(500).json({ error: "Server error" });
      }
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid"); // Name of session cookie
      res.sendStatus(200);
    });
  });
  
  

// POST /api/auth/update-password - Update user password using secret word
router.post("/update-password", async (req, res) => {
  try {
    const { email, secret_word, new_password } = req.body;

    // Validate input
    if (!email || !secret_word || !new_password) {
      return res.status(400).json({ error: "Email, secret word, and new password are required" });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long" });
    }

    // Find user by email
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "No account found with this email address" });
    }

    const user = userResult.rows[0];

    // Verify secret word
    if (!user.secret_word) {
      return res.status(400).json({ 
        error: "This account was created before secret word feature. Please contact support." 
      });
    }

    const secretWordMatch = await bcrypt.compare(secret_word, user.secret_word);
    if (!secretWordMatch) {
      return res.status(400).json({ error: "Invalid secret word" });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [hashedNewPassword, user.id]
    );

    console.log(`🔐 Password updated for user: ${user.email}`);

    res.json({ 
      success: true, 
      message: "Password updated successfully" 
    });

  } catch (err) {
    console.error("User password update error:", err);
    res.status(500).json({ error: "Server error during password update" });
  }
});

// GET /api/auth/orders - Get customer's orders
router.get("/orders", async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: "Must be logged in to view orders" });
    }

    // Get all orders for the customer with order items
    const ordersResult = await pool.query(`
      SELECT 
        o.id as order_id,
        o.total,
        o.status,
        COALESCE(o.platform_fee, 0) as platform_fee,
        o.created_at,
        o.paid_at,
        oi.id as item_id,
        oi.name as item_name,
        oi.price as item_price,
        oi.quantity,
        r.name as restaurant_name,
        r.id as restaurant_id
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN dishes d ON oi.dish_id = d.id
      LEFT JOIN restaurants r ON d.restaurant_id = r.id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
    `, [userId]);

    // Group orders by order_id
    const groupedOrders = ordersResult.rows.reduce((acc, row) => {
      if (!acc[row.order_id]) {
        acc[row.order_id] = {
          id: row.order_id,
          total: row.total,
          status: row.status || 'pending',
          platform_fee: row.platform_fee,
          created_at: row.created_at,
          paid_at: row.paid_at,
          items: []
        };
      }
      
      acc[row.order_id].items.push({
        id: row.item_id,
        name: row.item_name,
        price: row.item_price,
        quantity: row.quantity,
        restaurant_name: row.restaurant_name,
        restaurant_id: row.restaurant_id
      });
      
      return acc;
    }, {});

    const orders = Object.values(groupedOrders);

    res.json({ orders });
  } catch (err) {
    console.error("Get customer orders error:", err);
    res.status(500).json({ error: "Failed to get orders" });
  }
});

// POST /api/auth/orders/:id/cancel - Cancel customer order with refund request
router.post("/orders/:id/cancel", async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.userId;
    const { reason, requestRefund } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Must be logged in to cancel order" });
    }

    // Check if order exists and belongs to user
    const orderResult = await pool.query(
      "SELECT o.*, u.name as customer_name, u.email as customer_email FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = $1 AND o.user_id = $2",
      [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderResult.rows[0];
    const currentStatus = order.status;

    // Only allow cancellation if order is not yet completed or delivered
    if (currentStatus === 'completed' || currentStatus === 'delivered') {
      return res.status(400).json({ 
        error: "Cannot cancel order that has already been completed or delivered" 
      });
    }

    // Create notifications table if it doesn't exist
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          owner_id INTEGER REFERENCES restaurant_owners(id),
          order_id INTEGER REFERENCES orders(id),
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          data JSONB,
          read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (err) {
      console.log("Notifications table creation check - might already exist");
    }

    // Update order status to cancelled
    await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2",
      ['cancelled', orderId]
    );

    // Get all restaurants involved in this order for notifications
    const restaurantsResult = await pool.query(`
      SELECT DISTINCT r.id as restaurant_id, r.name as restaurant_name, ro.id as owner_id, ro.name as owner_name
      FROM order_items oi
      LEFT JOIN dishes d ON oi.dish_id = d.id
      LEFT JOIN restaurants r ON d.restaurant_id = r.id
      LEFT JOIN restaurant_owners ro ON r.owner_id = ro.id
      WHERE oi.order_id = $1 AND ro.id IS NOT NULL
    `, [orderId]);

    // Create notifications for each restaurant owner
    const notificationPromises = restaurantsResult.rows.map(restaurant => {
      const notificationData = {
        orderId: parseInt(orderId),
        customerId: userId,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        orderTotal: order.total,
        reason: reason || 'No reason provided',
        requestRefund: requestRefund || false,
        restaurantId: restaurant.restaurant_id,
        restaurantName: restaurant.restaurant_name,
        cancelledAt: new Date().toISOString()
      };

      const title = requestRefund 
        ? `🔄 Refund Request - Order #${orderId}`
        : `❌ Order Cancelled - #${orderId}`;

      const message = requestRefund
        ? `Customer ${order.customer_name} cancelled order #${orderId} and requested a refund. Reason: ${reason || 'No reason provided'}. Order total: $${Number(order.total || 0).toFixed(2)}`
        : `Customer ${order.customer_name} cancelled order #${orderId}. Reason: ${reason || 'No reason provided'}. Order total: $${Number(order.total || 0).toFixed(2)}`;

      return pool.query(
        `INSERT INTO notifications (owner_id, order_id, type, title, message, data, read) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [restaurant.owner_id, orderId, requestRefund ? 'refund_request' : 'order_cancelled', title, message, JSON.stringify(notificationData), false]
      );
    });

    await Promise.all(notificationPromises);

    console.log(`📋 Order ${orderId} cancelled by customer ${userId}${requestRefund ? ' with refund request' : ''}`);
    console.log(`📧 Notifications sent to ${restaurantsResult.rows.length} restaurant owner(s)`);

    res.json({ 
      success: true, 
      message: requestRefund 
        ? "Order cancelled and refund request sent to restaurant owner" 
        : "Order cancelled successfully",
      notificationsSent: restaurantsResult.rows.length
    });
  } catch (err) {
    console.error("Cancel order error:", err);
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

// DELETE /api/auth/orders/:id - Remove completed order from customer's order history
router.delete("/orders/:id", async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: "Must be logged in to remove order" });
    }

    // Check if order exists and belongs to user
    const orderCheck = await pool.query(
      "SELECT status FROM orders WHERE id = $1 AND user_id = $2",
      [orderId, userId]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const currentStatus = orderCheck.rows[0].status;

    // Only allow removal of completed or delivered orders
    if (currentStatus !== 'completed' && currentStatus !== 'delivered' && currentStatus !== 'cancelled') {
      return res.status(400).json({ 
        error: "Can only remove completed, delivered, or cancelled orders" 
      });
    }

    // Remove related records first, then the order
    // Remove order items
    await pool.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
    
    // Remove any notifications related to this order (optional cleanup)
    try {
      await pool.query("DELETE FROM notifications WHERE order_id = $1", [orderId]);
    } catch (err) {
      console.log("No notifications to remove or notifications table doesn't exist");
    }
    
    // Finally, remove the order
    await pool.query("DELETE FROM orders WHERE id = $1 AND user_id = $2", [orderId, userId]);

    console.log(`🗑️ Order ${orderId} removed from customer ${userId} order history`);

    res.json({ 
      success: true, 
      message: "Order removed from your order history" 
    });
  } catch (err) {
    console.error("Remove order error:", err);
    res.status(500).json({ error: "Failed to remove order" });
  }
});

// TEMPORARY: Testing endpoint to update order status for debugging
router.post("/orders/:id/update-status", async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.userId;
    const { status } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Must be logged in" });
    }

    // Verify order belongs to user
    const orderCheck = await pool.query(
      "SELECT id FROM orders WHERE id = $1 AND user_id = $2",
      [orderId, userId]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Update status
    await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2",
      [status, orderId]
    );

    console.log(`🔧 TEST: Order ${orderId} status updated to '${status}' for debugging`);

    res.json({ 
      success: true, 
      message: `Order status updated to '${status}'` 
    });
  } catch (err) {
    console.error("Update order status error:", err);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// GET /api/auth/notifications - Get customer notifications
router.get('/notifications', async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: "Must be logged in" });
    }

    // Ensure customer notifications table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS customer_notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          data JSONB DEFAULT '{}',
          read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (err) {
      console.log("Customer notifications table creation check:", err.message);
    }

    // Get all notifications for this customer
    const notificationsResult = await pool.query(`
      SELECT * FROM customer_notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 50
    `, [userId]);

    res.json({ 
      notifications: notificationsResult.rows,
      unreadCount: notificationsResult.rows.filter(n => !n.read).length
    });
  } catch (err) {
    console.error("Get customer notifications error:", err);
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

// POST /api/auth/notifications/:id/mark-read - Mark customer notification as read
router.post('/notifications/:id/mark-read', async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: "Must be logged in" });
    }

    // Mark notification as read (ensure it belongs to this user)
    const result = await pool.query(
      "UPDATE customer_notifications SET read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *",
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ success: true, message: "Notification marked as read" });
  } catch (err) {
    console.error("Mark customer notification read error:", err);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// POST /api/auth/notifications/mark-all-read - Mark all customer notifications as read
router.post('/notifications/mark-all-read', async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: "Must be logged in" });
    }

    await pool.query(
      "UPDATE customer_notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE",
      [userId]
    );

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    console.error("Mark all customer notifications read error:", err);
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

export default router;
