-- Migration: Add Stripe Connect fields to grocery_store_owners
-- Date: 2026-04-24
-- Description: Add Stripe Connect account fields for grocery owners to receive payments directly

-- Add Stripe Connect fields to grocery_store_owners table
ALTER TABLE grocery_store_owners
ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_details_submitted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_connected_at TIMESTAMP;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_grocery_store_owners_stripe_account ON grocery_store_owners(stripe_account_id);

-- Add comments
COMMENT ON COLUMN grocery_store_owners.stripe_account_id IS 'Stripe Connect account ID for receiving payments';
COMMENT ON COLUMN grocery_store_owners.stripe_onboarding_complete IS 'Whether Stripe onboarding is complete';
COMMENT ON COLUMN grocery_store_owners.stripe_details_submitted IS 'Whether all required details are submitted to Stripe';
COMMENT ON COLUMN grocery_store_owners.stripe_charges_enabled IS 'Whether the account can accept charges';
COMMENT ON COLUMN grocery_store_owners.stripe_payouts_enabled IS 'Whether the account can receive payouts';
