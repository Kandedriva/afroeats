import pool from './db.js';

async function check() {
  const result = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%grocery%' ORDER BY table_name");
  console.log('Grocery tables:', result.rows.map(r => r.table_name).join(', '));
  await pool.end();
}
check();
