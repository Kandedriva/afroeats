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

// POST /stripe/create-stripe-account - Now uses OAuth flow instead of direct account creation
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

    if (!process.env.STRIPE_CLIENT_ID) {
      console.log('❌ STRIPE_CLIENT_ID not configured');
      return res.status(503).json({ 
        error: 'Stripe Connect not configured - missing CLIENT_ID',
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

    // Check if already connected to Stripe
    if (owner.stripe_account_id) {
      console.log('♻️ Owner already has Stripe account:', owner.stripe_account_id);
      
      // Try to create account link for existing account
      try {
        const frontendUrl = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'http://localhost:3000';
        const accountLink = await stripe.accountLinks.create({
          account: owner.stripe_account_id,
          refresh_url: `${frontendUrl}/owner/dashboard?stripe_refresh=true`,
          return_url: `${frontendUrl}/owner/dashboard?stripe_return=true`,
          type: 'account_onboarding',
        });
        console.log('✅ Account link created for existing account:', accountLink.url);
        return res.json({ url: accountLink.url });
      } catch (linkErr) {
        console.log('⚠️ Existing account link failed:', linkErr.message);
        
        // If Stripe error, return helpful message
        if (linkErr.type === 'StripeAuthenticationError') {
          return res.status(503).json({ 
            error: 'Stripe authentication failed. Please check your Stripe configuration.',
            details: linkErr.message,
            type: 'stripe_auth_error'
          });
        }
        
        console.log('🔄 Falling back to OAuth flow');
        // Fall through to OAuth flow
      }
    }

    // Use OAuth flow instead of direct account creation
    console.log('🔗 Redirecting to Stripe Connect OAuth flow');
    
    // Get the frontend URL dynamically
    const frontendUrl = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'http://localhost:3000';
    console.log('🌐 Frontend URL detected:', frontendUrl);

    // Generate state parameter for security
    const state = Buffer.from(JSON.stringify({
      ownerId: req.owner.id,
      timestamp: Date.now()
    })).toString('base64');

    // Determine if we're in live mode based on secret key
    const isLiveMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
    const clientIdMode = process.env.STRIPE_CLIENT_ID?.includes('test') ? 'test' : 'live';
    
    console.log('🔍 Mode Detection:');
    console.log('  - Secret Key Mode:', isLiveMode ? 'LIVE' : 'TEST');
    console.log('  - Client ID:', process.env.STRIPE_CLIENT_ID);
    console.log('  - Client ID appears to be:', clientIdMode, 'mode');

    // Create OAuth authorization URL
    const oauthUrl = new URL('https://connect.stripe.com/oauth/authorize');
    oauthUrl.searchParams.append('response_type', 'code');
    oauthUrl.searchParams.append('client_id', process.env.STRIPE_CLIENT_ID);
    oauthUrl.searchParams.append('scope', 'read_write');
    oauthUrl.searchParams.append('redirect_uri', `${process.env.BACKEND_URL || 'http://localhost:5001'}/api/stripe/oauth-callback`);
    oauthUrl.searchParams.append('state', state);

    // Add suggested account info
    if (owner.email) {
      oauthUrl.searchParams.append('stripe_user[email]', owner.email);
    }
    
    if (isLiveMode) {
      console.log('🔥 Configured for LIVE mode OAuth flow');
    } else {
      console.log('🧪 Configured for TEST mode OAuth flow');
    }

    console.log('✅ OAuth URL generated:', oauthUrl.toString());
    
    res.json({ 
      url: oauthUrl.toString(),
      state: state,
      oauth_flow: true 
    });

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


// GET /stripe/oauth-connect - Generate OAuth authorization URL
router.get('/oauth-connect', requireOwnerAuth, async (req, res) => {
  console.log('🔗 OAuth Connect request received');
  console.log('👤 Owner ID:', req.owner?.id || 'undefined');
  
  try {
    if (!stripe) {
      return res.status(503).json({ 
        error: 'Stripe not configured - development mode',
        development: true 
      });
    }

    // Get the frontend URL dynamically
    const frontendUrl = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'http://localhost:3000';
    console.log('🌐 Frontend URL detected:', frontendUrl);

    // Generate state parameter for security (optional but recommended)
    const state = Buffer.from(JSON.stringify({
      ownerId: req.owner.id,
      timestamp: Date.now()
    })).toString('base64');

    // Create OAuth authorization URL
    const oauthUrl = new URL('https://connect.stripe.com/oauth/authorize');
    oauthUrl.searchParams.append('response_type', 'code');
    oauthUrl.searchParams.append('client_id', process.env.STRIPE_CLIENT_ID || 'ca_your_client_id'); // You need to add this to .env
    oauthUrl.searchParams.append('scope', 'read_write');
    oauthUrl.searchParams.append('redirect_uri', `${process.env.BACKEND_URL || 'http://localhost:5001'}/api/stripe/oauth-callback`);
    oauthUrl.searchParams.append('state', state);

    console.log('✅ OAuth URL generated:', oauthUrl.toString());
    
    res.json({ 
      url: oauthUrl.toString(),
      state: state 
    });
  } catch (err) {
    console.error('❌ OAuth URL generation failed:', err);
    res.status(500).json({ 
      error: 'Failed to generate OAuth URL',
      details: err.message 
    });
  }
});

// GET /stripe/oauth-callback - Handle OAuth callback
router.get('/oauth-callback', async (req, res) => {
  console.log('🔄 OAuth callback received');
  console.log('📝 Query params:', req.query);
  
  const { code, state, error, error_description } = req.query;
  
  try {
    // Handle OAuth errors
    if (error) {
      console.error('❌ OAuth error:', error, error_description);
      
      // Handle specific error cases
      let redirectUrl;
      if (error === 'access_denied') {
        console.log('🚫 User denied access to Stripe Connect');
        redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/owner/dashboard?error=access_denied`;
      } else {
        redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/owner/dashboard?error=${encodeURIComponent(error)}`;
        if (error_description) {
          redirectUrl += `&error_description=${encodeURIComponent(error_description)}`;
        }
      }
      
      return res.redirect(redirectUrl);
    }

    if (!code) {
      console.error('❌ No authorization code received');
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/owner/dashboard?error=no_code`);
    }

    // Decode state to get owner info (if you're using state)
    let ownerId = null;
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        ownerId = stateData.ownerId;
        console.log('📋 Owner ID from state:', ownerId);
      } catch (stateErr) {
        console.warn('⚠️ Failed to decode state:', stateErr.message);
      }
    }

    if (!stripe) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/owner/dashboard?error=stripe_not_configured`);
    }

    // Exchange authorization code for access token
    console.log('🔄 Exchanging code for access token...');
    let tokenResponse;
    try {
      tokenResponse = await stripe.oauth.token({
        grant_type: 'authorization_code',
        code: code,
      });
    } catch (tokenError) {
      console.error('❌ OAuth token exchange failed:', tokenError.message);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      
      if (tokenError.type === 'StripeAuthenticationError') {
        return res.redirect(`${frontendUrl}/owner/dashboard?error=stripe_auth_failed&details=${encodeURIComponent('Invalid Stripe credentials')}`);
      }
      
      return res.redirect(`${frontendUrl}/owner/dashboard?error=oauth_token_failed&details=${encodeURIComponent(tokenError.message)}`);
    }

    console.log('✅ OAuth token received:', {
      stripe_user_id: tokenResponse.stripe_user_id,
      scope: tokenResponse.scope
    });

    // Update owner in database with Stripe account ID
    if (ownerId) {
      await pool.query(
        "UPDATE restaurant_owners SET stripe_account_id = $1 WHERE id = $2",
        [tokenResponse.stripe_user_id, ownerId]
      );
      console.log('💾 Owner updated with Stripe account ID');
    }

    // Redirect back to frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/owner/dashboard?stripe_connected=true&account_id=${tokenResponse.stripe_user_id}`);
    
  } catch (err) {
    console.error('❌ OAuth callback error:', err);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/owner/dashboard?error=oauth_failed&details=${encodeURIComponent(err.message)}`);
  }
});

export default router;
