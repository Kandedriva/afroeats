import express from "express";
import bcrypt from "bcrypt";
import pool from "../db.js";

const router = express.Router();

// 🔐 REGISTER
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashedPassword]
    );

    req.session.userId = newUser.rows[0].id;


    res.status(201).json({ user: newUser.rows[0] });
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔑 LOGIN
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
  
    try {
      // 1. Check if user exists
      const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
      if (userResult.rows.length === 0) {
        return res.status(400).json({ error: "Invalid email or password" });
      }
  
      const user = userResult.rows[0];
  
      // 2. Compare password with hashed password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid email or password" });
      }
  
      // 3. Set session data
      req.session.userId = user.id;
      req.session.userName = user.name.split(" ")[0]; // just first name for greeting
  
      // 4. Respond with user info (optional)
      res.json({ user: { id: user.id, name: user.name, email: user.email } });
  
    } catch (err) {
      console.error("Login Error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // in authRoutes.js
router.get("/me", (req, res) => {
    if (req.session.userId) {
      res.json({ id: req.session.userId, name: req.session.userName });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid"); // Name of session cookie
      res.sendStatus(200);
    });
  });
  
  

export default router;
