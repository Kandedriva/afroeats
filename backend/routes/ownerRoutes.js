import express from "express";
import bcryptjs from "bcryptjs";
import pool from "../db.js";
import stripe from "../stripe.js";
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
import {
  sendRestaurantOwnerWelcomeEmail,
  sendEmailVerificationCode,
  sendEmailChangeVerification,
  sendEmailChangeNotification,
  sendPasswordChangeNotification,
} from "../services/emailService.js";
import { validatePassword } from "../middleware/security.js";
import crypto from "crypto";

function ownerSafeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const router = express.Router();

// Note: Image upload configurations now handled by R2 middleware

// ========= OWNER REGISTRATION ==========
router.post("/register", ...uploadRestaurantLogo, async (req, res) => {
  const { name, email, password, secret_word, restaurant_name, address, city, state, zip_code, phone_number, invite_code } = req.body;
  
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
    // Validate invite code
    const validCode = process.env.OWNER_INVITE_CODE;
    if (!validCode || invite_code !== validCode) {
      return res.status(403).json({ error: 'Invalid invite code' });
    }

    // Ensure address + approval columns exist on restaurants
    await pool.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS city VARCHAR(100)`);
    await pool.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS state VARCHAR(100)`);
    await pool.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20)`);
    await pool.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`);
    await pool.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'pending'`);
    await pool.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);

    // Ensure email verification columns exist (existing rows default to verified)
    await pool.query(`ALTER TABLE restaurant_owners ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE`);
    await pool.query(`ALTER TABLE restaurant_owners ADD COLUMN IF NOT EXISTS verification_code VARCHAR(10)`);
    await pool.query(`ALTER TABLE restaurant_owners ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMP`);
    await pool.query(`ALTER TABLE restaurant_owners ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255)`);
    await pool.query(`ALTER TABLE restaurant_owners ADD COLUMN IF NOT EXISTS email_change_code VARCHAR(10)`);
    await pool.query(`ALTER TABLE restaurant_owners ADD COLUMN IF NOT EXISTS email_change_code_expires_at TIMESTAMP`);

    const existing = await pool.query("SELECT * FROM restaurant_owners WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Owner already exists" });
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.error });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const hashedSecretWord = await bcryptjs.hash(secret_word, 10);

    const verificationCode = crypto.randomInt(100000, 1000000).toString();
    const codeExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Create owner (handle case where columns might not exist)
    let ownerResult;
    try {
      ownerResult = await pool.query(
        `INSERT INTO restaurant_owners (name, email, password, secret_word, is_subscribed, email_verified, verification_code, verification_code_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, email`,
        [name, email, hashedPassword, hashedSecretWord, false, false, verificationCode, codeExpiry]
      );
    } catch (err) {
      try {
        ownerResult = await pool.query(
          `INSERT INTO restaurant_owners (name, email, password, secret_word, email_verified, verification_code, verification_code_expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, email`,
          [name, email, hashedPassword, hashedSecretWord, false, verificationCode, codeExpiry]
        );
      } catch (err2) {
        ownerResult = await pool.query(
          `INSERT INTO restaurant_owners (name, email, password, email_verified, verification_code, verification_code_expires_at)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email`,
          [name, email, hashedPassword, false, verificationCode, codeExpiry]
        );
      }
    }
    const ownerId = ownerResult.rows[0].id;

    const fullAddress = `${address}, ${city}, ${state} ${zip_code}`;

    // Create restaurant (pending approval by default)
    const restaurantResult = await pool.query(
      `INSERT INTO restaurants (name, address, city, state, zip_code, phone_number, image_url, owner_id, active, approval_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, FALSE, 'pending') RETURNING *`,
      [restaurant_name, address, city, state, zip_code, phone_number, logoPath, ownerId]
    );

    const restaurantId = restaurantResult.rows[0].id;

    // Generate and store URL slug for the new restaurant
    try {
      const { toSlug } = await import('./restaurantRoutes.js');
      const baseSlug = toSlug(restaurant_name);
      const conflict = await pool.query(`SELECT id FROM restaurants WHERE slug = $1 AND id != $2`, [baseSlug, restaurantId]);
      const slug = conflict.rows.length > 0 ? `${baseSlug}-${restaurantId}` : baseSlug;
      await pool.query(`UPDATE restaurants SET slug = $1 WHERE id = $2`, [slug, restaurantId]);
    } catch (slugErr) {
      console.warn('Could not generate restaurant slug:', slugErr.message);
    }

    // Auto-geocode the new restaurant address
    try {
      const { geocodeRestaurant } = await import('../services/googleMapsService.js');
      const geocoded = await geocodeRestaurant(restaurantId);
      if (geocoded) {
        console.log(`✅ Auto-geocoded new restaurant ${restaurant_name}: (${geocoded.latitude}, ${geocoded.longitude})`);
      } else {
        console.warn(`⚠️ Could not auto-geocode restaurant ${restaurant_name} at address: ${fullAddress}`);
      }
    } catch (geocodeError) {
      console.warn(`⚠️ Auto-geocoding failed for restaurant ${restaurant_name}:`, geocodeError.message);
      // Don't fail registration if geocoding fails - it can be done later
    }

    // Send verification code — do not start session until email is confirmed
    sendEmailVerificationCode(email, name, verificationCode)
      .catch(err => console.error('Failed to send owner verification email:', err));

    res.status(201).json({
      needsVerification: true,
      email,
      message: "Registration successful! Please check your email for a verification code. Your restaurant will be visible to customers once approved by our team.",
    });
  } catch (err) {
    console.error('Owner registration error:', err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// ========= OWNER EMAIL VERIFICATION ==========
router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: "Email and code are required" });
  }
  try {
    const ownerRes = await pool.query(
      "SELECT id, name, email, email_verified, verification_code, verification_code_expires_at FROM restaurant_owners WHERE email = $1",
      [email]
    );
    if (ownerRes.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }
    const owner = ownerRes.rows[0];
    if (owner.email_verified) {
      return res.status(400).json({ error: "Email is already verified" });
    }
    if (!owner.verification_code || !owner.verification_code_expires_at) {
      return res.status(400).json({ error: "No verification code found. Please request a new one." });
    }
    if (new Date() > new Date(owner.verification_code_expires_at)) {
      return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
    }
    if (!ownerSafeCompare(owner.verification_code, code)) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    await pool.query(
      "UPDATE restaurant_owners SET email_verified = true, verification_code = NULL, verification_code_expires_at = NULL WHERE id = $1",
      [owner.id]
    );

    // Get restaurant for session data
    const restaurantRes = await pool.query("SELECT id FROM restaurants WHERE owner_id = $1", [owner.id]);

    // Log them in
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: "Session error" });
      req.session.ownerId = owner.id;
      req.session.ownerName = owner.name;
      req.session.ownerEmail = owner.email;
      req.session.loginTime = new Date().toISOString();
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ error: "Session save error" });
        sendRestaurantOwnerWelcomeEmail(owner.email, owner.name, '')
          .catch(() => {});
        res.json({ success: true, message: "Email verified successfully! Welcome!" });
      });
    });
  } catch (err) {
    console.error('Owner email verification error:', err);
    res.status(500).json({ error: "Server error during verification" });
  }
});

router.post("/resend-verification", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  try {
    const ownerRes = await pool.query(
      "SELECT id, name, email_verified FROM restaurant_owners WHERE email = $1",
      [email]
    );
    if (ownerRes.rows.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }
    const owner = ownerRes.rows[0];
    if (owner.email_verified) {
      return res.status(400).json({ error: "Email is already verified" });
    }
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      "UPDATE restaurant_owners SET verification_code = $1, verification_code_expires_at = $2 WHERE id = $3",
      [code, expiry, owner.id]
    );
    sendEmailVerificationCode(email, owner.name, code)
      .catch(err => console.error('Failed to resend owner verification:', err));
    res.json({ success: true, message: "Verification code resent" });
  } catch (err) {
    console.error('Owner resend verification error:', err);
    res.status(500).json({ error: "Server error" });
  }
});

// ========= OWNER LOGIN (with account lockout) ==========
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

    // Check email verification (NULL treated as verified for legacy accounts)
    if (owner.email_verified === false) {
      return res.status(403).json({
        error: "Please verify your email before logging in.",
        needsVerification: true,
        email: owner.email,
      });
    }

    // Clear failed attempts on successful login
    await handleSuccessfulLogin(req, res, () => {});

    // Regenerate session ID for security
    req.session.regenerate((regenerateErr) => {
      if (regenerateErr) {
        console.error('Session regeneration error:', regenerateErr);
        return res.status(500).json({ error: "Session error during login" });
      }

      // Set session
      req.session.ownerId = owner.id;
      req.session.ownerName = owner.name;
      req.session.ownerEmail = owner.email;
      req.session.loginTime = new Date().toISOString();
      
      // Force session save and respond only after successful save
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error during owner login:', saveErr);
          return res.status(500).json({ error: "Session save error during login" });
        }

        console.log('✅ Owner session saved successfully. ID:', req.sessionID, 'Owner:', owner.name);
        
        res.json({
          message: "Login successful",
          owner: {
            id: owner.id,
            name: owner.name,
            email: owner.email
          },
        });
      });
    });
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
  console.log('=== DISH CREATION DEBUG ===');
  console.log('req.body:', req.body);
  console.log('req.file:', req.file ? 'File present' : 'No file');
  console.log('Content-Type:', req.headers['content-type']);
  console.log('=== END DEBUG ===');
  
  const { name, description = "", price, available } = req.body;
  
  // Validate required fields
  if (!name || !price) {
    return res.status(400).json({ 
      error: "Name and price are required",
      debug: { name, price, body: req.body }
    });
  }
  
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
    console.error('Database error adding dish:', err.message);
    console.error('Values:', { name, description, price, imagePath, available });
    res.status(500).json({ 
      error: "Server error while adding dish",
      debug: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ========= OWNER DASHBOARD ==========
router.get("/dashboard", requireOwnerAuth, async (req, res) => {
  const ownerId = req.owner.id;

  try {
    const restaurantRes = await pool.query(
      "SELECT id, name, address, city, state, zip_code, phone_number, image_url, delivery_fee FROM restaurants WHERE owner_id = $1",
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
        COALESCE(o.guest_name, u.name, 'Guest') AS customer_name,
        oi.name AS dish_name,
        d.image_url,
        oi.price,
        oi.quantity,
        r.name AS restaurant_name
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN dishes d ON oi.dish_id = d.id
      LEFT JOIN restaurants r ON COALESCE(oi.restaurant_id, d.restaurant_id) = r.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE r.owner_id = $1
      ORDER BY o.created_at DESC
      `,
      [ownerId]
    );

    res.json({
      restaurant: {
        ...restaurant,
        image_url: restaurant.image_url ? restaurant.image_url.replace(/\\/g, "/") : null,
        delivery_fee: restaurant.delivery_fee || 0.00
      },
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
  
  // Comprehensive debug logging for request data
  console.log('=== DISH UPDATE DEBUG ===');
  console.log('dishId:', dishId);
  console.log('ownerId:', ownerId);
  console.log('req.body:', JSON.stringify(req.body, null, 2));
  console.log('req.file:', req.file ? { 
    fieldname: req.file.fieldname, 
    originalname: req.file.originalname, 
    size: req.file.size 
  } : null);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('All headers:', Object.keys(req.headers));
  console.log('Raw body type:', typeof req.body);
  console.log('Body keys:', req.body ? Object.keys(req.body) : 'no body');
  console.log('=== END DEBUG ===');
  
  // TEMPORARY: Log content type for debugging in production
  console.log('Content-Type received:', req.headers['content-type']);

  // Ensure req.body exists and has expected structure
  if (!req.body || typeof req.body !== 'object') {
    req.body = {};
  }
  
  const { name, description = "", price } = req.body;
  
  // More flexible validation - handle empty strings, undefined, and various data types
  const trimmedName = name ? String(name).trim() : '';
  const trimmedPrice = (price !== undefined && price !== null && price !== '') ? String(price).trim() : '';
  const trimmedDescription = description ? String(description).trim() : '';
  
  // TEMPORARY: Enhanced debugging for validation failures (production + development)
  console.log('=== DISH UPDATE VALIDATION DEBUG ===');
  console.log('Raw req.body:', JSON.stringify(req.body));
  console.log('name from body:', JSON.stringify(name), 'Type:', typeof name);
  console.log('trimmedName:', JSON.stringify(trimmedName), 'Length:', trimmedName.length);
  console.log('price from body:', JSON.stringify(price), 'Type:', typeof price);
  console.log('trimmedPrice:', JSON.stringify(trimmedPrice));
  console.log('description from body:', JSON.stringify(description), 'Type:', typeof description);
  console.log('req.file:', req.file ? 'Present' : 'Not present');
  console.log('=== END VALIDATION DEBUG ===');
  
  // Validate required fields with improved error messages
  if (!trimmedName || trimmedName.length === 0) {
    console.log('VALIDATION FAILED: Name is missing or empty');
    console.log('Full request body keys:', Object.keys(req.body || {}));
    console.log('Full request body values:', Object.values(req.body || {}));
    return res.status(400).json({ 
      error: "Dish name is required",
      details: "Dish name cannot be empty",
      received: { name, price, description },
      bodyKeys: Object.keys(req.body || {}),
      bodyValues: req.body
    });
  }
  
  const numericPrice = parseFloat(trimmedPrice);
  if (isNaN(numericPrice) || numericPrice <= 0) {
    console.log('VALIDATION FAILED: Price is missing or invalid');
    return res.status(400).json({ 
      error: "Valid price is required",
      details: "Price must be a number greater than 0",
      received: { name, price, description }
    });
  }
  
  // Use validated values for the update
  const finalName = trimmedName;
  const finalDescription = trimmedDescription;
  const finalPrice = numericPrice;
  
  console.log('VALIDATION PASSED:', { finalName, finalDescription, finalPrice });

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

    // Update the dish using validated and processed values
    const updatedDish = await pool.query(
      `UPDATE dishes SET name = $1, description = $2, price = $3, image_url = $4
       WHERE id = $5 RETURNING *`,
      [finalName, finalDescription, finalPrice, imagePath, dishId]
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


// Check current owner session
router.get("/me", async (req, res) => {
  try {
    // Log minimal session info for debugging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Owner /me check - Session ID:', req.sessionID, 'Owner ID:', req.session?.ownerId, 'Has Cookie:', !!req.headers.cookie);
    }
    
    if (!req.session || !req.session.ownerId) {
      return res.status(401).json({ error: "Not logged in" });
    }

    // Validate that the owner still exists in the database
    const ownerResult = await pool.query(
      "SELECT id, name, email FROM restaurant_owners WHERE id = $1",
      [req.session.ownerId]
    );

    if (ownerResult.rows.length === 0) {
      // Owner no longer exists, clear session
      req.session.destroy((err) => {
        if (err) console.error('Error destroying invalid owner session:', err);
      });
      return res.status(401).json({ error: "Owner account not found" });
    }

    const owner = ownerResult.rows[0];
    
    res.json({
      id: owner.id,
      name: owner.name,
      email: owner.email,
      loginTime: req.session.loginTime,
    });
  } catch (err) {
    console.error('Owner /me endpoint error:', err);
    res.status(500).json({ error: "Server error checking authentication" });
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

    // Ensure restaurant_order_status table exists with all required columns
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
      await pool.query(`ALTER TABLE restaurant_order_status ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP`);
      await pool.query(`ALTER TABLE restaurant_order_status ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMP`);
      await pool.query(`ALTER TABLE restaurant_order_status ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP`);
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
        COALESCE(o.guest_name, u.name, 'Guest Customer') as customer_name,
        COALESCE(o.guest_email, u.email, 'guest@orderdabaly.com') as customer_email,
        COALESCE(o.delivery_address, u.address, 'No address provided') as customer_address,
        COALESCE(o.delivery_phone, u.phone, 'No phone provided') as customer_phone,
        COALESCE(o.is_guest_order, false) as is_guest_order,
        oi.id as item_id,
        oi.name as item_name,
        oi.price as item_price,
        oi.quantity,
        r.name as restaurant_name,
        r.id as restaurant_id,
        COALESCE(ros.status, 'active') as restaurant_status,
        ros.cancelled_at as restaurant_cancelled_at,
        ros.completed_at as restaurant_completed_at,
        ros.preparing_at as restaurant_preparing_at,
        ros.ready_at as restaurant_ready_at
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN dishes d ON oi.dish_id = d.id
      LEFT JOIN restaurants r ON COALESCE(oi.restaurant_id, d.restaurant_id) = r.id
      LEFT JOIN restaurant_order_status ros ON (o.id = ros.order_id AND r.id = ros.restaurant_id)
      LEFT JOIN users u ON o.user_id = u.id
      WHERE r.owner_id = $1 
        AND (o.status IN ('paid', 'completed', 'received', 'delivered', 'preparing', 'ready', 'picked_up'))
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
          preparing_at: row.restaurant_preparing_at,
          ready_at: row.restaurant_ready_at,
          cancelled_at: row.restaurant_cancelled_at,
          order_details: restaurantSpecificInstructions, // Use restaurant-specific instructions
          delivery_address: row.delivery_address,
          delivery_phone: row.delivery_phone,
          delivery_type: row.delivery_type,
          customer_name: row.customer_name,
          customer_email: row.customer_email,
          customer_address: row.customer_address,
          customer_phone: row.customer_phone,
          is_guest_order: row.is_guest_order,
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
      const divisor = order.original_total - order.original_platform_fee;
      const proportion = divisor > 0 ? order.restaurant_subtotal / divisor : 1;
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

    const pwCheck = validatePassword(new_password);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.error });
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

// PATCH /api/owners/orders/:id/status - Advance order to preparing or ready
router.patch("/orders/:id/status", requireOwnerAuth, async (req, res) => {
  try {
    const orderId = req.params.id;
    const ownerId = req.owner.id;
    const { status } = req.body;

    if (!['preparing', 'ready'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed: preparing, ready' });
    }

    const restaurantResult = await pool.query(
      "SELECT id, name FROM restaurants WHERE owner_id = $1",
      [ownerId]
    );
    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: "Restaurant not found for this owner" });
    }
    const { id: restaurantId, name: restaurantName } = restaurantResult.rows[0];

    const verifyResult = await pool.query(`
      SELECT DISTINCT o.id, o.user_id, o.delivery_phone
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

    // Ensure schema columns exist
    await pool.query(`ALTER TABLE restaurant_order_status ADD COLUMN IF NOT EXISTS preparing_at TIMESTAMP`);
    await pool.query(`ALTER TABLE restaurant_order_status ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP`);

    const timestampField = status === 'preparing' ? 'preparing_at' : 'ready_at';

    await pool.query(`
      INSERT INTO restaurant_order_status (order_id, restaurant_id, status, ${timestampField})
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (order_id, restaurant_id)
      DO UPDATE SET status = $3, ${timestampField} = NOW()
    `, [orderId, restaurantId, status]);

    await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [status, orderId]);

    const { user_id: userId, delivery_phone: customerPhone } = verifyResult.rows[0];

    const notifConfig = {
      preparing: {
        type: 'order_preparing',
        title: 'Your order is being prepared! 👨‍🍳',
        message: `Your order #${orderId} from ${restaurantName} is now being prepared.`,
      },
      ready: {
        type: 'order_ready',
        title: 'Your order is ready! 🍽️',
        message: `Your order #${orderId} from ${restaurantName} is ready for pickup/delivery!`,
      },
    };
    const { type, title, message } = notifConfig[status];

    if (userId) {
      try {
        await pool.query(
          `INSERT INTO customer_notifications (user_id, order_id, type, title, message, data)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, orderId, type, title, message,
           JSON.stringify({ orderId, restaurantId, restaurantName, status })]
        );
      } catch (notifError) {
        console.error('Failed to create customer notification:', notifError.message);
      }
    }

    if (customerPhone) {
      try {
        const { sendSMS } = await import('../services/smsService.js');
        await sendSMS(customerPhone, message);
      } catch (smsError) {
        console.error('Failed to send order status SMS:', smsError.message);
      }
    }

    res.json({ success: true, status, message: `Order marked as ${status}` });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: "Failed to update order status" });
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

    // ✅ Create customer notification that restaurant portion is ready
    try {
      // Get order details for notification
      const orderResult = await pool.query(
        'SELECT user_id FROM orders WHERE id = $1',
        [orderId]
      );

      if (orderResult.rows.length > 0 && orderResult.rows[0].user_id) {
        const userId = orderResult.rows[0].user_id;

        // Get restaurant name
        const restaurantNameResult = await pool.query(
          'SELECT name FROM restaurants WHERE id = $1',
          [restaurantId]
        );
        const restaurantName = restaurantNameResult.rows[0]?.name || 'Restaurant';

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

        // Create notification
        await pool.query(
          `INSERT INTO customer_notifications (user_id, order_id, type, title, message, data)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            userId,
            orderId,
            'order_ready',
            'Order Ready! 🍽️',
            `Your order #${orderId} from ${restaurantName} is ready!`,
            JSON.stringify({
              orderId,
              restaurantId,
              restaurantName
            })
          ]
        );

        console.log(`✅ Customer notification created: Order ${orderId} ready at ${restaurantName}`);

        // ✅ Send SMS to customer about order ready
        try {
          const notificationService = require('../services/NotificationService.js');
          const customerPhone = orderResult.rows[0]?.delivery_phone;

          if (customerPhone) {
            await notificationService.sendOrderStatusUpdateSMS(customerPhone, {
              orderId,
              status: 'ready',
              restaurantName
            });
            console.log(`✅ Order ready SMS sent to customer: ${customerPhone}`);
          }
        } catch (smsError) {
          console.error('❌ Failed to send order ready SMS:', smsError.message);
        }
      }
    } catch (notifError) {
      console.error('❌ Failed to create customer notification:', notifError.message);
      // Don't fail the main operation if notification fails
    }

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

      // ✅ Send final notification that entire order is complete
      try {
        const orderResult = await pool.query(
          'SELECT user_id FROM orders WHERE id = $1',
          [orderId]
        );

        if (orderResult.rows.length > 0 && orderResult.rows[0].user_id) {
          const userId = orderResult.rows[0].user_id;

          await pool.query(
            `INSERT INTO customer_notifications (user_id, order_id, type, title, message, data)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              userId,
              orderId,
              'order_completed',
              'Order Complete! ✅',
              `Your entire order #${orderId} is now complete. Enjoy your meal!`,
              JSON.stringify({
                orderId,
                completedRestaurants: completedRestaurantsResult.rows.length
              })
            ]
          );

          console.log(`✅ Customer notification created: Order ${orderId} fully completed`);

          // ✅ Send SMS to customer about order completion
          try {
            const notificationService = require('../services/NotificationService.js');
            const completedOrderResult = await pool.query(
              'SELECT delivery_phone FROM orders WHERE id = $1',
              [orderId]
            );
            const customerPhone = completedOrderResult.rows[0]?.delivery_phone;

            if (customerPhone) {
              await notificationService.sendOrderStatusUpdateSMS(customerPhone, {
                orderId,
                status: 'delivered',
                restaurantName: 'All Restaurants'
              });
              console.log(`✅ Order completion SMS sent to customer: ${customerPhone}`);
            }
          } catch (smsError) {
            console.error('❌ Failed to send order completion SMS:', smsError.message);
          }
        }
      } catch (notifError) {
        console.error('❌ Failed to create completion notification:', notifError.message);
      }
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

    if (!['approve', 'deny'].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve' or 'deny'" });
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

    // Prevent double-processing
    if (notificationData.refundProcessed) {
      return res.status(409).json({ error: "This refund request has already been processed" });
    }

    // Get order — LEFT JOIN so guest orders (null user_id) are included
    const orderResult = await pool.query(
      `SELECT o.*,
              u.id   AS customer_id,
              u.name AS customer_name,
              COALESCE(u.email, o.guest_email) AS customer_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [notification.order_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderResult.rows[0];
    const restaurantName = notificationData.restaurantName || 'Restaurant';
    const restaurantTotal = parseFloat(notificationData.restaurantTotal || 0);
    const itemCount = notificationData.itemCount || 0;

    // --- Execute Stripe refund when approved ---
    let stripeRefundId = null;

    if (action === 'approve') {
      if (restaurantTotal <= 0) {
        return res.status(400).json({ error: "Invalid refund amount" });
      }

      if (!stripe) {
        // Demo / test mode — record a synthetic refund ID
        stripeRefundId = `demo_refund_${Date.now()}`;
        console.log(`[Demo] Simulated refund of $${restaurantTotal} for order ${order.id}`);
      } else if (!order.stripe_payment_intent) {
        return res.status(400).json({
          error: "Cannot refund this order — no Stripe payment found. Demo orders cannot be refunded."
        });
      } else {
        try {
          const amountCents = Math.round(restaurantTotal * 100);
          const refund = await stripe.refunds.create({
            payment_intent: order.stripe_payment_intent,
            amount: amountCents,
            reason: 'requested_by_customer',
            metadata: {
              order_id: order.id.toString(),
              restaurant_owner_id: ownerId.toString(),
              notification_id: notificationId.toString(),
            }
          });
          stripeRefundId = refund.id;
          console.log(`✅ Stripe refund ${refund.id} issued: $${restaurantTotal} for order ${order.id}`);
        } catch (stripeErr) {
          console.error('Stripe refund error:', stripeErr);
          if (stripeErr.code === 'charge_already_refunded') {
            return res.status(409).json({ error: "This payment has already been fully refunded" });
          }
          if (stripeErr.code === 'charge_disputed') {
            return res.status(409).json({ error: "This payment is under dispute and cannot be refunded directly" });
          }
          return res.status(502).json({ error: `Stripe refund failed: ${stripeErr.message}` });
        }
      }
    }

    // Persist the decision (and refund ID) on the notification
    const updatedData = {
      ...notificationData,
      refundProcessed: true,
      refundAction: action,
      refundNotes: notes || '',
      processedAt: new Date().toISOString(),
      processedBy: ownerId,
      ...(stripeRefundId && { stripeRefundId })
    };

    await pool.query(
      "UPDATE notifications SET data = $1, read = TRUE WHERE id = $2",
      [JSON.stringify(updatedData), notificationId]
    );

    // Ensure customer_notifications table exists
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

    // Build customer-facing notification
    const customerTitle = action === 'approve'
      ? `Refund Processed — ${restaurantName}`
      : `Refund Denied — ${restaurantName}`;

    const customerMessage = action === 'approve'
      ? `Your refund of $${restaurantTotal.toFixed(2)} for order #${order.id} has been processed. It should appear on your statement within 5–10 business days.`
      : `Your refund request for order #${order.id} was denied by ${restaurantName}.${notes ? ` Reason: ${notes}` : ''}`;

    const customerData = {
      orderId: order.id,
      restaurantTotal,
      restaurantName,
      itemCount,
      refundAction: action,
      refundNotes: notes || '',
      processedAt: new Date().toISOString(),
      ...(stripeRefundId && { stripeRefundId })
    };

    // Insert for authenticated customers; guest orders have no user_id so skip
    if (order.customer_id) {
      await pool.query(
        "INSERT INTO customer_notifications (user_id, type, title, message, data) VALUES ($1, $2, $3, $4, $5)",
        [order.customer_id, `refund_${action}`, customerTitle, customerMessage, JSON.stringify(customerData)]
      );
    }

    res.json({
      success: true,
      message: action === 'approve'
        ? `Refund of $${restaurantTotal.toFixed(2)} sent to customer. It will appear within 5–10 business days.`
        : `Refund denied. Customer has been notified.`,
      action,
      ...(stripeRefundId && { stripeRefundId })
    });
  } catch (err) {
    console.error('Process refund error:', err);
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

// ========= UPDATE DELIVERY FEE ==========
router.put("/restaurant/delivery-fee", requireOwnerAuth, async (req, res) => {
  const ownerId = req.owner.id;
  const { deliveryFee } = req.body;

  // Validate delivery fee
  if (deliveryFee === undefined || deliveryFee === null) {
    return res.status(400).json({ error: "Delivery fee is required" });
  }

  const fee = parseFloat(deliveryFee);
  if (isNaN(fee) || fee < 0) {
    return res.status(400).json({ error: "Delivery fee must be a valid positive number" });
  }

  if (fee > 50) {
    return res.status(400).json({ error: "Delivery fee cannot exceed $50.00" });
  }

  try {
    // Ensure delivery_fee column exists
    try {
      await pool.query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0.00");
    } catch (err) {
      // Column might already exist
    }

    // Check if restaurant exists for this owner
    const restaurantRes = await pool.query(
      "SELECT id FROM restaurants WHERE owner_id = $1",
      [ownerId]
    );

    if (restaurantRes.rows.length === 0) {
      return res.status(404).json({ error: "No restaurant found for this owner" });
    }

    // Update delivery fee
    await pool.query(
      "UPDATE restaurants SET delivery_fee = $1 WHERE owner_id = $2",
      [fee, ownerId]
    );

    res.json({ 
      success: true, 
      message: "Delivery fee updated successfully",
      deliveryFee: fee 
    });

  } catch (err) {
    console.error('Delivery fee update error:', err);
    res.status(500).json({ error: "Failed to update delivery fee" });
  }
});

// ========= GET RESTAURANT WITH DELIVERY FEE ==========
router.get("/restaurant/details", requireOwnerAuth, async (req, res) => {
  const ownerId = req.owner.id;

  try {
    // Ensure delivery_fee column exists
    try {
      await pool.query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0.00");
    } catch (err) {
      // Column might already exist
    }

    const restaurantRes = await pool.query(
      "SELECT id, name, address, city, state, zip_code, phone_number, image_url, delivery_fee FROM restaurants WHERE owner_id = $1",
      [ownerId]
    );

    if (restaurantRes.rows.length === 0) {
      return res.status(404).json({ error: "No restaurant found for this owner" });
    }

    const restaurant = restaurantRes.rows[0];

    res.json({
      restaurant: {
        ...restaurant,
        delivery_fee: restaurant.delivery_fee || 0.00
      }
    });

  } catch (err) {
    console.error('Restaurant details fetch error:', err);
    res.status(500).json({ error: "Failed to fetch restaurant details" });
  }
});

// ========= UPDATE OWNER EMAIL ==========
router.put("/profile/email", requireOwnerAuth, async (req, res) => {
  try {
    const { email } = req.body;
    const ownerId = req.owner.id;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }

    const trimmedEmail = email.trim().toLowerCase();
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if email is already taken by another owner
    const existingOwner = await pool.query(
      "SELECT id FROM restaurant_owners WHERE email = $1 AND id != $2",
      [trimmedEmail, ownerId]
    );

    if (existingOwner.rows.length > 0) {
      return res.status(400).json({ error: "Email is already taken by another account" });
    }

    // Get current owner data
    const currentOwner = await pool.query(
      "SELECT email FROM restaurant_owners WHERE id = $1",
      [ownerId]
    );

    if (currentOwner.rows.length === 0) {
      return res.status(404).json({ error: "Owner not found" });
    }

    // Check if email is actually changing
    if (currentOwner.rows[0].email === trimmedEmail) {
      return res.json({
        success: true,
        message: "Email is already up to date",
        email: trimmedEmail
      });
    }

    // Initiate email change: send code to new email, do not update yet
    const changeCode = crypto.randomInt(100000, 1000000).toString();
    const codeExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      "UPDATE restaurant_owners SET pending_email = $1, email_change_code = $2, email_change_code_expires_at = $3 WHERE id = $4",
      [trimmedEmail, changeCode, codeExpiry, ownerId]
    );

    sendEmailChangeVerification(trimmedEmail, req.owner.name, changeCode)
      .catch(err => console.error('Failed to send email change verification:', err));
    sendEmailChangeNotification(currentOwner.rows[0].email, req.owner.name, trimmedEmail)
      .catch(err => console.error('Failed to send email change notification:', err));

    res.json({
      success: true,
      pendingEmailChange: true,
      message: "A confirmation code has been sent to your new email address. Enter it below to complete the change.",
    });

  } catch (err) {
    console.error('Email update error:', err);
    res.status(500).json({ error: "Failed to update email" });
  }
});

// ========= CONFIRM EMAIL CHANGE ==========
router.post("/confirm-email-change", requireOwnerAuth, async (req, res) => {
  try {
    const { code } = req.body;
    const ownerId = req.owner.id;

    if (!code) return res.status(400).json({ error: "Confirmation code is required" });

    const ownerRes = await pool.query(
      "SELECT pending_email, email_change_code, email_change_code_expires_at FROM restaurant_owners WHERE id = $1",
      [ownerId]
    );

    if (ownerRes.rows.length === 0) return res.status(404).json({ error: "Owner not found" });

    const owner = ownerRes.rows[0];

    if (!owner.pending_email || !owner.email_change_code) {
      return res.status(400).json({ error: "No pending email change found" });
    }

    if (new Date() > new Date(owner.email_change_code_expires_at)) {
      return res.status(400).json({ error: "Confirmation code has expired. Please start the email change again." });
    }

    if (!ownerSafeCompare(owner.email_change_code, code)) {
      return res.status(400).json({ error: "Invalid confirmation code" });
    }

    await pool.query(
      "UPDATE restaurant_owners SET email = $1, pending_email = NULL, email_change_code = NULL, email_change_code_expires_at = NULL WHERE id = $2",
      [owner.pending_email, ownerId]
    );

    req.session.ownerEmail = owner.pending_email;

    res.json({ success: true, message: "Email updated successfully", email: owner.pending_email });

  } catch (err) {
    console.error('Confirm email change error:', err);
    res.status(500).json({ error: "Failed to confirm email change" });
  }
});

// ========= UPDATE RESTAURANT ADDRESS ==========
router.put("/restaurant/address", requireOwnerAuth, async (req, res) => {
  try {
    const { street, city, state, zip } = req.body;
    const ownerId = req.owner.id;

    if (!street?.trim() || !city?.trim() || !state?.trim() || !zip?.trim()) {
      return res.status(400).json({ error: "Street, city, state, and zip code are all required" });
    }

    const trimmedStreet = street.trim();
    const trimmedCity = city.trim();
    const trimmedState = state.trim();
    const trimmedZip = zip.trim();

    // Check if owner owns a restaurant
    const restaurantResult = await pool.query(
      "SELECT id FROM restaurants WHERE owner_id = $1",
      [ownerId]
    );

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: "No restaurant found for this owner" });
    }

    // Compose full address for geocoding and display
    const fullAddress = `${trimmedStreet}, ${trimmedCity}, ${trimmedState} ${trimmedZip}`;

    const updateResult = await pool.query(
      `UPDATE restaurants
       SET address = $1, city = $2, state = $3, zip_code = $4, address_geocoded = FALSE
       WHERE owner_id = $5
       RETURNING id`,
      [fullAddress, trimmedCity, trimmedState, trimmedZip, ownerId]
    );

    // Auto-geocode the updated address
    if (updateResult.rows.length > 0) {
      const restaurantId = updateResult.rows[0].id;
      try {
        const { geocodeRestaurant } = await import('../services/googleMapsService.js');
        const geocoded = await geocodeRestaurant(restaurantId);
        if (geocoded) {
          console.log(`✅ Re-geocoded restaurant after address update: (${geocoded.latitude}, ${geocoded.longitude})`);
        } else {
          console.warn(`⚠️ Could not geocode updated address: ${fullAddress}`);
        }
      } catch (geocodeError) {
        console.warn(`⚠️ Re-geocoding failed for updated address:`, geocodeError.message);
      }
    }

    res.json({
      success: true,
      message: "Restaurant address updated successfully",
      address: fullAddress,
      city: trimmedCity,
      state: trimmedState,
      zip_code: trimmedZip
    });

  } catch (err) {
    console.error('Restaurant address update error:', err);
    res.status(500).json({ error: "Failed to update restaurant address" });
  }
});

