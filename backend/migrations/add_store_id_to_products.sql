-- Migration: Add store_id column to products table
-- Date: 2026-04-21
-- Description: Add foreign key relationship between products and grocery_stores

-- Add store_id column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES grocery_stores(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);

-- Comment
COMMENT ON COLUMN products.store_id IS 'Reference to the grocery store that owns this product';
