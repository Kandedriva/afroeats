-- Migration: Create grocery_owner_notifications table
-- Date: 2026-04-23
-- Description: Create notifications table for grocery store owners to track new orders, changes, and refund requests

CREATE TABLE IF NOT EXISTS grocery_owner_notifications (
  id SERIAL PRIMARY KEY,
  grocery_owner_id INTEGER REFERENCES grocery_store_owners(id) ON DELETE CASCADE,
  grocery_order_id INTEGER REFERENCES grocery_orders(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_grocery_owner_notifications_owner_id ON grocery_owner_notifications(grocery_owner_id);
CREATE INDEX IF NOT EXISTS idx_grocery_owner_notifications_order_id ON grocery_owner_notifications(grocery_order_id);
CREATE INDEX IF NOT EXISTS idx_grocery_owner_notifications_read ON grocery_owner_notifications(read);
CREATE INDEX IF NOT EXISTS idx_grocery_owner_notifications_created_at ON grocery_owner_notifications(created_at DESC);

-- Add comments
COMMENT ON TABLE grocery_owner_notifications IS 'Notifications for grocery store owners including new orders, order changes, and refund requests';
COMMENT ON COLUMN grocery_owner_notifications.type IS 'Type of notification: new_order, order_change, refund_request, etc.';
COMMENT ON COLUMN grocery_owner_notifications.data IS 'Additional JSON data related to the notification';
