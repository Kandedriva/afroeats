/**
 * User Authentication Middleware
 *
 * Checks if the user is authenticated via session
 */

export function auth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: "Unauthorized. Please log in."
    });
  }

  // Set req.user object for consistency
  req.user = {
    id: req.session.userId,
    name: req.session.userName,
    email: req.session.userEmail,
    phone: req.session.userPhone || null
  };

  next();
}

export function optionalAuth(req, res, next) {
  if (req.session && req.session.userId) {
    req.user = {
      id: req.session.userId,
      name: req.session.userName,
      email: req.session.userEmail,
      phone: req.session.userPhone || null
    };
  }

  next();
}

export default { auth, optionalAuth };
