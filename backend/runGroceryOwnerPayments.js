import pool from './db.js';
import fs from 'fs';

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migration: create_grocery_owner_payments...');

    const migrationSQL = fs.readFileSync('migrations/create_grocery_owner_payments.sql', 'utf8');
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('   - Created grocery_owner_payments table');
    console.log('   - Added indexes for tracking payments');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
