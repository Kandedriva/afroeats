import express from "express";
import bcryptjs from "bcryptjs";
import pool from "../db.js";
import { uploadToR2 } from "../middleware/r2Upload.js";
import { requireDriverAuth } from "../middleware/driverAuth.js";

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
 * POST /api/drivers/register
 * Driver registration with multipart form data (driver's license upload)
 */
router.post("/register", ...uploadToR2('driver_license', 'drivers_license', false), async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      secret_word,
      vehicle_type,
      vehicle_color,
      license_plate,
      vehicle_make,
      vehicle_model,
      vehicle_year
    } = req.body;

    // Validation
    if (!name || !email || !phone || !password || !vehicle_type || !vehicle_color || !license_plate) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["name", "email", "phone", "password", "vehicle_type", "vehicle_color", "license_plate"]
      });
    }

    // Check if driver already exists
    const existing = await pool.query(
      "SELECT * FROM drivers WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password and secret word
    const hashedPassword = await bcryptjs.hash(password, 10);
    const hashedSecretWord = secret_word ? await bcryptjs.hash(secret_word, 10) : null;

    // Get uploaded license URL from R2 (set by middleware)
    const driversLicenseUrl = req.uploadedImageUrl || null;

    if (!driversLicenseUrl) {
      console.warn('⚠️ No driver license uploaded or R2 upload failed');
    }

    // Create driver account (pending approval)
    const result = await pool.query(
      `INSERT INTO drivers (
        name, email, phone, password, secret_word,
        vehicle_type, vehicle_color, license_plate,
        vehicle_make, vehicle_model, vehicle_year,
        drivers_license_url, approval_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, name, email, approval_status, created_at`,
      [
        name,
        email,
        phone,
        hashedPassword,
        hashedSecretWord,
        vehicle_type,
        vehicle_color,
        license_plate,
        vehicle_make || null,
        vehicle_model || null,
        vehicle_year ? parseInt(vehicle_year) : null,
        driversLicenseUrl,
        'pending' // Default approval status
      ]
    );

    const driver = result.rows[0];

    // Create session (driver can log in but not accept orders until approved)
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ error: "Session error" });
      }

      req.session.driverId = driver.id;
      req.session.driverName = driver.name;
      req.session.driverEmail = driver.email;
      req.session.loginTime = new Date().toISOString();

      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ error: "Session save error" });
        }

        res.status(201).json({
          success: true,
          message: "Registration successful. Your account is pending admin approval.",
          driver: {
            id: driver.id,
            name: driver.name,
            email: driver.email,
            approval_status: driver.approval_status,
            created_at: driver.created_at
          }
        });
      });
    });

  } catch (err) {
    console.error('Driver registration error:', err);
    res.status(500).json({
      error: "Registration failed",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

/**
 * POST /api/drivers/login
 * Driver login
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find driver
    const result = await pool.query(
      "SELECT * FROM drivers WHERE email = $1 AND is_active = true",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const driver = result.rows[0];

    // Verify password
    const isMatch = await bcryptjs.compare(password, driver.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Regenerate session
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ error: "Session error" });
      }

      req.session.driverId = driver.id;
      req.session.driverName = driver.name;
      req.session.driverEmail = driver.email;
      req.session.loginTime = new Date().toISOString();

      req.session.save(async (saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ error: "Session save error" });
        }

        // Update last login and set driver online
        try {
          const updateResult = await pool.query(
            `UPDATE drivers
             SET last_login_at = NOW(), is_available = true
             WHERE id = $1
             RETURNING id, name, email, phone, approval_status, is_available,
                       stripe_onboarding_complete, vehicle_type, vehicle_color,
                       total_deliveries, completed_deliveries, total_earnings, average_rating`,
            [driver.id]
          );

          const updatedDriver = updateResult.rows[0];

          res.json({
            success: true,
            message: "Login successful",
            driver: updatedDriver
          });
        } catch (err) {
          console.error('Failed to update driver status:', err);
          // Return driver data anyway, but with old status
          res.json({
            success: true,
            message: "Login successful",
            driver: {
              id: driver.id,
              name: driver.name,
              email: driver.email,
              phone: driver.phone,
              approval_status: driver.approval_status,
              is_available: true, // Set to true even if update failed
              stripe_onboarding_complete: driver.stripe_onboarding_complete,
              vehicle_type: driver.vehicle_type,
              vehicle_color: driver.vehicle_color,
              total_deliveries: driver.total_deliveries,
              completed_deliveries: driver.completed_deliveries,
              total_earnings: driver.total_earnings
            }
          });
        }
      });
    });

  } catch (err) {
    console.error('Driver login error:', err);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * GET /api/drivers/me
 * Get current driver session
 */
router.get("/me", async (req, res) => {
  if (!req.session || !req.session.driverId) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    const result = await pool.query(
      `SELECT
        id, name, email, phone,
        vehicle_type, vehicle_make, vehicle_model, vehicle_year, vehicle_color, license_plate,
        drivers_license_url, drivers_license_verified,
        approval_status, is_available, is_active,
        stripe_account_id, stripe_onboarding_complete,
        total_deliveries, completed_deliveries, cancelled_deliveries,
        average_rating, total_earnings,
        created_at, last_login_at
       FROM drivers
       WHERE id = $1 AND is_active = true`,
      [req.session.driverId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Driver not found or inactive" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Driver /me error:', err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/drivers/logout
 * Driver logout
 */
router.post("/logout", async (req, res) => {
  const driverId = req.session?.driverId;

  // Set driver offline before destroying session
  if (driverId) {
    try {
      await pool.query(
        "UPDATE drivers SET is_available = false WHERE id = $1",
        [driverId]
      );
    } catch (err) {
      console.error('Failed to set driver offline:', err);
    }
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: "Logout failed" });
    }

    res.clearCookie("orderdabaly.sid", {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });

    res.json({ success: true, message: "Logged out successfully" });
  });
});

/**
 * GET /api/drivers/profile
 * Get full driver profile (requires authentication)
 */
router.get("/profile", requireDriverAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        id, name, email, phone,
        vehicle_type, vehicle_make, vehicle_model, vehicle_year, vehicle_color, license_plate,
        drivers_license_url, drivers_license_verified,
        approval_status, rejection_reason, is_available, is_active,
        stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled,
        total_deliveries, completed_deliveries, cancelled_deliveries,
        average_rating, total_earnings,
        created_at, last_login_at, approved_at
       FROM drivers
       WHERE id = $1`,
      [req.driver.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Driver not found" });
    }

    res.json({ driver: result.rows[0] });
  } catch (err) {
    console.error('Driver profile error:', err);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

/**
 * PUT /api/drivers/profile
 * Update driver profile information
 */
router.put("/profile", requireDriverAuth, async (req, res) => {
  try {
    const { name, phone, vehicle_type, vehicle_make, vehicle_model, vehicle_year, vehicle_color, license_plate } = req.body;

    // Validation
    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    // Update driver profile
    const result = await pool.query(
      `UPDATE drivers
       SET name = $1,
           phone = $2,
           vehicle_type = COALESCE($3, vehicle_type),
           vehicle_make = $4,
           vehicle_model = $5,
           vehicle_year = $6,
           vehicle_color = COALESCE($7, vehicle_color),
           license_plate = COALESCE($8, license_plate),
           updated_at = NOW()
       WHERE id = $9
       RETURNING id, name, email, phone, vehicle_type, vehicle_make, vehicle_model,
                 vehicle_year, vehicle_color, license_plate, approval_status, is_available`,
      [name, phone, vehicle_type, vehicle_make || null, vehicle_model || null,
       vehicle_year ? parseInt(vehicle_year) : null, vehicle_color, license_plate, req.driver.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Driver not found" });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      driver: result.rows[0]
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
