-- Add subscription columns to restaurant_owners table if they don't exist

-- Add is_subscribed column
DO $$ 
BEGIN 
    BEGIN
        ALTER TABLE restaurant_owners ADD COLUMN is_subscribed BOOLEAN DEFAULT FALSE;
    EXCEPTION
        WHEN duplicate_column THEN 
            RAISE NOTICE 'Column is_subscribed already exists in restaurant_owners';
    END;
END $$;

-- Add stripe_customer_id column  
DO $$ 
BEGIN 
    BEGIN
        ALTER TABLE restaurant_owners ADD COLUMN stripe_customer_id VARCHAR(255);
    EXCEPTION
        WHEN duplicate_column THEN 
            RAISE NOTICE 'Column stripe_customer_id already exists in restaurant_owners';
    END;
END $$;

-- Add stripe_account_id column (for Stripe Connect)
DO $$ 
BEGIN 
    BEGIN
        ALTER TABLE restaurant_owners ADD COLUMN stripe_account_id VARCHAR(255);
    EXCEPTION
        WHEN duplicate_column THEN 
            RAISE NOTICE 'Column stripe_account_id already exists in restaurant_owners';
    END;
END $$;