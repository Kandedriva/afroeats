# Quick Start - New Grocery System

## What This Does

Redesigns the grocery order system to work exactly like restaurant orders:
- ✅ Database-backed cart (not localStorage)
- ✅ Requires authentication (no guest checkout)
- ✅ Orders route to correct grocery owners
- ✅ Cart persists through page refreshes

## Setup (3 Steps)

### Step 1: Run Migration
```bash
cd /Users/drissakande/Afro-Restaut/backend
node runGroceryCartSystemMigration.js
```

**Expected Output**:
```
=== RUNNING GROCERY CART SYSTEM MIGRATION ===

📄 Migration file loaded
🔧 Applying grocery cart system migration...

✅ Migration completed successfully!

🔍 Verifying new tables...
Tables found:
  ✅ grocery_carts
  ✅ grocery_orders

📋 Grocery Carts Table Structure:
  - id: integer (nullable: NO)
  - user_id: integer (nullable: NO)
  - product_id: integer (nullable: NO)
  - quantity: integer (nullable: NO)
  - created_at: timestamp (nullable: YES)
  - updated_at: timestamp (nullable: YES)

=== MIGRATION SUMMARY ===

Changes Applied:
  ✅ Created grocery_carts table (database-backed cart)
  ✅ Made user_id NOT NULL in grocery_orders (auth required)
  ✅ Removed guest_email column (no guest checkout)
  ✅ Ensured products.store_id exists (order routing)
  ✅ Added auto-update timestamp trigger
  ✅ Assigned products to stores

🎉 GROCERY SYSTEM REDESIGN COMPLETE!
```

### Step 2: Restart Backend
```bash
# In your backend terminal, press Ctrl+C
# Then restart:
npm start
```

### Step 3: Clear Browser Data
```
1. Open browser DevTools (F12)
2. Go to Application tab
3. Clear localStorage (left sidebar → Local Storage → Clear All)
4. Refresh page (Cmd+R or Ctrl+R)
```

## Test It Works

### Test 1: Add to Cart
```
1. Login as user
2. Go to marketplace
3. Click on a product
4. Click "Add to Cart"
5. Expected: ✅ "Added to cart" message
6. Cart icon shows item count
```

### Test 2: Cart Persists
```
1. Add items to cart
2. Refresh the page (F5)
3. Check cart icon
4. Expected: ✅ Items still in cart
```

### Test 3: Checkout
```
1. Go to cart
2. Click "Proceed to Checkout"
3. Fill in delivery info
4. Calculate delivery fee
5. Click "Proceed to Payment"
6. Expected: ✅ Redirects to Stripe
```

### Test 4: Complete Order
```
1. On Stripe page, use test card: 4242 4242 4242 4242
2. Complete payment
3. Expected: ✅ Redirects to order success page
4. Cart is cleared
5. Order shows in "My Orders"
```

### Test 5: Owner Dashboard
```
1. Login as grocery owner
2. Go to Orders tab
3. Expected: ✅ See the order you just placed
```

## What If It Doesn't Work?

### Problem: "Please log in to add items to cart"
✅ This is correct! Users must login (like restaurant orders)
**Action**: Login first, then add to cart

### Problem: Migration fails with "column does not exist"
**Action**: The old migration files might conflict. Run:
```bash
node runGroceryCartSystemMigration.js --force
```

### Problem: Cart still empty after refresh
**Action**:
1. Check browser console for errors
2. Make sure you're logged in
3. Clear localStorage and try again
4. Check backend terminal for API errors

### Problem: 500 error creating order
**Action**: Check backend terminal for exact error:
```bash
# Look for lines like:
error: column "guest_email" does not exist
```
Then re-run migration.

### Problem: Orders don't show in owner dashboard
**Action**: Products need store_id:
```sql
-- Connect to database and run:
UPDATE products
SET store_id = (SELECT id FROM grocery_stores LIMIT 1)
WHERE store_id IS NULL;
```

## Key Differences from Before

| Before | After |
|--------|-------|
| Cart in localStorage | Cart in database ✅ |
| Guest checkout | Must login ✅ |
| Cart disappears | Cart persists ✅ |
| 500 errors | Works reliably ✅ |
| Orders lost | Routes to owners ✅ |

## Important Notes

1. **Authentication Required**: Users MUST login to:
   - Add items to cart
   - View cart
   - Checkout
   - Place orders

2. **No Guest Checkout**: Grocery orders now work exactly like restaurant orders

3. **Cart is Server-Side**: Cart stored in database, syncs across devices

4. **Clear Old Data**: Old localStorage cart data is ignored

## Files Changed

### Backend
- `backend/migrations/create_grocery_cart_system_v2.sql` (NEW)
- `backend/routes/groceryCartRoutes.js` (NEW)
- `backend/runGroceryCartSystemMigration.js` (NEW)
- `backend/server.js` (MODIFIED - added cart routes)

### Frontend
- `afro-eats/src/context/GroceryCartContext.js` (REWRITTEN)
- `afro-eats/src/pages/GroceryCheckout.js` (MODIFIED - requires auth)

## Quick Commands

```bash
# 1. Run migration
cd backend && node runGroceryCartSystemMigration.js

# 2. Restart backend
# Press Ctrl+C, then:
npm start

# 3. Clear localStorage
# Open browser DevTools (F12) → Application → Clear Storage

# 4. Test
# Login → Add to cart → Refresh → Cart still there ✅
```

## Success Criteria

After setup, you should be able to:
- ✅ Login and add products to cart
- ✅ See cart persist through page refresh
- ✅ Complete checkout without errors
- ✅ See orders in grocery owner dashboard
- ✅ No more "cart is empty" issues

## Get Help

If you encounter issues:
1. Check backend terminal for errors
2. Check browser console for errors
3. Verify migration completed successfully
4. Make sure you're logged in
5. Clear browser data and try again

---

**TL;DR**:
1. `node runGroceryCartSystemMigration.js`
2. Restart backend
3. Clear browser localStorage
4. Login and test!

🎉 Grocery system now matches restaurant system!
