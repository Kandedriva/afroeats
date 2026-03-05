-- Create refunds table for tracking order refunds
-- Supports full and partial refunds with reason tracking

CREATE TABLE IF NOT EXISTS refunds (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  stripe_refund_id VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255),

  -- Refund details
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) DEFAULT 'usd',
  reason VARCHAR(50) NOT NULL CHECK (reason IN (
    'duplicate',
    'fraudulent',
    'customer_request',
    'order_cancelled',
    'item_unavailable',
    'quality_issue',
    'wrong_item',
    'late_delivery',
    'other'
  )),
  description TEXT,

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',     -- Refund requested but not processed
    'processing',  -- Being processed with Stripe
    'succeeded',   -- Successfully refunded
    'failed',      -- Refund failed
    'cancelled'    -- Refund request cancelled
  )),

  -- Who initiated the refund
  requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  requested_by_admin_email VARCHAR(255), -- Admin email instead of FK (admins table may not exist)
  approved_by_admin_email VARCHAR(255),

  -- Restaurant impact (if restaurant needs to be debited)
  restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE SET NULL,
  restaurant_refund_amount DECIMAL(10, 2) DEFAULT 0.00,
  platform_refund_amount DECIMAL(10, 2) DEFAULT 0.00,

  -- Timestamps
  requested_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  succeeded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_stripe_refund_id ON refunds(stripe_refund_id);
CREATE INDEX IF NOT EXISTS idx_refunds_requested_at ON refunds(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_restaurant_id ON refunds(restaurant_id);

-- Add refund status to orders table if not exists
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS refund_status VARCHAR(20) DEFAULT 'none' CHECK (refund_status IN (
  'none',           -- No refund
  'requested',      -- Refund requested
  'partial',        -- Partially refunded
  'full',           -- Fully refunded
  'processing'      -- Refund in progress
));

-- Add refunded amount tracking to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(10, 2) DEFAULT 0.00;

-- Create refund_logs table for audit trail
CREATE TABLE IF NOT EXISTS refund_logs (
  id SERIAL PRIMARY KEY,
  refund_id INTEGER NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  old_status VARCHAR(20),
  new_status VARCHAR(20),
  notes TEXT,
  performed_by_admin_email VARCHAR(255),
  performed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_logs_refund_id ON refund_logs(refund_id);
CREATE INDEX IF NOT EXISTS idx_refund_logs_created_at ON refund_logs(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE refunds IS 'Stores refund transactions for orders';
COMMENT ON COLUMN refunds.reason IS 'Reason for refund: duplicate, fraudulent, customer_request, etc.';
COMMENT ON COLUMN refunds.status IS 'Current status of the refund';
COMMENT ON COLUMN refunds.restaurant_refund_amount IS 'Amount to be debited from restaurant';
COMMENT ON COLUMN refunds.platform_refund_amount IS 'Amount absorbed by platform';

COMMENT ON TABLE refund_logs IS 'Audit trail for all refund actions';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Refunds tables created successfully';
  RAISE NOTICE 'ℹ️  Tables: refunds, refund_logs';
  RAISE NOTICE 'ℹ️  Added refund tracking columns to orders table';
END $$;
