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
  const { name, email, password, restaurant_name, address, phone_number } = req.body;
  const logoPath = req.file ? `/uploads/restaurant_logos/${req.file.filename}` : null;

  try {
    const existing = await pool.query("SELECT * FROM restaurant_owners WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Owner already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const ownerResult = await pool.query(
      `INSERT INTO restaurant_owners (name, email, password)
       VALUES ($1, $2, $3) RETURNING id, name, email`,
      [name, email, hashedPassword]
    );
    const ownerId = ownerResult.rows[0].id;

    const restaurantResult = await pool.query(
      `INSERT INTO restaurants (name, address, phone_number, image_url, owner_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [restaurant_name, address, phone_number, logoPath, ownerId]
    );

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

export default router;
