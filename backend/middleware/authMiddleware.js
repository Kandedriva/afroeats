export function requireAuth(req, res, next) {
    // Enhanced session validation for production
    if (!req.session || !req.session.userId) {
      const debugInfo = {
        sessionId: req.sessionID,
        hasSession: !!req.session,
        sessionUserId: req.session?.userId,
        cookieHeader: req.headers.cookie ? 'present' : 'missing',
        userAgent: req.get('User-Agent')?.substring(0, 100),
        origin: req.get('Origin'),
        referer: req.get('Referer'),
        timestamp: new Date().toISOString()
      };
      
      console.log('Auth failed: No valid session', debugInfo);
      
      // Set headers to ensure proper CORS handling
      if (req.get('Origin')) {
        res.set('Access-Control-Allow-Origin', req.get('Origin'));
        res.set('Access-Control-Allow-Credentials', 'true');
      }
      
      return res.status(401).json({ 
        error: "Unauthorized",
        message: "Please log in to continue",
        ...(process.env.NODE_ENV !== 'production' && { debug: debugInfo })
      });
    }
    
    // Touch session to extend its life
    if (req.session.touch) {
      req.session.touch();
    }
    
    next();
  }
  