# 🚀 Production Deployment Guide

## Environment Variables Required

### **Backend (.env)**

Create a `.env` file in the `backend/` directory with these variables:

```env
# Database (Production)
DATABASE_URL=postgresql://username:password@host:5432/database

# Stripe (Production - IMPORTANT: Use live keys!)
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# SMS Notifications (Twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Email Notifications (Optional - choose one provider)
# Option 1: Brevo (Recommended)
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=xsmtpsib-your-smtp-key
SMTP_FROM_EMAIL=your-email@example.com

# Frontend URL (Production)
FRONTEND_URL=https://yourdomain.com

# Server
PORT=5001
NODE_ENV=production
```

### **Frontend (.env)**

Create a `.env` file in the `afro-eats/` directory:

```env
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
```

## Deployment Steps

### 1. **Database Setup**

```bash
# Create production database
createdb orderdabaly_production

# Run migrations
cd backend
psql $DATABASE_URL < schema.sql
```

### 2. **Install Dependencies**

```bash
# Backend
cd backend
npm install --production

# Frontend
cd afro-eats
npm install
```

### 3. **Build Frontend**

```bash
cd afro-eats
npm run build
```

### 4. **Configure Stripe Webhook**

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://api.yourdomain.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `transfer.created`
4. Copy webhook secret to `.env` as `STRIPE_WEBHOOK_SECRET`

### 5. **Start Server**

```bash
cd backend
npm run start
# Or with PM2:
pm2 start server.js --name orderdabaly-api
```

## Security Checklist

- [ ] All `.env` files are in `.gitignore`
- [ ] Using Stripe LIVE keys (not test keys)
- [ ] Database has strong password
- [ ] HTTPS enabled on production domain
- [ ] CORS configured for production domain only
- [ ] Twilio account upgraded (or phone numbers verified)
- [ ] Session secret is strong and unique

## Monitoring

- Monitor Stripe webhooks in Dashboard
- Check Twilio SMS delivery logs
- Monitor server logs for errors
- Set up uptime monitoring (e.g., UptimeRobot)

## Support

For issues, check server logs:
```bash
pm2 logs orderdabaly-api
```
