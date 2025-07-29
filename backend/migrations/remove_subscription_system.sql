-- Remove subscription system from A Food Zone
-- This migration removes all subscription-related columns and tables

-- Remove subscription columns from restaurant_owners table
DO $$ 
BEGIN 
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='restaurant_owners' AND column_name='is_subscribed') THEN
    ALTER TABLE restaurant_owners DROP COLUMN is_subscribed;
  END IF;
  
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='restaurant_owners' AND column_name='stripe_customer_id') THEN
    ALTER TABLE restaurant_owners DROP COLUMN stripe_customer_id;
  END IF;
  
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='restaurant_owners' AND column_name='subscription_status') THEN
    ALTER TABLE restaurant_owners DROP COLUMN subscription_status;
  END IF;
  
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='restaurant_owners' AND column_name='subscription_id') THEN
    ALTER TABLE restaurant_owners DROP COLUMN subscription_id;
  END IF;
  
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='restaurant_owners' AND column_name='subscription_end_date') THEN
    ALTER TABLE restaurant_owners DROP COLUMN subscription_end_date;
  END IF;
END $$;

-- Drop subscription-related tables if they exist
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_payments CASCADE;
DROP TABLE IF EXISTS stripe_subscriptions CASCADE;

-- Update platform settings to reflect new commission-only model
UPDATE platform_settings 
SET value = 'Commission-based platform - no subscriptions required' 
WHERE key = 'subscription_model' AND EXISTS(
  SELECT 1 FROM platform_settings WHERE key = 'subscription_model'
);

-- Insert or update platform fee information
INSERT INTO platform_settings (key, value, description, category, is_public) VALUES
  ('commission_fee', '1.20', 'Fixed commission fee per order in USD', 'financial', false),
  ('commission_model', 'fixed', 'Commission model: fixed or percentage', 'financial', false)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- Clean up any subscription references in orders or other tables
UPDATE orders SET notes = REPLACE(notes, 'subscription', 'commission') WHERE notes LIKE '%subscription%';

-- Remove any subscription-related constraints or indexes
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conname LIKE '%subscription%'
    LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident((SELECT nspname FROM pg_namespace WHERE oid = connamespace)) || 
                '.' || quote_ident((SELECT relname FROM pg_class WHERE oid = conrelid)) || 
                ' DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name);
    END LOOP;
END $$;

-- Log the migration
INSERT INTO platform_settings (key, value, description, category, is_public) VALUES
  ('migration_subscription_removal', NOW()::text, 'Timestamp when subscription system was removed', 'system', false)
ON CONFLICT (key) DO UPDATE SET value = NOW()::text;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Subscription system successfully removed from A Food Zone platform';
  RAISE NOTICE 'Platform now operates on commission-only model';
  RAISE NOTICE 'Fixed commission fee: $1.20 per order';
END $$;