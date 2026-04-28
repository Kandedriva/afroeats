import pool from './db.js';

async function quickCheck() {
  try {
    console.log('=== QUICK DATABASE CHECK ===\n');

    // Check user_id nullable
    console.log('1. Checking grocery_orders.user_id...');
    const userIdCheck = await pool.query(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = 'grocery_orders' AND column_name = 'user_id'
    `);
    console.log(`   user_id nullable: ${userIdCheck.rows[0]?.is_nullable || 'NOT FOUND'}`);

    // Check guest_email exists
    console.log('\n2. Checking grocery_orders.guest_email...');
    const guestEmailCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'grocery_orders' AND column_name = 'guest_email'
    `);
    console.log(`   guest_email exists: ${guestEmailCheck.rows.length > 0 ? 'YES' : 'NO'}`);

    // Check products with store_id
    console.log('\n3. Checking products.store_id...');
    const productsCheck = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE store_id IS NOT NULL) as with_store,
        COUNT(*) FILTER (WHERE store_id IS NULL) as without_store,
        COUNT(*) as total
      FROM products
    `);
    const p = productsCheck.rows[0];
    console.log(`   Products with store_id: ${p.with_store}/${p.total}`);
    console.log(`   Products WITHOUT store_id: ${p.without_store}`);

    // Check grocery stores
    console.log('\n4. Checking grocery stores...');
    const storesCheck = await pool.query(`
      SELECT id, name, owner_id FROM grocery_stores LIMIT 5
    `);
    if (storesCheck.rows.length === 0) {
      console.log('   ❌ NO GROCERY STORES FOUND!');
    } else {
      storesCheck.rows.forEach(s => {
        console.log(`   Store #${s.id}: ${s.name} (Owner: ${s.owner_id || 'NONE'})`);
      });
    }

    // Summary
    console.log('\n=== SUMMARY ===');
    const userIdOk = userIdCheck.rows[0]?.is_nullable === 'YES';
    const guestEmailOk = guestEmailCheck.rows.length > 0;
    const productsOk = parseInt(p.without_store) === 0;
    const storesOk = storesCheck.rows.length > 0;

    console.log(`Guest checkout ready: ${userIdOk && guestEmailOk ? '✅ YES' : '❌ NO'}`);
    console.log(`Products assigned: ${productsOk ? '✅ YES' : '❌ NO'}`);
    console.log(`Stores configured: ${storesOk ? '✅ YES' : '❌ NO'}`);

    if (!userIdOk || !guestEmailOk) {
      console.log('\n⚠️  Run: node diagnoseAndFixOrderSystem.js');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

quickCheck();
