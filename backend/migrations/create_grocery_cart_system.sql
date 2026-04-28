-- Complete Grocery Cart System Migration
-- Redesigns grocery system to match restaurant order flow with database-backed carts

-- ============================================
-- STEP 1: Create grocery_carts table (matches 'carts' table for restaurants)
-- ============================================

CREATE TABLE IF NOT EXISTS grocery_carts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, product_id) -- One entry per user per product
);

-- Index for fast cart lookups
CREATE INDEX IF NOT EXISTS idx_grocery_carts_user_id ON grocery_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_grocery_carts_product_id ON grocery_carts(product_id);

COMMENT ON TABLE grocery_carts IS 'Shopping cart for grocery/marketplace products - stored in database like restaurant carts';
COMMENT ON COLUMN grocery_carts.user_id IS 'User who owns this cart item (NULL for guest carts not supported yet)';
COMMENT ON COLUMN grocery_carts.product_id IS 'Product in the cart';
COMMENT ON COLUMN grocery_carts.quantity IS 'Quantity of product';

-- ============================================
-- STEP 2: Fix grocery_orders table for guest support
-- ============================================

-- Make user_id nullable to support guest orders
ALTER TABLE grocery_orders
ALTER COLUMN user_id DROP NOT NULL;

-- Add guest_email column if it doesn't exist
ALTER TABLE grocery_orders
ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255);

-- Add constraint: either user_id OR guest_email must be present
DO $$
BEGIN
  -- Drop constraint if it exists
  ALTER TABLE grocery_orders DROP CONSTRAINT IF EXISTS user_or_guest_required;

  -- Add the constraint
  ALTER TABLE grocery_orders
  ADD CONSTRAINT user_or_guest_required
  CHECK (
    (user_id IS NOT NULL AND guest_email IS NULL) OR
    (user_id IS NULL AND guest_email IS NOT NULL)
  );
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Constraint already exists
END$$;

-- Add index for guest email lookups
CREATE INDEX IF NOT EXISTS idx_grocery_orders_guest_email ON grocery_orders(guest_email);

COMMENT ON COLUMN grocery_orders.guest_email IS 'Email for guest orders (when user_id is NULL)';

-- ============================================
-- STEP 3: Ensure products have store_id
-- ============================================

-- Add store_id column to products if it doesn't exist
ALTER TABLE products
ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES grocery_stores(id) ON DELETE CASCADE;

-- Add index for store lookups
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);

COMMENT ON COLUMN products.store_id IS 'Grocery store that owns this product - required for order routing';

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

-- This migration creates:
-- 1. grocery_carts table - Database-backed shopping cart (like restaurant carts)
-- 2. Guest order support - user_id nullable, guest_email column added
-- 3. Product-store linking - store_id ensures orders route to correct owner
-- 4. Auto-update timestamps - grocery_carts updated_at automatically maintained
-- 5. Platform fee tracking - per-product platform fees

COMMENT ON TABLE grocery_carts IS 'Database-backed grocery shopping cart - matches restaurant cart system design';
