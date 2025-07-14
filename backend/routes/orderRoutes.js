import express from "express";
import pool from "../db.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { userId, items } = req.body;

  if (!userId || !items || items.length === 0) {
    return res.status(400).json({ error: "Missing user ID or cart items." });
  }

  try {
    // 1. Calculate total
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // 2. Insert order
    const result = await pool.query(
      "INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING id",
      [userId, total]
    );
    const orderId = result.rows[0].id;

    // 3. Insert order items
    const itemPromises = items.map(item => {
      return pool.query(
        "INSERT INTO order_items (order_id, dish_id, name, price, quantity) VALUES ($1, $2, $3, $4, $5)",
        [orderId, item.id, item.name, item.price, item.quantity]
      );
    });

    await Promise.all(itemPromises);

    res.status(201).json({ message: "Order placed successfully", orderId });
  } catch (err) {
    console.error("Order Error:", err);
    res.status(500).json({ error: "Failed to place order" });
  }
});

export default router;
