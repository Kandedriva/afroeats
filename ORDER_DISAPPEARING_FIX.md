# Order Disappearing Issue - Complete Fix

## Problems Identified

### 1. ✅ FIXED: Infinite Loop Causing App Crash
**File**: `afro-eats/src/pages/OrderSuccess.js`

**Problem**: The `useEffect` hook had too many dependencies, causing an infinite loop:
- Every time the effect ran, it updated state
- State update triggered re-render
- Re-render triggered the effect again
- This created infinite API calls to `/api/grocery/verify-session` and `/api/grocery/orders/:id`
- Browser rate limiting kicked in with "too many requests from this IP"
- App crashed

**Fix Applied**:
```javascript
// Before (INFINITE LOOP):
useEffect(() => {
  handleOrderSuccess();
}, [orderId, sessionId, isDemo, isGroceryOrder, isGuestFromStripe, guestOrderInfo?.guestOrder, guestOrderInfo?.email, navigate, forceRefreshCart, clearCart, clearGroceryCart, clearGuestCartAfterSuccessfulOrder, user]);

// After (FIXED):
useEffect(() => {
  handleOrderSuccess();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [orderId, sessionId, isDemo, isGroceryOrder, isGuestFromStripe]);
```

**What Changed**: Removed dependencies that change during the effect execution (functions and state setters), keeping only the URL parameters that determine WHEN the effect should run.

---

### 2. ✅ FIXED: Frontend URL Mismatch
**File**: `backend/.env`

**Problem**:
```bash
FRONTEND_URL=http://localhost:3000  # WRONG - frontend runs on 3002
CLIENT_URL=http://localhost:3000    # WRONG
```

**Fix Applied**:
```bash
FRONTEND_URL=http://localhost:3002  # CORRECT
CLIENT_URL=http://localhost:3002    # CORRECT
```

**Impact**: This was causing Stripe redirects to go to the wrong URL after payment.

---

### 3. ⚠️ REQUIRES ACTION: Stripe Webhooks Not Working in Development

**Problem**: Orders are created with `status = 'pending'` but never updated to `'paid'` because Stripe webhooks don't work in local development without the Stripe CLI.

**Current Behavior**:
1. User places order → Creates order with `status = 'pending'`
2. User pays on Stripe → Payment succeeds
3. Webhook should fire → **DOESN'T FIRE** (no Stripe CLI running)
4. Order never marked as 'paid'
5. Grocery owner dashboard queries only 'paid' orders → Order is invisible

**Why This Happens**:
- Stripe can't send webhooks to `localhost` from the internet
- You need Stripe CLI to forward webhook events to your local server

**Solution**: See "How to Fix" section below

---

## How to Fix (Complete Steps)

### Step 1: Install Stripe CLI (One-time setup)

**macOS**:
```bash
brew install stripe/stripe-cli/stripe
```

**Windows**: Download from https://github.com/stripe/stripe-cli/releases/latest

**Linux**:
```bash
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_*_linux_x86_64.tar.gz
tar -xvf stripe_*_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin/
```

### Step 2: Use the Setup Script I Created

I've created a helpful script to automate this:

```bash
cd /Users/drissakande/Afro-Restaut
./setup-stripe-dev.sh
```

This script will:
1. Check if Stripe CLI is installed
2. Authenticate you with Stripe (if needed)
3. Start webhook forwarding
4. Display the webhook secret you need

### Step 3: Update Webhook Secret

After running the setup script, you'll see output like:
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx (^C to quit)
```

Copy that secret and update `backend/.env`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx  # Use the actual secret from Stripe CLI
```

### Step 4: Run Your Development Environment

You need **3 terminal windows**:

**Terminal 1 - Backend Server**:
```bash
cd /Users/drissakande/Afro-Restaut/backend
npm run dev
```

**Terminal 2 - Frontend**:
```bash
cd /Users/drissakande/Afro-Restaut/afro-eats
npm start
```

**Terminal 3 - Stripe Webhook Forwarding**:
```bash
cd /Users/drissakande/Afro-Restaut
./setup-stripe-dev.sh
```

Keep all 3 running while developing!

---

## Testing the Fix

### Test 1: Verify No Infinite Loop

1. Place a grocery order
2. Complete payment with test card: `4242 4242 4242 4242`
3. Check browser console (F12)
4. You should see:
   - ONE call to `/api/grocery/verify-session`
   - ONE call to `/api/grocery/orders/14`
   - NO repeated calls
   - NO "too many requests" error

✅ **Expected**: Success page loads, no infinite requests

### Test 2: Verify Order Shows in Dashboard

1. Place a grocery order (with Stripe CLI running)
2. Complete payment
3. Check Stripe CLI terminal - you should see:
   ```
   --> checkout.session.completed [evt_xxxxx]
   <-- [200] POST http://localhost:5001/api/webhooks/stripe
   ```
4. Check backend logs - you should see:
   ```
   ✅ Webhook received: checkout.session.completed
   🥬 Processing grocery order payment: 14
   ✅ Grocery order 14 marked as paid
   ```