// ========= CHANGE PASSWORD (authenticated) ==========
router.put("/profile/password", requireOwnerAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const ownerId = req.owner.id;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.error });
    }

    // Get current owner data
    const ownerResult = await pool.query(
      "SELECT password, email, name FROM restaurant_owners WHERE id = $1",
      [ownerId]
    );

    if (ownerResult.rows.length === 0) {
      return res.status(404).json({ error: "Owner not found" });
    }

    const owner = ownerResult.rows[0];

    // Verify current password
    const currentPasswordMatch = await bcryptjs.compare(currentPassword, owner.password);
    if (!currentPasswordMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Check if new password is different from current
    const samePassword = await bcryptjs.compare(newPassword, owner.password);
    if (samePassword) {
      return res.status(400).json({ error: "New password must be different from current password" });
    }

    // Hash new password
    const hashedNewPassword = await bcryptjs.hash(newPassword, 10);

    // Update password
    await pool.query(
      "UPDATE restaurant_owners SET password = $1 WHERE id = $2",
      [hashedNewPassword, ownerId]
    );

    // Notify owner of password change (non-blocking)
    sendPasswordChangeNotification(owner.email, owner.name)
      .catch(err => console.error('Failed to send password change notification:', err));

    res.json({ 
      success: true, 
      message: "Password changed successfully" 
    });

  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: "Server error during password change" });
  }
});

