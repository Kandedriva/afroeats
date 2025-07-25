import stripe from '../stripe.js';
import pool from '../db.js';

// Create subscription session
export const createSubscriptionSession = async (req, res) => {
  try {
    const ownerId = req.session.ownerId;
    
    console.log("Creating subscription session for owner:", ownerId);
    console.log("Session data:", { ownerId: req.session.ownerId, session: !!req.session });
    
    if (!ownerId) {
      return res.status(401).json({ error: "Must be logged in as owner" });
    }

    // Check if Stripe is properly configured
    if (!stripe || !process.env.STRIPE_SECRET_KEY) {
      console.log("Stripe not configured - creating demo subscription page");
      
      // For development - create a demo checkout experience
      return res.json({ 
        url: "http://localhost:3000/owner/demo-checkout",
        dev_mode: true,
        message: "Demo mode - no real payment required"
      });
    }

    // If no price ID is set, create a basic subscription product
    let priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
    if (!priceId) {
      console.log("No STRIPE_SUBSCRIPTION_PRICE_ID found, creating default subscription product...");
      
      try {
        // Create a product for restaurant subscriptions
        const product = await stripe.products.create({
          name: 'Afro Eats Restaurant Subscription',
          description: 'Monthly subscription for restaurant owners to list their restaurants and receive orders',
        });

        // Create a price for the product ($19.99/month)
        const price = await stripe.prices.create({
          unit_amount: 1999, // $19.99 in cents
          currency: 'usd',
          recurring: { interval: 'month' },
          product: product.id,
        });

        priceId = price.id;
        console.log(`✅ Created default subscription: ${priceId}`);
        console.log(`💡 Add this to your .env file: STRIPE_SUBSCRIPTION_PRICE_ID=${priceId}`);
      } catch (err) {
        console.error("Failed to create default subscription product:", err);
        return res.status(500).json({ error: "Failed to set up subscription" });
      }
    }

    // Get owner details
    let ownerResult;
    try {
      ownerResult = await pool.query(
        "SELECT * FROM restaurant_owners WHERE id = $1",
        [ownerId]
      );
    } catch (err) {
      console.error("Database error getting owner:", err);
      return res.status(500).json({ error: "Database error" });
    }

    if (ownerResult.rows.length === 0) {
      return res.status(404).json({ error: "Owner not found" });
    }

    const owner = ownerResult.rows[0];

    // Validate the price ID format
    if (!priceId.startsWith('price_')) {
      console.error("Invalid STRIPE_SUBSCRIPTION_PRICE_ID - must start with 'price_', got:", priceId);
      return res.status(500).json({ 
        error: "Stripe configuration error - invalid price ID format",
        hint: "Price ID should start with 'price_', not 'prod_'"
      });
    }

    // Ensure stripe_customer_id column exists
    try {
      await pool.query("ALTER TABLE restaurant_owners ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)");
    } catch (err) {
      console.log("Column creation check:", err.message);
    }

    // Create Stripe customer if not exists or if existing ID is invalid for current mode
    let customerId = owner.stripe_customer_id;
    
    // Validate customer ID matches current Stripe mode (test/live)
    const isTestMode = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_');
    const isValidCustomerId = customerId && (
      (isTestMode && customerId.startsWith('cus_')) || 
      (!isTestMode && customerId.startsWith('cus_'))
    );
    
    if (!customerId || !isValidCustomerId) {
      if (customerId && !isValidCustomerId) {
        console.log(`Clearing invalid customer ID ${customerId} for ${isTestMode ? 'test' : 'live'} mode`);
      }
      
      const customer = await stripe.customers.create({
        email: owner.email,
        name: owner.name,
        metadata: {
          ownerId: ownerId.toString(),
          mode: isTestMode ? 'test' : 'live'
        }
      });

      customerId = customer.id;
      console.log(`Created new ${isTestMode ? 'test' : 'live'} mode customer: ${customerId}`);
      
      // Update owner with customer ID
      await pool.query(
        "UPDATE restaurant_owners SET stripe_customer_id = $1 WHERE id = $2",
        [customerId, ownerId]
      );
    }

    // Create subscription session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: "http://localhost:3000/owner/dashboard?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:3000/owner/subscribe?canceled=true",
      metadata: {
        ownerId: ownerId.toString(),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe subscription session error:", err);
    
    // If it's a price ID error, provide helpful message
    if (err.code === 'resource_missing' && err.param === 'line_items[0][price]') {
      return res.status(400).json({ 
        error: "Invalid Stripe price ID. Please check your Stripe dashboard and update STRIPE_SUBSCRIPTION_PRICE_ID in your .env file.",
        stripe_error: err.message
      });
    }
    
    res.status(500).json({ error: "Failed to create subscription session" });
  }
};

// Handle successful subscription
export const handleSubscriptionSuccess = async (req, res) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({ error: "Missing session ID" });
    }

    // Retrieve the session
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session.payment_status === 'paid') {
      const ownerId = session.metadata.ownerId;
      
      // Try to update owner subscription status
      try {
        // Ensure column exists first
        await pool.query(
          "ALTER TABLE restaurant_owners ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT false"
        );
        
        await pool.query(
          "UPDATE restaurant_owners SET is_subscribed = true WHERE id = $1",
          [ownerId]
        );
      } catch (err) {
        console.error("Error updating subscription status:", err);
        // Continue anyway - subscription was successful
      }
      
      res.json({ success: true, message: "Subscription activated successfully" });
    } else {
      res.status(400).json({ error: "Payment not completed" });
    }
  } catch (err) {
    console.error("Subscription success handler error:", err);
    res.status(500).json({ error: "Failed to process subscription success" });
  }
};

