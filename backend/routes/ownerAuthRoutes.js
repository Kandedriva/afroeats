// routes/ownerAuthRoutes.js
import express from "express";
import pool from "../db.js";
import bcrypt from "bcrypt";

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
    const isMatch = await bcrypt.compare(password, owner.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Allow login without subscription - subscription will be checked when adding dishes

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
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
});

export default router;
