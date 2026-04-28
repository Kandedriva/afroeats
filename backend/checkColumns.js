import pool from './db.js';

async function check() {
  const result = await pool.query("SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name = 'grocery_orders' AND column_name IN ('user_id', 'guest_email') ORDER BY column_name");
  console.log('Current columns:');
  result.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`));
  await pool.end();
}
check();
