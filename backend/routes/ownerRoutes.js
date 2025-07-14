import express from "express";
import multer from "multer";
import bcrypt from "bcrypt";
import pool from "../db.js";
import path from "path";
import fs from "fs";

const router = express.Router();

// Configure multer for storing uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/restaurant_logos";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `logo-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({ storage });

// 👇 Owner Registration with optional logo upload
router.post("/register", upload.single("logo"), async (req, res) => {
  const { name, email, password, restaurant_name, address, phone_number } = req.body;
  const logoPath = req.file ? req.file.path : null;

  try {
    // 1. Check if owner email exists
    const existingOwner = await pool.query("SELECT * FROM restaurant_owners WHERE email = $1", [email]);
    if (existingOwner.rows.length > 0) {
      return res.status(400).json({ error: "Owner already exists" });
    }

    // 2. Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. Insert new owner
    const ownerResult = await pool.query(
      `INSERT INTO restaurant_owners (name, email, password) 
       VALUES ($1, $2, $3) RETURNING id, name, email`,
      [name, email, hashedPassword]
    );

    const ownerId = ownerResult.rows[0].id;

    // 4. Create associated restaurant
    const restaurantResult = await pool.query(
      `INSERT INTO restaurants (name, address, phone_number, image_url, owner_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [restaurant_name, address, phone_number, logoPath, ownerId]
    );

    // 5. Set session for owner
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





  router.get("/dashboard", async (req, res) => {
    const ownerId = req.session.ownerId;
  
    if (!ownerId) {
      return res.status(401).json({ error: "Not authenticated as owner" });
    }
  
    try {
      // 1. Get the owner's restaurant
      const restaurantResult = await pool.query(
        "SELECT * FROM restaurants WHERE owner_id = $1",
        [ownerId]
      );
  
      if (restaurantResult.rows.length === 0) {
        return res.status(404).json({ error: "No restaurant found for this owner" });
      }
  
      const restaurant = restaurantResult.rows[0];
  
      // 2. Get dishes for that restaurant
      const dishesResult = await pool.query(
        "SELECT * FROM dishes WHERE restaurant_id = $1",
        [restaurant.id]
      );
  
      res.json({
        restaurant,
        dishes: dishesResult.rows,
      });
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      res.status(500).json({ error: "Failed to load dashboard data" });
    }
  });
});

export default router;
