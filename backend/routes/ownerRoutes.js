import express from "express";
import bcryptjs from "bcryptjs";
import pool from "../db.js";
import { requireOwnerAuth } from "../middleware/ownerAuth.js";
import { 
  checkAccountLockout, 
  handleFailedLogin, 
  handleSuccessfulLogin 
} from "../middleware/accountLockout.js";
import { 
  uploadRestaurantLogo, 
  uploadDishImage, 
  handleR2UploadResult, 
  deleteOldR2Image 
} from "../middleware/r2Upload.js";

const router = express.Router();

// Note: Image upload configurations now handled by R2 middleware

// ========= OWNER REGISTRATION ==========
router.post("/register", ...uploadRestaurantLogo, async (req, res) => {
  const { name, email, password, secret_word, restaurant_name, location, phone_number } = req.body;
  
  // Handle R2 upload result
  const uploadResult = handleR2UploadResult(req);
  let logoPath = null;

  if (uploadResult.success && uploadResult.imageUrl) {
    logoPath = uploadResult.imageUrl;
  } else if (uploadResult.error) {
    console.warn('Logo upload to R2 failed:', uploadResult.error);
    // Continue without logo - could implement fallback to local storage here if needed
  }

  try {
    const existing = await pool.query("SELECT * FROM restaurant_owners WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Owner already exists" });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const hashedSecretWord = await bcryptjs.hash(secret_word, 10);

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
      // Trying registration without some columns
      try {
        // Try with just secret_word (no is_subscribed)
        ownerResult = await pool.query(
          `INSERT INTO restaurant_owners (name, email, password, secret_word)
           VALUES ($1, $2, $3, $4) RETURNING id, name, email`,
          [name, email, hashedPassword, hashedSecretWord]
        );
      } catch (err2) {
        // If secret_word column doesn't exist either, fallback to basic registration
        // Trying registration with basic columns only
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
    // Owner registration error
    res.status(500).json({ error: "Server error during registration" });
  }
});

// ========= OWNER LOGING ==========
router.post("/login", checkAccountLockout, async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if owner exists
    const ownerRes = await pool.query("SELECT * FROM restaurant_owners WHERE email = $1", [email]);

    if (ownerRes.rows.length === 0) {
      await handleFailedLogin(req, res, () => {});
      const attemptInfo = req.loginAttempts ? ` (${req.loginAttempts.remaining} attempts remaining)` : '';
      return res.status(400).json({ 
        error: "Invalid email or password" + attemptInfo,
        attemptsRemaining: req.loginAttempts?.remaining
      });
    }

    const owner = ownerRes.rows[0];

    // Compare password
    const match = await bcryptjs.compare(password, owner.password);
    if (!match) {
      await handleFailedLogin(req, res, () => {});
      const attemptInfo = req.loginAttempts ? ` (${req.loginAttempts.remaining} attempts remaining)` : '';
      return res.status(400).json({ 
        error: "Invalid email or password" + attemptInfo,
        attemptsRemaining: req.loginAttempts?.remaining
      });
    }

    // Clear failed attempts on successful login
    await handleSuccessfulLogin(req, res, () => {});

    // Set session
    req.session.ownerId = owner.id;
    req.session.ownerName = owner.name;
    req.session.ownerEmail = owner.email;

    res.json({ message: "Login successful", owner: { id: owner.id, name: owner.name, email: owner.email } });
  } catch (err) {
    console.error('Owner login error:', err);
    res.status(500).json({ error: "Server error during login" });
  }
});


// ========= OWNER LOGOUT ==========
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      // Logout error
      return res.status(500).json({ error: "Failed to log out" });
    }

    res.clearCookie("orderdabaly.sid", {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }); // Match the session cookie name
    res.status(200).json({ message: "Logged out successfully" });
  });
});



// ========= ADD DISH ==========
router.post("/dishes", requireOwnerAuth, ...uploadDishImage, async (req, res) => {
  const { name, description = "", price, available } = req.body;
  
  // Handle R2 upload result
  const uploadResult = handleR2UploadResult(req);
  let imagePath = null;

  if (uploadResult.success && uploadResult.imageUrl) {
    imagePath = uploadResult.imageUrl;
  } else if (uploadResult.error) {
    console.warn('Dish image upload to R2 failed:', uploadResult.error);
    // Continue without image - could implement fallback to local storage here if needed
  }

  try {
    const ownerId = req.owner.id;

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
    // Add dish error
    res.status(500).json({ error: "Server error while adding dish" });
  }
});

