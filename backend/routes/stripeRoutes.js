import express from 'express';
import stripe from '../stripe.js';
import pool from '../db.js';
import ownerAuth from '../middleware/ownerAuth.js';
import { requireOwnerAuth } from "../middleware/ownerAuth.js";

const router = express.Router();

// Add logging middleware to see if requests reach this router
router.use((req, res, next) => {
  console.log('🚀 STRIPE ROUTER - Request received:', req.method, req.path);
  console.log('🚀 Full URL:', req.url);
  next();
});

// Simple test endpoint to verify connectivity
router.get('/test', (req, res) => {
  res.json({
    message: 'Stripe routes are working',
    stripe_configured: !!stripe,
    database_configured: !!pool,
    timestamp: new Date().toISOString()
  });
});

// POST /stripe/create-stripe-account (note: no /api prefix since it's handled by server.js mounting)
router.post('/create-stripe-account', requireOwnerAuth, async (req, res) => {
  console.log('🔗 Stripe Connect request received');
  console.log('👤 Owner ID:', req.owner?.id || 'undefined');
  console.log('📧 Owner email:', req.owner?.email || 'undefined');
  console.log('🔒 Session ID:', req.session?.id || 'no session');
  console.log('📍 Request headers origin:', req.headers.origin);
  console.log('🌍 Environment:', process.env.NODE_ENV);
  console.log('🔑 Stripe configured:', !!stripe);
  console.log('💾 Database pool exists:', !!pool);
  
  try {
    // Check if owner object exists
    if (!req.owner || !req.owner.id) {
      console.log('❌ Owner object missing or invalid');
      return res.status(401).json({ error: 'Owner authentication failed' });
    }

    if (!stripe) {
      console.log('❌ Stripe not configured - running in development mode');
      console.log('🔑 STRIPE_SECRET_KEY exists:', !!process.env.STRIPE_SECRET_KEY);
      return res.status(503).json({ 
        error: 'Stripe not configured - development mode',
        development: true 
      });
    }
    
    const ownerId = req.owner.id;
    console.log('🔍 Looking up owner:', ownerId);
    
    // Test database connection first
    try {
      await pool.query('SELECT NOW()');
      console.log('✅ Database connection working');
    } catch (dbErr) {
      console.error('❌ Database connection failed:', dbErr.message);
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: dbErr.message 
      });
    }
    
    // Get current owner data from database
    const ownerResult = await pool.query(
      "SELECT * FROM restaurant_owners WHERE id = $1",
      [ownerId]
    );
    
    if (ownerResult.rows.length === 0) {
      console.log('❌ Owner not found in database:', ownerId);
      return res.status(404).json({ error: 'Owner not found' });
    }
    
    const owner = ownerResult.rows[0];
    console.log('✅ Owner found:', { id: owner.id, email: owner.email, existing_stripe: !!owner.stripe_account_id });

    // Create Stripe account if not already created
    if (!owner.stripe_account_id) {
      console.log('🆕 Creating new Stripe account for owner:', owner.email);
      try {
        const account = await stripe.accounts.create({
          type: 'express',
          email: owner.email,
          business_type: 'individual',
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        });
        console.log('✅ Stripe account created:', account.id);

        // Save the account ID to the database
        await pool.query(
          "UPDATE restaurant_owners SET stripe_account_id = $1 WHERE id = $2",
          [account.id, ownerId]
        );
        console.log('💾 Stripe account ID saved to database');
        
        owner.stripe_account_id = account.id;
      } catch (stripeErr) {
        console.error('❌ Stripe account creation failed:', stripeErr.message);
        console.error('❌ Error type:', stripeErr.type);
        
        // Handle account activation error specifically
        if (stripeErr.message.includes('account must be activated')) {
          return res.status(400).json({ 
            error: 'Stripe account activation required',
            details: 'Your main Stripe account needs to be activated before you can create connected accounts. Please complete the account activation at https://dashboard.stripe.com/account/onboarding',
            activation_required: true,
            activation_url: 'https://dashboard.stripe.com/account/onboarding'
          });
        }
        
        // Handle platform profile completion requirement
        if (stripeErr.message.includes('complete your platform profile') || stripeErr.message.includes('questionnaire')) {
          return res.status(400).json({ 
            error: 'Platform profile completion required',
            details: 'You must complete your Stripe platform profile before creating connected accounts. Please go to your Stripe Dashboard → Connect → Accounts → Overview and complete the platform questionnaire.',
            platform_setup_required: true,
            setup_url: 'https://dashboard.stripe.com/connect/accounts/overview'
          });
        }
        
        return res.status(500).json({ 
          error: 'Failed to create Stripe account',
          details: stripeErr.message,
          type: stripeErr.type 
        });
      }
    } else {
      console.log('♻️ Using existing Stripe account:', owner.stripe_account_id);
    }

    // Get the frontend URL dynamically
    const frontendUrl = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'http://localhost:3000';
    console.log('🌐 Frontend URL detected:', frontendUrl);

    // Create account link for onboarding
    console.log('🔗 Creating Stripe account link...');
    try {
      const accountLink = await stripe.accountLinks.create({
        account: owner.stripe_account_id,
        refresh_url: `${frontendUrl}/owner/dashboard?stripe_refresh=true`,
        return_url: `${frontendUrl}/owner/dashboard?stripe_return=true`,
        type: 'account_onboarding',
      });
      console.log('✅ Account link created:', accountLink.url);

      res.json({ url: accountLink.url });
    } catch (linkErr) {
      console.error('❌ Stripe account link creation failed:', linkErr.message);
      return res.status(500).json({ 
        error: 'Failed to create Stripe onboarding link',
        details: linkErr.message 
      });
    }
  } catch (err) {
    console.error('❌ Unexpected Stripe Connect error:', err);
    console.error('❌ Full error stack:', err.stack);
    res.status(500).json({ 
      error: 'Stripe onboarding failed',
      details: err.message,
      type: err.name || 'UnknownError'
    });
  }
});

