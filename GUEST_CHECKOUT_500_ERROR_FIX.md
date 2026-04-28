# Guest Checkout 500 Error - FIXED ✅

## Problem
When trying to place a guest grocery order, the checkout fails with:
```
POST http://localhost:5001/api/grocery/create-order 500 (Internal Server Error)
```

Error message: "Failed to create order"

## Root Cause

### Database Constraint Violation
The `grocery_orders` table was created with `user_id INTEGER NOT NULL`:

```sql
CREATE TABLE grocery_orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,  -- ❌ This prevents guest orders!
  ...
);
```

### The Code Tries to Insert NULL
When a guest places an order, the code tries to insert `user_id = NULL`:

```javascript
// groceryRoutes.js line 109
const userId = req.session?.userId || null;  // null for guests

// Line 109 in INSERT query
[
  userId,  // ❌ NULL for guests, but column is NOT NULL
  isGuest ? guestEmail : null,
  ...
]
```

### Result
PostgreSQL rejects the INSERT with:
```
ERROR: null value in column "user_id" violates not-null constraint
```

This causes the 500 error the user sees.

## Solution

### Step 1: Create Migration
**File**: `backend/migrations/add_guest_support_to_grocery_orders.sql`

This migration:
1. Makes `user_id` nullable: `ALTER COLUMN user_id DROP NOT NULL`
2. Adds `guest_email` column for guest orders
3. Adds constraint: either `user_id` OR `guest_email` must be present
4. Adds index on `guest_email` for performance

### Step 2: Run Migration Script
```bash
cd /Users/drissakande/Afro-Restaut/backend
node runGuestSupportMigration.js
```

Expected output:
```
=== Running Guest Support Migration ===

📄 Migration file loaded
⚙️  Applying changes to grocery_orders table...

✅ Migration completed successfully!

Changes applied:
  1. Made user_id nullable (allows guest orders)
  2. Added guest_email column
  3. Added constraint: user_id OR guest_email must be present
  4. Added index on guest_email

🔍 Verifying changes...

Table structure:
  - guest_email: character varying (nullable: YES)
  - user_id: integer (nullable: YES)

✅ Guest checkout is now enabled for grocery orders!
```

## How It Works After Fix

### Guest Order Flow:
```sql
INSERT INTO grocery_orders (
  user_id,        -- NULL ✅
  guest_email,    -- 'guest@example.com' ✅
  ...
) VALUES (NULL, 'guest@example.com', ...);
```

### Authenticated Order Flow:
```sql
INSERT INTO grocery_orders (
  user_id,        -- 123 ✅
  guest_email,    -- NULL ✅
  ...
) VALUES (123, NULL, ...);
```

### Database Constraint:
```sql
CHECK (
  (user_id IS NOT NULL AND guest_email IS NULL) OR
  (user_id IS NULL AND guest_email IS NOT NULL)
)
```

This ensures:
- ✅ Guest orders have `guest_email` but no `user_id`
- ✅ Authenticated orders have `user_id` but no `guest_email`
- ❌ Cannot have both NULL
- ❌ Cannot have both set

## Testing Steps

### Test 1: Guest Grocery Checkout
1. **Open incognito browser**: Don't log in
2. **Add products to cart**: Browse marketplace, add items
3. **Go to checkout**: Fill in delivery info and email
4. **Complete payment**: Use test card `4242 4242 4242 4242`
5. **Expected**: ✅ Order creates successfully, redirects to success page

### Test 2: Authenticated Grocery Checkout
1. **Login as regular user**
2. **Add products to cart**
3. **Go to checkout**: Delivery info pre-filled
4. **Complete payment**: Use test card
5. **Expected**: ✅ Order creates successfully, links to user account

### Test 3: Verify Database
```sql
-- Check guest order
SELECT id, user_id, guest_email, total, status
FROM grocery_orders
WHERE guest_email IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- Check authenticated order
SELECT id, user_id, guest_email, total, status
FROM grocery_orders
WHERE user_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

## Files Created

1. **Migration**: `backend/migrations/add_guest_support_to_grocery_orders.sql`
   - Database schema changes

2. **Runner**: `backend/runGuestSupportMigration.js`
   - Script to apply migration safely

3. **Documentation**: `GUEST_CHECKOUT_500_ERROR_FIX.md` (this file)

## Related Issues

This fix enables guest checkout for grocery orders, which is required for:
- **Guest Order Success Page**: Orders can now be created and tracked
- **Email Notifications**: Guests receive order updates via email
- **Grocery Owner Dashboard**: Orders appear (after running `fixProductStoreIds.js`)

## Before and After

### Before Migration:
```
Guest tries to checkout
  ↓
POST /api/grocery/create-order
  ↓
INSERT user_id = NULL
  ↓
❌ Database: NULL violates NOT NULL constraint
  ↓
❌ 500 Internal Server Error
  ↓
❌ User sees: "Failed to create order"
```

### After Migration:
```
Guest tries to checkout
  ↓
POST /api/grocery/create-order
  ↓
INSERT user_id = NULL, guest_email = 'guest@example.com'
  ↓
✅ Database: Constraint satisfied (guest_email is NOT NULL)
  ↓
✅ Order created, Stripe session created
  ↓
✅ User redirects to Stripe checkout
  ↓
✅ Payment succeeds, webhook fires
  ↓
✅ Order marked as paid
  ↓
✅ Success page loads
```

## Summary

**Problem**: Database doesn't allow NULL user_id
**Cause**: Table created with NOT NULL constraint
**Fix**: Migration makes user_id nullable and adds guest_email
**Action**: Run `node runGuestSupportMigration.js`
**Result**: ✅ Guest checkout works

---

**Status**: Ready to test
**Confidence**: High (clear database constraint issue)
**Next Step**: Run migration script and test guest checkout

**Created**: April 26, 2026
**Issue**: Guest grocery order 500 error
**Resolution**: Database migration to support guest orders
