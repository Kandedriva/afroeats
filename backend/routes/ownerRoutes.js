import express from "express";
import multer from "multer";
import bcrypt from "bcrypt";
import pool from "../db.js";
import path from "path";
import fs from "fs";

const router = express.Router();

// ========= MULTER STORAGE FOR RESTAURANT LOGOS ==========
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/restaurant_logos";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `logo-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});
const uploadLogo = multer({ storage: logoStorage });

// ========= OWNER REGISTRATION ==========
router.post("/register", uploadLogo.single("logo"), async (req, res) => {
  const { name, email, password, secret_word, restaurant_name, location, phone_number } = req.body;
  const logoPath = req.file ? `/uploads/restaurant_logos/${req.file.filename}` : null;

  try {
    const existing = await pool.query("SELECT * FROM restaurant_owners WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Owner already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedSecretWord = await bcrypt.hash(secret_word, 10);

    // Create owner (handle case where columns might not exist)
    let ownerResult;
    try {
      // Try with both secret_word and is_subscribed columns
      ownerResult = await pool.query(
        `INSERT INTO restaurant_owners (name, email, password, secret_word, is_subscribed)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email`,
        [name, email, hashedPassword, hashedSecretWord, false]
      );
    } catch (err) {
      console.log("Trying registration without some columns:", err.message);
      try {
        // Try with just secret_word (no is_subscribed)
        ownerResult = await pool.query(
          `INSERT INTO restaurant_owners (name, email, password, secret_word)
           VALUES ($1, $2, $3, $4) RETURNING id, name, email`,
          [name, email, hashedPassword, hashedSecretWord]
        );
      } catch (err2) {
        // If secret_word column doesn't exist either, fallback to basic registration
        console.log("Trying registration with basic columns only");
        ownerResult = await pool.query(
          `INSERT INTO restaurant_owners (name, email, password)
           VALUES ($1, $2, $3) RETURNING id, name, email`,
          [name, email, hashedPassword]
        );
      }
    }
    const ownerId = ownerResult.rows[0].id;

    // Create restaurant
    const restaurantResult = await pool.query(
      `INSERT INTO restaurants (name, address, phone_number, image_url, owner_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [restaurant_name, location, phone_number, logoPath, ownerId]
    );

    // Set session
    req.session.ownerId = ownerId;
    req.session.ownerName = name;

    res.status(201).json({
      owner: ownerResult.rows[0],
      restaurant: restaurantResult.rows[0],
    });
  } catch (err) {
    console.error("Owner registration error:", err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// ========= OWNER LOGING ==========
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if owner exists
    const ownerRes = await pool.query("SELECT * FROM restaurant_owners WHERE email = $1", [email]);

    if (ownerRes.rows.length === 0) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const owner = ownerRes.rows[0];

    // Compare password
    const match = await bcrypt.compare(password, owner.password);
    if (!match) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Set session
    req.session.ownerId = owner.id;
    req.session.ownerName = owner.name;

    res.json({ message: "Login successful", owner: { id: owner.id, name: owner.name, email: owner.email } });
  } catch (err) {
    console.error("Owner login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});


// ========= OWNER LOGOUT ==========
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Failed to log out" });
    }

    res.clearCookie("connect.sid"); // default session cookie name
    res.status(200).json({ message: "Logged out successfully" });
  });
});


// ========= MULTER STORAGE FOR DISH IMAGES ==========
const dishStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/dish_images";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `dish-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});
const uploadDish = multer({ storage: dishStorage });

// ========= ADD DISH ==========
router.post("/dishes", uploadDish.single("image"), async (req, res) => {
  const { name, description = "", price, available } = req.body;
  const imagePath = req.file ? `/uploads/dish_images/${req.file.filename}` : null;

  try {
    const ownerId = req.session.ownerId;
    if (!ownerId) {
      return res.status(401).json({ error: "Unauthorized. Please log in as an owner." });
    }

    const restaurant = await pool.query("SELECT id FROM restaurants WHERE owner_id = $1", [ownerId]);
    if (restaurant.rows.length === 0) {
      return res.status(404).json({ error: "No restaurant found for this owner" });
    }

    const restaurantId = restaurant.rows[0].id;

    const newDish = await pool.query(
      `INSERT INTO dishes (name, description, price, image_url, restaurant_id, is_available)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description, price, imagePath, restaurantId, available === "true"]
    );

    res.status(201).json({ dish: newDish.rows[0] });
  } catch (err) {
    console.error("Add dish error:", err);
    res.status(500).json({ error: "Server error while adding dish" });
  }
});

// ========= OWNER DASHBOARD ==========
router.get("/dashboard", async (req, res) => {
  const ownerId = req.session.ownerId;
  if (!ownerId) return res.status(401).json({ error: "Not authorized" });

  try {
    const restaurantRes = await pool.query(
      "SELECT id, name FROM restaurants WHERE owner_id = $1",
      [ownerId]
    );

    if (restaurantRes.rows.length === 0) {
      return res.status(404).json({ error: "No restaurant found for this owner." });
    }

    const restaurant = restaurantRes.rows[0];

    const dishesRes = await pool.query(
      "SELECT * FROM dishes WHERE restaurant_id = $1",
      [restaurant.id]
    );

    const formattedDishes = dishesRes.rows.map(d => ({
      ...d,
      image_url: d.image_url ? d.image_url.replace(/\\/g, "/") : null
    }));

    const ordersRes = await pool.query(
      `
      SELECT 
        o.id AS order_id,
        o.created_at,
        u.name AS customer_name,
        d.name AS dish_name,
        d.image_url,
        d.price,
        oi.quantity,
        r.name AS restaurant_name
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN dishes d ON oi.dish_id = d.id
      JOIN restaurants r ON d.restaurant_id = r.id
      JOIN restaurant_owners ro ON r.owner_id = ro.id
      JOIN users u ON o.user_id = u.id
      WHERE ro.id = $1
      ORDER BY o.created_at DESC
      `,
      [ownerId]
    );

    res.json({
      dishes: formattedDishes,
      orders: ordersRes.rows.map(order => ({
        ...order,
        image_url: order.image_url ? order.image_url.replace(/\\/g, "/") : null
      })),
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Server error while fetching dashboard data" });
  }
});

// ========= TOGGLE DISH AVAILABILITY ==========
router.patch("/dishes/:id/availability", async (req, res) => {
  const ownerId = req.session.ownerId;
  const dishId = req.params.id;
  const { isAvailable } = req.body;

  if (!ownerId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const ownershipCheck = await pool.query(
      `SELECT d.id FROM dishes d
       JOIN restaurants r ON d.restaurant_id = r.id
       WHERE d.id = $1 AND r.owner_id = $2`,
      [dishId, ownerId]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ error: "Not authorized to update this dish" });
    }

    await pool.query(
      "UPDATE dishes SET is_available = $1 WHERE id = $2",
      [isAvailable, dishId]
    );

    res.sendStatus(204);
  } catch (err) {
    console.error("Availability toggle error:", err);
    res.status(500).json({ error: "Server error while updating availability" });
  }
});

// GET /api/owners/check-session
router.get("/check-session", (req, res) => {
  if (req.session.ownerId) {
    res.json({
      owner: {
        id: req.session.ownerId,
        name: req.session.ownerName,
      },
    });
  } else {
    res.status(401).json({ error: "Not logged in" });
  }
});

// Check current owner session
router.get("/me", (req, res) => {
  if (req.session.ownerId) {
    res.json({
      id: req.session.ownerId,
      name: req.session.ownerName,
    });
  } else {
    res.status(401).json({ error: "Not logged in" });
  }
});

// Get restaurant info for owner
router.get("/restaurant", async (req, res) => {
  const ownerId = req.session.ownerId;
  if (!ownerId) return res.status(401).json({ error: "Not authorized" });

  try {
    const restaurantRes = await pool.query(
      "SELECT * FROM restaurants WHERE owner_id = $1",
      [ownerId]
    );

    if (restaurantRes.rows.length === 0) {
      return res.status(404).json({ error: "No restaurant found for this owner." });
    }

    const restaurant = restaurantRes.rows[0];
    
    res.json({
      ...restaurant,
      image_url: restaurant.image_url ? restaurant.image_url.replace(/\\/g, "/") : null
    });
  } catch (err) {
    console.error("Restaurant fetch error:", err);
    res.status(500).json({ error: "Server error while fetching restaurant data" });
  }
});

// GET /api/owners/orders - Get orders for restaurant owner
router.get("/orders", async (req, res) => {
  try {
    const ownerId = req.session.ownerId;
    
    if (!ownerId) {
      return res.status(401).json({ error: "Must be logged in as owner" });
    }

    // First, ensure address and phone columns exist in users table
    try {
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)");
    } catch (err) {
      console.log("Column creation check - columns might already exist");
    }

    // Get all orders for restaurants owned by this owner
    const ordersResult = await pool.query(`
      SELECT 
        o.id as order_id,
        o.total,
        o.status,
        COALESCE(o.platform_fee, 0) as platform_fee,
        o.created_at,
        o.paid_at,
        u.name as customer_name,
        u.email as customer_email,
        COALESCE(u.address, 'No address provided') as customer_address,
        COALESCE(u.phone, 'No phone provided') as customer_phone,
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
      JOIN restaurant_owners ro ON r.owner_id = ro.id
      JOIN users u ON o.user_id = u.id
      WHERE ro.id = $1 AND (o.status = 'paid' OR o.status IS NULL)
      ORDER BY o.created_at DESC
    `, [ownerId]);

    // Group orders by order_id
    const groupedOrders = ordersResult.rows.reduce((acc, row) => {
      if (!acc[row.order_id]) {
        acc[row.order_id] = {
          id: row.order_id,
          total: row.total,
          status: row.status,
          platform_fee: row.platform_fee,
          created_at: row.created_at,
          paid_at: row.paid_at,
          customer_name: row.customer_name,
          customer_email: row.customer_email,
          customer_address: row.customer_address,
          customer_phone: row.customer_phone,
          items: []
        };
      }
      
      // Only include items from this owner's restaurants
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
    console.error("Get owner orders error:", err);
    res.status(500).json({ error: "Failed to get orders" });
  }
});

// POST /api/owners/update-password - Update owner password using secret word
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

    // Find owner by email
    const ownerResult = await pool.query(
      "SELECT * FROM restaurant_owners WHERE email = $1",
      [email]
    );

    if (ownerResult.rows.length === 0) {
      return res.status(404).json({ error: "No account found with this email address" });
    }

    const owner = ownerResult.rows[0];

    // Verify secret word
    if (!owner.secret_word) {
      return res.status(400).json({ 
        error: "This account was created before secret word feature. Please contact support." 
      });
    }

    const secretWordMatch = await bcrypt.compare(secret_word, owner.secret_word);
    if (!secretWordMatch) {
      return res.status(400).json({ error: "Invalid secret word" });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await pool.query(
      "UPDATE restaurant_owners SET password = $1 WHERE id = $2",
      [hashedNewPassword, owner.id]
    );

    console.log(`🔐 Password updated for owner: ${owner.email}`);

    res.json({ 
      success: true, 
      message: "Password updated successfully" 
    });

  } catch (err) {
    console.error("Password update error:", err);
    res.status(500).json({ error: "Server error during password update" });
  }
});

// POST /api/owners/orders/:id/complete - Mark order as completed
router.post("/orders/:id/complete", async (req, res) => {
  try {
    const orderId = req.params.id;
    const ownerId = req.session.ownerId;

    if (!ownerId) {
      return res.status(401).json({ error: "Must be logged in as owner" });
    }

    // Verify the order belongs to this owner's restaurant
    const verifyResult = await pool.query(`
      SELECT o.id 
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN dishes d ON oi.dish_id = d.id
      LEFT JOIN restaurants r ON d.restaurant_id = r.id
      JOIN restaurant_owners ro ON r.owner_id = ro.id
      WHERE o.id = $1 AND ro.id = $2
      LIMIT 1
    `, [orderId, ownerId]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found or not accessible" });
    }

    // Update order status to completed
    await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2",
      ['completed', orderId]
    );

    console.log(`✅ Order ${orderId} marked as completed by owner ${ownerId}`);

    res.json({ 
      success: true, 
      message: "Order marked as completed successfully" 
    });
  } catch (err) {
    console.error("Complete order error:", err);
    res.status(500).json({ error: "Failed to complete order" });
  }
});

// GET /api/owners/notifications - Get notifications for restaurant owner
router.get("/notifications", async (req, res) => {
  try {
    const ownerId = req.session.ownerId;

    if (!ownerId) {
      return res.status(401).json({ error: "Must be logged in as owner" });
    }

    // Get all notifications for this owner
    const notificationsResult = await pool.query(`
      SELECT 
        n.*,
        o.total as order_total,
        o.created_at as order_created_at
      FROM notifications n
      LEFT JOIN orders o ON n.order_id = o.id
      WHERE n.owner_id = $1
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [ownerId]);

    res.json({ 
      notifications: notificationsResult.rows,
      unreadCount: notificationsResult.rows.filter(n => !n.read).length
    });
  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

// POST /api/owners/notifications/:id/mark-read - Mark notification as read
router.post("/notifications/:id/mark-read", async (req, res) => {
  try {
    const notificationId = req.params.id;
    const ownerId = req.session.ownerId;

    if (!ownerId) {
      return res.status(401).json({ error: "Must be logged in as owner" });
    }

    // Mark notification as read (ensure it belongs to this owner)
    const result = await pool.query(
      "UPDATE notifications SET read = TRUE WHERE id = $1 AND owner_id = $2 RETURNING *",
      [notificationId, ownerId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ success: true, message: "Notification marked as read" });
  } catch (err) {
    console.error("Mark notification read error:", err);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// POST /api/owners/notifications/mark-all-read - Mark all notifications as read
router.post("/notifications/mark-all-read", async (req, res) => {
  try {
    const ownerId = req.session.ownerId;

    if (!ownerId) {
      return res.status(401).json({ error: "Must be logged in as owner" });
    }

    await pool.query(
      "UPDATE notifications SET read = TRUE WHERE owner_id = $1 AND read = FALSE",
      [ownerId]
    );

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    console.error("Mark all notifications read error:", err);
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

// POST /api/owners/refunds/:notificationId/process - Process refund request
router.post("/refunds/:notificationId/process", async (req, res) => {
  try {
    const notificationId = req.params.notificationId;
    const ownerId = req.session.ownerId;
    const { action, notes } = req.body; // action: 'approve' or 'deny'

    if (!ownerId) {
      return res.status(401).json({ error: "Must be logged in as owner" });
    }

    // Get the notification and verify ownership
    const notificationResult = await pool.query(
      "SELECT * FROM notifications WHERE id = $1 AND owner_id = $2 AND type = 'refund_request'",
      [notificationId, ownerId]
    );

    if (notificationResult.rows.length === 0) {
      return res.status(404).json({ error: "Refund request not found" });
    }

    const notification = notificationResult.rows[0];
    const notificationData = notification.data;

    // Update notification with refund decision
    const updatedData = {
      ...notificationData,
      refundProcessed: true,
      refundAction: action,
      refundNotes: notes || '',
      processedAt: new Date().toISOString(),
      processedBy: ownerId
    };

    await pool.query(
      "UPDATE notifications SET data = $1, read = TRUE WHERE id = $2",
      [JSON.stringify(updatedData), notificationId]
    );

    // Log the refund decision
    console.log(`💰 Refund ${action} for order #${notification.order_id} by owner ${ownerId}`);
    console.log(`📝 Notes: ${notes || 'No notes provided'}`);

    res.json({ 
      success: true, 
      message: `Refund request ${action}d successfully`,
      action: action
    });
  } catch (err) {
    console.error("Process refund error:", err);
    res.status(500).json({ error: "Failed to process refund request" });
  }
});

export default router;
