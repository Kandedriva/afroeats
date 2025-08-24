-- Add delivery fee column to restaurants table
-- This allows restaurant owners to set their delivery fee

ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 0.00;

-- Update existing restaurants to have a default delivery fee of $2.99
UPDATE restaurants 
SET delivery_fee = 2.99 
WHERE delivery_fee IS NULL OR delivery_fee = 0.00;

-- Add comment for documentation
COMMENT ON COLUMN restaurants.delivery_fee IS 'Delivery fee charged by the restaurant in USD';