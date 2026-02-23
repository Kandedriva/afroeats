-- Add geocoding columns to restaurants table for distance calculation
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS address_geocoded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMP;

-- Index for location-based queries (future feature: nearby restaurants)
CREATE INDEX IF NOT EXISTS idx_restaurants_coordinates ON restaurants(latitude, longitude);

COMMENT ON COLUMN restaurants.latitude IS 'Restaurant latitude from Google Maps Geocoding API';
COMMENT ON COLUMN restaurants.longitude IS 'Restaurant longitude from Google Maps Geocoding API';
COMMENT ON COLUMN restaurants.address_geocoded IS 'Whether address has been geocoded';
COMMENT ON COLUMN restaurants.geocoded_at IS 'When geocoding was last performed';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Coordinate columns added to restaurants table successfully';
  RAISE NOTICE 'ℹ️ Run geocodeRestaurants() from googleMapsService.js to populate coordinates';
END $$;
