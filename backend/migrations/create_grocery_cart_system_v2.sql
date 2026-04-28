-- Complete Grocery Cart System Migration V2
-- Redesigns grocery system to match restaurant order flow
-- REQUIRES AUTHENTICATION for orders (no guest checkout)
-- Database-backed cart storage (like restaurant cart system)

-- ============================================
-- STEP 1: Create grocery_carts table
-- ============================================

CREATE TABLE IF NOT EXISTS grocery_carts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, product_id) -- One entry per user per product
);

-- Indexes for fast cart lookups
CREATE INDEX IF NOT EXISTS idx_grocery_carts_user_id ON grocery_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_grocery_carts_product_id ON grocery_carts(product_id);

COMMENT ON TABLE grocery_carts IS 'Database-backed shopping cart for grocery products - requires authentication';
COMMENT ON COLUMN grocery_carts.user_id IS 'Authenticated user who owns this cart item';
COMMENT ON COLUMN grocery_carts.product_id IS 'Product in the cart';
COMMENT ON COLUMN grocery_carts.quantity IS 'Quantity of product';

-- ============================================
-- STEP 2: Fix grocery_orders table - Require authentication
-- ============================================

-- First, delete any guest orders (user_id IS NULL) since we no longer support them
DELETE FROM grocery_orders WHERE user_id IS NULL;

-- Make sure user_id is NOT NULL (orders require authentication)
ALTER TABLE grocery_orders
ALTER COLUMN user_id SET NOT NULL;

-- Remove guest_email column if it exists (not needed - authentication required)
ALTER TABLE grocery_orders
DROP COLUMN IF EXISTS guest_email CASCADE;

-- Drop guest constraint if it exists
ALTER TABLE grocery_orders
DROP CONSTRAINT IF EXISTS user_or_guest_required;

COMMENT ON COLUMN grocery_orders.user_id IS 'User who placed the order - authentication required (matches restaurant order system)';
COMMENT ON TABLE grocery_orders IS 'Grocery orders - requires authentication like restaurant orders';

-- ============================================
-- STEP 3: Ensure products have store_id
-- ============================================

-- Add store_id column to products if it doesn't exist
ALTER TABLE products
ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES grocery_stores(id) ON DELETE CASCADE;

-- Add index for store lookups
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);

COMMENT ON COLUMN products.store_id IS 'Grocery store that owns this product - required for order routing to owners';

-- ============================================
-- STEP 4: Auto-update timestamp trigger for grocery_carts
-- ============================================

CREATE OR REPLACE FUNCTION update_grocery_carts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS grocery_carts_updated_at_trigger ON grocery_carts;
CREATE TRIGGER grocery_carts_updated_at_trigger
  BEFORE UPDATE ON grocery_carts
  FOR EACH ROW
  EXECUTE FUNCTION update_grocery_carts_updated_at();

-- ============================================
-- STEP 5: Add platform_fee column to products if missing
-- ============================================

ALTER TABLE products
ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10, 2) DEFAULT 0 CHECK (platform_fee >= 0);

COMMENT ON COLUMN products.platform_fee IS 'Platform fee for this product (calculated as percentage of price)';

-- ============================================
-- SUMMARY
-- ============================================

-- This migration creates a grocery system that matches the restaurant order flow:
-- 1. grocery_carts table - Database-backed shopping cart (requires login)
-- 2. Authenticated orders only - user_id NOT NULL (matches restaurant orders)
-- 3. Product-store linking - store_id ensures orders route to correct owner
-- 4. Auto-update timestamps - grocery_carts updated_at automatically maintained
-- 5. Platform fee tracking - per-product platform fees

-- NO GUEST CHECKOUT - Users must be logged in to add items to cart and place orders
-- This matches the restaurant order system design