// ========= CLOSE ACCOUNT ==========
router.delete("/profile/close", requireOwnerAuth, async (req, res) => {
  try {
    const { password, confirmText } = req.body;
    const ownerId = req.owner.id;

    // Validate confirmation text
    if (confirmText !== "CLOSE MY ACCOUNT") {
      return res.status(400).json({ error: "Please type 'CLOSE MY ACCOUNT' exactly to confirm" });
    }

    if (!password) {
      return res.status(400).json({ error: "Password is required to close account" });
    }

    // Get owner data
    const ownerResult = await pool.query(
      "SELECT password, email, name FROM restaurant_owners WHERE id = $1",
      [ownerId]
    );

    if (ownerResult.rows.length === 0) {
      return res.status(404).json({ error: "Owner not found" });
    }

    const owner = ownerResult.rows[0];

    // Verify password
    const passwordMatch = await bcryptjs.compare(password, owner.password);
    if (!passwordMatch) {
      return res.status(400).json({ error: "Password is incorrect" });
    }

    // Check for pending orders
    const pendingOrdersResult = await pool.query(`
      SELECT COUNT(*) as order_count 
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN dishes d ON oi.dish_id = d.id
      LEFT JOIN restaurants r ON COALESCE(oi.restaurant_id, d.restaurant_id) = r.id
      WHERE r.owner_id = $1 AND o.status IN ('pending', 'paid', 'received')
    `, [ownerId]);

    const pendingOrderCount = parseInt(pendingOrdersResult.rows[0].order_count);
    if (pendingOrderCount > 0) {
      return res.status(400).json({ 
        error: `Cannot close account with ${pendingOrderCount} pending order${pendingOrderCount !== 1 ? 's' : ''}. Please complete or cancel all orders first.` 
      });
    }

    // Start transaction for account closure
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get restaurant ID for cleanup
      const restaurantResult = await client.query(
        "SELECT id FROM restaurants WHERE owner_id = $1",
        [ownerId]
      );

      if (restaurantResult.rows.length > 0) {
        const restaurantId = restaurantResult.rows[0].id;

        // Mark all dishes as unavailable
        await client.query(
          "UPDATE dishes SET is_available = false WHERE restaurant_id = $1",
          [restaurantId]
        );

        // Soft delete restaurant (mark as inactive)
        await client.query(
          "UPDATE restaurants SET active = false, closed_at = NOW() WHERE id = $1",
          [restaurantId]
        );
      }

      // Soft delete owner account (anonymize data)
      const anonymizedEmail = `deleted_${ownerId}_${Date.now()}@deleted.local`;
      await client.query(
        `UPDATE restaurant_owners 
         SET email = $1, name = 'Deleted User', password = 'deleted', 
             secret_word = 'deleted', active = false, deleted_at = NOW() 
         WHERE id = $2`,
        [anonymizedEmail, ownerId]
      );

      await client.query('COMMIT');
      
      // Destroy session
      req.session.destroy((err) => {
        if (err) console.error('Error destroying session during account closure:', err);
      });

      res.json({ 
        success: true, 
        message: "Account has been closed successfully. You will be logged out." 
      });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Account closure error:', err);
    res.status(500).json({ error: "Failed to close account" });
  }
});


