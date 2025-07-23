import express from 'express';
import stripe from '../stripe.js';
import ownerAuth from '../middleware/ownerAuth.js';
import { requireOwnerAuth } from "../middleware/ownerAuth.js";

const router = express.Router();

// POST /api/owners/stripe/create-stripe-account
router.post('/create-stripe-account', ownerAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe not configured - development mode' });
    }
    
    const owner = req.owner;

    // Create Stripe account if not already created
    if (!owner.stripe_account_id) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: owner.email,
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      // Save the account ID to the owner in DB (replace this with your DB update logic)
      owner.stripe_account_id = account.id;
      await owner.save(); // Assuming you’re using Mongoose
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: owner.stripe_account_id,
      refresh_url: 'http://localhost:3000/owner/dashboard',
      return_url: 'http://localhost:3000/owner/dashboard',
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    console.error('Error creating Stripe account:', err);
    res.status(500).json({ error: 'Stripe onboarding failed' });
  }
});

// GET /api/owners/stripe/account-status
router.get('/account-status', ownerAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe not configured - development mode' });
    }
    
    const owner = req.owner;

    if (!owner.stripe_account_id) {
      return res.status(400).json({ error: 'Stripe account not found for this owner.' });
    }

    const account = await stripe.accounts.retrieve(owner.stripe_account_id);

    res.json({
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
    });
  } catch (err) {
    console.error('Stripe account status error:', err);
    res.status(500).json({ error: 'Unable to fetch Stripe account status.' });
  }
});

// POST /api/owners/stripe/create-subscription
router.post('/create-subscription', ownerAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe not configured - development mode' });
    }
    
    const owner = req.owner;

    // Create Stripe customer if not present
    if (!owner.stripe_customer_id) {
      const customer = await stripe.customers.create({
        email: owner.email,
      });

      owner.stripe_customer_id = customer.id;
      await owner.save();
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: owner.stripe_customer_id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_SUBSCRIPTION_PRICE_ID, // must be set in .env
          quantity: 1,
        },
      ],
      success_url: 'http://localhost:3000/owner/dashboard',
      cancel_url: 'http://localhost:3000/owner/subscribe',
      metadata: {
        ownerId: owner._id.toString(),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe subscription error:', err);
    res.status(500).json({ error: 'Unable to create subscription' });
  }
});

router.post("/create-subscription-session", requireOwnerAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe not configured - development mode' });
    }
    
    const ownerId = req.owner.id;

    const owner = await getOwnerById(ownerId);
    if (!owner) return res.status(404).json({ error: "Owner not found" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: process.env.STRIPE_SUBSCRIPTION_PRICE_ID, // Make sure this is defined in your .env
          quantity: 1,
        },
      ],
      customer_email: owner.email,
      success_url: "http://localhost:5173/owner/dashboard",
      cancel_url: "http://localhost:5173/owner/login",
      metadata: {
        ownerId,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe subscription session error:", err.message);
    res.status(500).json({ error: "Failed to create Stripe session" });
  }
});

// GET /api/stripe/subscription-status
router.get('/subscription-status', ownerAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe not configured - development mode' });
    }
    
    const owner = req.owner;

    if (!owner.stripe_customer_id) {
      return res.status(403).json({ error: 'No Stripe customer ID found' });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: owner.stripe_customer_id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return res.status(403).json({ error: 'No active subscription found' });
    }

    res.json({ active: true });
  } catch (err) {
    console.error('Subscription status error:', err);
    res.status(500).json({ error: 'Unable to check subscription status' });
  }
});

export default router;
