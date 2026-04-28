# Testing Guest Order Fix

## Quick Test Guide

### Prerequisites
1. Start backend server: `cd backend && npm start`
2. Start frontend: `cd afro-eats && npm start`
3. Start Stripe webhooks: `./start-stripe-webhooks.sh` (in backend folder)

### Test Case: Guest Grocery Order

**Step 1: Browse as Guest**
- Open browser in incognito/private mode
- Go to `http://localhost:3002`
- **DO NOT LOG IN**

**Step 2: Add Products to Cart**
- Browse marketplace products
- Click on any product
- Add to cart
- Add 2-3 different products

**Step 3: Go to Checkout**
- Click cart icon
- Click "Proceed to Checkout"
- You should see checkout page

**Step 4: Fill Delivery Info**
- Enter test email: `test@example.com`
- Enter delivery name, address, city, etc.
- Click "Proceed to Payment"

**Step 5: Complete Payment**
- Use Stripe test card: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., `12/30`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)
- Click "Pay"

**Step 6: Verify Success Page**
✅ **EXPECTED**: Success page loads with:
- Green checkmark
- "Order Confirmed!" message
- Order number displayed
- Order details (or minimal success message)
- "Continue Shopping" button works

❌ **NOT EXPECTED**:
- Page crash
- Chrome error message
- Blank page
- Infinite loading

### What to Look For

**In Browser Console** (F12):
- ✅ No `chrome-error://chromewebdata/` errors
- ✅ No infinite API call loops
- ⚠️ Some 401 errors are OK (navbar trying to fetch grocery owner data)

**In Backend Terminal**:
- ✅ Should see: `POST /api/grocery/checkout/guest`
- ✅ Should see: `GET /api/grocery/verify-session?session_id=...`
- ✅ May see: `GET /api/grocery-owners/orders - 401` (this is OK, navbar trying to fetch)

**In Stripe Webhook Terminal**:
- ✅ Should see: `checkout.session.completed [evt_...]`
- ✅ Should see: `<-- [200] POST http://localhost:5001/api/webhooks/stripe`

### Success Criteria

The fix is working if:
1. ✅ Page doesn't crash
2. ✅ User sees success message (full details or minimal)
3. ✅ User can click buttons and navigate
4. ✅ No chrome-error:// in console

The fix is PERFECT if:
1. ✅ Page shows full order details
2. ✅ All buttons work
3. ✅ Cart is cleared
4. ✅ User can continue shopping

## Troubleshooting

### If Page Still Crashes
1. Check browser console for exact error
2. Check if all contexts are properly provided in App.js
3. Verify ErrorBoundary and OrderSuccessWrapper are imported correctly
4. Make sure you restarted the frontend after changes

### If Webhooks Show 404
- Run: `./start-stripe-webhooks.sh` again
- Make sure webhook secret is in backend/.env
- Check backend terminal for webhook logs

### If Orders Don't Show in Dashboard
- Run: `node backend/fixProductStoreIds.js`
- This assigns products to stores so orders appear

## Alternative: Test with Demo Mode

If you want to test without Stripe:

1. Add `?demo=true` to checkout URL
2. Skip payment step
3. Should still load success page
4. Order won't be in database (it's demo mode)

---

**Quick Test Command**:
```bash
# Terminal 1: Backend
cd /Users/drissakande/Afro-Restaut/backend && npm start

# Terminal 2: Frontend
cd /Users/drissakande/Afro-Restaut/afro-eats && npm start

# Terminal 3: Webhooks
cd /Users/drissakande/Afro-Restaut/backend && ./start-stripe-webhooks.sh
```

Then test in browser as guest user.
