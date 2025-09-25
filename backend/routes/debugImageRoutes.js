import express from 'express';
import pool from '../db.js';
import r2Storage from '../services/r2Storage.js';

const router = express.Router();

/**
 * Debug endpoint to help diagnose image issues in production
 */
router.get('/image-debug/:restaurantId?', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    // Get sample data
    const restaurantQuery = restaurantId 
      ? 'SELECT * FROM restaurants WHERE id = $1'
      : 'SELECT * FROM restaurants WHERE image_url IS NOT NULL LIMIT 3';
    
    const restaurants = await pool.query(restaurantQuery, restaurantId ? [restaurantId] : []);
    
    const dishQuery = restaurantId 
      ? 'SELECT * FROM dishes WHERE restaurant_id = $1 AND image_url IS NOT NULL LIMIT 5'
      : 'SELECT * FROM dishes WHERE image_url IS NOT NULL LIMIT 5';
      
    const dishes = await pool.query(dishQuery, restaurantId ? [restaurantId] : []);
    
    // Process URLs for debugging
    const processedRestaurants = restaurants.rows.map(restaurant => {
      if (restaurant.image_url) {
        return {
          ...restaurant,
          processed_url: r2Storage.getPublicUrl(restaurant.image_url.replace('/api/r2-images/', ''), req),
          raw_url: restaurant.image_url
        };
      }
      return restaurant;
    });
    
    const processedDishes = dishes.rows.map(dish => {
      if (dish.image_url) {
        return {
          ...dish,
          processed_url: r2Storage.getPublicUrl(dish.image_url.replace('/api/r2-images/', ''), req),
          raw_url: dish.image_url
        };
      }
      return dish;
    });
    
    res.json({
      success: true,
      debug_info: {
        environment: process.env.NODE_ENV,
        r2_configured: r2Storage.isConfigured(),
        request_headers: {
          host: req.get('host'),
          origin: req.get('origin'),
          'user-agent': req.get('user-agent'),
          'x-forwarded-proto': req.get('x-forwarded-proto'),
          'x-forwarded-host': req.get('x-forwarded-host')
        },
        backend_url: process.env.BACKEND_URL,
      },
      sample_data: {
        restaurants: processedRestaurants,
        dishes: processedDishes.slice(0, 3) // Limit for readability
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;