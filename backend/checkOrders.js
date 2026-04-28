import pool from './db.js';

async function checkOrders() {
  try {
    console.log('=== CHECKING RECENT ORDERS ===\n');

    // Check grocery orders
    console.log('1. Recent Grocery Orders:');
    const groceryOrders = await pool.query(`
      SELECT id, user_id, guest_email, status, total,
             stripe_session_id, stripe_payment_intent,
             paid_at, created_at
      FROM grocery_orders
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (groceryOrders.rows.length === 0) {
      console.log('   ❌ No grocery orders found\n');
    } else {
      groceryOrders.rows.forEach(order => {
        console.log(`   Order #${order.id}:`);
        console.log(`   - Status: ${order.status}`);
        console.log(`   - Total: $${order.total}`);
        console.log(`   - User: ${order.user_id || 'Guest (' + order.guest_email + ')'}`);
        console.log(`   - Created: ${order.created_at}`);
        console.log(`   - Paid At: ${order.paid_at || 'Not paid yet'}`);
        console.log(`   - Stripe Session: ${order.stripe_session_id || 'None'}`);
        console.log(`   - Payment Intent: ${order.stripe_payment_intent || 'None'}\n`);
      });
    }

    // Check pending orders
    console.log('2. Pending Grocery Orders (should be empty after webhook):');
    const pendingOrders = await pool.query(`
      SELECT id, status, total, created_at
      FROM grocery_orders
      WHERE status = 'pending'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (pendingOrders.rows.length === 0) {
      console.log('   ✅ No pending orders (good!)\n');
    } else {
      console.log(`   ⚠️  Found ${pendingOrders.rows.length} pending orders:\n`);
      pendingOrders.rows.forEach(order => {
        console.log(`   - Order #${order.id}: $${order.total} (created ${order.created_at})`);
      });
      console.log('');
    }

    // Check paid orders
    console.log('3. Paid Grocery Orders (should show after webhook):');
    const paidOrders = await pool.query(`
      SELECT id, status, total, paid_at, created_at
      FROM grocery_orders
      WHERE status = 'paid'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (paidOrders.rows.length === 0) {
      console.log('   ❌ No paid orders found\n');
    } else {
      console.log(`   ✅ Found ${paidOrders.rows.length} paid orders:\n`);
      paidOrders.rows.forEach(order => {
        console.log(`   - Order #${order.id}: $${order.total}`);
        console.log(`     Created: ${order.created_at}`);
        console.log(`     Paid: ${order.paid_at}\n`);
      });
    }

    // Check grocery order items
    console.log('4. Recent Grocery Order Items:');
    const orderItems = await pool.query(`
      SELECT goi.grocery_order_id, goi.product_id, goi.quantity,
             p.name as product_name, p.store_id
      FROM grocery_order_items goi
      LEFT JOIN products p ON goi.product_id = p.id
      ORDER BY goi.id DESC
      LIMIT 10
    `);

    if (orderItems.rows.length === 0) {
      console.log('   ❌ No order items found\n');
    } else {
      console.log(`   Found ${orderItems.rows.length} items:\n`);
      orderItems.rows.forEach(item => {
        console.log(`   - Order #${item.grocery_order_id}: ${item.product_name || 'Unknown'} (x${item.quantity})`);
        console.log(`     Store ID: ${item.store_id || 'Missing!'}\n`);
      });
    }

    // Check grocery owners
    console.log('5. Grocery Store Owners:');
    const owners = await pool.query(`
      SELECT id, name, email
      FROM grocery_store_owners
      LIMIT 5
    `);

    if (owners.rows.length === 0) {
      console.log('   ❌ No grocery owners found\n');
    } else {
      owners.rows.forEach(owner => {
        console.log(`   - Owner #${owner.id}: ${owner.name} (${owner.email})`);
      });
      console.log('');
    }

    console.log('=== CHECK COMPLETE ===\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkOrders();
