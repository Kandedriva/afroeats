# Manual Database Fix for Grocery Orders

## The 500 Error You're Seeing

```
POST http://localhost:5001/api/grocery/create-order 500 (Internal Server Error)
Failed to create order
```

This happens because the database table `grocery_orders` doesn't allow NULL values for `user_id`, but the code tries to insert NULL for guest orders.

## What You Need to See in Backend Logs

Look at your **backend terminal** when you try to place an order. You should see one of these errors:

**Error 1: Column doesn't exist**
```
error: column "guest_email" of relation "grocery_orders" does not exist
```

**Error 2: NULL constraint violation**
```
error: null value in column "user_id" violates not-null constraint
```

## Fix Option 1: Run the Scripts (Recommended)

Open a **new terminal** and run:

```bash
# Terminal 1 - Check status
cd /Users/drissakande/Afro-Restaut/backend
npm run diagnose
# OR manually:
node quickDbCheck.js

# Terminal 2 - Fix everything
node diagnoseAndFixOrderSystem.js
```

After running, **restart your backend server** (stop with Ctrl+C, then `npm start` again).

## Fix Option 2: Manual SQL (If Scripts Don't Work)

If the Node scripts aren't working, connect directly to your database:

### Step 1: Connect to Database

```bash
# Check your backend/.env file for DATABASE_URL
cat backend/.env | grep DATABASE_URL

# Connect with psql (replace with your actual connection string)
psql "your_database_connection_string"
```

### Step 2: Run These SQL Commands

```sql
-- 1. Make user_id nullable (allows guest orders)
ALTER TABLE grocery_orders
ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add guest_email column (if it doesn't exist)
ALTER TABLE grocery_orders
ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255);

-- 3. Add constraint (either user OR guest, not both)
ALTER TABLE grocery_orders
DROP CONSTRAINT IF EXISTS user_or_guest_required;

ALTER TABLE grocery_orders
ADD CONSTRAINT user_or_guest_required
CHECK (
  (user_id IS NOT NULL AND guest_email IS NULL) OR
  (user_id IS NULL AND guest_email IS NOT NULL)
);

-- 4. Add index for performance
CREATE INDEX IF NOT EXISTS idx_grocery_orders_guest_email
ON grocery_orders(guest_email);

-- 5. Verify changes
\d grocery_orders
```

### Step 3: Fix Product Assignments

```sql
-- Check if products have store_id
SELECT COUNT(*) as without_store
FROM products
WHERE store_id IS NULL;

-- If count > 0, assign products to first store
UPDATE products
SET store_id = (SELECT id FROM grocery_stores ORDER BY id LIMIT 1)
WHERE store_id IS NULL;

-- Verify
SELECT COUNT(*) as without_store
FROM products
WHERE store_id IS NULL;
-- Should return 0
```

### Step 4: Verify Everything

```sql
-- Check table structure
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'grocery_orders'
  AND column_name IN ('user_id', 'guest_email')
ORDER BY column_name;

-- Expected output:
-- guest_email | character varying | YES
-- user_id     | integer          | YES
```

## Fix Option 3: Using Supabase Dashboard

If you're using Supabase:

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in left menu
4. Paste the SQL from "Fix Option 2" above
5. Click "Run"
6. Restart your backend server

## After Applying the Fix

1. **Restart backend server**: Stop (Ctrl+C) and start (`npm start`)
2. **Clear browser cache**: Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
3. **Try order again**:
   - Add items to cart
   - Go to checkout
   - Fill in info
   - Click "Proceed to Payment"
   - Should redirect to Stripe (no 500 error!)

## About the Cart Emptying Issue

The cart emptying on refresh is likely because:

1. **localStorage is being cleared** - Check browser dev tools → Application → Local Storage
2. **User ID is changing** - Cart key is based on user ID: `groceryCart_${user.id}`
3. **Auth state is resetting** - User logs out/in causing cart key change

To debug:

```javascript
// Open browser console and check:
localStorage.getItem('groceryCart_guest')  // For guest
localStorage.getItem('groceryCart_24')     // For user with ID 24

// See all cart keys:
Object.keys(localStorage).filter(k => k.startsWith('groceryCart'))
```

The cart should persist through refresh. If it doesn't:
- Check if you're switching between logged in/out states
- Check if localStorage is being cleared by an extension
- Check browser console for any errors related to localStorage

## Verification Checklist

After applying fixes, verify:

- [ ] Backend terminal shows no errors when creating order
- [ ] POST to `/api/grocery/create-order` returns 200 (not 500)
- [ ] Response includes `sessionUrl` and `orderId`
- [ ] Browser redirects to Stripe checkout page
- [ ] Cart items stay in localStorage after refresh

## Still Not Working?

Share these with me:

1. **Exact error from backend terminal** (not browser console)
2. **Output of this SQL query**:
   ```sql
   \d grocery_orders
   ```
3. **Browser console full error** (expand the error in console)
4. **Browser Network tab**: Click the failed request, show "Response" tab

This will help identify the exact issue.

---

**Quick Fix Commands**:
```bash
# Check
cd backend && node quickDbCheck.js

# Fix
node diagnoseAndFixOrderSystem.js

# Restart
# Press Ctrl+C then npm start
```
