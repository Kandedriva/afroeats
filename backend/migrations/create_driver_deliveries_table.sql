-- Create driver_deliveries table to track driver assignments and delivery status
CREATE TABLE IF NOT EXISTS driver_deliveries (
  id SERIAL PRIMARY KEY,

  -- Relationships
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,

  -- Delivery Status
  status VARCHAR(20) DEFAULT 'available',
  -- 'available' - ready to be claimed
  -- 'claimed' - driver claimed, not picked up yet
  -- 'picked_up' - driver has food from restaurant
  -- 'in_transit' - on the way to customer
  -- 'delivered' - completed
  -- 'cancelled' - cancelled by driver or customer

  -- Timing
  claimed_at TIMESTAMP,
  picked_up_at TIMESTAMP,
  in_transit_at TIMESTAMP,
  delivered_at TIMESTAMP,
  cancelled_at TIMESTAMP,

  -- Delivery Details
  pickup_location TEXT NOT NULL, -- Restaurant address(es)
  pickup_latitude DECIMAL(10, 8),
  pickup_longitude DECIMAL(11, 8),

  delivery_location TEXT NOT NULL, -- Customer address
  delivery_latitude DECIMAL(10, 8),
  delivery_longitude DECIMAL(11, 8),

  -- Distance and Fee Calculation
  distance_miles DECIMAL(6, 2), -- Calculated via Google Maps API
  base_delivery_fee DECIMAL(10, 2) DEFAULT 3.00,
  distance_delivery_fee DECIMAL(10, 2) DEFAULT 0.00,
  total_delivery_fee DECIMAL(10, 2) NOT NULL, -- What customer pays
  driver_payout DECIMAL(10, 2) NOT NULL, -- What driver receives (85-90% of fee)
  platform_commission DECIMAL(10, 2) DEFAULT 0.00, -- Platform cut (10-15%)

  -- Payment
  driver_paid BOOLEAN DEFAULT FALSE,
  driver_payout_date TIMESTAMP,
  stripe_transfer_id VARCHAR(255), -- Stripe transfer ID for payout

  -- Notes
  driver_notes TEXT, -- Driver's delivery notes
  cancellation_reason TEXT,

  -- Customer Rating (optional future feature)
  customer_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5), -- 1-5 stars
  customer_feedback TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_driver_deliveries_order ON driver_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_driver_deliveries_driver ON driver_deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_deliveries_status ON driver_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_driver_deliveries_created ON driver_deliveries(created_at DESC);

-- Unique constraint: one delivery record per order
CREATE UNIQUE INDEX IF NOT EXISTS idx_driver_deliveries_order_unique ON driver_deliveries(order_id);

COMMENT ON TABLE driver_deliveries IS 'Tracks driver assignments and delivery status for orders';
COMMENT ON COLUMN driver_deliveries.status IS 'Delivery status: available, claimed, picked_up, in_transit, delivered, cancelled';
COMMENT ON COLUMN driver_deliveries.driver_payout IS 'Amount paid to driver (typically 85-90% of delivery fee)';
COMMENT ON COLUMN driver_deliveries.platform_commission IS 'Platform commission (typically 10-15% of delivery fee)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Driver deliveries table created successfully';
END $$;
