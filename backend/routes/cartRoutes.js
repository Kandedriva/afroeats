import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get current user's cart with restaurant info
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        c.id, 
        c.dish_id, 
        d.name, 
        d.price, 
        c.quantity, 
        r.id AS restaurant_id, 
        r.name AS restaurant_name
      FROM carts c
      JOIN dishes d ON c.dish_id = d.id
      JOIN restaurants r ON d.restaurant_id = r.id
      WHERE c.user_id = $1
      `,
      [req.session.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Add item to cart or update quantity
router.post("/", requireAuth, async (req, res) => {
  const { dishId, quantity } = req.body;

  try {
    // Check if dish already in cart
    const check = await pool.query(
      "SELECT * FROM carts WHERE user_id = $1 AND dish_id = $2",
      [req.session.userId, dishId]
    );

    if (check.rows.length > 0) {
      // Update quantity
      const updated = await pool.query(
        "UPDATE carts SET quantity = quantity + $1 WHERE user_id = $2 AND dish_id = $3 RETURNING *",
        [quantity, req.session.userId, dishId]
      );
      res.json(updated.rows[0]);
    } else {
      // Insert new item
      const inserted = await pool.query(
        "INSERT INTO carts (user_id, dish_id, quantity) VALUES ($1, $2, $3) RETURNING *",
        [req.session.userId, dishId, quantity]
      );
      res.json(inserted.rows[0]);
    }
  } catch (err) {
    console.error('Cart add operation error:', err);
    res.status(500).json({ error: "Server error" });
  }
});

// Remove item from cart
router.delete("/:dishId", requireAuth, async (req, res) => {
  const { dishId } = req.params;

  try {
    await pool.query(
      "DELETE FROM carts WHERE user_id = $1 AND dish_id = $2",
      [req.session.userId, dishId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Clear the cart
router.delete("/", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM carts WHERE user_id = $1", [req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
