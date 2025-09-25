-- Fix Image URLs Migration
-- This script updates any old /uploads/ paths to use /api/r2-images/ paths

-- First, let's see what we have
SELECT 'RESTAURANTS with /uploads/ paths:' as info;
SELECT id, name, image_url 
FROM restaurants 
WHERE image_url LIKE '/uploads/%';

SELECT 'DISHES with /uploads/ paths:' as info;  
SELECT id, name, image_url 
FROM dishes 
WHERE image_url LIKE '/uploads/%';

-- Update restaurants table
UPDATE restaurants 
SET image_url = REPLACE(image_url, '/uploads/', '/api/r2-images/')
WHERE image_url LIKE '/uploads/%';

-- Update dishes table  
UPDATE dishes
SET image_url = REPLACE(image_url, '/uploads/', '/api/r2-images/')
WHERE image_url LIKE '/uploads/%';

-- Show results
SELECT 'UPDATED RESTAURANTS:' as info;
SELECT COUNT(*) as updated_restaurants
FROM restaurants 
WHERE image_url LIKE '/api/r2-images/%';

SELECT 'UPDATED DISHES:' as info;
SELECT COUNT(*) as updated_dishes
FROM dishes 
WHERE image_url LIKE '/api/r2-images/%';

-- Also check for any malformed URLs that might exist
SELECT 'CHECKING for duplicate /api/ in URLs:' as info;
SELECT id, name, image_url
FROM restaurants 
WHERE image_url LIKE '%/api/r2-images/api/r2-images/%'
UNION ALL
SELECT id, name, image_url  
FROM dishes
WHERE image_url LIKE '%/api/r2-images/api/r2-images/%';