// routes/ownerAuthRoutes.js
import express from "express";
import pool from "../db.js";
import bcryptjs from "bcryptjs";

const router = express.Router();

// ========== OWNER LOGIN ==========
router.post("/owners/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM restaurant_owners WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const owner = result.rows[0];
    const isMatch = await bcryptjs.compare(password, owner.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Login successful

    // Save owner info to session
    req.session.ownerId = owner.id;
    req.session.ownerName = owner.name;

    res.json({
      message: "Login successful",
      owner: {
        id: owner.id,
        name: owner.name,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error during login" });
  }
});

// ========== OWNER LOGOUT ==========
router.post("/owners/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("afoodzone.sid"); // Match the session cookie name
    res.json({ message: "Logged out" });
  });
});

export default router;
