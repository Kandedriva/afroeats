const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { uploadToR2, deleteFromR2 } = require('../services/r2StorageService');
const { sendEmail } = require('../services/emailService');
const { geocodeAddress } = require('../utils/geocoding');

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

router.post('/register', uploadToR2.single('logo'), async (req, res) => {
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

    // Handle logo upload
    let logoUrl = null;
    if (req.file) {
      const uploadResult = await uploadToR2(req.file);
      if (uploadResult.success) {
        logoUrl = uploadResult.url;
      } else {
        console.warn('Logo upload to R2 failed:', uploadResult.error);
      }
    }

    await client.query('BEGIN');

    // Create grocery store owner
    const ownerResult = await client.query(
      `INSERT INTO grocery_store_owners (name, email, password, secret_word, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, name, email, created_at`,
      [name, email, hashedPassword, hashedSecretWord]
    );

    const ownerId = ownerResult.rows[0].id;

    // Auto-geocode the address
    let geocoded = { latitude: null, longitude: null };
    try {
      geocoded = await geocodeAddress(location);
      if (geocoded.latitude && geocoded.longitude) {
        console.log(`✅ Auto-geocoded grocery store ${store_name}: (${geocoded.latitude}, ${geocoded.longitude})`);
      } else {
        console.warn(`⚠️ Could not auto-geocode grocery store ${store_name} at address: ${location}`);
      }
    } catch (geocodeError) {
      console.warn(`⚠️ Auto-geocoding failed for grocery store ${store_name}:`, geocodeError.message);
    }

    // Create grocery store
    await client.query(
      `INSERT INTO grocery_stores (name, address, phone_number, image_url, owner_id, latitude, longitude, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [store_name, location, phone_number, logoUrl, ownerId, geocoded.latitude, geocoded.longitude]
    );

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
        sendEmail(
          email,
          'Welcome to Order Dabaly - Grocery Store Owner',
          `<h1>Welcome, ${name}!</h1>
           <p>Thank you for registering your grocery store <strong>${store_name}</strong> on Order Dabaly!</p>
           <p>You can now start managing your store and receiving orders.</p>
           <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/grocery-owner/dashboard">Go to Dashboard</a></p>`
        ).catch(err => console.error('Welcome email failed:', err));

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

    // Get all grocery orders with items
    const ordersResult = await pool.query(`
      SELECT
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
        u.phone AS customer_phone,
        json_agg(
          json_build_object(
            'id', goi.id,
            'product_id', goi.product_id,
            'quantity', goi.quantity,
            'price', goi.price,
            'product_name', p.name,
            'product_image', p.image_url
          )
        ) AS items
      FROM grocery_orders go
      LEFT JOIN users u ON go.user_id = u.id
      LEFT JOIN grocery_order_items goi ON go.id = goi.order_id
      LEFT JOIN products p ON goi.product_id = p.id
      WHERE p.grocery_store_id = $1
      GROUP BY go.id, u.id
      ORDER BY go.created_at DESC
    `, [storeId]);

    res.json({ orders: ordersResult.rows });
  } catch (error) {
    console.error('Get grocery orders error:', error);
    res.status(500).json({ error: 'Failed to get grocery orders' });
  }
});

/**
 * PATCH /api/grocery-owners/orders/:id/complete
 * Mark a grocery order as completed/delivered
 */
router.patch('/orders/:id/complete', requireGroceryOwnerAuth, async (req, res) => {
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

    // Check if order exists
    const orderCheck = await pool.query(
      'SELECT * FROM grocery_orders WHERE id = $1',
      [orderId]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderCheck.rows[0];

    // Don't allow completing already delivered orders
    if (order.status === 'delivered') {
      return res.status(400).json({ error: 'Order already delivered' });
    }

    // Update order status to delivered
    await pool.query(
      'UPDATE grocery_orders SET status = $1, updated_at = NOW() WHERE id = $2',
      ['delivered', orderId]
    );

    res.json({ message: 'Order marked as delivered' });
  } catch (error) {
    console.error('Complete grocery order error:', error);
    res.status(500).json({ error: 'Failed to complete order' });
  }
});

module.exports = router;
module.exports.requireGroceryOwnerAuth = requireGroceryOwnerAuth;
