import pool from '../db.js';

/**
 * Middleware to check if driver is logged in
 * Allows access but doesn't check approval status
 */
export const requireDriverAuth = (req, res, next) => {
  if (!req.session || !req.session.driverId) {
    return res.status(401).json({
      error: "Unauthorized: Driver not logged in"
    });
  }

  // Set req.driver object for use in routes
  req.driver = {
    id: req.session.driverId,
    name: req.session.driverName,
    email: req.session.driverEmail
  };

  // Extend session lifetime
  if (req.session.touch) {
    req.session.touch();
  }

  next();
};

/**
 * Middleware to check if driver is logged in AND approved
 * Only approved drivers can access protected routes (claiming orders, etc.)
 */
export const requireApprovedDriver = async (req, res, next) => {
  if (!req.session || !req.session.driverId) {
    return res.status(401).json({
      error: "Unauthorized: Driver not logged in"
    });
  }

  try {
    const result = await pool.query(
      "SELECT approval_status FROM drivers WHERE id = $1 AND is_active = TRUE",
      [req.session.driverId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Driver not found or inactive"
      });
    }

    const approvalStatus = result.rows[0].approval_status;

    if (approvalStatus !== 'approved') {
      return res.status(403).json({
        error: "Account pending approval",
        approval_status: approvalStatus,
        message: approvalStatus === 'pending'
          ? "Your account is under review. You'll be notified once approved."
          : approvalStatus === 'rejected'
          ? "Your account application was not approved."
          : "Your account is suspended."
      });
    }

    // Set req.driver object for use in routes
    req.driver = {
      id: req.session.driverId,
      name: req.session.driverName,
      email: req.session.driverEmail,
      approval_status: approvalStatus
    };

    // Extend session lifetime
    if (req.session.touch) {
      req.session.touch();
    }

    next();
  } catch (err) {
    console.error('Driver approval check error:', err);
    res.status(500).json({ error: "Authorization check failed" });
  }
};

export default {
  requireDriverAuth,
  requireApprovedDriver
};
