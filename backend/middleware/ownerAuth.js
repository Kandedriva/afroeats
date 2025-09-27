// backend/middleware/ownerAuth.js
export default function ownerAuth(req, res, next) {
    if (!req.session || !req.session.ownerId) {
      return res.status(401).json({ error: "Unauthorized. Please log in as an owner." });
    }
  
    req.owner = {
      id: req.session.ownerId,
      name: req.session.ownerName,
      email: req.session.ownerEmail,
      stripe_account_id: req.session.stripeAccountId || null,
      stripe_customer_id: req.session.stripeCustomerId || null,
      _id: req.session.ownerId,
      save: async () => {} // placeholder, not used with Postgres
    };
  
    next();
  }
  export const requireOwnerAuth = (req, res, next) => {
    // Debug session information
    console.log('=== OWNER AUTH DEBUG ===');
    console.log('Session exists:', !!req.session);
    console.log('Session ID:', req.sessionID);
    console.log('Owner ID in session:', req.session?.ownerId);
    console.log('Session keys:', req.session ? Object.keys(req.session) : 'no session');
    console.log('Cookies received:', !!req.headers.cookie);
    console.log('User-Agent:', req.headers['user-agent']?.substring(0, 50));
    console.log('=== END AUTH DEBUG ===');
    
    if (!req.session || !req.session.ownerId) {
      console.log('AUTH FAILED: No session or owner ID');
      return res.status(401).json({ 
        error: "Unauthorized: Owner not logged in",
        debug: {
          hasSession: !!req.session,
          sessionId: req.sessionID,
          hasCookies: !!req.headers.cookie
        }
      });
    }
    
    // Set req.owner object for consistency with the routes
    req.owner = {
      id: req.session.ownerId,
      name: req.session.ownerName,
      email: req.session.ownerEmail,
      stripe_account_id: req.session.stripeAccountId || null,
      stripe_customer_id: req.session.stripeCustomerId || null,
    };
    
    next();
  };
  
  