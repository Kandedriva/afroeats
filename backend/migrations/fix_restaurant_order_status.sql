-- Migration to add missing columns to restaurant_order_status table
-- Run this if you encounter "column does not exist" errors

-- Add completed_at column if it doesn't exist
ALTER TABLE restaurant_order_status 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Add removed_at column if it doesn't exist
ALTER TABLE restaurant_order_status 
ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP;

-- Verify the table structure
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'restaurant_order_status';