-- Add guest checkout support to grocery orders
-- Allow user_id to be NULL for guest orders and add guest_email column

-- Make user_id nullable to support guest orders
ALTER TABLE grocery_orders
ALTER COLUMN user_id DROP NOT NULL;

-- Add guest_email column for guest orders
ALTER TABLE grocery_orders
ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255);

-- Add check constraint to ensure either user_id or guest_email is present
ALTER TABLE grocery_orders
ADD CONSTRAINT user_or_guest_required CHECK (
  (user_id IS NOT NULL AND guest_email IS NULL) OR
  (user_id IS NULL AND guest_email IS NOT NULL)
);

-- Add index on guest_email for lookups
CREATE INDEX IF NOT EXISTS idx_grocery_orders_guest_email ON grocery_orders(guest_email);

-- Add comment
COMMENT ON COLUMN grocery_orders.guest_email IS 'Email for guest orders (when user_id is NULL)';
