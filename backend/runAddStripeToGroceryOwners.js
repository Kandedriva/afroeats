import pool from './db.js';
import fs from 'fs';

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migration: add_stripe_to_grocery_owners...');

    const migrationSQL = fs.readFileSync('migrations/add_stripe_to_grocery_owners.sql', 'utf8');
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('   - Added Stripe Connect fields to grocery_store_owners table');
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
