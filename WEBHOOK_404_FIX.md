# Webhook 404 Error - FIXED ✅

## Problem
Stripe webhook was getting 404 errors:
```
--> checkout.session.completed [evt_xxx]
<-- [404] POST http://localhost:5001/api/webhooks/stripe [evt_xxx]
```

## Root Cause
- Stripe CLI was sending webhooks to: `/api/webhooks/stripe` (with 's')
- Backend route was configured at: `/api/webhook` (no 's')
- Route mismatch = 404 error

## Fix Applied

### 1. Updated webhook routes (`backend/routes/webhook.js`)
Added support for both routes:
- `/api/webhook` (original)
- `/api/webhooks/stripe` (Stripe CLI default) ✅

### 2. Updated body parser skip logic (`backend/server.js`)
Added new route to skip list so Stripe can verify signatures

## What You Need to Do Now

### Step 1: Restart Backend Server
The backend needs to reload with the new routes:

```bash
# Stop the backend (Ctrl+C in Terminal 1)
# Then restart:
cd /Users/drissakande/Afro-Restaut/backend
npm run dev
```

### Step 2: Keep Stripe CLI Running
No changes needed in Terminal 3 - keep it running

### Step 3: Test Again
Place a new order and check Terminal 3. You should now see:

✅ **Before (404 errors)**:
```
--> checkout.session.completed [evt_xxx]
<-- [404] POST http://localhost:5001/api/webhooks/stripe
```

✅ **After (200 success)**:
```
--> checkout.session.completed [evt_xxx]
<-- [200] POST http://localhost:5001/api/webhooks/stripe
```

## Expected Flow After Fix

1. User places order
2. Stripe processes payment
3. Stripe CLI forwards webhook to `/api/webhooks/stripe`
4. Backend receives webhook → **200 OK** ✅
5. Webhook handler updates order status to 'paid'
6. Order appears in grocery owner dashboard ✅

## Files Modified
- ✅ `backend/routes/webhook.js` - Added `/webhooks/stripe` route
- ✅ `backend/server.js` - Added route to body parser skip list

## Quick Test Commands

### Check if webhook route exists:
```bash
curl -X POST http://localhost:5001/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

Should return 400 (signature error) NOT 404

### Check backend logs:
After placing an order, look for:
```
✅ Webhook received: checkout.session.completed
🥬 Processing grocery order payment: [order_id]
✅ Grocery order [order_id] marked as paid
```

---

**Status**: ✅ Fixed
**Action Required**: Restart backend server
**Expected Result**: Webhooks will return 200 instead of 404
