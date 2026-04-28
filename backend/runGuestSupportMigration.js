import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('=== ADDING GUEST SUPPORT TO GROCERY SYSTEM ===\n');

  try {
    const migrationPath = path.join(__dirname, 'migrations', 'add_guest_support_to_grocery.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');
    console.log('🔧 Applying guest support migration...\n');

    await pool.query('BEGIN');
    await pool.query(migrationSQL);
    await pool.query('COMMIT');

    console.log('✅ Migration completed successfully!\n');
    console.log('🎉 GUEST SUPPORT ADDED!\n');

  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
