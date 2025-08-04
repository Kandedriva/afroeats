export function requireAuth(req, res, next) {
    if (!req.session.userId) {
      console.log('Auth failed: No session userId', {
        sessionId: req.sessionID,
        session: req.session,
        cookies: req.headers.cookie,
        userAgent: req.get('User-Agent')
      });
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  }
  