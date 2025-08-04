import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// SSL configuration for Neon (only for production)
const sslConfig = process.env.NODE_ENV === 'production' ? {
  ssl: {
    rejectUnauthorized: false // Neon requires SSL but doesn't need strict cert validation
  }
} : {};

const pool = new Pool({
  user: process.env.PGUSER || process.env.DATABASE_USER || process.env.DB_USER || 'postgres',
  host: process.env.PGHOST || process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
  database: process.env.PGDATABASE || process.env.DATABASE_NAME || process.env.DB_NAME || 'afroeats',
  password: process.env.PGPASSWORD || process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'Dkkande',
  port: process.env.PGPORT || process.env.DATABASE_PORT || process.env.DB_PORT || 5432,
  
  // SSL configuration (required for Neon)
  ...sslConfig,
  
  // Connection pool settings
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
  
  // Additional security settings
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000,
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000,
});

  

export default pool;