// ========= OWNER DASHBOARD ==========
router.get("/dashboard", requireOwnerAuth, async (req, res) => {
  const ownerId = req.owner.id;

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
    // Dashboard error
    res.status(500).json({ error: "Server error while fetching dashboard data" });
  }
});

// ========= TOGGLE DISH AVAILABILITY ==========
router.patch("/dishes/:id/availability", requireOwnerAuth, async (req, res) => {
  const ownerId = req.owner.id;
  const dishId = req.params.id;
  const { isAvailable } = req.body;

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
    // Availability toggle error
    res.status(500).json({ error: "Server error while updating availability" });
  }
});

// ========= UPDATE DISH ==========
router.put("/dishes/:id", requireOwnerAuth, ...uploadDishImage, async (req, res) => {
  const ownerId = req.owner.id;
  const dishId = req.params.id;
  const { name, description = "", price } = req.body;

  try {
    // Verify ownership
    const ownershipCheck = await pool.query(
      `SELECT d.id, d.image_url FROM dishes d
       JOIN restaurants r ON d.restaurant_id = r.id
       WHERE d.id = $1 AND r.owner_id = $2`,
      [dishId, ownerId]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ error: "Not authorized to update this dish" });
    }

    const existingDish = ownershipCheck.rows[0];
    
    // Handle R2 upload result for new image
    const uploadResult = handleR2UploadResult(req);
    let imagePath = existingDish.image_url; // Keep existing image by default

    if (uploadResult.success && uploadResult.imageUrl) {
      // New image uploaded successfully
      imagePath = uploadResult.imageUrl;
      
      // Delete old image from R2 if it exists and is different
      if (existingDish.image_url && existingDish.image_url !== imagePath) {
        try {
          await deleteOldR2Image(existingDish.image_url);
        } catch (deleteErr) {
          console.warn('Failed to delete old dish image from R2:', deleteErr);
          // Continue anyway - don't fail the update
        }
      }
    } else if (uploadResult.error) {
      // If there was an upload attempt but it failed, return error
      return res.status(400).json({ error: uploadResult.error });
    }

    // Update the dish
    const updatedDish = await pool.query(
      `UPDATE dishes SET name = $1, description = $2, price = $3, image_url = $4
       WHERE id = $5 RETURNING *`,
      [name, description, price, imagePath, dishId]
    );

    const formattedDish = {
      ...updatedDish.rows[0],
      image_url: updatedDish.rows[0].image_url ? updatedDish.rows[0].image_url.replace(/\\/g, "/") : null
    };

    res.json({ dish: formattedDish });
  } catch (err) {
    console.error('Update dish error:', err);
    res.status(500).json({ error: "Server error while updating dish" });
  }
});

// ========= DELETE DISH ==========
router.delete("/dishes/:id", requireOwnerAuth, async (req, res) => {
  const ownerId = req.owner.id;
  const dishId = req.params.id;

  try {
    // Verify ownership and get dish info
    const ownershipCheck = await pool.query(
      `SELECT d.id, d.name, d.image_url FROM dishes d
       JOIN restaurants r ON d.restaurant_id = r.id
       WHERE d.id = $1 AND r.owner_id = $2`,
      [dishId, ownerId]
    );

    if (ownershipCheck.rows.length === 0) {
      return res.status(403).json({ error: "Not authorized to delete this dish" });
    }

    const dish = ownershipCheck.rows[0];

    // Check if dish is in any pending/active orders
    const activeOrdersCheck = await pool.query(
      `SELECT COUNT(*) as order_count FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.dish_id = $1 AND o.status IN ('pending', 'paid')`,
      [dishId]
    );

    if (parseInt(activeOrdersCheck.rows[0].order_count) > 0) {
      return res.status(400).json({ 
        error: "Cannot delete dish with pending orders. Please wait for all orders to be completed first." 
      });
    }

    // Delete the dish
    await pool.query("DELETE FROM dishes WHERE id = $1", [dishId]);

    // Delete associated image from R2 if it exists
    if (dish.image_url) {
      try {
        await deleteOldR2Image(dish.image_url);
      } catch (deleteErr) {
        console.warn('Failed to delete dish image from R2:', deleteErr);
        // Continue anyway - dish is already deleted from database
      }
    }

    res.json({ 
      success: true, 
      message: `Dish "${dish.name}" has been deleted successfully` 
    });
  } catch (err) {
    console.error('Delete dish error:', err);
    res.status(500).json({ error: "Server error while deleting dish" });
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
      email: req.session.ownerEmail,
    });
  } else {
    res.status(401).json({ error: "Not logged in" });
  }
});