// GET /stripe/connect-status
router.get('/connect-status', requireOwnerAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.json({ 
        connected: false, 
        payouts_enabled: false, 
        charges_enabled: false, 
        details_submitted: false,
        development_mode: true 
      });
    }
    
    const ownerId = req.owner.id;
    
    // Get owner's stripe account ID
    const ownerResult = await pool.query(
      "SELECT stripe_account_id FROM restaurant_owners WHERE id = $1",
      [ownerId]
    );
    
    if (ownerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Owner not found' });
    }
    
    const stripeAccountId = ownerResult.rows[0].stripe_account_id;
    
    if (!stripeAccountId) {
      return res.json({ 
        connected: false, 
        payouts_enabled: false, 
        charges_enabled: false, 
        details_submitted: false 
      });
    }

    const account = await stripe.accounts.retrieve(stripeAccountId);

    res.json({
      connected: true,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      account_id: stripeAccountId
    });
  } catch (err) {
    res.status(500).json({ error: 'Unable to fetch Stripe Connect status' });
  }
});

// POST /stripe/create-order-payment-intent - For splitting payments to connected accounts
router.post('/create-order-payment-intent', async (req, res) => {
  try {
    if (!stripe) {
      return res.json({ 
        development_mode: true,
        message: 'Development mode - no real payment processing' 
      });
    }
    
    const { amount, restaurantId, orderId } = req.body;
    
    if (!amount || !restaurantId) {
      return res.status(400).json({ error: 'Amount and restaurant ID required' });
    }

    // Get restaurant owner's stripe account
    const restaurantResult = await pool.query(
      "SELECT ro.stripe_account_id, r.name as restaurant_name FROM restaurants r JOIN restaurant_owners ro ON r.owner_id = ro.id WHERE r.id = $1",
      [restaurantId]
    );
    
    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    const { stripe_account_id, restaurant_name } = restaurantResult.rows[0];
    
    if (!stripe_account_id) {
      return res.status(400).json({ 
        error: 'Restaurant owner has not connected their Stripe account',
        needs_stripe_connect: true 
      });
    }

    // Calculate platform fee (5% of total)
    const platformFee = Math.round(amount * 0.05);
    const restaurantAmount = amount - platformFee;

    // Create payment intent with destination and application fee
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card'],
      application_fee_amount: platformFee,
      transfer_data: {
        destination: stripe_account_id,
      },
      metadata: {
        order_id: orderId,
        restaurant_id: restaurantId,
        restaurant_name: restaurant_name,
        platform_fee: platformFee.toString(),
        restaurant_amount: restaurantAmount.toString()
      }
    });

    res.json({ 
      client_secret: paymentIntent.client_secret,
      platform_fee: platformFee,
      restaurant_amount: restaurantAmount 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});


export default router;
