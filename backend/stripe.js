// backend/stripe.js
import Stripe from "stripe";
import dotenv from "dotenv";
dotenv.config();

// Initialize Stripe with validation
let stripe = null;
let stripeError = null;

if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2022-11-15",
    });
    
    // Test the key by making a simple API call
    (async () => {
      try {
        await stripe.accounts.retrieve();
        console.log('✅ Stripe initialized successfully with valid key');
      } catch (error) {
        console.error('❌ Stripe key validation failed:', error.message);
        stripeError = error.message;
        // Don't set stripe to null here, let the routes handle it
      }
    })();
    
  } catch (error) {
    console.error('❌ Failed to initialize Stripe:', error.message);
    stripeError = error.message;
    stripe = null;
  }
} else {
  console.log('ℹ️ No Stripe secret key provided - running in demo mode');
}

export default stripe;
export { stripeError };
