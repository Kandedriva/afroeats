import express from 'express';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import pool from '../db.js';
import { uploadRestaurantLogo, uploadProductImage, handleR2UploadResult } from '../middleware/r2Upload.js';
import { sendGroceryOwnerWelcomeEmail } from '../services/emailService.js';
import { validatePassword } from '../middleware/security.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Middleware to require grocery owner authentication
const requireGroceryOwnerAuth = (req, res, next) => {
  if (!req.session || !req.session.groceryOwnerId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Add grocery owner info to request
  req.groceryOwner = {
    id: req.session.groceryOwnerId,
    name: req.session.groceryOwnerName,
    email: req.session.groceryOwnerEmail,
  };

  next();
};

// ===========================
// REGISTRATION
// ===========================

router.post('/register', uploadRestaurantLogo, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      name,
      email,
      password,
      secret_word,
      store_name,
      location,
      phone_number,
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !secret_word || !store_name || !location || !phone_number) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.error });
    }

    // Check if email already exists
    const emailCheck = await client.query(
      'SELECT id FROM grocery_store_owners WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password and secret word
    const hashedPassword = await bcrypt.hash(password, 10);
    const hashedSecretWord = await bcrypt.hash(secret_word, 10);

    const logoUrl = handleR2UploadResult(req).imageUrl || null;

    await client.query('BEGIN');

    // Create grocery store owner
    const ownerResult = await client.query(
      `INSERT INTO grocery_store_owners (name, email, password, secret_word, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, name, email, created_at`,
      [name, email, hashedPassword, hashedSecretWord]
    );

    const ownerId = ownerResult.rows[0].id;

    // Create grocery store (without geocoding initially)
    const storeResult = await client.query(
      `INSERT INTO grocery_stores (name, address, phone_number, image_url, owner_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id`,
      [store_name, location, phone_number, logoUrl, ownerId]
    );

    const storeId = storeResult.rows[0].id;

    // Auto-geocode the store address (async, non-blocking)
    try {
      const { geocodeGroceryStore } = await import('../services/googleMapsService.js');
      const geocoded = await geocodeGroceryStore(storeId);
      if (geocoded) {
        console.log(`✅ Auto-geocoded grocery store ${store_name}: (${geocoded.latitude}, ${geocoded.longitude})`);
      } else {
        console.warn(`⚠️ Could not auto-geocode grocery store ${store_name} at address: ${location}`);
      }
    } catch (geocodeError) {
      console.warn(`⚠️ Auto-geocoding failed for grocery store ${store_name}:`, geocodeError.message);
    }

    await client.query('COMMIT');

    // Create session
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error during grocery owner registration:', err);
        return res.status(500).json({ error: 'Session creation failed' });
      }

      req.session.groceryOwnerId = ownerId;
      req.session.groceryOwnerName = name;
      req.session.groceryOwnerEmail = email;
      req.session.loginTime = new Date().toISOString();

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ error: 'Session save failed' });
        }

        // Send welcome email
        sendGroceryOwnerWelcomeEmail(email, name, store_name)
          .catch(err => console.error('Welcome email failed:', err));

        res.status(201).json({
          message: 'Registration successful',
          groceryOwner: {
            id: ownerId,
            name,
            email,
          },
        });
      });
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  } finally {
    client.release();
  }
});

// ===========================
// LOGIN
// ===========================

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find grocery owner by email
    const result = await pool.query(
      'SELECT * FROM grocery_store_owners WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const groceryOwner = result.rows[0];

    // Check if account is inactive
    if (groceryOwner.active === false) {
      return res.status(403).json({ error: 'This account has been deactivated' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, groceryOwner.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create session
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ error: 'Login failed' });
      }

      req.session.groceryOwnerId = groceryOwner.id;
      req.session.groceryOwnerName = groceryOwner.name;
      req.session.groceryOwnerEmail = groceryOwner.email;
      req.session.loginTime = new Date().toISOString();

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ error: 'Login failed' });
        }

        res.json({
          message: 'Login successful',
          groceryOwner: {
            id: groceryOwner.id,
            name: groceryOwner.name,
            email: groceryOwner.email,
          },
        });
      });
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ===========================
// LOGOUT
// ===========================

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('orderdabaly.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// ===========================
// GET CURRENT GROCERY OWNER
// ===========================

router.get('/me', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email FROM grocery_store_owners WHERE id = $1',
      [req.groceryOwner.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Grocery owner not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get grocery owner error:', error);
    res.status(500).json({ error: 'Failed to get grocery owner information' });
  }
});

