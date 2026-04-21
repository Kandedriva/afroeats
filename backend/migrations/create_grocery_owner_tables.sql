-- Migration: Create Grocery Store Owner Tables
-- Description: Creates tables for grocery store owners and their stores

-- Create grocery_store_owners table
CREATE TABLE IF NOT EXISTS grocery_store_owners (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  secret_word VARCHAR(255) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create grocery_stores table
CREATE TABLE IF NOT EXISTS grocery_stores (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  image_url VARCHAR(500),
  owner_id INTEGER REFERENCES grocery_store_owners(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_grocery_store_owners_email ON grocery_store_owners(email);
CREATE INDEX IF NOT EXISTS idx_grocery_store_owners_active ON grocery_store_owners(active);
CREATE INDEX IF NOT EXISTS idx_grocery_stores_owner_id ON grocery_stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_grocery_stores_active ON grocery_stores(active);
CREATE INDEX IF NOT EXISTS idx_grocery_stores_location ON grocery_stores(latitude, longitude);

-- Add comment to tables
COMMENT ON TABLE grocery_store_owners IS 'Stores information about grocery store owners';
COMMENT ON TABLE grocery_stores IS 'Stores information about grocery stores';
