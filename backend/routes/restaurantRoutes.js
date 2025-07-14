import express from "express";
import pool from "../db.js"; // adjust path if needed

const router = express.Router();

// GET all restaurants
router.get("/restaurants", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM restaurants");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching restaurants:", err);
    res.status(500).json({ error: "Server error" });
  }
});


export default router;