// ===========================
// UPDATE GROCERY OWNER EMAIL
// ===========================

router.patch('/me', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const { email, current_password } = req.body;

    if (!email || !current_password) {
      return res.status(400).json({ error: 'Email and current password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Verify current password
    const ownerResult = await pool.query(
      'SELECT id, email, password FROM grocery_store_owners WHERE id = $1',
      [req.groceryOwner.id]
    );

    if (ownerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const owner = ownerResult.rows[0];
    const passwordMatch = await bcrypt.compare(current_password, owner.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Check new email isn't already taken by another account
    if (email.toLowerCase() !== owner.email.toLowerCase()) {
      const emailTaken = await pool.query(
        'SELECT id FROM grocery_store_owners WHERE email = $1 AND id != $2',
        [email.toLowerCase(), req.groceryOwner.id]
      );
      if (emailTaken.rows.length > 0) {
        return res.status(409).json({ error: 'This email address is already in use' });
      }
    }

    await pool.query(
      'UPDATE grocery_store_owners SET email = $1 WHERE id = $2',
      [email.toLowerCase(), req.groceryOwner.id]
    );

    // Update session email
    req.session.groceryOwnerEmail = email.toLowerCase();

    res.json({ message: 'Email updated successfully', email: email.toLowerCase() });
  } catch (error) {
    console.error('Update email error:', error);
    res.status(500).json({ error: 'Failed to update email' });
  }
});

// ===========================
// GET GROCERY STORE
// ===========================

router.get('/store', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM grocery_stores WHERE owner_id = $1',
      [req.groceryOwner.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Grocery store not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get grocery store error:', error);
    res.status(500).json({ error: 'Failed to get grocery store information' });
  }
});

// ===========================
// UPDATE GROCERY STORE
// ===========================

router.patch('/store', requireGroceryOwnerAuth, uploadRestaurantLogo, async (req, res) => {
  try {
    const { name, address, phone_number, active } = req.body;

    // Validate required fields
    if (!name || !address || !phone_number) {
      return res.status(400).json({ error: 'Name, address, and phone number are required' });
    }

    // Get current store info
    const storeResult = await pool.query(
      'SELECT * FROM grocery_stores WHERE owner_id = $1',
      [req.groceryOwner.id]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Grocery store not found' });
    }

    const currentStore = storeResult.rows[0];

    const logoUrl = handleR2UploadResult(req).imageUrl || currentStore.image_url;

    // Convert active to boolean
    const isActive = active === 'true' || active === true;

    // Update store information
    const updateResult = await pool.query(
      `UPDATE grocery_stores
       SET name = $1, address = $2, phone_number = $3, image_url = $4, active = $5
       WHERE owner_id = $6
       RETURNING *`,
      [name, address, phone_number, logoUrl, isActive, req.groceryOwner.id]
    );

    // Auto-geocode the updated address if address changed (async, non-blocking)
    if (address !== currentStore.address) {
      try {
        const { geocodeGroceryStore } = await import('../services/googleMapsService.js');
        const geocoded = await geocodeGroceryStore(currentStore.id);
        if (geocoded) {
          console.log(`✅ Auto-geocoded updated grocery store ${name}: (${geocoded.latitude}, ${geocoded.longitude})`);
        } else {
          console.warn(`⚠️ Could not auto-geocode updated grocery store ${name} at address: ${address}`);
        }
      } catch (geocodeError) {
        console.warn(`⚠️ Auto-geocoding failed for updated grocery store ${name}:`, geocodeError.message);
      }
    }

    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Update grocery store error:', error);
    res.status(500).json({ error: 'Failed to update grocery store information' });
  }
});

// ===========================
// PRODUCT MANAGEMENT
// ===========================

/**
 * POST /api/grocery-owners/products
 * Create a new product for the grocery store
 */
router.post('/products', requireGroceryOwnerAuth, ...uploadProductImage, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      platform_fee,
      category,
      subcategory,
      unit,
      stock_quantity,
      low_stock_threshold,
      is_available,
      origin,
      organic,
      gluten_free,
      vegan,
    } = req.body;

    // Validate required fields
    if (!name || !price || !platform_fee || !category || !unit || stock_quantity === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get store for this owner
    const storeResult = await pool.query(
      'SELECT id FROM grocery_stores WHERE owner_id = $1',
      [req.groceryOwner.id]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Grocery store not found' });
    }

    const storeId = storeResult.rows[0].id;

    // Handle image upload
    const uploadResult = handleR2UploadResult(req);
    const imageUrl = uploadResult.success ? uploadResult.imageUrl : null;

    // Convert boolean strings from FormData
    const isAvailable = is_available === 'true' || is_available === true;
    const isOrganic = organic === 'true' || organic === true;
    const isGlutenFree = gluten_free === 'true' || gluten_free === true;
    const isVegan = vegan === 'true' || vegan === true;

    // Insert product
    const productResult = await pool.query(
      `INSERT INTO products (
        name, description, price, platform_fee, category, subcategory, unit,
        stock_quantity, low_stock_threshold, is_available,
        image_url, origin, organic, gluten_free, vegan, store_id,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      RETURNING *`,
      [
        name,
        description || null,
        parseFloat(price),
        parseFloat(platform_fee),
        category,
        subcategory || null,
        unit,
        parseInt(stock_quantity),
        low_stock_threshold ? parseInt(low_stock_threshold) : 10,
        isAvailable,
        imageUrl,
        origin || null,
        isOrganic,
        isGlutenFree,
        isVegan,
        storeId,
      ]
    );

    res.status(201).json({
      message: 'Product created successfully',
      product: productResult.rows[0],
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

/**
 * PUT /api/grocery-owners/products/:id
 * Update product details (full update)
 */
router.put('/products/:id', requireGroceryOwnerAuth, ...uploadProductImage, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const {
      name,
      description,
      price,
      platform_fee,
      category,
      unit,
      stock_quantity,
      low_stock_threshold,
      is_available,
    } = req.body;

    // Verify product belongs to this owner's store
    const verifyResult = await pool.query(
      `SELECT p.id, p.image_url FROM products p
       INNER JOIN grocery_stores gs ON p.store_id = gs.id
       WHERE p.id = $1 AND gs.owner_id = $2`,
      [productId, req.groceryOwner.id]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }

    const currentProduct = verifyResult.rows[0];

    // Handle image upload
    const uploadResult = handleR2UploadResult(req);
    const imageUrl = uploadResult.success ? uploadResult.imageUrl : currentProduct.image_url;

    // Convert boolean strings from FormData
    const isAvailable = is_available === 'true' || is_available === true;

    // Update product
    const updateResult = await pool.query(
      `UPDATE products
       SET name = $1, description = $2, price = $3, platform_fee = $4, category = $5,
           unit = $6, stock_quantity = $7, low_stock_threshold = $8, is_available = $9,
           image_url = $10, updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        name,
        description || null,
        parseFloat(price),
        parseFloat(platform_fee),
        category,
        unit,
        parseInt(stock_quantity),
        low_stock_threshold ? parseInt(low_stock_threshold) : 10,
        isAvailable,
        imageUrl,
        productId,
      ]
    );

    res.json({
      message: 'Product updated successfully',
      product: updateResult.rows[0],
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

/**
 * PATCH /api/products/:id
 * Update product availability (quick toggle)
 */
router.patch('/products/:id', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { is_available } = req.body;

    // Verify product belongs to this owner's store
    const verifyResult = await pool.query(
      `SELECT p.id FROM products p
       INNER JOIN grocery_stores gs ON p.store_id = gs.id
       WHERE p.id = $1 AND gs.owner_id = $2`,
      [productId, req.groceryOwner.id]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }

    // Update availability
    const updateResult = await pool.query(
      'UPDATE products SET is_available = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [is_available, productId]
    );

    res.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Update product availability error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

/**
 * DELETE /api/products/:id
 * Delete a product
 */
router.delete('/products/:id', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);

    // Verify product belongs to this owner's store
    const verifyResult = await pool.query(
      `SELECT p.id FROM products p
       INNER JOIN grocery_stores gs ON p.store_id = gs.id
       WHERE p.id = $1 AND gs.owner_id = $2`,
      [productId, req.groceryOwner.id]
    );

    if (verifyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }

    // Delete product
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ===========================
// GROCERY ORDERS MANAGEMENT
// ===========================

/**
 * GET /api/grocery-owners/orders
 * Get all grocery orders for the grocery store owner
 */
router.get('/orders', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const groceryOwnerId = req.groceryOwner.id;

    // First get the grocery store for this owner
    const storeResult = await pool.query(
      'SELECT id FROM grocery_stores WHERE owner_id = $1',
      [groceryOwnerId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Grocery store not found' });
    }

    const storeId = storeResult.rows[0].id;

    // Get all grocery orders that contain at least one product from this store
    const ordersResult = await pool.query(`
      SELECT DISTINCT
        go.id,
        go.total,
        go.subtotal,
        go.platform_fee,
        go.delivery_fee,
        go.status,
        go.delivery_address,
        go.delivery_city,
        go.delivery_state,
        go.delivery_zip,
        go.delivery_name,
        go.delivery_phone,
        go.created_at,
        go.user_id,
        u.name AS customer_name,
        u.email AS customer_email,
        u.phone AS customer_phone
      FROM grocery_orders go
      LEFT JOIN users u ON go.user_id = u.id
      INNER JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      INNER JOIN products p ON goi.product_id = p.id
      WHERE p.store_id = $1
      ORDER BY go.created_at DESC
    `, [storeId]);

    // For each order, get only the items belonging to this store
    const ordersWithItems = await Promise.all(
      ordersResult.rows.map(async (order) => {
        const itemsResult = await pool.query(`
          SELECT
            goi.id,
            goi.product_id,
            goi.quantity,
            goi.unit_price,
            goi.total_price,
            p.name AS product_name,
            p.image_url AS product_image
          FROM grocery_order_items goi
          LEFT JOIN products p ON goi.product_id = p.id
          WHERE goi.grocery_order_id = $1 AND p.store_id = $2
          ORDER BY goi.id
        `, [order.id, storeId]);

        return {
          ...order,
          items: itemsResult.rows
        };
      })
    );

    res.json(ordersWithItems);
  } catch (error) {
    console.error('Get grocery orders error:', error);
    res.status(500).json({ error: 'Failed to get grocery orders' });
  }
});

/**
 * GET /api/grocery-owners/orders/new-count
 * Returns the count of new (paid, not yet actioned) orders for the badge.
 */
router.get('/orders/new-count', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const groceryOwnerId = req.groceryOwner.id;

    const storeResult = await pool.query(
      'SELECT id FROM grocery_stores WHERE owner_id = $1',
      [groceryOwnerId]
    );

    if (storeResult.rows.length === 0) {
      return res.json({ newOrdersCount: 0 });
    }

    const storeId = storeResult.rows[0].id;

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT go.id)::int AS count
       FROM grocery_orders go
       JOIN grocery_order_items goi ON goi.grocery_order_id = go.id
       JOIN products p ON p.id = goi.product_id
       WHERE p.store_id = $1 AND go.status = 'paid'`,
      [storeId]
    );

    res.json({ newOrdersCount: countResult.rows[0].count });
  } catch (error) {
    console.error('Get new orders count error:', error);
    res.status(500).json({ error: 'Failed to get orders count' });
  }
});

// Notification copy per status transition
const GROCERY_STATUS_NOTIFICATIONS = {
  preparing:        { title: 'Order Being Prepared 🥬', message: (id) => `Your grocery order #${id} is now being prepared.` },
  out_for_delivery: { title: 'Out for Delivery 🚚',    message: (id) => `Your grocery order #${id} is on its way!` },
  delivered:        { title: 'Order Delivered ✅',      message: (id) => `Your grocery order #${id} has been delivered. Enjoy!` },
  cancelled:        { title: 'Order Cancelled ❌',      message: (id) => `Your grocery order #${id} has been cancelled.` },
};

async function notifyGroceryCustomer(orderId, newStatus) {
  const notif = GROCERY_STATUS_NOTIFICATIONS[newStatus];
  if (!notif) return;
  try {
    const orderRow = await pool.query(
      'SELECT user_id FROM grocery_orders WHERE id = $1',
      [orderId]
    );
    const userId = orderRow.rows[0]?.user_id;
    if (!userId) return; // guest — no in-app notification

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

    await pool.query(
      `INSERT INTO customer_notifications (user_id, order_id, type, title, message, data)
       VALUES ($1, NULL, $2, $3, $4, $5)`,
      [
        userId,
        'grocery_order_status',
        notif.title,
        notif.message(orderId),
        JSON.stringify({ groceryOrderId: orderId, status: newStatus }),
      ]
    );
    console.log(`✅ [GroceryNotif] user ${userId} notified: order ${orderId} → ${newStatus}`);
  } catch (err) {
    console.error(`[GroceryNotif] Failed for order ${orderId}:`, err.message);
  }
}

/**
 * PATCH /api/grocery-owners/orders/:id/status
 * Advance an order through its lifecycle and notify the customer.
 * Accepted statuses: preparing | out_for_delivery | delivered | cancelled
 */
router.patch('/orders/:id/status', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status } = req.body;

    const allowed = ['preparing', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${allowed.join(', ')}` });
    }

    const orderCheck = await pool.query(
      'SELECT id, status FROM grocery_orders WHERE id = $1',
      [orderId]
    );
    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (orderCheck.rows[0].status === 'delivered') {
      return res.status(400).json({ error: 'Order already delivered' });
    }

    await pool.query(
      'UPDATE grocery_orders SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, orderId]
    );

    setImmediate(() => notifyGroceryCustomer(orderId, status));

    res.json({ message: `Order status updated to ${status}` });
  } catch (error) {
    console.error('Update grocery order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

/**
 * PATCH /api/grocery-owners/orders/:id/complete
 * Legacy endpoint — kept for backward compatibility, delegates to delivered.
 */
router.patch('/orders/:id/complete', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);

    const orderCheck = await pool.query(
      'SELECT id, status FROM grocery_orders WHERE id = $1',
      [orderId]
    );
    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (orderCheck.rows[0].status === 'delivered') {
      return res.status(400).json({ error: 'Order already delivered' });
    }

    await pool.query(
      'UPDATE grocery_orders SET status = $1, updated_at = NOW() WHERE id = $2',
      ['delivered', orderId]
    );

    setImmediate(() => notifyGroceryCustomer(orderId, 'delivered'));

    res.json({ message: 'Order marked as delivered' });
  } catch (error) {
    console.error('Complete grocery order error:', error);
    res.status(500).json({ error: 'Failed to complete order' });
  }
});

/**
 * DELETE /api/grocery-owners/orders/:id
 * Delete a completed grocery order
 */
router.delete('/orders/:id', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const groceryOwnerId = req.groceryOwner.id;

    // First get the grocery store for this owner
    const storeResult = await pool.query(
      'SELECT id FROM grocery_stores WHERE owner_id = $1',
      [groceryOwnerId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Grocery store not found' });
    }

    const storeId = storeResult.rows[0].id;

    // Check if order exists and belongs to this store
    const orderCheck = await pool.query(
      `SELECT go.id, go.status
       FROM grocery_orders go
       INNER JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
       INNER JOIN products p ON goi.product_id = p.id
       WHERE go.id = $1 AND p.store_id = $2
       LIMIT 1`,
      [orderId, storeId]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found or unauthorized' });
    }

    const order = orderCheck.rows[0];

    // Only allow deletion of delivered orders
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Only delivered orders can be deleted' });
    }

    // Delete order items first (foreign key constraint)
    await pool.query(
      'DELETE FROM grocery_order_items WHERE grocery_order_id = $1',
      [orderId]
    );

    // Delete the order
    await pool.query(
      'DELETE FROM grocery_orders WHERE id = $1',
      [orderId]
    );

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete grocery order error:', error);
    res.status(500).json({ error: 'Failed to delete order' });
  }
});

// ===========================
// NOTIFICATIONS MANAGEMENT
// ===========================

/**
 * GET /api/grocery-owners/notifications
 * Get all notifications for the grocery store owner
 */
router.get('/notifications', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const groceryOwnerId = req.groceryOwner.id;

    // Get all notifications for this grocery owner
    const notificationsResult = await pool.query(`
      SELECT *
      FROM grocery_owner_notifications
      WHERE grocery_owner_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [groceryOwnerId]);

    res.json({
      notifications: notificationsResult.rows,
      unreadCount: notificationsResult.rows.filter(n => !n.read).length
    });
  } catch (error) {
    console.error('Get grocery notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

/**
 * POST /api/grocery-owners/notifications/:id/mark-read
 * Mark a notification as read
 */
router.post('/notifications/:id/mark-read', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const groceryOwnerId = req.groceryOwner.id;

    // Mark notification as read (ensure it belongs to this owner)
    const result = await pool.query(`
      UPDATE grocery_owner_notifications
      SET read = true
      WHERE id = $1 AND grocery_owner_id = $2
      RETURNING *
    `, [notificationId, groceryOwnerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * POST /api/grocery-owners/notifications/mark-all-read
 * Mark all notifications as read
 */
router.post('/notifications/mark-all-read', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const groceryOwnerId = req.groceryOwner.id;

    await pool.query(`
      UPDATE grocery_owner_notifications
      SET read = true
      WHERE grocery_owner_id = $1 AND read = false
    `, [groceryOwnerId]);

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

/**
 * GET /api/grocery-owners/reports
 * Get reports and analytics for grocery owner
 */
router.get('/reports', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const groceryOwnerId = req.groceryOwner.id;
    const range = req.query.range || 'week';

    // Calculate date range
    const now = new Date();
    let startDate;

    switch (range) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date('2020-01-01');
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get all orders for this grocery owner's store
    const ordersResult = await pool.query(`
      SELECT
        go.id,
        go.total,
        go.status,
        go.refund_status,
        go.created_at,
        go.paid_at,
        go.delivered_at
      FROM grocery_orders go
      JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      JOIN products p ON goi.product_id = p.id
      WHERE p.store_id = $1
        AND go.created_at >= $2
      GROUP BY go.id
      ORDER BY go.created_at DESC
    `, [groceryOwnerId, startDate]);

    const orders = ordersResult.rows;

    // Calculate stats
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'delivered').length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
    const refundedOrders = orders.filter(o => o.refund_status === 'full' || o.refund_status === 'partial').length;

    const totalRevenue = orders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + parseFloat(o.total || 0), 0);

    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Get top products
    const topProductsResult = await pool.query(`
      SELECT
        p.name,
        SUM(goi.quantity) as total_sold,
        SUM(goi.total_price) as revenue
      FROM grocery_order_items goi
      JOIN products p ON goi.product_id = p.id
      JOIN grocery_orders go ON goi.grocery_order_id = go.id
      WHERE p.store_id = $1
        AND go.status = 'delivered'
        AND go.created_at >= $2
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
      LIMIT 5
    `, [groceryOwnerId, startDate]);

    const topProducts = topProductsResult.rows.map(p => ({
      name: p.name,
      total_sold: parseInt(p.total_sold),
      revenue: parseFloat(p.revenue)
    }));

    // Get recent activity
    const activityResult = await pool.query(`
      SELECT
        'new_order' as type,
        CONCAT('New order #', go.id, ' placed by ', go.delivery_name) as description,
        go.total as amount,
        go.created_at
      FROM grocery_orders go
      JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      JOIN products p ON goi.product_id = p.id
      WHERE p.store_id = $1
        AND go.created_at >= $2
      GROUP BY go.id

      UNION ALL

      SELECT
        'order_completed' as type,
        CONCAT('Order #', go.id, ' delivered to ', go.delivery_name) as description,
        go.total as amount,
        go.delivered_at as created_at
      FROM grocery_orders go
      JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      JOIN products p ON goi.product_id = p.id
      WHERE p.store_id = $1
        AND go.status = 'delivered'
        AND go.delivered_at >= $2
      GROUP BY go.id

      UNION ALL

      SELECT
        'refund_request' as type,
        CONCAT('Refund request for order #', grr.grocery_order_id) as description,
        grr.amount,
        grr.requested_at as created_at
      FROM grocery_refund_requests grr
      JOIN grocery_orders go ON grr.grocery_order_id = go.id
      JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      JOIN products p ON goi.product_id = p.id
      WHERE p.store_id = $1
        AND grr.requested_at >= $2
      GROUP BY grr.id

      ORDER BY created_at DESC
      LIMIT 20
    `, [groceryOwnerId, startDate]);

    const recentActivity = activityResult.rows;

    res.json({
      totalRevenue,
      totalOrders,
      averageOrderValue,
      completedOrders,
      cancelledOrders,
      refundedOrders,
      topProducts,
      recentActivity
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// ===========================
// STRIPE CONNECT ENDPOINTS
// ===========================

/**
 * POST /api/grocery-owners/stripe/create-account
 * Create a Stripe Connect account for grocery owner
 */
router.post('/stripe/create-account', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const groceryOwnerId = req.groceryOwner.id;

    // Check if owner already has a Stripe account
    const ownerResult = await pool.query(
      'SELECT stripe_account_id FROM grocery_store_owners WHERE id = $1',
      [groceryOwnerId]
    );

    if (ownerResult.rows[0]?.stripe_account_id) {
      return res.json({
        accountId: ownerResult.rows[0].stripe_account_id,
        message: 'Stripe account already exists',
        alreadyExists: true
      });
    }

    // Create Stripe Connect account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: req.groceryOwner.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // Save Stripe account ID to database
    await pool.query(
      `UPDATE grocery_store_owners
       SET stripe_account_id = $1
       WHERE id = $2`,
      [account.id, groceryOwnerId]
    );

    console.log(`✅ Created Stripe Connect account ${account.id} for grocery owner ${groceryOwnerId}`);

    res.json({
      accountId: account.id,
      message: 'Stripe account created successfully'
    });
  } catch (error) {
    console.error('Create Stripe account error:', error);
    console.error('Error details:', error.message);
    console.error('Error type:', error.type);
    res.status(500).json({
      error: 'Failed to create Stripe account',
      details: error.message
    });
  }
});

/**
 * POST /api/grocery-owners/stripe/create-onboarding-link
 * Create Stripe Connect onboarding link
 */
router.post('/stripe/create-onboarding-link', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const groceryOwnerId = req.groceryOwner.id;

    // Get owner's Stripe account ID
    const ownerResult = await pool.query(
      'SELECT stripe_account_id FROM grocery_store_owners WHERE id = $1',
      [groceryOwnerId]
    );

    const stripeAccountId = ownerResult.rows[0]?.stripe_account_id;

    if (!stripeAccountId) {
      return res.status(400).json({ error: 'No Stripe account found. Please create one first.' });
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${FRONTEND_URL}/grocery-owner/store?stripe_refresh=true`,
      return_url: `${FRONTEND_URL}/grocery-owner/store?stripe_success=true`,
      type: 'account_onboarding',
    });

    console.log(`✅ Created onboarding link for Stripe account ${stripeAccountId}`);

    res.json({
      url: accountLink.url,
      accountId: stripeAccountId
    });
  } catch (error) {
    if (error.code === '42703') {
      return res.status(503).json({ error: 'Stripe setup is not yet configured. Please contact support.' });
    }
    console.error('Create onboarding link error:', error.message, '| type:', error.type, '| FRONTEND_URL:', FRONTEND_URL);
    res.status(500).json({ error: 'Failed to create onboarding link', details: error.message });
  }
});

/**
 * POST /api/grocery-owners/stripe/create-login-link
 * Create Stripe Connect dashboard login link
 */
router.post('/stripe/create-login-link', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const groceryOwnerId = req.groceryOwner.id;

    const ownerResult = await pool.query(
      'SELECT stripe_account_id FROM grocery_store_owners WHERE id = $1',
      [groceryOwnerId]
    );

    const stripeAccountId = ownerResult.rows[0]?.stripe_account_id;

    if (!stripeAccountId) {
      return res.status(400).json({ error: 'No Stripe account found' });
    }

    try {
      const loginLink = await stripe.accounts.createLoginLink(stripeAccountId);
      console.log(`✅ Created login link for Stripe account ${stripeAccountId}`);
      return res.json({ url: loginLink.url });
    } catch (stripeError) {
      // Login link only works for fully onboarded accounts — fall back to onboarding link
      console.warn(`Login link failed (${stripeError.message}), falling back to onboarding link`);
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${FRONTEND_URL}/grocery-owner/store?stripe_refresh=true`,
        return_url: `${FRONTEND_URL}/grocery-owner/store?stripe_success=true`,
        type: 'account_onboarding',
      });
      return res.json({ url: accountLink.url, isOnboarding: true });
    }
  } catch (error) {
    console.error('Create login link error:', error.message, '| type:', error.type, '| FRONTEND_URL:', FRONTEND_URL);
    res.status(500).json({ error: 'Failed to create link' });
  }
});

/**
 * GET /api/grocery-owners/stripe/account-status
 * Get Stripe Connect account status
 */
router.get('/stripe/account-status', requireGroceryOwnerAuth, async (req, res) => {
  try {
    const groceryOwnerId = req.groceryOwner.id;

    // Get owner's Stripe account ID
    const ownerResult = await pool.query(
      `SELECT
        stripe_account_id,
        stripe_onboarding_complete,
        stripe_details_submitted,
        stripe_charges_enabled,
        stripe_payouts_enabled
       FROM grocery_store_owners
       WHERE id = $1`,
      [groceryOwnerId]
    );

    const owner = ownerResult.rows[0];

    if (!owner?.stripe_account_id) {
      return res.json({
        hasAccount: false,
        onboardingComplete: false,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false
      });
    }

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(owner.stripe_account_id);

    // Update database with latest status
    await pool.query(
      `UPDATE grocery_store_owners
       SET stripe_onboarding_complete = $1,
           stripe_details_submitted = $2,
           stripe_charges_enabled = $3,
           stripe_payouts_enabled = $4,
           stripe_connected_at = CASE WHEN $3 = true AND stripe_connected_at IS NULL THEN NOW() ELSE stripe_connected_at END
       WHERE id = $5`,
      [
        account.details_submitted && account.charges_enabled,
        account.details_submitted,
        account.charges_enabled,
        account.payouts_enabled,
        groceryOwnerId
      ]
    );

    res.json({
      hasAccount: true,
      accountId: owner.stripe_account_id,
      onboardingComplete: account.details_submitted && account.charges_enabled,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirementsCurrentlyDue: account.requirements?.currently_due || [],
      requirementsEventuallyDue: account.requirements?.eventually_due || []
    });
  } catch (error) {
    // If Stripe columns don't exist yet in DB, return safe default instead of crashing
    if (error.code === '42703') {
      return res.json({
        hasAccount: false,
        onboardingComplete: false,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false
      });
    }
    console.error('Get account status error:', error);
    res.status(500).json({ error: 'Failed to get account status' });
  }
});

export default router;
export { requireGroceryOwnerAuth };
