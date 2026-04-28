#!/bin/bash

echo "========================================="
echo "  Starting Stripe Webhook Forwarding"
echo "========================================="
echo ""
echo "Forwarding webhooks to: http://localhost:5001/api/webhooks/stripe"
echo ""
echo "⚠️  IMPORTANT INSTRUCTIONS:"
echo ""
echo "1. Copy the webhook signing secret that appears below"
echo "   (it starts with: whsec_)"
echo ""
echo "2. Open backend/.env and update this line:"
echo "   STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE"
echo ""
echo "3. Restart your backend server after updating .env"
echo ""
echo "4. Keep this terminal window open while developing!"
echo ""
echo "========================================="
echo ""

stripe listen --forward-to localhost:5001/api/webhooks/stripe
