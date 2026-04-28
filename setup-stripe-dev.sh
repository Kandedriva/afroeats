#!/bin/bash

# Stripe Development Setup Script
# This script helps set up Stripe webhook forwarding for local development

echo "========================================="
echo "  Stripe Development Setup"
echo "========================================="
echo ""

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo "❌ Stripe CLI is not installed"
    echo ""
    echo "Please install Stripe CLI first:"
    echo ""
    echo "macOS (Homebrew):"
    echo "  brew install stripe/stripe-cli/stripe"
    echo ""
    echo "Or download from:"
    echo "  https://github.com/stripe/stripe-cli/releases/latest"
    echo ""
    exit 1
fi

echo "✅ Stripe CLI is installed"
echo ""

# Check if logged in
echo "Checking Stripe CLI authentication..."
if stripe config --list &> /dev/null; then
    echo "✅ Stripe CLI is authenticated"
else
    echo "⚠️  Stripe CLI is not authenticated"
    echo ""
    echo "Running 'stripe login'..."
    stripe login

    if [ $? -ne 0 ]; then
        echo "❌ Failed to authenticate with Stripe"
        exit 1
    fi
    echo "✅ Successfully authenticated"
fi

echo ""
echo "========================================="
echo "  Starting Webhook Forwarding"
echo "========================================="
echo ""
echo "This will forward Stripe webhook events to:"
echo "  http://localhost:5001/api/webhooks/stripe"
echo ""
echo "⚠️  IMPORTANT:"
echo "  1. Copy the webhook signing secret (whsec_xxx) that appears below"
echo "  2. Update backend/.env with:"
echo "     STRIPE_WEBHOOK_SECRET=whsec_xxx"
echo "  3. Restart your backend server"
echo ""
echo "Press Ctrl+C to stop webhook forwarding"
echo ""
echo "========================================="
echo ""

# Start Stripe CLI listener
stripe listen --forward-to localhost:5001/api/webhooks/stripe
