-- Migration: Add platform_fee column to products table
-- Date: 2026-04-21
-- Description: Add platform fee that goes to platform owner (separate from store owner price)

-- Add platform_fee column to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10, 2) DEFAULT 0.00 CHECK (platform_fee >= 0);

-- Comment
COMMENT ON COLUMN products.platform_fee IS 'Fee charged by platform that goes to platform owner (added to base price)';
