# Debug Steps for Grocery Order 500 Error

## Step 1: Check What the Backend Is Actually Saying

The **browser console** shows:
```
POST http://localhost:5001/api/grocery/create-order 500 (Internal Server Error)
```

But this doesn't tell us the **real error**. You need to look at your **backend terminal** (where you ran `npm start`).

## What to Look For in Backend Terminal

When you try to place an order, the backend terminal will show the **actual error**. Look for one of these:

### Error Type A: Column Doesn't Exist
```
error: column "guest_email" of relation "grocery_orders" does not exist
    at Parser.parseErrorMessage (...)
```
**Solution**: Run `node diagnoseAndFixOrderSystem.js`

### Error Type B: NULL Constraint Violation
```
error: null value in column "user_id" violates not-null constraint
DETAIL: Failing row contains (32, null, 45.99, 2.30, 5.00, 53.29, ...)
```
**Solution**: Run SQL to make `user_id` nullable

### Error Type C: Foreign Key Violation
```
error: insert or update on table "grocery_order_items" violates foreign key constraint
DETAIL: Key (product_id)=(15) is not present in table "products"
```
**Solution**: Check if products exist in database

### Error Type D: Stripe Error
```
Error: No such customer: 'cus_xxx'
    at Stripe.request (...)
```
**Solution**: Check Stripe API key in `.env`

### Error Type E: Connection Timeout
```
Error: connect ETIMEDOUT
    at TCPConnectWrap.afterConnect
```
**Solution**: Check DATABASE_URL connection string

## Step 2: Copy the EXACT Error

1. Go to your **backend terminal** (where you see `Server running on port 5001`)
2. Try to place an order
3. **Copy the full error message** that appears
4. Share it with me

## Step 3: Quick Tests You Can Run

### Test 1: Check Database Connection
```bash
cd /Users/drissakande/Afro-Restaut/backend

# This will either work or show connection error:
node -e "import('./db.js').then(m => m.default.query('SELECT NOW()')).then(r => console.log('✅ Connected:', r.rows[0])).catch(e => console.log('❌ Error:', e.message))"
```

### Test 2: Check Table Structure
```bash
# Check if you can connect to database
node quickDbCheck.js
```

Expected output if broken:
```
=== QUICK DATABASE CHECK ===

1. Checking grocery_orders.user_id...
   user_id nullable: NO          ❌

2. Checking grocery_orders.guest_email...
   guest_email exists: NO        ❌
```

### Test 3: Check Environment Variables
```bash
cd /Users/drissakande/Afro-Restaut/backend

# Check if Stripe key is set
echo "STRIPE_SECRET_KEY exists: $(grep -c STRIPE_SECRET_KEY .env)"

# Check if DATABASE_URL is set
echo "DATABASE_URL exists: $(grep -c DATABASE_URL .env)"
```

## Step 4: Enable Verbose Logging

Edit `backend/routes/groceryRoutes.js` and add detailed logging:

Find this line (around line 214):
```javascript
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create grocery order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  } finally {
```

Change it to:
```javascript
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create grocery order error:', err);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      constraint: err.constraint,
      table: err.table,
      column: err.column
    });
    res.status(500).json({ error: 'Failed to create order', details: err.message });
  } finally {
```

Save the file, restart backend, and try again. The error will now show more details.

## Step 5: Test with Simple Data

Create a test file `backend/testOrderCreation.js`:

```javascript
import pool from './db.js';

async function testOrder() {
  const client = await pool.connect();

  try {
    console.log('Testing order creation...\n');

    await client.query('BEGIN');

    const result = await client.query(`
      INSERT INTO grocery_orders (
        user_id, guest_email, subtotal, platform_fee, delivery_fee, total,
        delivery_address, delivery_city, delivery_state, delivery_zip,
        delivery_phone, delivery_name, notes, distance_miles, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending', NOW())
      RETURNING id
    `, [
      null,                    // user_id (NULL for guest)
      'test@example.com',      // guest_email
      45.99,                   // subtotal
      2.30,                    // platform_fee
      5.00,                    // delivery_fee
      53.29,                   // total
      '123 Test St',           // delivery_address
      'New York',              // delivery_city
      'NY',                    // delivery_state
      '10001',                 // delivery_zip
      '555-1234',              // delivery_phone
      'Test User',             // delivery_name
      null,                    // notes
      5.2                      // distance_miles
    ]);

    console.log('✅ SUCCESS! Order ID:', result.rows[0].id);

    await client.query('ROLLBACK'); // Don't actually save test order

  } catch (error) {
    await client.query('ROLLBACK');
    console.log('❌ FAILED!');
    console.log('Error:', error.message);
    console.log('Code:', error.code);
    console.log('Detail:', error.detail);
    console.log('Constraint:', error.constraint);
  } finally {
    client.release();
    process.exit(0);
  }
}

testOrder();
```

Run it:
```bash
node backend/testOrderCreation.js
```

This will tell you exactly what's wrong with the database.

## Common Fixes

### If you see "column guest_email does not exist":
```bash
node backend/diagnoseAndFixOrderSystem.js
```

### If you see "null value in column user_id violates not-null constraint":
```sql
ALTER TABLE grocery_orders ALTER COLUMN user_id DROP NOT NULL;
```

### If you see "no pg_hba.conf entry for host":
Check your DATABASE_URL in `.env` - connection string might be wrong

## Most Likely Issue

Based on your error, the most likely problem is:
1. The database migration didn't run
2. `user_id` is still NOT NULL
3. `guest_email` column doesn't exist

**Quick fix**:
```bash
cd backend
node diagnoseAndFixOrderSystem.js
# Then restart backend server
```

---

Please share:
1. What you see in **backend terminal** when order fails
2. Output of `node quickDbCheck.js`
3. Any error messages with full details
