-- Create drivers table for delivery drivers
CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,

  -- Personal Information
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) NOT NULL,
  password TEXT NOT NULL,
  secret_word TEXT, -- For password recovery

  -- Vehicle Information
  vehicle_type VARCHAR(50) NOT NULL, -- 'car', 'bike', 'scooter', 'motorcycle'
  vehicle_make VARCHAR(100),
  vehicle_model VARCHAR(100),
  vehicle_year INTEGER,
  vehicle_color VARCHAR(50) NOT NULL,
  license_plate VARCHAR(20) NOT NULL,

  -- Driver's License Document
  drivers_license_url TEXT, -- R2/S3 URL to uploaded license image
  drivers_license_verified BOOLEAN DEFAULT FALSE,

  -- Approval Status
  approval_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'suspended'
  approved_by INTEGER, -- FK to platform_admins(id) if table exists
  approved_at TIMESTAMP,
  rejection_reason TEXT,

  -- Stripe Connect for Payouts
  stripe_account_id VARCHAR(255), -- Stripe Express account ID
  stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
  stripe_charges_enabled BOOLEAN DEFAULT FALSE,
  stripe_payouts_enabled BOOLEAN DEFAULT FALSE,

  -- Availability Status
  is_available BOOLEAN DEFAULT FALSE, -- Currently accepting deliveries
  is_active BOOLEAN DEFAULT TRUE, -- Account active (not deleted)

  -- Location Tracking (optional for future features)
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  last_location_update TIMESTAMP,

  -- Statistics
  total_deliveries INTEGER DEFAULT 0,
  completed_deliveries INTEGER DEFAULT 0,
  cancelled_deliveries INTEGER DEFAULT 0,
  average_rating DECIMAL(3, 2) DEFAULT 0.00,
  total_earnings DECIMAL(10, 2) DEFAULT 0.00,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  last_login_ip VARCHAR(45)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_drivers_email ON drivers(email);
CREATE INDEX IF NOT EXISTS idx_drivers_approval_status ON drivers(approval_status);
CREATE INDEX IF NOT EXISTS idx_drivers_is_available ON drivers(is_available);
CREATE INDEX IF NOT EXISTS idx_drivers_stripe_account ON drivers(stripe_account_id);

-- Comments
COMMENT ON TABLE drivers IS 'Delivery drivers who claim and fulfill orders';
COMMENT ON COLUMN drivers.approval_status IS 'Admin approval status: pending, approved, rejected, suspended';
COMMENT ON COLUMN drivers.is_available IS 'Whether driver is currently online and accepting deliveries';
COMMENT ON COLUMN drivers.vehicle_type IS 'Type of vehicle: car, bike, scooter, motorcycle';
COMMENT ON COLUMN drivers.total_earnings IS 'Total lifetime earnings from completed deliveries';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Drivers table created successfully';
END $$;
