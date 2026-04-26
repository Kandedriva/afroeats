import pool from './db.js';
import fs from 'fs';

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migration: create_grocery_refund_requests...');

    const migrationSQL = fs.readFileSync('migrations/create_grocery_refund_requests.sql', 'utf8');
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('   - Created grocery_refund_requests table');
    console.log('   - Added refund_status column to grocery_orders table');
    console.log('   - Added indexes for better performance');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
