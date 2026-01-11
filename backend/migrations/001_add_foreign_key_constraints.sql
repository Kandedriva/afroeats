-- Migration: Add Foreign Key Constraints for Data Integrity
-- Created: 2026-01-06
-- Description: Adds foreign key constraints to all tables to ensure referential integrity
-- and prevent orphaned records

-- Note: This migration assumes tables already exist.
-- Run this after initial table creation.

BEGIN;

-- ============================================================================
-- RESTAURANTS TABLE - Foreign Keys
-- ============================================================================

-- Add foreign key constraint from restaurants to restaurant_owners
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_restaurants_owner_id'
        AND table_name = 'restaurants'
    ) THEN
        ALTER TABLE restaurants
        ADD CONSTRAINT fk_restaurants_owner_id
        FOREIGN KEY (owner_id)
        REFERENCES restaurant_owners(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE;

        RAISE NOTICE 'Added foreign key constraint: fk_restaurants_owner_id';
    ELSE
        RAISE NOTICE 'Foreign key constraint fk_restaurants_owner_id already exists';
    END IF;
END $$;

-- ============================================================================
-- DISHES TABLE - Foreign Keys
-- ============================================================================

-- Add foreign key constraint from dishes to restaurants
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_dishes_restaurant_id'
        AND table_name = 'dishes'
    ) THEN
        ALTER TABLE dishes
        ADD CONSTRAINT fk_dishes_restaurant_id
        FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE;

        RAISE NOTICE 'Added foreign key constraint: fk_dishes_restaurant_id';
    ELSE
        RAISE NOTICE 'Foreign key constraint fk_dishes_restaurant_id already exists';
    END IF;
END $$;

-- ============================================================================
-- ORDERS TABLE - Foreign Keys
-- ============================================================================

-- Add foreign key constraint from orders to users (nullable for guest orders)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_orders_user_id'
        AND table_name = 'orders'
    ) THEN
        -- Only add if user_id column can be null (for guest orders)
        ALTER TABLE orders
        ADD CONSTRAINT fk_orders_user_id
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;

        RAISE NOTICE 'Added foreign key constraint: fk_orders_user_id';
    ELSE
        RAISE NOTICE 'Foreign key constraint fk_orders_user_id already exists';
    END IF;
END $$;

-- ============================================================================
-- ORDER_ITEMS TABLE - Foreign Keys
-- ============================================================================

-- Add foreign key constraint from order_items to orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_order_items_order_id'
        AND table_name = 'order_items'
    ) THEN
        ALTER TABLE order_items
        ADD CONSTRAINT fk_order_items_order_id
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE;

        RAISE NOTICE 'Added foreign key constraint: fk_order_items_order_id';
    ELSE
        RAISE NOTICE 'Foreign key constraint fk_order_items_order_id already exists';
    END IF;
END $$;

-- Add foreign key constraint from order_items to dishes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_order_items_dish_id'
        AND table_name = 'order_items'
    ) THEN
        ALTER TABLE order_items
        ADD CONSTRAINT fk_order_items_dish_id
        FOREIGN KEY (dish_id)
        REFERENCES dishes(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE;

        RAISE NOTICE 'Added foreign key constraint: fk_order_items_dish_id';
    ELSE
        RAISE NOTICE 'Foreign key constraint fk_order_items_dish_id already exists';
    END IF;
END $$;

-- Add foreign key constraint from order_items to restaurants (if column exists)
DO $$
BEGIN
    -- Check if restaurant_id column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order_items' AND column_name = 'restaurant_id'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_order_items_restaurant_id'
            AND table_name = 'order_items'
        ) THEN
            ALTER TABLE order_items
            ADD CONSTRAINT fk_order_items_restaurant_id
            FOREIGN KEY (restaurant_id)
            REFERENCES restaurants(id)
            ON DELETE RESTRICT
            ON UPDATE CASCADE;

            RAISE NOTICE 'Added foreign key constraint: fk_order_items_restaurant_id';
        ELSE
            RAISE NOTICE 'Foreign key constraint fk_order_items_restaurant_id already exists';
        END IF;
    ELSE
        RAISE NOTICE 'Column restaurant_id does not exist in order_items, skipping FK';
    END IF;
END $$;

-- ============================================================================
-- CARTS TABLE - Foreign Keys
-- ============================================================================

-- Add foreign key constraint from carts to users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_carts_user_id'
        AND table_name = 'carts'
    ) THEN
        ALTER TABLE carts
        ADD CONSTRAINT fk_carts_user_id
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE;

        RAISE NOTICE 'Added foreign key constraint: fk_carts_user_id';
    ELSE
        RAISE NOTICE 'Foreign key constraint fk_carts_user_id already exists';
    END IF;
END $$;