// Get restaurant info for owner
router.get("/restaurant", requireOwnerAuth, async (req, res) => {
  const ownerId = req.owner.id;

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
    // Restaurant fetch error
    res.status(500).json({ error: "Server error while fetching restaurant data" });
  }
});

// GET /api/owners/orders - Get orders for restaurant owner
router.get("/orders", requireOwnerAuth, async (req, res) => {
  try {
    const ownerId = req.owner.id;

    // First, ensure address and phone columns exist in users table
    try {
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT");
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)");
    } catch (err) {
      // Column creation check - columns might already exist
    }

    // Ensure restaurant_instructions column exists
    try {
      await pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_instructions JSONB");
    } catch (err) {
      // Column creation check - column might already exist
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
      
      // Add removed_at column if it doesn't exist (for existing tables)
      await pool.query(`
        ALTER TABLE restaurant_order_status 
        ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP
      `);
    } catch (err) {
      // Handle table creation/modification silently
    }

    // Get all orders that contain items from this owner's restaurants with restaurant-specific status
    const ordersResult = await pool.query(`
      SELECT 
        o.id as order_id,
        o.total as original_total,
        o.status as order_status,
        COALESCE(o.platform_fee, 0) as original_platform_fee,
        o.created_at,
        o.paid_at,
        COALESCE(o.order_details, '') as order_details,
        COALESCE(o.restaurant_instructions, '{}') as restaurant_instructions,
        COALESCE(o.delivery_address, u.address, 'No address provided') as delivery_address,
        COALESCE(o.delivery_phone, u.phone, 'No phone provided') as delivery_phone,
        COALESCE(o.delivery_type, 'delivery') as delivery_type,
        u.name as customer_name,
        u.email as customer_email,
        COALESCE(u.address, 'No address provided') as customer_address,
        COALESCE(u.phone, 'No phone provided') as customer_phone,
        oi.id as item_id,
        oi.name as item_name,
        oi.price as item_price,
        oi.quantity,
        r.name as restaurant_name,
        r.id as restaurant_id,
        COALESCE(ros.status, 'active') as restaurant_status,
        ros.cancelled_at as restaurant_cancelled_at,
        ros.completed_at as restaurant_completed_at
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN dishes d ON oi.dish_id = d.id
      LEFT JOIN restaurants r ON COALESCE(oi.restaurant_id, d.restaurant_id) = r.id
      LEFT JOIN restaurant_order_status ros ON (o.id = ros.order_id AND r.id = ros.restaurant_id)
      JOIN users u ON o.user_id = u.id
      WHERE r.owner_id = $1 
        AND (o.status = 'paid' OR o.status = 'completed')
        AND COALESCE(ros.status, 'active') NOT IN ('cancelled', 'removed')
      ORDER BY o.created_at DESC
    `, [ownerId]);

    // Group orders by order_id and calculate restaurant-specific totals
    const groupedOrders = ordersResult.rows.reduce((acc, row) => {
      if (!acc[row.order_id]) {
        // Parse restaurant instructions and extract instructions for this restaurant
        let restaurantSpecificInstructions = '';
        try {
          const restaurantInstructions = typeof row.restaurant_instructions === 'string' 
            ? JSON.parse(row.restaurant_instructions) 
            : row.restaurant_instructions || {};
          
          // Find instructions for this specific restaurant
          restaurantSpecificInstructions = restaurantInstructions[row.restaurant_name] || '';
        } catch (err) {
          console.warn("Failed to parse restaurant instructions:", err);
          restaurantSpecificInstructions = '';
        }

        acc[row.order_id] = {
          id: row.order_id,
          status: row.restaurant_status || 'active', // Use restaurant-specific status
          order_status: row.order_status, // Keep original order status for reference
          created_at: row.created_at,
          paid_at: row.paid_at,
          completed_at: row.restaurant_completed_at,
          cancelled_at: row.restaurant_cancelled_at,
          order_details: restaurantSpecificInstructions, // Use restaurant-specific instructions
          delivery_address: row.delivery_address,
          delivery_phone: row.delivery_phone,
          delivery_type: row.delivery_type,
          customer_name: row.customer_name,
          customer_email: row.customer_email,
          customer_address: row.customer_address,
          customer_phone: row.customer_phone,
          items: [],
          restaurant_subtotal: 0,
          original_total: row.original_total,
          original_platform_fee: row.original_platform_fee,
          restaurant_name: row.restaurant_name, // Store restaurant name for reference
          restaurant_id: row.restaurant_id
        };
      }
      
      // Add item (only items from this owner's restaurants)
      const itemTotal = row.item_price * row.quantity;
      acc[row.order_id].items.push({
        id: row.item_id,
        name: row.item_name,
        price: row.item_price,
        quantity: row.quantity,
        restaurant_name: row.restaurant_name,
        restaurant_id: row.restaurant_id
      });
      
      // Calculate restaurant-specific subtotal
      acc[row.order_id].restaurant_subtotal += itemTotal;
      
      return acc;
    }, {});

    // Calculate restaurant-specific totals and platform fees
    Object.values(groupedOrders).forEach(order => {
      // Calculate proportional platform fee based on this restaurant's portion of the order
      const proportion = order.restaurant_subtotal / (order.original_total - order.original_platform_fee);
      order.platform_fee = order.original_platform_fee * proportion;
      order.total = order.restaurant_subtotal + order.platform_fee;
    });

    const orders = Object.values(groupedOrders);

    res.json({ orders });
  } catch (err) {
    // Get owner orders error
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

    const secretWordMatch = await bcryptjs.compare(secret_word, owner.secret_word);
    if (!secretWordMatch) {
      return res.status(400).json({ error: "Invalid secret word" });
    }

    // Hash new password
    const hashedNewPassword = await bcryptjs.hash(new_password, 10);

    // Update password
    await pool.query(
      "UPDATE restaurant_owners SET password = $1 WHERE id = $2",
      [hashedNewPassword, owner.id]
    );

    // Password updated for owner

    res.json({ 
      success: true, 
      message: "Password updated successfully" 
    });

  } catch (err) {
    // Password update error
    res.status(500).json({ error: "Server error during password update" });
  }
});

