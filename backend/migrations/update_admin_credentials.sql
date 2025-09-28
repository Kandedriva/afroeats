-- Update admin credentials
-- This script updates the admin user with new credentials

-- Update admin email and username
UPDATE platform_admins 
SET 
  username = 'Kande',
  email = 'drivanokande4985@gmail.com',
  updated_at = NOW()
WHERE username = 'Kande' OR role = 'admin';

-- Note: Password was updated via secure Node.js script with proper bcrypt hashing