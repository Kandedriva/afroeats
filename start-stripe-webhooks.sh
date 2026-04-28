#!/bin/bash

# Full path to Stripe CLI
STRIPE_BIN="/opt/homebrew/Cellar/stripe/1.40.8/bin/stripe"

# Or try to use stripe from PATH
if ! command -v stripe &> /dev/null; then
    if [ -f "$STRIPE_BIN" ]; then
        alias stripe="$STRIPE_BIN"
    else
        echo "❌ Stripe CLI not found!"
        echo "Please install it with: brew install stripe/stripe-cli/stripe"
        exit 1
    fi
fi

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
echo "Press Ctrl+C to stop webhook forwarding"
echo ""
echo "========================================="
echo ""

# Start Stripe webhook listener
$STRIPE_BIN listen --forward-to localhost:5001/api/webhooks/stripe