// POST /api/owners/orders/:id/complete - Mark restaurant's portion of order as completed
router.post("/orders/:id/complete", requireOwnerAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const ownerId = req.owner.id;

    // Get the restaurant ID for this owner
    const restaurantResult = await pool.query(
      "SELECT id FROM restaurants WHERE owner_id = $1",
      [ownerId]
    );

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: "Restaurant not found for this owner" });
    }

    const restaurantId = restaurantResult.rows[0].id;

    // Verify the order contains items from this owner's restaurant
    const verifyResult = await pool.query(`
      SELECT DISTINCT o.id
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN dishes d ON oi.dish_id = d.id
      LEFT JOIN restaurants r ON COALESCE(oi.restaurant_id, d.restaurant_id) = r.id
      WHERE o.id = $1 AND r.owner_id = $2
      LIMIT 1
    `, [orderId, ownerId]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found or not accessible" });
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
      
      // Add removed_at column if it doesn't exist (for existing tables)
      await pool.query(`
        ALTER TABLE restaurant_order_status 
        ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP
      `);
    } catch (err) {
      // Handle table creation/modification silently
    }

    // Mark this restaurant's portion as completed
    await pool.query(`
      INSERT INTO restaurant_order_status (order_id, restaurant_id, status, completed_at)
      VALUES ($1, $2, 'completed', NOW())
      ON CONFLICT (order_id, restaurant_id) 
      DO UPDATE SET status = 'completed', completed_at = NOW()
    `, [orderId, restaurantId]);

    // Check if all restaurants in the order have completed their portions
    const allRestaurantsResult = await pool.query(`
      SELECT DISTINCT r.id as restaurant_id
      FROM order_items oi
      LEFT JOIN dishes d ON oi.dish_id = d.id
      LEFT JOIN restaurants r ON COALESCE(oi.restaurant_id, d.restaurant_id) = r.id
      WHERE oi.order_id = $1
    `, [orderId]);

    const completedRestaurantsResult = await pool.query(`
      SELECT restaurant_id 
      FROM restaurant_order_status 
      WHERE order_id = $1 AND status = 'completed'
    `, [orderId]);

    const cancelledRestaurantsResult = await pool.query(`
      SELECT restaurant_id 
      FROM restaurant_order_status 
      WHERE order_id = $1 AND status = 'cancelled'
    `, [orderId]);

    // If all restaurants are either completed or cancelled, mark the entire order as completed
    const totalRestaurants = allRestaurantsResult.rows.length;
    const processedRestaurants = completedRestaurantsResult.rows.length + cancelledRestaurantsResult.rows.length;

    if (processedRestaurants === totalRestaurants) {
      await pool.query(
        "UPDATE orders SET status = $1 WHERE id = $2",
        ['completed', orderId]
      );
    }

    res.json({ 
      success: true, 
      message: "Your restaurant's portion of the order has been marked as completed" 
    });
  } catch (err) {
    console.error('Complete order error:', err);
    res.status(500).json({ error: "Failed to complete order" });
  }
});

