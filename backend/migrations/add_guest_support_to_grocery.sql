-- Add Guest Support to Grocery Orders
-- This migration allows both authenticated and guest users to place grocery orders

-- ============================================
-- STEP 1: Make user_id nullable to support guest orders
-- ============================================

ALTER TABLE grocery_orders
ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON COLUMN grocery_orders.user_id IS 'User who placed the order - NULL for guest orders';

-- ============================================
-- STEP 2: Add guest_email column back
-- ============================================

ALTER TABLE grocery_orders
ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_grocery_orders_guest_email ON grocery_orders(guest_email);

COMMENT ON COLUMN grocery_orders.guest_email IS 'Email address for guest orders - used for order tracking';

-- ============================================
-- STEP 3: Add constraint to ensure either user_id OR guest_email is present
-- ============================================

ALTER TABLE grocery_orders
DROP CONSTRAINT IF EXISTS user_or_guest_required;

ALTER TABLE grocery_orders
ADD CONSTRAINT user_or_guest_required CHECK (
  (user_id IS NOT NULL) OR (guest_email IS NOT NULL)
);

COMMENT ON CONSTRAINT user_or_guest_required ON grocery_orders IS 'Ensures either a user account or guest email is provided';

-- ============================================
-- SUMMARY
-- ============================================

-- This migration enables guest checkout for grocery orders:
-- 1. user_id is now nullable (guests have NULL user_id)
-- 2. guest_email column added for guest order tracking
-- 3. Constraint ensures every order has either user_id OR guest_email
--
-- Guest users: user_id = NULL, guest_email = 'customer@email.com'
-- Authenticated users: user_id = 123, guest_email = NULL
