-- Migration: Create grocery_refund_requests table
-- Date: 2026-04-23
-- Description: Create refund requests table for grocery orders

CREATE TABLE IF NOT EXISTS grocery_refund_requests (
  id SERIAL PRIMARY KEY,
  grocery_order_id INTEGER REFERENCES grocery_orders(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  reason VARCHAR(50) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  processed_by_admin_email VARCHAR(255),
  stripe_refund_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_grocery_refund_requests_order_id ON grocery_refund_requests(grocery_order_id);
CREATE INDEX IF NOT EXISTS idx_grocery_refund_requests_user_id ON grocery_refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_grocery_refund_requests_status ON grocery_refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_grocery_refund_requests_requested_at ON grocery_refund_requests(requested_at DESC);

-- Add refund_status column to grocery_orders table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grocery_orders' AND column_name = 'refund_status'
  ) THEN
    ALTER TABLE grocery_orders ADD COLUMN refund_status VARCHAR(20) DEFAULT 'none';
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE grocery_refund_requests IS 'Refund requests for grocery orders from customers';
COMMENT ON COLUMN grocery_refund_requests.reason IS 'Reason for refund: customer_request, order_cancelled, item_unavailable, quality_issue, wrong_item, late_delivery, other';
COMMENT ON COLUMN grocery_refund_requests.status IS 'Status of refund request: pending, approved, rejected, processing, completed, failed';
