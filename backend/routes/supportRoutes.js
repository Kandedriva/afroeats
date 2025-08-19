import express from 'express';
import pool from '../db.js';
import { logger } from '../services/logger.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const supportRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: 'Too many support requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Submit a support message
router.post('/submit', supportRateLimit, async (req, res) => {
  try {
    const { subject, message, contact_info } = req.body;
    
    // Validation
    if (!subject || !message || !contact_info) {
      return res.status(400).json({ 
        error: 'Subject, message, and contact information are required' 
      });
    }

    if (subject.length > 255) {
      return res.status(400).json({ 
        error: 'Subject must be 255 characters or less' 
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({ 
        error: 'Message must be 2000 characters or less' 
      });
    }

    // Validate contact info (should be email or phone)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,20}$/;
    
    let user_email = null;
    let user_phone = null;
    
    if (emailRegex.test(contact_info)) {
      user_email = contact_info.toLowerCase();
    } else if (phoneRegex.test(contact_info)) {
      user_phone = contact_info.replace(/\s/g, '');
    } else {
      return res.status(400).json({ 
        error: 'Please provide a valid email address or phone number' 
      });
    }

    // Get user ID if user is authenticated
    let user_id = null;
    if (req.user) {
      user_id = req.user.id;
    }

    // If no user_email but we have user_id, get email from user record
    if (!user_email && user_id) {
      const userQuery = 'SELECT email FROM users WHERE id = $1';
      const userResult = await pool.query(userQuery, [user_id]);
      if (userResult.rows.length > 0) {
        user_email = userResult.rows[0].email;
      }
    }

    // Ensure we have an email for contact
    if (!user_email) {
      return res.status(400).json({ 
        error: 'Email address is required for support requests' 
      });
    }

    // Insert support message
    const insertQuery = `
      INSERT INTO support_messages (user_id, user_email, user_phone, subject, message, status, priority)
      VALUES ($1, $2, $3, $4, $5, 'pending', 'medium')
      RETURNING id, created_at
    `;
    
    const values = [user_id, user_email, user_phone, subject, message];
    const result = await pool.query(insertQuery, values);
    
    logger.info('Support message submitted', { 
      messageId: result.rows[0].id,
      userEmail: user_email,
      subject: subject.substring(0, 50) + '...' 
    });

    res.status(201).json({
      success: true,
      message: 'Support request submitted successfully. We will respond within 24 hours.',
      messageId: result.rows[0].id
    });

  } catch (error) {
    logger.error('Error submitting support message:', error);
    res.status(500).json({ error: 'Failed to submit support request' });
  }
});

// Get user's support messages (authenticated users only)
router.get('/my-messages', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const query = `
      SELECT id, subject, message, status, priority, admin_response, 
             created_at, updated_at, responded_at
      FROM support_messages 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [req.user.id]);
    
    res.json({
      success: true,
      messages: result.rows
    });

  } catch (error) {
    logger.error('Error fetching user support messages:', error);
    res.status(500).json({ error: 'Failed to fetch support messages' });
  }
});

export default router;