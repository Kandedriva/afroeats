# Stripe Integration Setup

## Environment Variables Required

Add these to your `.env` file in the backend directory:

```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_SUBSCRIPTION_PRICE_ID=price_your_subscription_price_id_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## Database Setup

Run the migration script to add required columns:

```sql
-- Connect to your PostgreSQL database and run:
\i backend/migrations/add_subscription_columns.sql
```

Or copy and paste the SQL from the migration file into your database client.

## Stripe Dashboard Setup

1. **Create a Subscription Product:**
   - Go to Stripe Dashboard > Products
   - Create a new product (e.g., "Restaurant Owner Subscription")
   - Add a recurring price (e.g., $29/month)
   - Copy the Price ID and add it to STRIPE_SUBSCRIPTION_PRICE_ID

2. **Set up Webhooks:**
   - Go to Stripe Dashboard > Developers > Webhooks
   - Add endpoint: `http://your-domain.com/api/webhook`
   - Select events: `checkout.session.completed`, `customer.subscription.deleted`
   - Copy the webhook secret and add it to STRIPE_WEBHOOK_SECRET

## Flow Overview

1. **Owner Registration**: New owners register and are redirected to `/owner/subscribe`
2. **Subscription Page**: Automatically redirects to Stripe Checkout
3. **Payment Success**: Stripe redirects back to `/owner/dashboard?session_id=xxx`
4. **Dashboard**: Handles the success callback and activates subscription
5. **Webhook**: Updates subscription status automatically for future changes

## Testing

Use Stripe test mode with these test cards:
- Success: `4242424242424242`
- Decline: `4000000000000002`

## Production Checklist

- [ ] Replace test keys with live keys
- [ ] Update webhook endpoint to production URL
- [ ] Test the complete flow in production
- [ ] Set up proper error monitoring