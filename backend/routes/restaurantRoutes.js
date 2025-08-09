import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET all restaurants
router.get("/restaurants", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM restaurants");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching restaurants" });
  }
});

// GET a single restaurant by ID with available dishes
router.get("/restaurants/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const restaurantRes = await pool.query("SELECT * FROM restaurants WHERE id = $1", [id]);
    if (restaurantRes.rows.length === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const dishesRes = await pool.query(
      "SELECT * FROM dishes WHERE restaurant_id = $1 ORDER BY is_available DESC, name ASC",
      [id]
    );

    res.json({
      restaurant: restaurantRes.rows[0],
      dishes: dishesRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error fetching restaurant details" });
  }
});

export default router;
