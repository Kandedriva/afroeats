-- Migration: Create grocery_owner_payments table
-- Date: 2026-04-24
-- Description: Track Stripe Connect payments to grocery owners

CREATE TABLE IF NOT EXISTS grocery_owner_payments (
  id SERIAL PRIMARY KEY,
  grocery_order_id INTEGER REFERENCES grocery_orders(id) ON DELETE CASCADE,
  grocery_owner_id INTEGER REFERENCES grocery_store_owners(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  stripe_transfer_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(grocery_order_id, grocery_owner_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_grocery_owner_payments_order_id ON grocery_owner_payments(grocery_order_id);
CREATE INDEX IF NOT EXISTS idx_grocery_owner_payments_owner_id ON grocery_owner_payments(grocery_owner_id);
CREATE INDEX IF NOT EXISTS idx_grocery_owner_payments_status ON grocery_owner_payments(status);
CREATE INDEX IF NOT EXISTS idx_grocery_owner_payments_stripe_transfer ON grocery_owner_payments(stripe_transfer_id);

-- Add comments
COMMENT ON TABLE grocery_owner_payments IS 'Stripe Connect payment records for grocery store owners';
COMMENT ON COLUMN grocery_owner_payments.status IS 'Payment status: pending, completed, failed, awaiting_connect';
COMMENT ON COLUMN grocery_owner_payments.stripe_transfer_id IS 'Stripe transfer ID for tracking';