// Check subscription status
// Demo subscription activation (for development)
export const activateDemoSubscription = async (req, res) => {
  try {
    const ownerId = req.session.ownerId;
    
    if (!ownerId) {
      return res.status(401).json({ error: "Must be logged in as owner" });
    }

    console.log("Activating demo subscription for owner:", ownerId);

    // Ensure is_subscribed column exists and update subscription status
    try {
      // First try to add the column if it doesn't exist
      await pool.query(
        "ALTER TABLE restaurant_owners ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT false"
      );
      
      // Then update the subscription status
      await pool.query(
        "UPDATE restaurant_owners SET is_subscribed = true WHERE id = $1",
        [ownerId]
      );
      
      console.log("Demo subscription activated successfully for owner:", ownerId);
    } catch (err) {
      console.error("Error updating subscription status:", err);
      // Continue anyway since this is demo mode
    }

    res.json({ 
      success: true, 
      message: "Demo subscription activated successfully",
      demo_mode: true 
    });
  } catch (err) {
    console.error("Demo subscription activation error:", err);
    res.status(500).json({ error: "Failed to activate demo subscription" });
  }
};

export const checkSubscriptionStatus = async (req, res) => {
  try {
    const ownerId = req.session.ownerId;
    
    console.log("Checking subscription status for owner:", ownerId);
    console.log("Session data:", { ownerId: req.session.ownerId, session: !!req.session });
    
    if (!ownerId) {
      return res.status(401).json({ error: "Must be logged in as owner" });
    }

    let ownerResult;
    try {
      // First ensure the column exists
      await pool.query(
        "ALTER TABLE restaurant_owners ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT false"
      );
      
      ownerResult = await pool.query(
        "SELECT stripe_customer_id, is_subscribed FROM restaurant_owners WHERE id = $1",
        [ownerId]
      );
    } catch (err) {
      // If we still can't get subscription data, fall back to basic query
      console.log("Error accessing subscription data, falling back to basic owner query");
      ownerResult = await pool.query(
        "SELECT id, email FROM restaurant_owners WHERE id = $1",
        [ownerId]
      );
      
      if (ownerResult.rows.length === 0) {
        return res.status(404).json({ error: "Owner not found" });
      }
      
      // Without subscription data, default to false
      return res.json({ active: false });
    }

    if (ownerResult.rows.length === 0) {
      return res.status(404).json({ error: "Owner not found" });
    }

    const owner = ownerResult.rows[0];
    
    // If Stripe is not configured, check local is_subscribed status only
    if (!stripe) {
      const isSubscribed = owner.is_subscribed || false;
      return res.json({ active: isSubscribed, dev_mode: true });
    }
    
    if (!owner.stripe_customer_id) {
      return res.json({ active: false });
    }

    // Validate customer ID matches current Stripe mode (test/live)
    const isTestMode = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_');
    const isValidCustomerId = owner.stripe_customer_id && (
      (isTestMode && owner.stripe_customer_id.startsWith('cus_')) || 
      (!isTestMode && owner.stripe_customer_id.startsWith('cus_'))
    );
    
    if (!isValidCustomerId) {
      console.log(`Invalid customer ID ${owner.stripe_customer_id} for ${isTestMode ? 'test' : 'live'} mode, clearing it`);
      // Clear invalid customer ID
      await pool.query(
        "UPDATE restaurant_owners SET stripe_customer_id = NULL WHERE id = $1",
        [ownerId]
      );
      return res.json({ active: false });
    }

    // Check with Stripe for active subscriptions
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: owner.stripe_customer_id,
        status: 'active',
        limit: 1,
      });
    
      const hasActiveSubscription = subscriptions.data.length > 0;
      
      // Update local status if it doesn't match Stripe
      if (hasActiveSubscription !== owner.is_subscribed) {
        await pool.query(
          "UPDATE restaurant_owners SET is_subscribed = $1 WHERE id = $2",
          [hasActiveSubscription, ownerId]
        );
      }

      res.json({ active: hasActiveSubscription });
    } catch (stripeError) {
      console.error("Stripe subscription check error:", stripeError.message);
      if (stripeError.code === 'resource_missing') {
        // Customer doesn't exist in Stripe, clear the invalid ID
        await pool.query(
          "UPDATE restaurant_owners SET stripe_customer_id = NULL WHERE id = $1",
          [ownerId]
        );
        return res.json({ active: false });
      }
      throw stripeError; // Re-throw other errors
    }
  } catch (err) {
    console.error("Subscription status check error:", err);
    res.status(500).json({ error: "Failed to check subscription status" });
  }
};