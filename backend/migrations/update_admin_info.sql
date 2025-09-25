-- Update admin information
-- Change admin username to Kande and role to admin

-- Update the admin username and role
UPDATE platform_admins 
SET 
  username = 'Kande',
  role = 'admin',
  updated_at = NOW()
WHERE username = 'admin' OR role = 'super_admin';

-- Update platform name in settings
UPDATE platform_settings 
SET 
  value = 'Order Dabaly',
  updated_at = NOW()
WHERE key = 'platform_name';

-- Ensure any other super_admin roles are changed to admin
UPDATE platform_admins 
SET 
  role = 'admin',
  updated_at = NOW()
WHERE role = 'super_admin';