import pool from './db.js';
import fs from 'fs';

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migration: add_store_id_to_products...');

    const migrationSQL = fs.readFileSync('migrations/add_store_id_to_products.sql', 'utf8');
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('   - Added store_id column to products table');
    console.log('   - Created index on store_id');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
