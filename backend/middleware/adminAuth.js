/**
 * Admin Authentication Middleware
 *
 * Verifies that the user is an authenticated admin with an active session
 */

import pool from '../db.js';

export const adminAuth = async (req, res, next) => {
  try {
    if (!req.session.adminId) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }

    // Verify admin still exists and is active
    const adminResult = await pool.query(
      'SELECT id, username, email, role, is_active FROM platform_admins WHERE id = $1 AND is_active = true',
      [req.session.adminId]
    );

    if (adminResult.rows.length === 0) {
      req.session.destroy();
      return res.status(401).json({ error: 'Admin account not found or inactive' });
    }

    req.admin = adminResult.rows[0];
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

export default adminAuth;
