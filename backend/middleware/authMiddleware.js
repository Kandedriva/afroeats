export function requireAuth(req, res, next) {
    // Enhanced session validation for production
    if (!req.session || !req.session.userId) {
      const userAgent = req.get('User-Agent') || '';
      const isChrome = /Chrome/.test(userAgent);
      const cookiesPresent = !!req.headers.cookie;
      
      const debugInfo = {
        sessionId: req.sessionID,
        hasSession: !!req.session,
        sessionUserId: req.session?.userId,
        cookieHeader: cookiesPresent ? 'present' : 'missing',
        userAgent: userAgent.substring(0, 100),
        origin: req.get('Origin'),
        referer: req.get('Referer'),
        timestamp: new Date().toISOString(),
        isChrome,
        sessionData: req.session ? Object.keys(req.session) : []
      };
      
      console.log('Auth failed: No valid session', debugInfo);
      
      // Provide specific guidance for Chrome users without cookies
      let message = "Please log in to continue";
      if (isChrome && !cookiesPresent) {
        message = "Session authentication failed. Please try logging in again or enable third-party cookies in Chrome.";
        console.log('🚨 Chrome third-party cookie issue detected for user:', {
          origin: req.get('Origin'),
          sessionId: req.sessionID,
          hasSessionObject: !!req.session
        });
      }
      
      return res.status(401).json({ 
        error: "Unauthorized",
        message,
        suggestion: isChrome && !cookiesPresent ? "Try refreshing the page after logging in" : undefined,
        ...(process.env.NODE_ENV !== 'production' && { debug: debugInfo })
      });
    }
    
    // Touch session to extend its life
    if (req.session.touch) {
      req.session.touch();
    }
    
    next();
  }
  