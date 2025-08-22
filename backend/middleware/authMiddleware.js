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
      
      // Provide specific guidance based on the issue
      let message = "Please log in to continue";
      let suggestion = undefined;
      
      if (isChrome && !cookiesPresent) {
        message = "Session authentication failed. Please try logging in again.";
        suggestion = "If this persists, try clearing your browser cache or using a different browser.";
        console.log('🚨 Chrome third-party cookie issue detected for user:', {
          origin: req.get('Origin'),
          sessionId: req.sessionID,
          hasSessionObject: !!req.session
        });
      } else if (!cookiesPresent) {
        message = "Authentication required. Please log in.";
        suggestion = "Make sure cookies are enabled in your browser.";
      } else if (req.session && !req.session.userId) {
        message = "Session expired. Please log in again.";
        suggestion = "Your session may have expired. Please refresh and log in again.";
      }
      
      return res.status(401).json({ 
        error: "Unauthorized",
        message,
        suggestion,
        sessionExpired: req.session && !req.session.userId,
        ...(process.env.NODE_ENV !== 'production' && { debug: debugInfo })
      });
    }
    
    // Touch session to extend its life
    if (req.session.touch) {
      req.session.touch();
    }
    
    next();
  }
  