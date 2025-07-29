// backend/stripe.js
import Stripe from "stripe";
import dotenv from "dotenv";
dotenv.config();

// Only initialize Stripe if we have a valid secret key
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2022-11-15",
    });
    // Stripe initialized with real API key
  } catch (error) {
    // Failed to initialize Stripe
  }
} else {
  // Stripe running in development mode - no real API key provided
}

export default stripe;
