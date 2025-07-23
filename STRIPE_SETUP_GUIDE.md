# Stripe Setup Guide - Step by Step

## 🚀 Quick Start (Development Mode - Currently Active)

Your app is currently running in **development mode** where subscriptions automatically succeed without real Stripe setup. This is perfect for testing!

## 📋 To Enable Real Stripe Integration

### Step 1: Create Stripe Account & Get Keys
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Sign up/Log in to your account
3. Get your API keys:
   - Go to **Developers** > **API Keys**
   - Copy **Publishable Key** (starts with `pk_test_` for test mode)
   - Copy **Secret Key** (starts with `sk_test_` for test mode)

### Step 2: Create a Subscription Product
1. In Stripe Dashboard, go to **Products**
2. Click **+ Add Product**
3. Fill in details:
   - **Name**: "Restaurant Owner Subscription"
   - **Description**: "Monthly subscription for restaurant owners"
4. Add pricing:
   - **Price**: $29.00 (or your desired amount)
   - **Billing period**: Monthly
   - Click **Save**
5. **IMPORTANT**: Copy the **Price ID** (starts with `price_`) NOT the Product ID

### Step 3: Set up Webhooks
1. Go to **Developers** > **Webhooks**
2. Click **+ Add endpoint**
3. Set endpoint URL: `http://localhost:5001/api/webhook` (or your production URL)
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
5. Click **Add endpoint**
6. Copy the **Webhook Secret** (starts with `whsec_`)

### Step 4: Update Your .env File
```env
# Use test keys for development
STRIPE_SECRET_KEY=sk_test_your_actual_test_key_here
STRIPE_SUBSCRIPTION_PRICE_ID=price_your_actual_price_id_here
STRIPE_WEBHOOK_SECRET=whsec_your_actual_webhook_secret_here
```

### Step 5: Test with Stripe Test Cards
Use these test card numbers:
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **Requires Authentication**: 4000 0000 0000 3220

## 🏭 Production Setup

For production:
1. Switch to **Live mode** in Stripe Dashboard
2. Get your **live keys** (starts with `sk_live_` and `pk_live_`)
3. Update webhook endpoint to your production URL
4. Update .env with live keys:
```env
STRIPE_SECRET_KEY=sk_live_your_actual_live_key_here
STRIPE_SUBSCRIPTION_PRICE_ID=price_your_actual_live_price_id_here
STRIPE_WEBHOOK_SECRET=whsec_your_actual_live_webhook_secret_here
```

## 🔧 Current Development Mode Features

When `STRIPE_SUBSCRIPTION_PRICE_ID` is not set (current setup):
- ✅ **Automatic subscription success** - no real payment required
- ✅ **Redirect to dashboard** with `?dev_subscription=true`
- ✅ **All functionality works** for testing
- ✅ **No real Stripe setup needed**

## 🐛 Troubleshooting

### Issue: "Invalid price ID" error
- **Cause**: Using Product ID (`prod_`) instead of Price ID (`price_`)
- **Solution**: Make sure you copy the **Price ID** from the pricing section, not the product ID

### Issue: "Must be logged in as owner" error
- **Cause**: Session not being passed correctly
- **Solution**: Make sure cookies are enabled and you're logged in

### Issue: Webhook not receiving events
- **Cause**: Wrong endpoint URL or not selecting correct events
- **Solution**: Check endpoint URL and ensure you selected `checkout.session.completed`

## 🎯 Recommended Development Workflow

1. **Start with Development Mode** (current setup) - test all functionality
2. **Set up Stripe Test Mode** - test with real Stripe but fake payments
3. **Switch to Production** - real payments with live keys

Your current setup is perfect for development and testing! 🚀