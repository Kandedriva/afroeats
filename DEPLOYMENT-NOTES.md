# Deployment Configuration Notes

## CORS Issues After Domain Change

If you encounter CORS errors like:
```
Access to fetch at 'https://api.afoodzone.com/api/restaurants' from origin 'https://orderdabaly.com' has been blocked by CORS policy
```

This indicates the application was built with old environment variables. Here's how to fix it:

### Frontend Configuration

1. **Update `.env.production`** (create if it doesn't exist):
```bash
# Production API Configuration
REACT_APP_API_BASE_URL=https://api.orderdabaly.com

# Stripe Configuration
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_your_actual_live_key
```

2. **Rebuild the frontend** with correct environment variables:
```bash
cd afro-eats
npm run build
```

### Backend Configuration

1. **Update `.env.production`** (create from `.env.production.example`):
```bash
# Copy the example file
cp backend/.env.production.example backend/.env.production

# Edit with actual values
COOKIE_DOMAIN=.orderdabaly.com
FRONTEND_URL=https://orderdabaly.com
CLIENT_URL=https://app.orderdabaly.com
ADMIN_URL=https://admin.orderdabaly.com
```

2. **Deploy backend** with updated environment variables.

### Verification

After updating both frontend and backend configurations:

1. Check browser network tab - API calls should go to `api.orderdabaly.com`
2. Check browser console - no CORS errors should appear
3. Verify cookies are set correctly with `.orderdabaly.com` domain

### Security Notes

- Never commit `.env.production` files to git (they're gitignored for security)
- Always use HTTPS in production
- Ensure session secrets are randomly generated
- Verify CORS origins are properly configured