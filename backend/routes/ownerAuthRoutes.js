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

    // Regenerate session ID for security
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ error: "Session error during login" });
      }

      // Save owner info to session
      req.session.ownerId = owner.id;
      req.session.ownerName = owner.name;
      req.session.ownerEmail = owner.email;
      req.session.loginTime = new Date().toISOString();

      // Force session save and respond only after successful save
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error during owner login:', saveErr);
          return res.status(500).json({ error: "Session save error during login" });
        }

        console.log('✅ Owner session saved successfully. ID:', req.sessionID, 'Owner:', owner.name);
        
        res.json({
          message: "Login successful",
          owner: {
            id: owner.id,
            name: owner.name,
            email: owner.email,
          },
        });
      });
    });
  } catch (err) {
    console.error('Owner login error:', err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ========== OWNER LOGOUT ==========
router.post("/owners/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: "Failed to log out" });
    }

    res.clearCookie("orderdabaly.sid", {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    
    console.log('✅ Owner logged out successfully');
    res.json({ message: "Logged out successfully" });
  });
});

export default router;