-- Add foreign key constraint from carts to dishes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_carts_dish_id'
        AND table_name = 'carts'
    ) THEN
        ALTER TABLE carts
        ADD CONSTRAINT fk_carts_dish_id
        FOREIGN KEY (dish_id)
        REFERENCES dishes(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE;

        RAISE NOTICE 'Added foreign key constraint: fk_carts_dish_id';
    ELSE
        RAISE NOTICE 'Foreign key constraint fk_carts_dish_id already exists';
    END IF;
END $$;

-- ============================================================================
-- NOTIFICATIONS TABLE - Foreign Keys (if exists)
-- ============================================================================

DO $$
BEGIN
    -- Check if notifications table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'notifications'
    ) THEN
        -- Add FK to restaurant_owners if owner_id column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'notifications' AND column_name = 'owner_id'
        ) THEN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_notifications_owner_id'
                AND table_name = 'notifications'
            ) THEN
                ALTER TABLE notifications
                ADD CONSTRAINT fk_notifications_owner_id
                FOREIGN KEY (owner_id)
                REFERENCES restaurant_owners(id)
                ON DELETE CASCADE
                ON UPDATE CASCADE;

                RAISE NOTICE 'Added foreign key constraint: fk_notifications_owner_id';
            END IF;
        END IF;

        -- Add FK to orders if order_id column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'notifications' AND column_name = 'order_id'
        ) THEN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_notifications_order_id'
                AND table_name = 'notifications'
            ) THEN
                ALTER TABLE notifications
                ADD CONSTRAINT fk_notifications_order_id
                FOREIGN KEY (order_id)
                REFERENCES orders(id)
                ON DELETE CASCADE
                ON UPDATE CASCADE;

                RAISE NOTICE 'Added foreign key constraint: fk_notifications_order_id';
            END IF;
        END IF;
    END IF;
END $$;

-- ============================================================================
-- CUSTOMER_NOTIFICATIONS TABLE - Foreign Keys (if exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'customer_notifications'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_customer_notifications_user_id'
            AND table_name = 'customer_notifications'
        ) THEN
            ALTER TABLE customer_notifications
            ADD CONSTRAINT fk_customer_notifications_user_id
            FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE;

            RAISE NOTICE 'Added foreign key constraint: fk_customer_notifications_user_id';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- RESTAURANT_PAYMENTS TABLE - Foreign Keys (if exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'restaurant_payments'
    ) THEN
        -- FK to orders
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_restaurant_payments_order_id'
            AND table_name = 'restaurant_payments'
        ) THEN
            ALTER TABLE restaurant_payments
            ADD CONSTRAINT fk_restaurant_payments_order_id
            FOREIGN KEY (order_id)
            REFERENCES orders(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE;

            RAISE NOTICE 'Added foreign key constraint: fk_restaurant_payments_order_id';
        END IF;

        -- FK to restaurants
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_restaurant_payments_restaurant_id'
            AND table_name = 'restaurant_payments'
        ) THEN
            ALTER TABLE restaurant_payments
            ADD CONSTRAINT fk_restaurant_payments_restaurant_id
            FOREIGN KEY (restaurant_id)
            REFERENCES restaurants(id)
            ON DELETE CASCADE
            ON UPDATE CASCADE;

            RAISE NOTICE 'Added foreign key constraint: fk_restaurant_payments_restaurant_id';
        END IF;
    END IF;
END $$;

-- ============================================================================
-- SUPPORT_MESSAGES TABLE - Foreign Keys (if exists)
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'support_messages'
    ) THEN
        -- FK to users (nullable)
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'support_messages' AND column_name = 'user_id'
        ) THEN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_support_messages_user_id'
                AND table_name = 'support_messages'
            ) THEN
                ALTER TABLE support_messages
                ADD CONSTRAINT fk_support_messages_user_id
                FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE SET NULL
                ON UPDATE CASCADE;

                RAISE NOTICE 'Added foreign key constraint: fk_support_messages_user_id';
            END IF;
        END IF;
    END IF;
END $$;

-- ============================================================================
-- Summary of Foreign Key Constraints
-- ============================================================================

DO $$
DECLARE
    fk_count integer;
BEGIN
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public';

    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Foreign Key Migration Complete';
    RAISE NOTICE 'Total Foreign Keys in database: %', fk_count;
    RAISE NOTICE '===========================================';
END $$;

COMMIT;

-- To rollback this migration, run the following:
-- (Save this as rollback script if needed)

/*
BEGIN;

ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS fk_restaurants_owner_id CASCADE;
ALTER TABLE dishes DROP CONSTRAINT IF EXISTS fk_dishes_restaurant_id CASCADE;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_user_id CASCADE;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS fk_order_items_order_id CASCADE;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS fk_order_items_dish_id CASCADE;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS fk_order_items_restaurant_id CASCADE;
ALTER TABLE carts DROP CONSTRAINT IF EXISTS fk_carts_user_id CASCADE;
ALTER TABLE carts DROP CONSTRAINT IF EXISTS fk_carts_dish_id CASCADE;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_owner_id CASCADE;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS fk_notifications_order_id CASCADE;
ALTER TABLE customer_notifications DROP CONSTRAINT IF EXISTS fk_customer_notifications_user_id CASCADE;
ALTER TABLE restaurant_payments DROP CONSTRAINT IF EXISTS fk_restaurant_payments_order_id CASCADE;
ALTER TABLE restaurant_payments DROP CONSTRAINT IF EXISTS fk_restaurant_payments_restaurant_id CASCADE;
ALTER TABLE support_messages DROP CONSTRAINT IF EXISTS fk_support_messages_user_id CASCADE;

COMMIT;
*/
