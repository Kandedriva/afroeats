import pool from './db.js';

async function diagnoseOrders() {
  try {
    console.log('=== GROCERY ORDERS DIAGNOSIS ===\n');

    // Check recent grocery orders
    console.log('1. Recent Grocery Orders:');
    const ordersResult = await pool.query(`
      SELECT
        id, user_id, guest_email, status,
        total, paid_at, stripe_session_id,
        stripe_payment_intent, created_at
      FROM grocery_orders
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log(`Found ${ordersResult.rows.length} orders:`);
    ordersResult.rows.forEach(order => {
      console.log(`  - Order #${order.id}: ${order.status} | Total: $${order.total} | Created: ${order.created_at}`);
      console.log(`    User ID: ${order.user_id || 'Guest'} | Email: ${order.guest_email || 'N/A'}`);
      console.log(`    Stripe Session: ${order.stripe_session_id || 'N/A'}`);
      console.log(`    Payment Intent: ${order.stripe_payment_intent || 'N/A'}`);
      console.log(`    Paid At: ${order.paid_at || 'Not paid yet'}\n`);
    });

    // Check grocery order items
    console.log('\n2. Recent Grocery Order Items:');
    const itemsResult = await pool.query(`
      SELECT
        goi.id, goi.grocery_order_id, goi.product_id,
        goi.quantity, goi.unit_price, goi.total_price,
        p.name as product_name, p.store_id
      FROM grocery_order_items goi
      LEFT JOIN products p ON goi.product_id = p.id
      ORDER BY goi.id DESC
      LIMIT 20
    `);

    console.log(`Found ${itemsResult.rows.length} order items:`);
    itemsResult.rows.forEach(item => {
      console.log(`  - Item #${item.id}: Order #${item.grocery_order_id} | ${item.product_name || 'Unknown'}`);
      console.log(`    Qty: ${item.quantity} | Price: $${item.unit_price} | Total: $${item.total_price}`);
      console.log(`    Product ID: ${item.product_id} | Store ID: ${item.store_id || 'N/A'}\n`);
    });

    // Check pending orders (might be stuck)
    console.log('\n3. Pending Orders (not paid):');
    const pendingResult = await pool.query(`
      SELECT
        id, user_id, guest_email, status, total,
        stripe_session_id, created_at
      FROM grocery_orders
      WHERE status = 'pending'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    console.log(`Found ${pendingResult.rows.length} pending orders:`);
    pendingResult.rows.forEach(order => {
      console.log(`  - Order #${order.id}: ${order.status} | Total: $${order.total}`);
      console.log(`    Created: ${order.created_at}`);
      console.log(`    Stripe Session: ${order.stripe_session_id || 'N/A'}\n`);
    });

    // Check paid orders
    console.log('\n4. Paid Orders:');
    const paidResult = await pool.query(`
      SELECT
        id, user_id, guest_email, status, total,
        paid_at, created_at
      FROM grocery_orders
      WHERE status = 'paid'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log(`Found ${paidResult.rows.length} paid orders:`);
    paidResult.rows.forEach(order => {
      console.log(`  - Order #${order.id}: ${order.status} | Total: $${order.total}`);
      console.log(`    Created: ${order.created_at} | Paid: ${order.paid_at}\n`);
    });

    // Check grocery store owners
    console.log('\n5. Grocery Store Owners:');
    const ownersResult = await pool.query(`
      SELECT id, name, email, store_id
      FROM grocery_store_owners
      ORDER BY id DESC
      LIMIT 5
    `);

    console.log(`Found ${ownersResult.rows.length} grocery owners:`);
    ownersResult.rows.forEach(owner => {
      console.log(`  - Owner #${owner.id}: ${owner.name} | ${owner.email} | Store ID: ${owner.store_id || 'N/A'}\n`);
    });

    // Check products with store_id
    console.log('\n6. Products (with store_id):');
    const productsResult = await pool.query(`
      SELECT id, name, price, store_id, stock
      FROM products
      WHERE store_id IS NOT NULL
      ORDER BY id DESC
      LIMIT 10
    `);

    console.log(`Found ${productsResult.rows.length} products with store_id:`);
    productsResult.rows.forEach(product => {
      console.log(`  - Product #${product.id}: ${product.name} | $${product.price}`);
      console.log(`    Store ID: ${product.store_id} | Stock: ${product.stock || 'N/A'}\n`);
    });

    console.log('\n=== DIAGNOSIS COMPLETE ===');
    process.exit(0);
  } catch (error) {
    console.error('Diagnosis error:', error);
    process.exit(1);
  }
}

diagnoseOrders();
