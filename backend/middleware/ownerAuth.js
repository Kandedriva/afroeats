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
    if (!req.session || !req.session.ownerId) {
      return res.status(401).json({ error: "Unauthorized: Owner not logged in" });
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
  
  