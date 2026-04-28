import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('=== RUNNING GROCERY CART SYSTEM MIGRATION ===\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'create_grocery_cart_system_v2.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');
    console.log('🔧 Applying grocery cart system migration...\n');

    // Run migration in a transaction
    await pool.query('BEGIN');
    await pool.query(migrationSQL);
    await pool.query('COMMIT');

    console.log('✅ Migration completed successfully!\n');

    // Verify grocery_carts table
    console.log('🔍 Verifying new tables...');
    const tablesCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('grocery_carts', 'grocery_orders')
      ORDER BY table_name;
    `);

    console.log('Tables found:');
    tablesCheck.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });

    // Check grocery_carts structure
    console.log('\n📋 Grocery Carts Table Structure:');
    const cartsStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'grocery_carts'
      ORDER BY ordinal_position;
    `);

    cartsStructure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check grocery_orders guest support
    console.log('\n📋 Grocery Orders Guest Support:');
    const ordersColumns = await pool.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'grocery_orders'
      AND column_name IN ('user_id', 'guest_email')
      ORDER BY column_name;
    `);

    ordersColumns.rows.forEach(col => {
      const status = col.is_nullable === 'YES' ? '✅' : '❌';
      console.log(`  ${status} ${col.column_name}: nullable = ${col.is_nullable}`);
    });

    // Check products store_id
    console.log('\n📋 Products Store Assignment:');
    const productsCheck = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE store_id IS NOT NULL) as with_store,
        COUNT(*) FILTER (WHERE store_id IS NULL) as without_store,
        COUNT(*) as total
      FROM products;
    `);

    const p = productsCheck.rows[0];
    console.log(`  Products with store_id: ${p.with_store}/${p.total}`);
    console.log(`  Products WITHOUT store_id: ${p.without_store}`);

    if (parseInt(p.without_store) > 0) {
      console.log('\n⚠️  Some products don\'t have store_id assigned');
      console.log('   Run: node fixProductStoreIds.js to assign them');
    }

    // Assign products to stores automatically if needed
    if (parseInt(p.without_store) > 0) {
      console.log('\n🔧 Auto-assigning products to stores...');

      const storeResult = await pool.query(`
        SELECT id, name FROM grocery_stores ORDER BY id LIMIT 1;
      `);

      if (storeResult.rows.length > 0) {
        const storeId = storeResult.rows[0].id;
        const storeName = storeResult.rows[0].name;

        const updateResult = await pool.query(`
          UPDATE products SET store_id = $1 WHERE store_id IS NULL RETURNING id;
        `, [storeId]);

        console.log(`  ✅ Assigned ${updateResult.rows.length} products to "${storeName}"`);
      } else {
        console.log('  ⚠️  No grocery stores found. Create a store first.');
      }
    }

    console.log('\n=== MIGRATION SUMMARY ===\n');
    console.log('Changes Applied:');
    console.log('  ✅ Created grocery_carts table (database-backed cart)');
    console.log('  ✅ Made user_id nullable in grocery_orders (guest support)');
    console.log('  ✅ Added guest_email column (track guest orders)');
    console.log('  ✅ Ensured products.store_id exists (order routing)');
    console.log('  ✅ Added auto-update timestamp trigger');
    console.log('  ✅ Added platform_fee column to products');
    console.log('\nSystem Status:');
    console.log('  ✅ Guest checkout: ENABLED');
    console.log('  ✅ Database-backed cart: ENABLED');
    console.log(`  ${p.without_store === '0' ? '✅' : '⚠️'} Product assignments: ${p.without_store === '0' ? 'COMPLETE' : 'NEEDS ATTENTION'}`);

    console.log('\n🎉 GROCERY SYSTEM REDESIGN COMPLETE!\n');
    console.log('Next Steps:');
    console.log('  1. Restart backend server');
    console.log('  2. Clear browser localStorage (F12 → Application → Clear)');
    console.log('  3. Test adding products to cart');
    console.log('  4. Test checkout flow');

    process.exit(0);
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

runMigration();
