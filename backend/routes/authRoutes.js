import express from "express";
import bcrypt from "bcrypt";
import pool from "../db.js";

const router = express.Router();

// 🔐 REGISTER
router.post("/register", async (req, res) => {
  const { name, email, password, secret_word } = req.body;

  try {
    const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const hashedSecretWord = await bcrypt.hash(secret_word, saltRounds);

    // Try to insert with secret_word, fallback to basic registration if column doesn't exist
    let newUser;
    try {
      newUser = await pool.query(
        "INSERT INTO users (name, email, password, secret_word) VALUES ($1, $2, $3, $4) RETURNING id, name, email",
        [name, email, hashedPassword, hashedSecretWord]
      );
    } catch (err) {
      console.log("Trying user registration without secret_word column:", err.message);
      // Fallback to basic registration if secret_word column doesn't exist
      newUser = await pool.query(
        "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
        [name, email, hashedPassword]
      );
    }

    req.session.userId = newUser.rows[0].id;
    req.session.userName = newUser.rows[0].name.split(" ")[0];

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
router.get("/me", async (req, res) => {
    if (req.session.userId) {
      try {
        // Get full user info from database
        const userResult = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [req.session.userId]);
        
        if (userResult.rows.length > 0) {
          res.json(userResult.rows[0]);
        } else {
          res.status(401).json({ error: "User not found" });
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        res.status(500).json({ error: "Server error" });
      }
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
  
  

// POST /api/auth/update-password - Update user password using secret word
router.post("/update-password", async (req, res) => {
  try {
    const { email, secret_word, new_password } = req.body;

    // Validate input
    if (!email || !secret_word || !new_password) {
      return res.status(400).json({ error: "Email, secret word, and new password are required" });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long" });
    }

    // Find user by email
    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "No account found with this email address" });
    }

    const user = userResult.rows[0];

    // Verify secret word
    if (!user.secret_word) {
      return res.status(400).json({ 
        error: "This account was created before secret word feature. Please contact support." 
      });
    }

    const secretWordMatch = await bcrypt.compare(secret_word, user.secret_word);
    if (!secretWordMatch) {
      return res.status(400).json({ error: "Invalid secret word" });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(new_password, 10);

    // Update password
    await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [hashedNewPassword, user.id]
    );

    console.log(`🔐 Password updated for user: ${user.email}`);

    res.json({ 
      success: true, 
      message: "Password updated successfully" 
    });

  } catch (err) {
    console.error("User password update error:", err);
    res.status(500).json({ error: "Server error during password update" });
  }
});

export default router;