5. Login as grocery owner
6. Go to Orders tab

✅ **Expected**: Order appears in the dashboard!

### Test 3: Verify Restaurant Orders

1. Add restaurant items to cart
2. Proceed to checkout
3. Complete payment
4. Check order appears in:
   - Customer's "My Orders"
   - Restaurant owner's dashboard
   - Admin dashboard

✅ **Expected**: Order visible in all dashboards

---

## What Was Fixed

### Files Modified:

1. **afro-eats/src/pages/OrderSuccess.js**
   - Fixed infinite loop in useEffect dependencies
   - Removed function dependencies that were causing re-renders

2. **backend/.env**
   - Updated FRONTEND_URL from port 3000 to 3002
   - Updated CLIENT_URL from port 3000 to 3002

3. **setup-stripe-dev.sh** (Created)
   - Helper script to set up Stripe CLI webhook forwarding
   - Automates the development environment setup

4. **GROCERY_ORDER_FIX_GUIDE.md** (Created)
   - Comprehensive guide explaining webhook issues
   - Step-by-step fix instructions
   - Troubleshooting section

---

## Understanding the Complete Flow

### Before Fix:
```
1. User places order
2. Order created with status='pending'
3. User pays on Stripe
4. Infinite loop starts on success page ❌
5. Browser rate limits → app crashes ❌
6. Webhook never fires (no Stripe CLI) ❌
7. Order stays 'pending' forever ❌
8. Order invisible to grocery owner ❌
```

### After Fix:
```
1. User places order
2. Order created with status='pending'
3. User pays on Stripe
4. Success page loads ONCE ✅
5. Stripe CLI forwards webhook to localhost ✅
6. Webhook marks order as 'paid' ✅
7. Email notifications sent ✅
8. Order visible to grocery owner ✅
```

---

## Common Issues and Solutions

### Issue 1: "Still getting infinite loop"
**Solution**:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh the page (Ctrl+Shift+R)
3. Rebuild frontend: `npm run build`

### Issue 2: "Orders still not showing"
**Check**:
1. Is Stripe CLI running? (Terminal 3)
2. Did you update STRIPE_WEBHOOK_SECRET in .env?
3. Did you restart backend server after updating .env?
4. Check backend logs for webhook events

### Issue 3: "Stripe CLI says webhook failed"
**Check**:
1. Backend server is running on port 5001
2. Webhook URL in Stripe CLI is correct: `localhost:5001/api/webhooks/stripe`
3. Check backend logs for errors

### Issue 4: "Can't access localhost:5001"
**Solution**:
```bash
# Test if backend is accessible
curl http://localhost:5001/api/health

# Should return:
# {"status":"healthy"}
```

---

## For Production Deployment

When deploying to production, you DON'T need Stripe CLI:

1. **Configure webhook in Stripe Dashboard**:
   - Go to https://dashboard.stripe.com/webhooks
   - Click "+ Add endpoint"
   - URL: `https://api.orderdabaly.com/api/webhooks/stripe`
   - Select event: `checkout.session.completed`
   - Copy the signing secret

2. **Update production .env**:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_production_secret_here
   FRONTEND_URL=https://orderdabaly.com
   ```

3. **Use live Stripe keys**:
   ```bash
   STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
   STRIPE_SECRET_KEY=sk_live_xxxxx
   ```

---

## Quick Diagnostic Commands

### Check if orders are being created:
```bash
# From your database client:
SELECT id, user_id, guest_email, status, total, created_at
FROM grocery_orders
ORDER BY created_at DESC
LIMIT 10;
```

### Check restaurant orders:
```bash
SELECT id, user_id, status, total, created_at
FROM orders
ORDER BY created_at DESC
LIMIT 10;
```

### Manually mark order as paid (for testing):
```bash
UPDATE grocery_orders
SET status = 'paid', paid_at = NOW()
WHERE id = ORDER_ID_HERE;
```

---

## Summary of Changes

| File | Change | Status |
|------|--------|--------|
| `afro-eats/src/pages/OrderSuccess.js` | Fixed infinite loop | ✅ Fixed |
| `backend/.env` | Updated FRONTEND_URL to 3002 | ✅ Fixed |
| `backend/.env` | Updated CLIENT_URL to 3002 | ✅ Fixed |
| `setup-stripe-dev.sh` | Created helper script | ✅ Created |
| Stripe Webhooks | Need Stripe CLI running | ⚠️ Manual Setup Required |

---

## Next Steps

1. ✅ Rebuild frontend (changes already applied to OrderSuccess.js)
2. ✅ Restart backend server (to pick up .env changes)
3. ⚠️ **YOU NEED TO DO**: Install and run Stripe CLI (see Step 1-4 above)
4. ⚠️ **YOU NEED TO DO**: Update STRIPE_WEBHOOK_SECRET in .env with value from Stripe CLI
5. ⚠️ **YOU NEED TO DO**: Test placing an order

---

**Last Updated**: April 26, 2026
**Issue**: Orders disappearing & infinite loop crash
**Status**: Partially fixed (infinite loop ✅), webhook setup pending (⚠️)
