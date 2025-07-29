import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// SSL configuration for production
const sslConfig = process.env.NODE_ENV === 'production' ? {
  ssl: {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    ca: process.env.DB_SSL_CA,
    cert: process.env.DB_SSL_CERT,
    key: process.env.DB_SSL_KEY
  }
} : {};

const pool = new Pool({
  user: process.env.DATABASE_USER || process.env.DB_USER || 'postgres',
  host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
  database: process.env.DATABASE_NAME || process.env.DB_NAME || 'afoodzone',
  password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'password',
  port: process.env.DATABASE_PORT || process.env.DB_PORT || 5432,
  
  // SSL configuration
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
