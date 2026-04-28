# Fix Guest Checkout - Quick Start

## The Problem
Guest grocery orders fail with "Failed to create order" (500 error).

## The Fix (2 Minutes)

### Run This Command:
```bash
cd /Users/drissakande/Afro-Restaut/backend
node runGuestSupportMigration.js
```

### Expected Output:
```
=== Running Guest Support Migration ===
✅ Migration completed successfully!
```

## That's It!

Guest checkout should now work. Test it:
1. Open incognito browser
2. Go to marketplace (don't login)
3. Add products to cart
4. Checkout as guest
5. Pay with `4242 4242 4242 4242`
6. ✅ Should work!

## What This Does

Makes the database allow guest orders by:
- Making `user_id` nullable
- Adding `guest_email` column
- Adding proper constraints

## If It Fails

Check if migration already ran:
```sql
\d grocery_orders
```

Look for `guest_email` column. If it exists, migration already ran.

---

**TL;DR**: Run `node runGuestSupportMigration.js` in backend folder
