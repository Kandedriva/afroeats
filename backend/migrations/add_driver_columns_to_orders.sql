-- Add driver-related columns to existing orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS driver_id INTEGER REFERENCES drivers(id),
ADD COLUMN IF NOT EXISTS actual_delivery_fee DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS delivery_distance_miles DECIMAL(6, 2),
ADD COLUMN IF NOT EXISTS pickup_location TEXT,
ADD COLUMN IF NOT EXISTS pickup_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS pickup_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS delivery_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS delivery_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS driver_claimed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS driver_picked_up_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS driver_delivered_at TIMESTAMP;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_type ON orders(delivery_type);

COMMENT ON COLUMN orders.driver_id IS 'Driver assigned to deliver this order';
COMMENT ON COLUMN orders.actual_delivery_fee IS 'Calculated delivery fee based on distance';
COMMENT ON COLUMN orders.delivery_distance_miles IS 'Distance from restaurant to customer in miles';
COMMENT ON COLUMN orders.pickup_location IS 'Restaurant pickup address(es)';
COMMENT ON COLUMN orders.driver_claimed_at IS 'When driver claimed this delivery';
COMMENT ON COLUMN orders.driver_picked_up_at IS 'When driver picked up the order';
COMMENT ON COLUMN orders.driver_delivered_at IS 'When driver marked order as delivered';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Driver columns added to orders table successfully';
END $$;
