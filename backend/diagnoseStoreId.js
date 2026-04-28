import pool from './db.js';

async function diagnoseStoreId() {
  try {
    console.log('=== DIAGNOSING STORE_ID ISSUE ===\n');

    // Check products without store_id
    console.log('1. Products WITHOUT store_id:');
    const productsNoStore = await pool.query(`
      SELECT id, name, price, store_id
      FROM products
      WHERE store_id IS NULL
      LIMIT 10
    `);

    if (productsNoStore.rows.length === 0) {
      console.log('   ✅ All products have store_id\n');
    } else {
      console.log(`   ⚠️  Found ${productsNoStore.rows.length} products without store_id:\n`);
      productsNoStore.rows.forEach(p => {
        console.log(`   - Product #${p.id}: ${p.name} ($${p.price}) - store_id: ${p.store_id || 'NULL'}`);
      });
      console.log('');
    }

    // Check products WITH store_id
    console.log('2. Products WITH store_id:');
    const productsWithStore = await pool.query(`
      SELECT id, name, price, store_id
      FROM products
      WHERE store_id IS NOT NULL
      LIMIT 10
    `);

    if (productsWithStore.rows.length === 0) {
      console.log('   ❌ NO products have store_id set!\n');
    } else {
      console.log(`   ✅ Found ${productsWithStore.rows.length} products with store_id:\n`);
      productsWithStore.rows.forEach(p => {
        console.log(`   - Product #${p.id}: ${p.name} - Store: ${p.store_id}`);
      });
      console.log('');
    }

    // Check grocery stores
    console.log('3. Grocery Stores:');
    const stores = await pool.query(`
      SELECT id, name, owner_id
      FROM grocery_stores
      LIMIT 10
    `);

    if (stores.rows.length === 0) {
      console.log('   ❌ No grocery stores found!\n');
    } else {
      console.log(`   Found ${stores.rows.length} stores:\n`);
      stores.rows.forEach(s => {
        console.log(`   - Store #${s.id}: ${s.name} (Owner: ${s.owner_id})`);
      });
      console.log('');
    }

    // Check grocery owners
    console.log('4. Grocery Store Owners:');
    const owners = await pool.query(`
      SELECT id, name, email, store_id
      FROM grocery_store_owners
      LIMIT 10
    `);

    if (owners.rows.length === 0) {
      console.log('   ❌ No grocery owners found!\n');
    } else {
      console.log(`   Found ${owners.rows.length} owners:\n`);
      owners.rows.forEach(o => {
        console.log(`   - Owner #${o.id}: ${o.name} - Store ID: ${o.store_id || 'NULL'}`);
      });
      console.log('');
    }

    // Check recent order items and their products
    console.log('5. Recent Order Items and Product Store IDs:');
    const orderItems = await pool.query(`
      SELECT
        goi.grocery_order_id,
        goi.product_id,
        p.name as product_name,
        p.store_id,
        go.status as order_status
      FROM grocery_order_items goi
      LEFT JOIN products p ON goi.product_id = p.id
      LEFT JOIN grocery_orders go ON goi.grocery_order_id = go.id
      ORDER BY goi.id DESC
      LIMIT 10
    `);

    if (orderItems.rows.length === 0) {
      console.log('   ❌ No order items found!\n');
    } else {
      console.log(`   Found ${orderItems.rows.length} order items:\n`);
      orderItems.rows.forEach(item => {
        const storeStatus = item.store_id ? `✅ Store: ${item.store_id}` : '❌ NO STORE_ID';
        console.log(`   - Order #${item.grocery_order_id}: ${item.product_name || 'Unknown'}`);
        console.log(`     Product ID: ${item.product_id} | ${storeStatus} | Order: ${item.order_status}\n`);
      });
    }

    // SOLUTION: Check if we need to update products
    console.log('6. SOLUTION CHECK:');
    const needsUpdate = productsNoStore.rows.length > 0;

    if (needsUpdate) {
      console.log('   ⚠️  ACTION REQUIRED:');
      console.log('   Products without store_id need to be updated.');
      console.log('   This is why orders are not showing in grocery owner dashboard!\n');

      if (stores.rows.length > 0) {
        console.log('   💡 Quick Fix:');
        console.log(`   Run this SQL to assign all products to the first store:`);
        console.log(`   UPDATE products SET store_id = ${stores.rows[0].id} WHERE store_id IS NULL;\n`);
      }
    } else {
      console.log('   ✅ All products have store_id assigned!\n');
    }

    console.log('=== DIAGNOSIS COMPLETE ===\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnoseStoreId();
