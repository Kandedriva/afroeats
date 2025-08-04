-- Create platform_admins table
CREATE TABLE IF NOT EXISTS platform_admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,
    last_login_ip INET
);

-- Insert default admin account
-- NOTE: Run this manually with your actual admin credentials
-- INSERT INTO platform_admins (username, email, password_hash, role, is_active) 
-- VALUES (
--     'admin',
--     'your_email@example.com',
--     'your_bcrypt_hashed_password',
--     'super_admin',
--     true
-- ) ON CONFLICT (email) DO NOTHING;

-- Create platform_settings table for future use
CREATE TABLE IF NOT EXISTS platform_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default platform settings
INSERT INTO platform_settings (key, value, description, category) VALUES
    ('platform_name', 'A Food Zone', 'Platform display name', 'general'),
    ('platform_fee_rate', '5.0', 'Platform fee percentage', 'general'),
    ('smtp_enabled', 'false', 'Enable email sending', 'email')
ON CONFLICT (key) DO NOTHING;