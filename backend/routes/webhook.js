import express from "express";
import { handleStripeWebhook } from "../webhooks/stripeWebhook.js";

const router = express.Router();

// Stripe webhook endpoint - needs raw body parser
router.post(
  "/webhook", 
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

export default router;
