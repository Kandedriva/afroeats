import express from "express";
import pool from "../db.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Get current user's grocery cart with product info
 * GET /api/grocery-cart
 * Requires authentication
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        gc.id,
        gc.product_id,
        p.name,
        p.price,
        p.unit,
        p.image_url,
        p.stock_quantity,
        p.category,
        p.store_id,
        gc.quantity,
        gs.name AS store_name
      FROM grocery_carts gc
      JOIN products p ON gc.product_id = p.id
      LEFT JOIN grocery_stores gs ON p.store_id = gs.id
      WHERE gc.user_id = $1
      ORDER BY gc.created_at DESC`,
      [req.session.userId]
    );

    // Format response to match expected structure
    const formattedCart = result.rows.map(item => ({
      id: item.product_id,
      name: item.name,
      price: parseFloat(item.price),
      unit: item.unit,
      quantity: item.quantity,
      image_url: item.image_url,
      stock_quantity: item.stock_quantity,
      category: item.category,
      store_id: item.store_id,
      store_name: item.store_name
    }));

    res.json(formattedCart);
  } catch (err) {
    console.error('Get grocery cart error:', err);
    res.status(500).json({ error: "Failed to fetch grocery cart" });
  }
});

/**
 * Add item to grocery cart or update quantity
 * POST /api/grocery-cart
 * Body: { productId: number, quantity: number }
 * Requires authentication
 */
router.post("/", requireAuth, async (req, res) => {
  const { productId, quantity } = req.body;

  if (!productId || !quantity || quantity < 1) {
    return res.status(400).json({ error: "Invalid productId or quantity" });
  }

  try {
    // Verify product exists and has stock
    const productCheck = await pool.query(
      "SELECT id, stock_quantity, name FROM products WHERE id = $1",
      [productId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const product = productCheck.rows[0];

    // Check if product already in cart
    const cartCheck = await pool.query(
      "SELECT * FROM grocery_carts WHERE user_id = $1 AND product_id = $2",
      [req.session.userId, productId]
    );

    if (cartCheck.rows.length > 0) {
      // Update quantity
      const newQuantity = cartCheck.rows[0].quantity + quantity;

      // Check stock availability
      if (newQuantity > product.stock_quantity) {
        return res.status(400).json({
          error: `Only ${product.stock_quantity} units available in stock`
        });
      }

      const updated = await pool.query(
        `UPDATE grocery_carts
         SET quantity = $1, updated_at = NOW()
         WHERE user_id = $2 AND product_id = $3
         RETURNING *`,
        [newQuantity, req.session.userId, productId]
      );

      res.json({
        success: true,
        cart_item: updated.rows[0],
        message: `Updated ${product.name} quantity to ${newQuantity}`
      });
    } else {
      // Insert new item
      if (quantity > product.stock_quantity) {
        return res.status(400).json({
          error: `Only ${product.stock_quantity} units available in stock`
        });
      }

      const inserted = await pool.query(
        `INSERT INTO grocery_carts (user_id, product_id, quantity, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING *`,
        [req.session.userId, productId, quantity]
      );

      res.json({
        success: true,
        cart_item: inserted.rows[0],
        message: `Added ${product.name} to cart`
      });
    }
  } catch (err) {
    console.error('Add to grocery cart error:', err);
    res.status(500).json({ error: "Failed to add to cart" });
  }
});

/**
 * Update cart item quantity
 * PUT /api/grocery-cart/:productId
 * Body: { quantity: number }
 * Requires authentication
 */
router.put("/:productId", requireAuth, async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: "Invalid quantity" });
  }

  try {
    // Check stock availability
    const productCheck = await pool.query(
      "SELECT stock_quantity FROM products WHERE id = $1",
      [productId]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (quantity > productCheck.rows[0].stock_quantity) {
      return res.status(400).json({
        error: `Only ${productCheck.rows[0].stock_quantity} units available`
      });
    }

    const updated = await pool.query(
      `UPDATE grocery_carts
       SET quantity = $1, updated_at = NOW()
       WHERE user_id = $2 AND product_id = $3
       RETURNING *`,
      [quantity, req.session.userId, productId]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: "Item not in cart" });
    }

    res.json({ success: true, cart_item: updated.rows[0] });
  } catch (err) {
    console.error('Update grocery cart error:', err);
    res.status(500).json({ error: "Failed to update cart" });
  }
});

/**
 * Remove item from grocery cart
 * DELETE /api/grocery-cart/:productId
 * Requires authentication
 */
router.delete("/:productId", requireAuth, async (req, res) => {
  const { productId } = req.params;

  try {
    await pool.query(
      "DELETE FROM grocery_carts WHERE user_id = $1 AND product_id = $2",
      [req.session.userId, productId]
    );

    res.json({ success: true, message: "Item removed from cart" });
  } catch (err) {
    console.error('Remove from grocery cart error:', err);
    res.status(500).json({ error: "Failed to remove item" });
  }
});

/**
 * Clear the entire grocery cart
 * DELETE /api/grocery-cart
 * Requires authentication
 */
router.delete("/", requireAuth, async (req, res) => {
  try {
    await pool.query(
      "DELETE FROM grocery_carts WHERE user_id = $1",
      [req.session.userId]
    );

    res.json({ success: true, message: "Grocery cart cleared" });
  } catch (err) {
    console.error('Clear grocery cart error:', err);
    res.status(500).json({ error: "Failed to clear cart" });
  }
});

/**
 * Get cart summary (item count, subtotal)
 * GET /api/grocery-cart/summary
 * Requires authentication
 */
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        COUNT(*) as item_count,
        COALESCE(SUM(gc.quantity), 0) as total_quantity,
        COALESCE(SUM(gc.quantity * p.price), 0) as subtotal
      FROM grocery_carts gc
      JOIN products p ON gc.product_id = p.id
      WHERE gc.user_id = $1`,
      [req.session.userId]
    );

    const summary = result.rows[0];
    res.json({
      item_count: parseInt(summary.item_count),
      total_quantity: parseInt(summary.total_quantity),
      subtotal: parseFloat(summary.subtotal)
    });
  } catch (err) {
    console.error('Get cart summary error:', err);
    res.status(500).json({ error: "Failed to get cart summary" });
  }
});

export default router;
