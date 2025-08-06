-- Performance optimization indexes for Afro Restaurant database
-- Run this after all tables are created

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email_btree ON users USING btree(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at) WHERE last_login_at IS NOT NULL;

-- Restaurant owners table indexes  
CREATE INDEX IF NOT EXISTS idx_restaurant_owners_email_btree ON restaurant_owners USING btree(email);
CREATE INDEX IF NOT EXISTS idx_restaurant_owners_created_at ON restaurant_owners(created_at);

-- Restaurants table indexes
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_created_at ON restaurants(created_at);
CREATE INDEX IF NOT EXISTS idx_restaurants_name_trgm ON restaurants USING gin(name gin_trgm_ops); -- For search
CREATE INDEX IF NOT EXISTS idx_restaurants_stripe_account ON restaurants(stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- Dishes table indexes
CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_id ON dishes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dishes_available ON dishes(is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_available ON dishes(restaurant_id, is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_dishes_price ON dishes(price);
CREATE INDEX IF NOT EXISTS idx_dishes_created_at ON dishes(created_at);
CREATE INDEX IF NOT EXISTS idx_dishes_name_trgm ON dishes USING gin(name gin_trgm_ops); -- For search

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(paid_at) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_total ON orders(total) WHERE total > 0;
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- Order items table indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_dish_id ON order_items(dish_id);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_id ON order_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_restaurant ON order_items(order_id, restaurant_id);

-- Cart table indexes
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_dish_id ON carts(dish_id);
CREATE INDEX IF NOT EXISTS idx_carts_user_dish ON carts(user_id, dish_id);
CREATE INDEX IF NOT EXISTS idx_carts_created_at ON carts(created_at);

-- Sessions table indexes (if using PostgreSQL session store)
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);

-- Notifications table indexes (if exists)
CREATE INDEX IF NOT EXISTS idx_notifications_owner_id ON notifications(owner_id) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications');
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications');
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications');
CREATE INDEX IF NOT EXISTS idx_notifications_owner_unread ON notifications(owner_id, read, created_at DESC) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications');

-- Customer notifications table indexes
CREATE INDEX IF NOT EXISTS idx_customer_notifications_user_id ON customer_notifications(user_id) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_notifications');
CREATE INDEX IF NOT EXISTS idx_customer_notifications_read ON customer_notifications(read) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_notifications');
CREATE INDEX IF NOT EXISTS idx_customer_notifications_user_unread ON customer_notifications(user_id, read, created_at DESC) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_notifications');

-- Restaurant order status table indexes
CREATE INDEX IF NOT EXISTS idx_restaurant_order_status_order_id ON restaurant_order_status(order_id) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'restaurant_order_status');
CREATE INDEX IF NOT EXISTS idx_restaurant_order_status_restaurant_id ON restaurant_order_status(restaurant_id) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'restaurant_order_status');
CREATE INDEX IF NOT EXISTS idx_restaurant_order_status_status ON restaurant_order_status(status) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'restaurant_order_status');
CREATE INDEX IF NOT EXISTS idx_restaurant_order_status_composite ON restaurant_order_status(order_id, restaurant_id) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'restaurant_order_status');

-- Platform admins table indexes
CREATE INDEX IF NOT EXISTS idx_platform_admins_username ON platform_admins(username) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_admins');
CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON platform_admins(email) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_admins');
CREATE INDEX IF NOT EXISTS idx_platform_admins_active ON platform_admins(is_active) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_admins');
CREATE INDEX IF NOT EXISTS idx_platform_admins_last_login ON platform_admins(last_login_at) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_admins');

-- Performance monitoring indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON performance_metrics(metric_type) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'performance_metrics');
CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded_at ON performance_metrics(recorded_at) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'performance_metrics');
CREATE INDEX IF NOT EXISTS idx_performance_metrics_type_recorded ON performance_metrics(metric_type, recorded_at DESC) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'performance_metrics');

-- Error logs indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'error_logs');
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'error_logs');
CREATE INDEX IF NOT EXISTS idx_error_logs_occurred_at ON error_logs(occurred_at) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'error_logs');
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'error_logs');
CREATE INDEX IF NOT EXISTS idx_error_logs_category_severity ON error_logs(category, severity, occurred_at DESC) WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'error_logs');

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_items ON order_items(restaurant_id, order_id, dish_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_dishes_available ON dishes(restaurant_id, is_available, created_at DESC) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_user_orders_recent ON orders(user_id, created_at DESC, status);

-- Partial indexes for better performance on filtered queries
CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders(created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_orders_paid ON orders(created_at DESC) WHERE status IN ('paid', 'completed');
CREATE INDEX IF NOT EXISTS idx_orders_cancelled ON orders(created_at DESC) WHERE status = 'cancelled';

-- Enable pg_trgm extension for text search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable pg_stat_statements for query performance monitoring (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Statistics for query planner optimization
ANALYZE users;
ANALYZE restaurant_owners;
ANALYZE restaurants;
ANALYZE dishes;
ANALYZE orders;
ANALYZE order_items;
ANALYZE carts;

-- Create materialized view for dashboard analytics (optional optimization)
CREATE MATERIALIZED VIEW IF NOT EXISTS restaurant_analytics AS
SELECT 
    r.id as restaurant_id,
    r.name as restaurant_name,
    r.owner_id,
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT o.user_id) as unique_customers,
    COALESCE(SUM(oi.price * oi.quantity), 0) as total_revenue,
    COALESCE(AVG(oi.price * oi.quantity), 0) as avg_order_value,
    COUNT(DISTINCT d.id) as total_dishes,
    COUNT(DISTINCT CASE WHEN d.is_available THEN d.id END) as available_dishes,
    MAX(o.created_at) as last_order_date,
    MIN(o.created_at) as first_order_date
FROM restaurants r
LEFT JOIN dishes d ON r.id = d.restaurant_id
LEFT JOIN order_items oi ON d.id = oi.dish_id
LEFT JOIN orders o ON oi.order_id = o.id AND o.status IN ('paid', 'completed')
GROUP BY r.id, r.name, r.owner_id;

-- Index for the materialized view
CREATE INDEX IF NOT EXISTS idx_restaurant_analytics_owner ON restaurant_analytics(owner_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_analytics_revenue ON restaurant_analytics(total_revenue DESC);
CREATE INDEX IF NOT EXISTS idx_restaurant_analytics_orders ON restaurant_analytics(total_orders DESC);

-- Function to refresh analytics (call periodically)
CREATE OR REPLACE FUNCTION refresh_restaurant_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW restaurant_analytics;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON INDEX idx_users_email_btree IS 'B-tree index for user email lookups during authentication';
COMMENT ON INDEX idx_orders_user_created IS 'Composite index for user order history queries';
COMMENT ON INDEX idx_dishes_restaurant_available IS 'Composite index for restaurant menu display';
COMMENT ON INDEX idx_restaurants_name_trgm IS 'GIN trigram index for restaurant name search';
COMMENT ON MATERIALIZED VIEW restaurant_analytics IS 'Pre-computed restaurant performance metrics for dashboard';

-- Display index creation summary
DO $$
DECLARE
    index_count integer;
BEGIN
    SELECT COUNT(*) INTO index_count 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%';
    
    RAISE NOTICE 'Performance optimization complete. Created % indexes.', index_count;
END $$;