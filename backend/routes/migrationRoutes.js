import express from 'express';
import pool from '../db.js';
import { logger } from '../services/logger.js';

const router = express.Router();

/**
 * Migration endpoint to fix old /uploads/ image paths
 * This should be run once to migrate any legacy image URLs
 */
router.post('/fix-image-paths', async (req, res) => {
  try {
    console.log('🔧 Starting image path migration...');
    
    // Check current state
    const checkQuery = `
      SELECT 
        'restaurants' as table_name, 
        COUNT(*) as uploads_count
      FROM restaurants 
      WHERE image_url LIKE '/uploads/%'
      UNION ALL
      SELECT 
        'dishes' as table_name, 
        COUNT(*) as uploads_count
      FROM dishes 
      WHERE image_url LIKE '/uploads/%'
    `;
    
    const checkResult = await pool.query(checkQuery);
    console.log('📊 Current state:', checkResult.rows);
    
    // Update restaurants
    const updateRestaurantsQuery = `
      UPDATE restaurants 
      SET image_url = REPLACE(image_url, '/uploads/', '/api/r2-images/')
      WHERE image_url LIKE '/uploads/%'
      RETURNING id, name, image_url
    `;
    
    const restaurantResult = await pool.query(updateRestaurantsQuery);
    console.log(`✅ Updated ${restaurantResult.rowCount} restaurant image paths`);
    
    // Update dishes
    const updateDishesQuery = `
      UPDATE dishes
      SET image_url = REPLACE(image_url, '/uploads/', '/api/r2-images/')
      WHERE image_url LIKE '/uploads/%'
      RETURNING id, name, image_url
    `;
    
    const dishResult = await pool.query(updateDishesQuery);
    console.log(`✅ Updated ${dishResult.rowCount} dish image paths`);
    
    // Final verification
    const verifyQuery = `
      SELECT 
        'restaurants' as table_name, 
        COUNT(*) as r2_count
      FROM restaurants 
      WHERE image_url LIKE '/api/r2-images/%'
      UNION ALL
      SELECT 
        'dishes' as table_name, 
        COUNT(*) as r2_count
      FROM dishes 
      WHERE image_url LIKE '/api/r2-images/%'
    `;
    
    const verifyResult = await pool.query(verifyQuery);
    
    logger.info('Image path migration completed', {
      restaurantsUpdated: restaurantResult.rowCount,
      dishesUpdated: dishResult.rowCount,
      finalCounts: verifyResult.rows
    });
    
    res.json({
      success: true,
      message: 'Image path migration completed successfully',
      results: {
        restaurantsUpdated: restaurantResult.rowCount,
        dishesUpdated: dishResult.rowCount,
        updatedRestaurants: restaurantResult.rows,
        updatedDishes: dishResult.rows,
        finalCounts: verifyResult.rows
      }
    });
    
  } catch (error) {
    logger.error('Image path migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message
    });
  }
});

/**
 * Check current image path status
 */
router.get('/image-path-status', async (req, res) => {
  try {
    const statusQuery = `
      SELECT 
        'restaurants_with_uploads' as category,
        COUNT(*) as count
      FROM restaurants 
      WHERE image_url LIKE '/uploads/%'
      UNION ALL
      SELECT 
        'restaurants_with_r2' as category,
        COUNT(*) as count
      FROM restaurants 
      WHERE image_url LIKE '/api/r2-images/%'
      UNION ALL
      SELECT 
        'dishes_with_uploads' as category,
        COUNT(*) as count
      FROM dishes 
      WHERE image_url LIKE '/uploads/%'
      UNION ALL
      SELECT 
        'dishes_with_r2' as category,
        COUNT(*) as count
      FROM dishes 
      WHERE image_url LIKE '/api/r2-images/%'
    `;
    
    const result = await pool.query(statusQuery);
    
    res.json({
      success: true,
      status: result.rows.reduce((acc, row) => {
        acc[row.category] = parseInt(row.count);
        return acc;
      }, {})
    });
    
  } catch (error) {
    logger.error('Failed to get image path status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get status',
      details: error.message
    });
  }
});

export default router;