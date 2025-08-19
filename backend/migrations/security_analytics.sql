-- Security and Analytics Database Schema Updates

-- Platform administrators table
CREATE TABLE IF NOT EXISTS platform_admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  last_login_ip INET,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP
);

-- Daily analytics storage
CREATE TABLE IF NOT EXISTS daily_analytics (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  unique_visitors INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  registrations INTEGER DEFAULT 0,
  orders INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  platform_fees DECIMAL(10,2) DEFAULT 0,
  active_restaurants INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Email logs for tracking sent emails
CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  sent_at TIMESTAMP,
  failed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- System logs for monitoring
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  level VARCHAR(10) NOT NULL, -- error, warn, info, debug
  message TEXT NOT NULL,
  context JSONB,
  user_id INTEGER REFERENCES users(id),
  admin_id INTEGER REFERENCES platform_admins(id),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Security events log
CREATE TABLE IF NOT EXISTS security_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL, -- login_failed, suspicious_activity, rate_limit_exceeded, etc.
  severity VARCHAR(10) NOT NULL, -- low, medium, high, critical
  description TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  user_id INTEGER REFERENCES users(id),
  admin_id INTEGER REFERENCES platform_admins(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Platform settings
CREATE TABLE IF NOT EXISTS platform_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'general',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Session store (if using database sessions)
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expires TIMESTAMP NOT NULL,
  PRIMARY KEY (sid)
);

-- API keys for external integrations
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_by INTEGER REFERENCES platform_admins(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_analytics_date ON daily_analytics(date);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip_address);

-- Add indexes to existing tables for better performance
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_restaurants_created_at ON restaurants(created_at);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner_id ON restaurants(owner_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_id ON order_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_id ON dishes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dishes_is_available ON dishes(is_available);

-- Insert default platform admin (password: Admin123!)
INSERT INTO platform_admins (username, email, password_hash, role) 
VALUES (
  'admin',
  'admin@orderdabaly.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- bcrypt hash of 'Admin123!'
  'super_admin'
) ON CONFLICT (email) DO NOTHING;

-- Insert default platform settings
INSERT INTO platform_settings (key, value, description, category, is_public) VALUES
  ('platform_name', 'A Food Zone', 'Name of the platform', 'general', true),
  ('platform_fee_rate', '5.0', 'Platform fee percentage', 'financial', false),
  ('max_order_amount', '1000.00', 'Maximum order amount allowed', 'orders', false),
  ('email_enabled', 'true', 'Enable email notifications', 'email', false),
  ('maintenance_mode', 'false', 'Enable maintenance mode', 'system', false),
  ('registration_enabled', 'true', 'Allow new user registrations', 'system', true),
  ('upload_max_size', '5242880', 'Maximum upload size in bytes (5MB)', 'uploads', false)
ON CONFLICT (key) DO NOTHING;

-- Add columns to existing tables if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip INET;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);

ALTER TABLE restaurant_owners ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE restaurant_owners ADD COLUMN IF NOT EXISTS last_login_ip INET;
ALTER TABLE restaurant_owners ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_daily_analytics_updated_at ON daily_analytics;
CREATE TRIGGER update_daily_analytics_updated_at 
  BEFORE UPDATE ON daily_analytics 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER update_platform_settings_updated_at 
  BEFORE UPDATE ON platform_settings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();