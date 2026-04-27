import express from "express";
import { handleStripeWebhook } from "../webhooks/stripeWebhook.js";

const router = express.Router();

// Stripe webhook endpoint - needs raw body parser
// Route: /api/webhook (for backward compatibility)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// Alternative route: /api/webhooks/stripe (for Stripe CLI default)
router.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

export default router;