/**
 * GET /api/owners/reports
 * Get reports and analytics for restaurant owner
 */
router.get('/reports', requireOwnerAuth, async (req, res) => {
  try {
    const ownerId = req.owner.id;
    const range = req.query.range || 'week';

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

    const restaurantResult = await pool.query(
      "SELECT id FROM restaurants WHERE owner_id = $1",
      [ownerId]
    );

    if (restaurantResult.rows.length === 0) {
      return res.json({
        totalRevenue: 0, totalOrders: 0, averageOrderValue: 0,
        completedOrders: 0, cancelledOrders: 0, topDishes: [], recentActivity: []
      });
    }

    const restaurantId = restaurantResult.rows[0].id;

    const ordersResult = await pool.query(`
      SELECT
        o.id,
        SUM(oi.price * oi.quantity) as restaurant_subtotal,
        o.created_at,
        COALESCE(ros.status, 'active') as restaurant_status,
        ros.completed_at
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN restaurant_order_status ros ON (o.id = ros.order_id AND ros.restaurant_id = $1)
      WHERE oi.restaurant_id = $1
        AND o.created_at >= $2
      GROUP BY o.id, o.created_at, ros.status, ros.completed_at
      ORDER BY o.created_at DESC
    `, [restaurantId, startDate]);

    const orders = ordersResult.rows;
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.restaurant_status === 'completed').length;
    const cancelledOrders = orders.filter(o => o.restaurant_status === 'cancelled').length;
    const totalRevenue = orders
      .filter(o => o.restaurant_status === 'completed')
      .reduce((sum, o) => sum + parseFloat(o.restaurant_subtotal || 0), 0);
    const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    const topDishesResult = await pool.query(`
      SELECT
        d.name,
        SUM(oi.quantity) as total_sold,
        SUM(oi.price * oi.quantity) as revenue
      FROM order_items oi
      JOIN dishes d ON oi.dish_id = d.id
      JOIN orders o ON oi.order_id = o.id
      JOIN restaurant_order_status ros ON (o.id = ros.order_id AND ros.restaurant_id = $1)
      WHERE d.restaurant_id = $1
        AND ros.status = 'completed'
        AND o.created_at >= $2
      GROUP BY d.id, d.name
      ORDER BY revenue DESC
      LIMIT 5
    `, [restaurantId, startDate]);

    const topDishes = topDishesResult.rows.map(d => ({
      name: d.name,
      total_sold: parseInt(d.total_sold),
      revenue: parseFloat(d.revenue)
    }));

    const activityResult = await pool.query(`
      SELECT type, description, amount, created_at FROM (
        SELECT
          'new_order' as type,
          CONCAT('New order #', o.id, ' placed') as description,
          (SELECT SUM(oi2.price * oi2.quantity) FROM order_items oi2 WHERE oi2.order_id = o.id AND oi2.restaurant_id = $1) as amount,
          o.created_at
        FROM orders o
        WHERE EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.restaurant_id = $1)
          AND o.created_at >= $2
        GROUP BY o.id

        UNION ALL

        SELECT
          'order_completed' as type,
          CONCAT('Order #', o.id, ' completed') as description,
          (SELECT SUM(oi2.price * oi2.quantity) FROM order_items oi2 WHERE oi2.order_id = o.id AND oi2.restaurant_id = $1) as amount,
          ros.completed_at as created_at
        FROM orders o
        JOIN restaurant_order_status ros ON (o.id = ros.order_id AND ros.restaurant_id = $1)
        WHERE ros.status = 'completed'
          AND ros.completed_at >= $2

        UNION ALL

        SELECT
          'order_cancelled' as type,
          CONCAT('Order #', o.id, ' cancelled') as description,
          (SELECT SUM(oi2.price * oi2.quantity) FROM order_items oi2 WHERE oi2.order_id = o.id AND oi2.restaurant_id = $1) as amount,
          o.created_at
        FROM orders o
        JOIN restaurant_order_status ros ON (o.id = ros.order_id AND ros.restaurant_id = $1)
        WHERE ros.status = 'cancelled'
          AND o.created_at >= $2
      ) activity
      ORDER BY created_at DESC
      LIMIT 20
    `, [restaurantId, startDate]);

    res.json({
      totalRevenue,
      totalOrders,
      averageOrderValue,
      completedOrders,
      cancelledOrders,
      topDishes,
      recentActivity: activityResult.rows
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

export default router;
