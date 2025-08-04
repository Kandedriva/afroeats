import express from "express";
import bcryptjs from "bcryptjs";
import pool from "../db.js";
import { 
  checkAccountLockout, 
  handleFailedLogin, 
  handleSuccessfulLogin 
} from "../middleware/accountLockout.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// 🔐 REGISTER
router.post("/register", async (req, res) => {
  const { name, email, password, secret_word, address, phone } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const userExists = await client.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userExists.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "User already exists" });
    }

    const saltRounds = 10;
    const hashedPassword = await bcryptjs.hash(password, saltRounds);
    const hashedSecretWord = secret_word ? await bcryptjs.hash(secret_word, saltRounds) : null;

    console.log('Registering user:', { name, email });

    // Try to insert with all fields, with graceful fallbacks
    let newUser;
    try {
      newUser = await client.query(
        "INSERT INTO users (name, email, password, secret_word, address, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email",
        [name, email, hashedPassword, hashedSecretWord, address, phone]
      );
    } catch (err) {
      try {
        // Try with just secret_word (no address/phone)
        newUser = await client.query(
          "INSERT INTO users (name, email, password, secret_word) VALUES ($1, $2, $3, $4) RETURNING id, name, email",
          [name, email, hashedPassword, hashedSecretWord]
        );
      } catch (err2) {
        // Fallback to basic registration if other columns don't exist
        newUser = await client.query(
          "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
          [name, email, hashedPassword]
        );
      }
    }

    // Commit the transaction
    await client.query('COMMIT');

    req.session.userId = newUser.rows[0].id;
    req.session.userName = newUser.rows[0].name.split(" ")[0];

    // Force session save for mobile compatibility
    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
    });

    res.status(201).json({ user: newUser.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Registration error:', err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// 🔑 LOGIN
router.post("/login", checkAccountLockout, async (req, res) => {
    const { email, password } = req.body;
  
    try {
      // 1. Check if user exists
      const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      if (userResult.rows.length === 0) {
        return await handleFailedLogin(req, res, () => {
          const attemptInfo = req.loginAttempts ? ` (${req.loginAttempts.remaining} attempts remaining)` : '';
          res.status(400).json({ 
            error: "Invalid email or password" + attemptInfo,
            attemptsRemaining: req.loginAttempts?.remaining
          });
        });
      }
  
      const user = userResult.rows[0];
  
      // 2. Compare password with hashed password
      const isMatch = await bcryptjs.compare(password, user.password);
      if (!isMatch) {
        return await handleFailedLogin(req, res, () => {
          const attemptInfo = req.loginAttempts ? ` (${req.loginAttempts.remaining} attempts remaining)` : '';
          res.status(400).json({ 
            error: "Invalid email or password" + attemptInfo,
            attemptsRemaining: req.loginAttempts?.remaining
          });
        });
      }
  
      // 3. Clear failed attempts on successful login
      await handleSuccessfulLogin(req, res, () => {});
  
      // 4. Set session data with mobile-friendly settings
      req.session.userId = user.id;
      req.session.userName = user.name.split(" ")[0]; // just first name for greeting
      
      // For mobile users, ensure session is properly saved
      if (req.isMobile) {
        req.session.isMobile = true;
        // Force session save for mobile browsers
        req.session.save((err) => {
          if (err) console.error('Session save error:', err);
        });
      }
  
      // 5. Respond with user info and mobile-friendly headers
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      });
      res.json({ user: { id: user.id, name: user.name, email: user.email } });
  
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Enhanced /me endpoint with mobile session handling
router.get("/me", async (req, res) => {
    // Set mobile-friendly headers
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    if (req.session.userId) {
      try {
        // Get full user info from database
        const userResult = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [req.session.userId]);
        
        if (userResult.rows.length > 0) {
          // Extend session on successful auth check for mobile users
          if (req.isMobile && req.session) {
            req.session.touch(); // This refreshes the session expiry
          }
          res.json(userResult.rows[0]);
        } else {
          // User exists in session but not in DB - clear session
          req.session.destroy((err) => {
            if (err) console.error('Session destroy error:', err);
          });
          res.status(401).json({ error: "User not found" });
        }
      } catch (err) {
        console.error('Auth check error:', err);
        res.status(500).json({ error: "Server error" });
      }
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

// GET /api/auth/profile - Get user's full profile including address and phone
router.get("/profile", async (req, res) => {
  if (req.session.userId) {
    try {
      // Ensure address and phone columns exist
      try {
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT");
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)");
      } catch (err) {
        // Column creation check handled silently
      }

      // Get full user profile from database
      const userResult = await pool.query(
        "SELECT id, name, email, address, phone FROM users WHERE id = $1", 
        [req.session.userId]
      );
      
      if (userResult.rows.length > 0) {
        res.json({ user: userResult.rows[0] });
      } else {
        res.status(401).json({ error: "User not found" });
      }
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  } else {
    res.status(401).json({ error: "Not authenticated" });
  }
});

  router.post("/logout", (req, res) => {
    // Mobile-friendly logout with proper cookie clearing
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout session destroy error:', err);
        return res.status(500).json({ error: "Logout failed" });
      }
      
      // Clear cookie with proper mobile-friendly settings
      res.clearCookie("afoodzone.sid", {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      
      // Set headers to prevent caching
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json({ message: "Logout successful" });
    });
  });

  // Session refresh endpoint for mobile browsers
  router.post("/refresh-session", (req, res) => {
    if (req.session.userId) {
      // Touch the session to extend its life
      req.session.touch();
      req.session.save((err) => {
        if (err) {
          console.error('Session refresh error:', err);
          return res.status(500).json({ error: "Session refresh failed" });
        }
        
        res.json({ 
          message: "Session refreshed", 
          sessionId: req.sessionID,
          isMobile: req.isMobile 
        });
      });
    } else {
      res.status(401).json({ error: "No active session to refresh" });
    }
  });
  
  

// POST /api/auth/update-password - Update user password using secret word
router.post("/update-password", async (req, res) => {
  try {
    const { email, secret_word, new_password } = req.body;

    // Validate input
    if (!email || !secret_word || !new_password) {
      return res.status(400).json({ error: "Email, secret word, and new password are required" });
    }

    if (new_password.length < 12) {
      return res.status(400).json({ error: "New password must be at least 12 characters long" });
    }

    // Enhanced password strength validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
    if (!passwordRegex.test(new_password)) {
      return res.status(400).json({ 
        error: "Password must contain at least one uppercase letter, lowercase letter, number, and special character (@$!%*?&)" 
      });
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

    const secretWordMatch = await bcryptjs.compare(secret_word, user.secret_word);
    if (!secretWordMatch) {
      return res.status(400).json({ error: "Invalid secret word" });
    }

    // Hash new password
    const hashedNewPassword = await bcryptjs.hash(new_password, 10);

    // Update password
    await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [hashedNewPassword, user.id]
    );


    res.json({ 
      success: true, 
      message: "Password updated successfully" 
    });

  } catch (err) {
    res.status(500).json({ error: "Server error during password update" });
  }
});

// GET /api/auth/orders - Get customer's orders
router.get("/orders", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ error: "Must be logged in to view orders" });
    }

    // Ensure restaurant_order_status table exists
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS restaurant_order_status (
          id SERIAL PRIMARY KEY,
          order_id INTEGER REFERENCES orders(id),
          restaurant_id INTEGER REFERENCES restaurants(id),
          status VARCHAR(50) DEFAULT 'active',
          cancelled_at TIMESTAMP,
          cancelled_reason TEXT,
          completed_at TIMESTAMP,
          removed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(order_id, restaurant_id)
        )
      `);
      
      // Add missing columns if they don't exist (for existing tables)
      await pool.query(`
        ALTER TABLE restaurant_order_status 
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP
      `);
      await pool.query(`
        ALTER TABLE restaurant_order_status 
        ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP
      `);
    } catch (err) {
      // Handle table creation/modification silently
    }

    // Get all orders for the customer with order items and restaurant-specific status
    const ordersResult = await pool.query(`
      SELECT 
        o.id as order_id,
        o.total,
        o.status,
        COALESCE(o.platform_fee, 0) as platform_fee,
        COALESCE(o.order_details, '') as order_details,
        COALESCE(o.delivery_address, '') as delivery_address,
        COALESCE(o.delivery_phone, '') as delivery_phone,
        o.created_at,
        o.paid_at,
        oi.id as item_id,
        oi.name as item_name,
        oi.price as item_price,
        oi.quantity,
        r.name as restaurant_name,
        r.id as restaurant_id,
        COALESCE(ros.status, 'active') as restaurant_status,
        ros.cancelled_at as restaurant_cancelled_at,
        ros.cancelled_reason as restaurant_cancelled_reason
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN dishes d ON oi.dish_id = d.id
      LEFT JOIN restaurants r ON COALESCE(oi.restaurant_id, d.restaurant_id) = r.id
      LEFT JOIN restaurant_order_status ros ON (o.id = ros.order_id AND r.id = ros.restaurant_id)
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC
    `, [userId]);

    // Group orders by order_id and then by restaurant
    const groupedOrders = ordersResult.rows.reduce((acc, row) => {
      if (!acc[row.order_id]) {
        acc[row.order_id] = {
          id: row.order_id,
          total: row.total,
          status: row.status || 'pending',
          platform_fee: row.platform_fee,
          order_details: row.order_details,
          delivery_address: row.delivery_address,
          delivery_phone: row.delivery_phone,
          created_at: row.created_at,
          paid_at: row.paid_at,
          items: [],
          restaurants: {}
        };
      }
      
      // Group items by restaurant
      if (!acc[row.order_id].restaurants[row.restaurant_id]) {
        acc[row.order_id].restaurants[row.restaurant_id] = {
          restaurant_id: row.restaurant_id,
          restaurant_name: row.restaurant_name,
          restaurant_status: row.restaurant_status,
          restaurant_cancelled_at: row.restaurant_cancelled_at,
          restaurant_cancelled_reason: row.restaurant_cancelled_reason,
          items: [],
          subtotal: 0
        };
      }

      const restaurantOrder = acc[row.order_id].restaurants[row.restaurant_id];
      restaurantOrder.items.push({
        id: row.item_id,
        name: row.item_name,
        price: row.item_price,
        quantity: row.quantity,
        restaurant_name: row.restaurant_name,
        restaurant_id: row.restaurant_id
      });
      restaurantOrder.subtotal += Number(row.item_price || 0) * Number(row.quantity || 1);
      
      // Also add to main items array for backward compatibility
      acc[row.order_id].items.push({
        id: row.item_id,
        name: row.item_name,
        price: row.item_price,
        quantity: row.quantity,
        restaurant_name: row.restaurant_name,
        restaurant_id: row.restaurant_id,
        restaurant_status: row.restaurant_status
      });
      
      return acc;
    }, {});

    const orders = Object.values(groupedOrders);

    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: "Failed to get orders" });
  }
});

// POST /api/auth/orders/:id/cancel-restaurant - Cancel specific restaurant items from an order
router.post("/orders/:id/cancel-restaurant", requireAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const userId = req.session.userId;
    const { restaurantId, reason, requestRefund } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Must be logged in to cancel order items" });
    }

    if (!restaurantId) {
      return res.status(400).json({ error: "Restaurant ID is required" });
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
        error: "Cannot cancel items from order that has already been completed or delivered" 
      });
    }

    // Get items from the specific restaurant in this order
    const restaurantItemsResult = await pool.query(`
      SELECT oi.*, r.name as restaurant_name, ro.id as owner_id, ro.name as owner_name
      FROM order_items oi
      LEFT JOIN dishes d ON oi.dish_id = d.id
      LEFT JOIN restaurants r ON COALESCE(oi.restaurant_id, d.restaurant_id) = r.id
      LEFT JOIN restaurant_owners ro ON r.owner_id = ro.id
      WHERE oi.order_id = $1 AND r.id = $2
    `, [orderId, restaurantId]);

    if (restaurantItemsResult.rows.length === 0) {
      return res.status(404).json({ error: "No items found from this restaurant in the order" });
    }

    // Calculate restaurant-specific total
    const restaurantTotal = restaurantItemsResult.rows.reduce((sum, item) => 
      sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0
    );

    // Create restaurant_order_status table if it doesn't exist
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS restaurant_order_status (
          id SERIAL PRIMARY KEY,
          order_id INTEGER REFERENCES orders(id),
          restaurant_id INTEGER REFERENCES restaurants(id),
          status VARCHAR(50) DEFAULT 'active',
          cancelled_at TIMESTAMP,
          cancelled_reason TEXT,
          completed_at TIMESTAMP,
          removed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(order_id, restaurant_id)
        )
      `);
      
      // Add missing columns if they don't exist (for existing tables)
      await pool.query(`
        ALTER TABLE restaurant_order_status 
        ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP
      `);
      await pool.query(`
        ALTER TABLE restaurant_order_status 
        ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP
      `);
    } catch (err) {
      // Handle table creation/modification silently
    }

    // Mark restaurant items as cancelled in the restaurant_order_status table
    await pool.query(`
      INSERT INTO restaurant_order_status (order_id, restaurant_id, status, cancelled_at, cancelled_reason)
      VALUES ($1, $2, 'cancelled', NOW(), $3)
      ON CONFLICT (order_id, restaurant_id) 
      DO UPDATE SET status = 'cancelled', cancelled_at = NOW(), cancelled_reason = $3
    `, [orderId, restaurantId, reason || 'Customer cancelled']);

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
      // Handle table creation silently
    }

    // Create notification for the specific restaurant owner
    const restaurantInfo = restaurantItemsResult.rows[0];
    const notificationData = {
      orderId: parseInt(orderId),
      customerId: userId,
      customerName: order.customer_name,
      customerEmail: order.customer_email,
      orderTotal: order.total,
      restaurantTotal: restaurantTotal,
      reason: reason || 'No reason provided',
      requestRefund: requestRefund || false,
      restaurantId: parseInt(restaurantId),
      restaurantName: restaurantInfo.restaurant_name,
      itemCount: restaurantItemsResult.rows.length,
      cancelledAt: new Date().toISOString()
    };

    const title = requestRefund 
      ? `🔄 Partial Refund Request - Order #${orderId}`
      : `❌ Items Cancelled - Order #${orderId}`;

    const message = requestRefund
      ? `Customer ${order.customer_name} cancelled their items from your restaurant in order #${orderId} and requested a refund. Reason: ${reason || 'No reason provided'}. Amount: $${restaurantTotal.toFixed(2)} (${restaurantItemsResult.rows.length} item${restaurantItemsResult.rows.length !== 1 ? 's' : ''})`
      : `Customer ${order.customer_name} cancelled their items from your restaurant in order #${orderId}. Reason: ${reason || 'No reason provided'}. Amount: $${restaurantTotal.toFixed(2)} (${restaurantItemsResult.rows.length} item${restaurantItemsResult.rows.length !== 1 ? 's' : ''})`;

    await pool.query(
      `INSERT INTO notifications (owner_id, order_id, type, title, message, data, read) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [restaurantInfo.owner_id, orderId, requestRefund ? 'refund_request' : 'partial_cancellation', title, message, JSON.stringify(notificationData), false]
    );

    // Check if all restaurants in the order have been cancelled
    const allItemsResult = await pool.query(`
      SELECT DISTINCT r.id as restaurant_id
      FROM order_items oi
      LEFT JOIN dishes d ON oi.dish_id = d.id
      LEFT JOIN restaurants r ON COALESCE(oi.restaurant_id, d.restaurant_id) = r.id
      WHERE oi.order_id = $1
    `, [orderId]);

    const cancelledRestaurantsResult = await pool.query(
      "SELECT restaurant_id FROM restaurant_order_status WHERE order_id = $1 AND status = 'cancelled'",
      [orderId]
    );

    // If all restaurants are cancelled, mark the entire order as cancelled
    if (cancelledRestaurantsResult.rows.length === allItemsResult.rows.length) {
      await pool.query(
        "UPDATE orders SET status = $1 WHERE id = $2",
        ['cancelled', orderId]
      );
    }

    res.json({ 
      success: true, 
      message: requestRefund 
        ? `Items from ${restaurantInfo.restaurant_name} cancelled and refund request sent to restaurant owner` 
        : `Items from ${restaurantInfo.restaurant_name} cancelled successfully`,
      restaurantName: restaurantInfo.restaurant_name,
      cancelledAmount: restaurantTotal.toFixed(2)
    });
  } catch (err) {
    console.error('Restaurant cancellation error:', err);
    res.status(500).json({ error: "Failed to cancel restaurant items" });
  }
});

// POST /api/auth/orders/:id/cancel - Cancel entire order (all restaurants)
router.post("/orders/:id/cancel", requireAuth, async (req, res) => {
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
    }

    // Update order status to cancelled
    await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2",
      ['cancelled', orderId]
    );

    // Get all restaurants involved in this order with their specific order amounts
    const restaurantsResult = await pool.query(`
      SELECT 
        r.id as restaurant_id, 
        r.name as restaurant_name, 
        ro.id as owner_id, 
        ro.name as owner_name,
        SUM(oi.price * oi.quantity) as restaurant_total,
        COUNT(oi.id) as item_count
      FROM order_items oi
      LEFT JOIN dishes d ON oi.dish_id = d.id
      LEFT JOIN restaurants r ON COALESCE(oi.restaurant_id, d.restaurant_id) = r.id
      LEFT JOIN restaurant_owners ro ON r.owner_id = ro.id
      WHERE oi.order_id = $1 AND ro.id IS NOT NULL
      GROUP BY r.id, r.name, ro.id, ro.name
    `, [orderId]);

    // Create notifications for each restaurant owner with their specific refund amount
    const notificationPromises = restaurantsResult.rows.map(restaurant => {
      const restaurantTotal = Number(restaurant.restaurant_total || 0);
      
      const notificationData = {
        orderId: parseInt(orderId),
        customerId: userId,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        orderTotal: order.total, // Keep total order amount for reference
        restaurantTotal: restaurantTotal, // Amount specific to this restaurant
        reason: reason || 'No reason provided',
        requestRefund: requestRefund || false,
        restaurantId: restaurant.restaurant_id,
        restaurantName: restaurant.restaurant_name,
        itemCount: restaurant.item_count,
        cancelledAt: new Date().toISOString()
      };

      const title = requestRefund 
        ? `🔄 Refund Request - Order #${orderId}`
        : `❌ Order Cancelled - #${orderId}`;

      const message = requestRefund
        ? `Customer ${order.customer_name} cancelled order #${orderId} and requested a refund. Reason: ${reason || 'No reason provided'}. Your restaurant portion: $${restaurantTotal.toFixed(2)} (${restaurant.item_count} item${restaurant.item_count !== '1' ? 's' : ''})`
        : `Customer ${order.customer_name} cancelled order #${orderId}. Reason: ${reason || 'No reason provided'}. Your restaurant portion: $${restaurantTotal.toFixed(2)} (${restaurant.item_count} item${restaurant.item_count !== '1' ? 's' : ''})`;

      return pool.query(
        `INSERT INTO notifications (owner_id, order_id, type, title, message, data, read) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [restaurant.owner_id, orderId, requestRefund ? 'refund_request' : 'order_cancelled', title, message, JSON.stringify(notificationData), false]
      );
    });

    await Promise.all(notificationPromises);


    res.json({ 
      success: true, 
      message: requestRefund 
        ? "Order cancelled and refund request sent to restaurant owner" 
        : "Order cancelled successfully",
      notificationsSent: restaurantsResult.rows.length
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

// DELETE /api/auth/orders/:id - Remove completed order from customer's order history
router.delete("/orders/:id", requireAuth, async (req, res) => {
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

    // Use a transaction to ensure all deletions succeed
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Remove order items
      await client.query("DELETE FROM order_items WHERE order_id = $1", [orderId]);
      
      // Remove any restaurant order status records
      try {
        await client.query("DELETE FROM restaurant_order_status WHERE order_id = $1", [orderId]);
      } catch (err) {
        // Table might not exist, ignore
      }
      
      // Remove any restaurant payments records (this is causing the foreign key constraint)
      try {
        await client.query("DELETE FROM restaurant_payments WHERE order_id = $1", [orderId]);
      } catch (err) {
        // Table might not exist, ignore
      }
      
      // Remove any notifications related to this order (optional cleanup)
      try {
        await client.query("DELETE FROM notifications WHERE order_id = $1", [orderId]);
        await client.query("DELETE FROM customer_notifications WHERE data->>'orderId' = $1", [orderId]);
      } catch (err) {
        // Tables might not exist, ignore
      }
      
      // Finally, remove the order
      await client.query("DELETE FROM orders WHERE id = $1 AND user_id = $2", [orderId, userId]);
      
      await client.query('COMMIT');
      
      res.json({ 
        success: true, 
        message: "Order removed from your order history" 
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Transaction error during order deletion:', err);
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete order error:', err);
    
    // Check if it's still a foreign key constraint error and provide more specific info
    if (err.code === '23503') {
      const constraintMatch = err.message.match(/violates foreign key constraint "([^"]+)"/);
      const tableMatch = err.message.match(/on table "([^"]+)"/);
      const constraint = constraintMatch ? constraintMatch[1] : 'unknown';
      const table = tableMatch ? tableMatch[1] : 'unknown';
      
      console.error(`Foreign key constraint violation: ${constraint} on table ${table}`);
      res.status(500).json({ 
        error: `Cannot remove order due to related data in ${table} table. Please contact support.` 
      });
    } else {
      res.status(500).json({ error: "Failed to remove order: " + err.message });
    }
  }
});

// TEMPORARY: Testing endpoint to update order status for debugging
router.post("/orders/:id/update-status", requireAuth, async (req, res) => {
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


    res.json({ 
      success: true, 
      message: `Order status updated to '${status}'` 
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// GET /api/auth/notifications - Get customer notifications
router.get('/notifications', requireAuth, async (req, res) => {
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
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

// POST /api/auth/notifications/:id/mark-read - Mark customer notification as read
router.post('/notifications/:id/mark-read', requireAuth, async (req, res) => {
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
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// POST /api/auth/notifications/mark-all-read - Mark all customer notifications as read
router.post('/notifications/mark-all-read', requireAuth, async (req, res) => {
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
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

// DELETE /api/auth/notifications/delete-read - Delete all read customer notifications
router.delete('/notifications/delete-read', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "Must be logged in to delete notifications" });
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
      // Handle table creation silently
    }

    // Delete all read notifications for this customer
    const result = await pool.query(
      "DELETE FROM customer_notifications WHERE user_id = $1 AND read = TRUE",
      [userId]
    );

    res.json({ 
      success: true, 
      message: "Read notifications deleted successfully",
      deletedCount: result.rowCount
    });
  } catch (err) {
    console.error('Delete read notifications error:', err);
    res.status(500).json({ error: "Failed to delete read notifications" });
  }
});

// PUT /api/auth/update-profile - Update user profile information
router.put('/update-profile', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { name, email, phone, address } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Must be logged in to update profile" });
    }

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Validate email format
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }

    // Check if email is already taken by another user
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1 AND id != $2",
      [email.trim().toLowerCase(), userId]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Email address is already in use" });
    }

    // Ensure address and phone columns exist
    try {
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)");
    } catch (err) {
    }

    // Update user profile
    const updateResult = await pool.query(
      `UPDATE users 
       SET name = $1, email = $2, phone = $3, address = $4 
       WHERE id = $5 
       RETURNING id, name, email, phone, address`,
      [name.trim(), email.trim().toLowerCase(), phone?.trim() || null, address?.trim() || null, userId]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const updatedUser = updateResult.rows[0];

    // Update session with new user name if changed
    req.session.userName = updatedUser.name.split(" ")[0];


    res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser
    });

  } catch (err) {
    res.status(500).json({ error: "Server error while updating profile" });
  }
});

export default router;
