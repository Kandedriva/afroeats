import pool from './db.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('📂 Reading migration file...');
    const migrationSQL = fs.readFileSync(
      join(__dirname, 'migrations', 'add_email_verification.sql'),
      'utf8'
    );

    console.log('🚀 Running email verification migration...');
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');

    // Verify the columns were added
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('email_verified', 'verification_code', 'verification_code_expires_at', 'verification_attempts')
      ORDER BY column_name;
    `);

    console.log('\n📋 Verification columns added:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
