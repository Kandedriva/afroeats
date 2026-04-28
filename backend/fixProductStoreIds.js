import pool from './db.js';

async function fixProductStoreIds() {
  try {
    console.log('=== FIXING PRODUCT STORE IDS ===\n');

    // Step 1: Check how many products need fixing
    const productsNeedingFix = await pool.query(`
      SELECT COUNT(*) as count
      FROM products
      WHERE store_id IS NULL
    `);

    const needsFixCount = parseInt(productsNeedingFix.rows[0].count);
    console.log(`📊 Products without store_id: ${needsFixCount}`);

    if (needsFixCount === 0) {
      console.log('✅ All products already have store_id assigned!\n');
      process.exit(0);
    }

    // Step 2: Get grocery stores
    const storesResult = await pool.query(`
      SELECT id, name, owner_id
      FROM grocery_stores
      LIMIT 1
    `);

    if (storesResult.rows.length === 0) {
      console.log('❌ No grocery stores found!');
      console.log('   Create a grocery store first, then run this script again.\n');
      process.exit(1);
    }

    const store = storesResult.rows[0];
    console.log(`🏪 Found grocery store: "${store.name}" (ID: ${store.id})`);
    console.log(`   Owner ID: ${store.owner_id}\n`);

    // Step 3: Check if we should use grocery_store_owners.id instead
    const ownersResult = await pool.query(`
      SELECT id, name, email
      FROM grocery_store_owners
      LIMIT 1
    `);

    if (ownersResult.rows.length === 0) {
      console.log('❌ No grocery owners found!');
      console.log('   Create a grocery owner first, then run this script again.\n');
      process.exit(1);
    }

    const owner = ownersResult.rows[0];
    console.log(`👤 Found grocery owner: "${owner.name}" (ID: ${owner.id})`);
    console.log(`   Email: ${owner.email}\n`);

    // Step 4: Check products.store_id foreign key to determine correct table
    const fkResult = await pool.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.table_name = 'products'
        AND kcu.column_name = 'store_id'
        AND tc.constraint_type = 'FOREIGN KEY';
    `);

    let storeIdToUse;
    if (fkResult.rows.length > 0) {
      const fk = fkResult.rows[0];
      console.log(`🔗 Foreign key found: products.store_id -> ${fk.foreign_table_name}.${fk.foreign_column_name}\n`);

      if (fk.foreign_table_name === 'grocery_store_owners') {
        storeIdToUse = owner.id;
        console.log(`✅ Using grocery_store_owners.id = ${storeIdToUse}\n`);
      } else if (fk.foreign_table_name === 'grocery_stores') {
        storeIdToUse = store.id;
        console.log(`✅ Using grocery_stores.id = ${storeIdToUse}\n`);
      } else {
        console.log(`⚠️  Unexpected foreign key table: ${fk.foreign_table_name}`);
        console.log(`   Using first owner ID: ${owner.id}\n`);
        storeIdToUse = owner.id;
      }
    } else {
      console.log('⚠️  No foreign key constraint found for products.store_id');
      console.log(`   Assuming it should reference grocery_store_owners`);
      console.log(`   Using owner ID: ${owner.id}\n`);
      storeIdToUse = owner.id;
    }

    // Step 5: Confirm before updating
    console.log('⚠️  About to update:');
    console.log(`   - ${needsFixCount} products`);
    console.log(`   - Set store_id = ${storeIdToUse}`);
    console.log('');

    // Step 6: Perform the update
    console.log('🔄 Updating products...');
    const updateResult = await pool.query(`
      UPDATE products
      SET store_id = $1
      WHERE store_id IS NULL
      RETURNING id, name
    `, [storeIdToUse]);

    console.log(`✅ Updated ${updateResult.rows.length} products\n`);

    // Step 7: Show sample of updated products
    if (updateResult.rows.length > 0) {
      console.log('Sample of updated products:');
      updateResult.rows.slice(0, 5).forEach(p => {
        console.log(`   - Product #${p.id}: ${p.name}`);
      });
      if (updateResult.rows.length > 5) {
        console.log(`   ... and ${updateResult.rows.length - 5} more`);
      }
      console.log('');
    }

    // Step 8: Verify
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM products
      WHERE store_id IS NULL
    `);

    const remainingNull = parseInt(verifyResult.rows[0].count);
    if (remainingNull === 0) {
      console.log('✅ SUCCESS! All products now have store_id assigned\n');
    } else {
      console.log(`⚠️  Warning: ${remainingNull} products still have NULL store_id\n`);
    }

    // Step 9: Test query
    console.log('🧪 Testing grocery owner orders query...');
    const testResult = await pool.query(`
      SELECT COUNT(DISTINCT go.id) as order_count
      FROM grocery_orders go
      INNER JOIN grocery_order_items goi ON go.id = goi.grocery_order_id
      INNER JOIN products p ON goi.product_id = p.id
      WHERE p.store_id = $1
    `, [storeIdToUse]);

    const orderCount = parseInt(testResult.rows[0].order_count);
    console.log(`✅ Found ${orderCount} orders for this store\n`);

    if (orderCount > 0) {
      console.log('🎉 ORDERS SHOULD NOW APPEAR IN GROCERY OWNER DASHBOARD!\n');
    } else {
      console.log('⚠️  No orders found. Place a new order to test.\n');
    }

    console.log('=== FIX COMPLETE ===\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixProductStoreIds();