// DELETE /api/owners/orders/:id - Mark restaurant's items as removed (soft delete)
router.delete("/orders/:id", requireOwnerAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const ownerId = req.owner.id;

    // Get the restaurant ID for this owner
    const restaurantResult = await pool.query(
      "SELECT id FROM restaurants WHERE owner_id = $1",
      [ownerId]
    );

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: "Restaurant not found for this owner" });
    }

    const restaurantId = restaurantResult.rows[0].id;

    // Verify the order contains items from this owner's restaurant
    const verifyResult = await pool.query(`
      SELECT DISTINCT o.id
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN dishes d ON oi.dish_id = d.id
      LEFT JOIN restaurants r ON COALESCE(oi.restaurant_id, d.restaurant_id) = r.id
      WHERE o.id = $1 AND r.owner_id = $2
      LIMIT 1
    `, [orderId, ownerId]);

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found or you don't have permission to remove it" });
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
      
      // Add removed_at column if it doesn't exist (for existing tables)
      await pool.query(`
        ALTER TABLE restaurant_order_status 
        ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP
      `);
    } catch (err) {
      // Handle table creation/modification silently
    }

    // Mark this restaurant's portion as removed (soft delete)
    await pool.query(`
      INSERT INTO restaurant_order_status (order_id, restaurant_id, status, removed_at)
      VALUES ($1, $2, 'removed', NOW())
      ON CONFLICT (order_id, restaurant_id) 
      DO UPDATE SET status = 'removed', removed_at = NOW()
    `, [orderId, restaurantId]);

    res.json({ 
      success: true, 
      message: "Order removed from your view" 
    });
  } catch (err) {
    console.error('Remove order error:', err);
    res.status(500).json({ error: "Failed to remove order: " + err.message });
  }
});

