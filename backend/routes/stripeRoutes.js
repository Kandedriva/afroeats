import express from 'express';
import stripe from '../stripe.js';
import pool from '../db.js';
import ownerAuth from '../middleware/ownerAuth.js';
import { requireOwnerAuth } from "../middleware/ownerAuth.js";

const router = express.Router();

// POST /api/stripe/create-stripe-account
router.post('/stripe/create-stripe-account', requireOwnerAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Stripe not configured - development mode' });
    }
    
    const ownerId = req.owner.id;
    
    // Get current owner data from database
    const ownerResult = await pool.query(
      "SELECT * FROM restaurant_owners WHERE id = $1",
      [ownerId]
    );
    
    if (ownerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Owner not found' });
    }
    
    const owner = ownerResult.rows[0];

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

      // Save the account ID to the database
      await pool.query(
        "UPDATE restaurant_owners SET stripe_account_id = $1 WHERE id = $2",
        [account.id, ownerId]
      );
      
      owner.stripe_account_id = account.id;
    }

    // Get the frontend URL dynamically
    const frontendUrl = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'http://localhost:3000';

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: owner.stripe_account_id,
      refresh_url: `${frontendUrl}/owner/dashboard?stripe_refresh=true`,
      return_url: `${frontendUrl}/owner/dashboard?stripe_return=true`,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    res.status(500).json({ error: 'Stripe onboarding failed' });
  }
});

// GET /api/stripe/connect-status
router.get('/stripe/connect-status', requireOwnerAuth, async (req, res) => {
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

// POST /api/stripe/create-order-payment-intent - For splitting payments to connected accounts
router.post('/stripe/create-order-payment-intent', async (req, res) => {
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
