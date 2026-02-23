-- Create driver_notifications table for in-app notifications
CREATE TABLE IF NOT EXISTS driver_notifications (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,

  type VARCHAR(50) NOT NULL, -- 'new_delivery', 'delivery_reminder', 'payment_received', 'account_approved', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}', -- Additional metadata

  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_notifications_driver ON driver_notifications(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_notifications_read ON driver_notifications(driver_id, read);

COMMENT ON TABLE driver_notifications IS 'In-app notifications for delivery drivers';
COMMENT ON COLUMN driver_notifications.type IS 'Notification type: new_delivery, delivery_reminder, payment_received, account_approved, etc.';
COMMENT ON COLUMN driver_notifications.data IS 'Additional JSON metadata for the notification';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Driver notifications table created successfully';
END $$;
