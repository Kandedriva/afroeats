-- Migration: Add email verification fields to users table
-- Created: 2026-04-21

-- Add email verification columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_verification_code ON users(verification_code);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);

-- Add comment for documentation
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN users.verification_code IS '6-digit verification code sent to user email';
COMMENT ON COLUMN users.verification_code_expires_at IS 'Expiration timestamp for verification code (10 minutes from creation)';
COMMENT ON COLUMN users.verification_attempts IS 'Number of failed verification attempts';
