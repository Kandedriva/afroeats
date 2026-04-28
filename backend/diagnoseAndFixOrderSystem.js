import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function diagnoseAndFix() {
  console.log('=== DIAGNOSING ORDER SYSTEM ISSUES ===\n');

  try {
    // STEP 1: Check if guest_email column exists
    console.log('1️⃣  Checking grocery_orders table for guest support...');
    const guestEmailCheck = await pool.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'grocery_orders' AND column_name = 'guest_email';
    `);

    if (guestEmailCheck.rows.length === 0) {
      console.log('   ❌ guest_email column missing - guest checkout will fail!');
      console.log('   🔧 Applying guest support migration...\n');

      const guestMigrationPath = path.join(__dirname, 'migrations', 'add_guest_support_to_grocery_orders.sql');
      const guestMigrationSQL = fs.readFileSync(guestMigrationPath, 'utf8');
      await pool.query(guestMigrationSQL);

      console.log('   ✅ Guest support migration applied!\n');
    } else {
      console.log('   ✅ guest_email column exists\n');
    }

    // STEP 2: Check user_id nullable
    console.log('2️⃣  Checking if user_id is nullable...');
    const userIdCheck = await pool.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'grocery_orders' AND column_name = 'user_id';
    `);

    if (userIdCheck.rows[0]?.is_nullable === 'NO') {
      console.log('   ❌ user_id is NOT NULL - guest checkout will fail!');
      console.log('   🔧 Making user_id nullable...\n');

      await pool.query(`ALTER TABLE grocery_orders ALTER COLUMN user_id DROP NOT NULL;`);

      console.log('   ✅ user_id is now nullable!\n');
    } else {
      console.log('   ✅ user_id is nullable\n');
    }

    // STEP 3: Check if products have store_id column
    console.log('3️⃣  Checking products table for store_id...');
    const storeIdCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'store_id';
    `);

    if (storeIdCheck.rows.length === 0) {
      console.log('   ❌ store_id column missing - orders won\'t route to owners!');
      console.log('   🔧 Adding store_id to products...\n');

      const storeIdMigrationPath = path.join(__dirname, 'migrations', 'add_store_id_to_products.sql');
      const storeIdMigrationSQL = fs.readFileSync(storeIdMigrationPath, 'utf8');
      await pool.query(storeIdMigrationSQL);

      console.log('   ✅ store_id column added!\n');
    } else {
      console.log('   ✅ store_id column exists\n');
    }

    // STEP 4: Check how many products have NULL store_id
    console.log('4️⃣  Checking products without store_id assignment...');
    const nullStoreIdCount = await pool.query(`
      SELECT COUNT(*) as count FROM products WHERE store_id IS NULL;
    `);

    const nullCount = parseInt(nullStoreIdCount.rows[0].count);
    if (nullCount > 0) {
      console.log(`   ⚠️  ${nullCount} products have no store_id assigned!`);
      console.log('   🔧 Assigning products to stores...\n');

      // Get first grocery store
      const storeResult = await pool.query(`
        SELECT id, name FROM grocery_stores ORDER BY id LIMIT 1;
      `);

      if (storeResult.rows.length === 0) {
        console.log('   ❌ No grocery stores found! Create a store first.\n');
      } else {
        const storeId = storeResult.rows[0].id;
        const storeName = storeResult.rows[0].name;

        console.log(`   📦 Assigning all products to: "${storeName}" (ID: ${storeId})`);

        const updateResult = await pool.query(`
          UPDATE products SET store_id = $1 WHERE store_id IS NULL RETURNING id;
        `, [storeId]);

        console.log(`   ✅ Assigned ${updateResult.rows.length} products to store!\n`);
      }
    } else {
      console.log('   ✅ All products have store_id assigned\n');
    }

    // STEP 5: Verify order routing will work
    console.log('5️⃣  Testing order routing to grocery owners...');
    const routingTest = await pool.query(`
      SELECT
        gs.id as store_id,
        gs.name as store_name,
        gso.id as owner_id,
        gso.name as owner_name,
        COUNT(p.id) as product_count
      FROM grocery_stores gs
      LEFT JOIN grocery_store_owners gso ON gs.owner_id = gso.id
      LEFT JOIN products p ON p.store_id = gs.id
      GROUP BY gs.id, gs.name, gso.id, gso.name
      ORDER BY gs.id;
    `);

    if (routingTest.rows.length === 0) {
      console.log('   ❌ No stores configured!\n');
    } else {
      console.log('   Store → Owner Mapping:');
      routingTest.rows.forEach(row => {
        console.log(`   - Store: "${row.store_name}" (ID: ${row.store_id})`);
        console.log(`     Owner: ${row.owner_name || 'NONE'} (ID: ${row.owner_id || 'N/A'})`);
        console.log(`     Products: ${row.product_count}`);
        console.log('');
      });

      const hasOwners = routingTest.rows.every(row => row.owner_id !== null);
      if (hasOwners) {
        console.log('   ✅ All stores have owners assigned!\n');
      } else {
        console.log('   ⚠️  Some stores have no owner!\n');
      }
    }

    // STEP 6: Final summary
    console.log('=== DIAGNOSIS COMPLETE ===\n');

    const finalCheck = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM products WHERE store_id IS NULL) as products_without_store,
        (SELECT COUNT(*) FROM grocery_stores WHERE owner_id IS NULL) as stores_without_owner,
        (SELECT is_nullable FROM information_schema.columns
         WHERE table_name = 'grocery_orders' AND column_name = 'user_id') as user_id_nullable,
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_name = 'grocery_orders' AND column_name = 'guest_email') as has_guest_email;
    `);

    const status = finalCheck.rows[0];
    const productsOk = status.products_without_store === '0';
    const storesOk = status.stores_without_owner === '0';
    const userIdOk = status.user_id_nullable === 'YES';
    const guestEmailOk = status.has_guest_email === '1';

    console.log('System Status:');
    console.log(`  ${userIdOk ? '✅' : '❌'} Guest checkout: ${userIdOk ? 'ENABLED' : 'DISABLED'}`);
    console.log(`  ${guestEmailOk ? '✅' : '❌'} Guest email tracking: ${guestEmailOk ? 'ENABLED' : 'DISABLED'}`);
    console.log(`  ${productsOk ? '✅' : '⚠️'} Products assigned to stores: ${productsOk ? 'YES' : 'NO'}`);
    console.log(`  ${storesOk ? '✅' : '⚠️'} Stores have owners: ${storesOk ? 'YES' : 'NO'}`);
    console.log('');

    if (userIdOk && guestEmailOk && productsOk && storesOk) {
      console.log('🎉 ALL SYSTEMS READY!');
      console.log('   - Customers can place orders');
      console.log('   - Orders will route to correct grocery owner');
      console.log('   - Guest checkout is enabled\n');
    } else {
      console.log('⚠️  SOME ISSUES REMAIN:');
      if (!userIdOk || !guestEmailOk) {
        console.log('   - Guest checkout needs manual database fix');
      }
      if (!productsOk) {
        console.log('   - Some products have no store assignment');
      }
      if (!storesOk) {
        console.log('   - Some stores have no owner');
      }
      console.log('');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

diagnoseAndFix();