// GET /api/owners/notifications - Get notifications for restaurant owner
router.get("/notifications", requireOwnerAuth, async (req, res) => {
  try {
    const ownerId = req.owner.id;

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
    // Get notifications error
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

// POST /api/owners/notifications/:id/mark-read - Mark notification as read
router.post("/notifications/:id/mark-read", requireOwnerAuth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const ownerId = req.owner.id;

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
    // Mark notification read error
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

// POST /api/owners/notifications/mark-all-read - Mark all notifications as read
router.post("/notifications/mark-all-read", requireOwnerAuth, async (req, res) => {
  try {
    const ownerId = req.owner.id;

    await pool.query(
      "UPDATE notifications SET read = TRUE WHERE owner_id = $1 AND read = FALSE",
      [ownerId]
    );

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    // Mark all notifications read error
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

// POST /api/owners/refunds/:notificationId/process - Process refund request
router.post("/refunds/:notificationId/process", requireOwnerAuth, async (req, res) => {
  try {
    const notificationId = req.params.notificationId;
    const ownerId = req.owner.id;
    const { action, notes } = req.body; // action: 'approve' or 'deny'

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

    // Get order and customer information
    const orderResult = await pool.query(
      "SELECT o.*, u.id as customer_id, u.name as customer_name, u.email as customer_email FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = $1",
      [notification.order_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderResult.rows[0];

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
      // Customer notifications table creation check
    }

    // Create notification for customer with restaurant-specific information
    const restaurantName = notificationData.restaurantName || 'Restaurant';
    const restaurantTotal = notificationData.restaurantTotal || 0;
    const itemCount = notificationData.itemCount || 0;
    
    const customerNotificationTitle = action === 'approve' 
      ? `Refund Approved - ${restaurantName}` 
      : `Refund Request Denied - ${restaurantName}`;
    
    const customerNotificationMessage = action === 'approve'
      ? `Your refund request for order #${order.id} has been approved by ${restaurantName}. Refund amount: $${Number(restaurantTotal).toFixed(2)} for ${itemCount} item${itemCount !== 1 ? 's' : ''}. The refund will be processed shortly.`
      : `Your refund request for order #${order.id} has been denied by ${restaurantName}. Amount: $${Number(restaurantTotal).toFixed(2)} for ${itemCount} item${itemCount !== 1 ? 's' : ''}.`;

    const customerNotificationData = {
      orderId: order.id,
      orderTotal: order.total,
      restaurantTotal: restaurantTotal,
      restaurantName: restaurantName,
      itemCount: itemCount,
      refundAction: action,
      refundNotes: notes || '',
      processedAt: new Date().toISOString()
    };

    await pool.query(
      "INSERT INTO customer_notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)",
      [
        order.customer_id,
        `refund_${action}`,
        customerNotificationTitle,
        customerNotificationMessage,
        JSON.stringify(customerNotificationData)
      ]
    );

    // Log the refund decision
    // Refund action processed for order by owner
    // Notes provided for refund action
    // Customer notification sent

    res.json({ 
      success: true, 
      message: `Refund request ${action}d successfully. Customer has been notified.`,
      action: action
    });
  } catch (err) {
    // Process refund error
    res.status(500).json({ error: "Failed to process refund request" });
  }
});

// PUT /api/owners/restaurant/logo - Update restaurant logo
router.put("/restaurant/logo", requireOwnerAuth, ...uploadRestaurantLogo, async (req, res) => {
  try {
    const ownerId = req.owner.id;
    
    // Handle R2 upload result
    const uploadResult = handleR2UploadResult(req);
    
    if (!uploadResult.success) {
      return res.status(400).json({ 
        error: uploadResult.error || "Failed to upload logo. Please check that you selected a valid image file." 
      });
    }

    const newLogoUrl = uploadResult.imageUrl;

    // Get current restaurant data to find old logo
    const restaurantResult = await pool.query(
      "SELECT image_url FROM restaurants WHERE owner_id = $1",
      [ownerId]
    );

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const oldLogoUrl = restaurantResult.rows[0].image_url;

    // Update restaurant with new logo URL
    await pool.query(
      "UPDATE restaurants SET image_url = $1 WHERE owner_id = $2",
      [newLogoUrl, ownerId]
    );

    // Delete old logo from R2 if it exists
    if (oldLogoUrl) {
      try {
        await deleteOldR2Image(oldLogoUrl);
      } catch (deleteErr) {
        console.warn('Failed to delete old logo from R2:', deleteErr);
        // Continue anyway - don't fail the update
      }
    }

    res.json({ 
      success: true, 
      message: "Logo updated successfully",
      image_url: newLogoUrl 
    });
  } catch (err) {
    console.error('Logo update error:', err);
    res.status(500).json({ error: "Failed to update logo" });
  }
});

// PATCH /api/owners/restaurant/name - Update restaurant name
router.patch("/restaurant/name", requireOwnerAuth, async (req, res) => {
  try {
    const { name } = req.body;
    const ownerId = req.session.ownerId;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Restaurant name is required" });
    }

    const trimmedName = name.trim();
    
    if (trimmedName.length > 100) {
      return res.status(400).json({ error: "Restaurant name must be 100 characters or less" });
    }

    // Check if owner owns a restaurant
    const restaurantResult = await pool.query(
      "SELECT id, name FROM restaurants WHERE owner_id = $1",
      [ownerId]
    );

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: "No restaurant found for this owner" });
    }

    const restaurant = restaurantResult.rows[0];

    // Check if the name is actually changing
    if (restaurant.name === trimmedName) {
      return res.json({ 
        success: true, 
        message: "Restaurant name is already up to date",
        name: trimmedName 
      });
    }

    // Update restaurant name
    await pool.query(
      "UPDATE restaurants SET name = $1 WHERE owner_id = $2",
      [trimmedName, ownerId]
    );

    res.json({ 
      success: true, 
      message: "Restaurant name updated successfully",
      name: trimmedName 
    });

  } catch (err) {
    console.error('Restaurant name update error:', err);
    res.status(500).json({ error: "Failed to update restaurant name" });
  }
});

export default router;
