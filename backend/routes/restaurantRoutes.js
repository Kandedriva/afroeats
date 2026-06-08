import express from "express";
import pool from "../db.js";

const router = express.Router();

function toSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// One-time migration: add slug column and populate for existing restaurants
async function runSlugMigration() {
  try {
    await pool.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slug VARCHAR(255)`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS restaurants_slug_idx ON restaurants (slug) WHERE slug IS NOT NULL`);

    const { rows } = await pool.query(`SELECT id, name FROM restaurants WHERE slug IS NULL OR slug = ''`);
    for (const row of rows) {
      const base = toSlug(row.name);
      const conflict = await pool.query(`SELECT id FROM restaurants WHERE slug = $1 AND id != $2`, [base, row.id]);
      const slug = conflict.rows.length > 0 ? `${base}-${row.id}` : base;
      await pool.query(`UPDATE restaurants SET slug = $1 WHERE id = $2`, [slug, row.id]);
    }
  } catch (err) {
    console.error('Restaurant slug migration error:', err);
  }
}
runSlugMigration();

// GET all approved, active restaurants (public-facing)
router.get("/restaurants", async (req, res) => {
  try {
    await pool.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`);
    await pool.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'pending'`);

    const result = await pool.query(
      "SELECT * FROM restaurants WHERE active = true AND approval_status = 'approved'"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Server error fetching restaurants" });
  }
});

// GET a single restaurant by slug or numeric ID
router.get("/restaurants/:identifier", async (req, res) => {
  const { identifier } = req.params;

  try {
    await pool.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0.00`);

    const isNumeric = /^\d+$/.test(identifier);
    const restaurantRes = isNumeric
      ? await pool.query("SELECT * FROM restaurants WHERE id = $1", [identifier])
      : await pool.query("SELECT * FROM restaurants WHERE slug = $1", [identifier]);

    if (restaurantRes.rows.length === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    const restaurant = restaurantRes.rows[0];

    const dishesRes = await pool.query(
      "SELECT * FROM dishes WHERE restaurant_id = $1 ORDER BY is_available DESC, name ASC",
      [restaurant.id]
    );

    res.json({
      restaurant: {
        ...restaurant,
        delivery_fee: restaurant.delivery_fee || 0.00,
      },
      dishes: dishesRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error fetching restaurant details" });
  }
});

export { toSlug };
export default router;
