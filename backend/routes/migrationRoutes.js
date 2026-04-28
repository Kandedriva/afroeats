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

/**
 * POST /api/migration/create-grocery-owner-notifications
 * Run once to create the grocery_owner_notifications table if it doesn't exist
 */
router.post('/create-grocery-owner-notifications', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS grocery_owner_notifications (
        id SERIAL PRIMARY KEY,
        grocery_owner_id INTEGER REFERENCES grocery_store_owners(id) ON DELETE CASCADE,
        grocery_order_id INTEGER REFERENCES grocery_orders(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSONB,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_grocery_owner_notifications_owner_id
      ON grocery_owner_notifications(grocery_owner_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_grocery_owner_notifications_read
      ON grocery_owner_notifications(read)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_grocery_owner_notifications_created_at
      ON grocery_owner_notifications(created_at DESC)
    `);

    logger.info('grocery_owner_notifications table ensured');
    res.json({ success: true, message: 'grocery_owner_notifications table ready' });
  } catch (error) {
    logger.error('create-grocery-owner-notifications migration failed:', error);
    res.status(500).json({ success: false, error: 'Migration failed', details: error.message });
  }
});

/**
 * POST /api/migration/add-stripe-to-grocery-owners
 * Run once to add Stripe Connect columns to grocery_store_owners table
 */
router.post('/add-stripe-to-grocery-owners', async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE grocery_store_owners
      ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS stripe_details_submitted BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS stripe_connected_at TIMESTAMP
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_grocery_store_owners_stripe_account
      ON grocery_store_owners(stripe_account_id)
    `);

    logger.info('Stripe columns migration completed for grocery_store_owners');

    res.json({
      success: true,
      message: 'Stripe columns added to grocery_store_owners successfully'
    });
  } catch (error) {
    logger.error('Stripe migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: error.message
    });
  }
});

/**
 * POST /api/migration/create-grocery-carts
 * Creates grocery_carts table if it doesn't exist
 */
router.post('/create-grocery-carts', async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS grocery_carts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_grocery_carts_user_id ON grocery_carts(user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_grocery_carts_product_id ON grocery_carts(product_id)
    `);
    logger.info('grocery_carts table ensured');
    res.json({ success: true, message: 'grocery_carts table ready' });
  } catch (error) {
    logger.error('create-grocery-carts migration failed:', error);
    res.status(500).json({ success: false, error: 'Migration failed', details: error.message });
  }
});

/**
 * POST /api/migration/fix-product-store-ids
 * Assigns store_id to any products that have NULL store_id.
 * Uses the first grocery_stores row — safe for single-owner deployments.
 */
router.post('/fix-product-store-ids', async (req, res) => {
  try {
    // Count products needing fix
    const needsFixResult = await pool.query(
      `SELECT COUNT(*) as count FROM products WHERE store_id IS NULL`
    );
    const needsFix = parseInt(needsFixResult.rows[0].count);

    if (needsFix === 0) {
      return res.json({ success: true, message: 'All products already have store_id', updated: 0 });
    }

    // Get the first grocery store
    const storeResult = await pool.query(
      `SELECT gs.id as store_id, gs.name, gso.id as owner_id, gso.name as owner_name
       FROM grocery_stores gs
       JOIN grocery_store_owners gso ON gs.owner_id = gso.id
       LIMIT 1`
    );

    if (storeResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No grocery store found — register a grocery owner first' });
    }

    const store = storeResult.rows[0];

    // Update all NULL store_id products
    const updateResult = await pool.query(
      `UPDATE products SET store_id = $1 WHERE store_id IS NULL RETURNING id, name`,
      [store.store_id]
    );

    logger.info(`Fixed ${updateResult.rowCount} products with NULL store_id`, { storeId: store.store_id });

    res.json({
      success: true,
      message: `Fixed ${updateResult.rowCount} products`,
      assignedTo: { storeId: store.store_id, storeName: store.name, ownerName: store.owner_name },
      updated: updateResult.rowCount,
      products: updateResult.rows.slice(0, 20)
    });
  } catch (error) {
    logger.error('fix-product-store-ids failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/migration/diagnose-notifications?orderId=123
 * Runs every step of the owner notification chain for a given grocery order.
 * Use this to diagnose why notifications aren't being written.
 */
router.get('/diagnose-notifications', async (req, res) => {
  const orderId = parseInt(req.query.orderId);
  if (!orderId || isNaN(orderId)) {
    return res.status(400).json({ error: 'Pass ?orderId=<id>' });
  }

  const report = { orderId, steps: {} };

  try {
    // Step 1: does the order exist?
    const orderRow = await pool.query(
      `SELECT id, status, total, user_id, guest_email FROM grocery_orders WHERE id = $1`,
      [orderId]
    );
    report.steps.order = orderRow.rows[0] || null;

    // Step 2: order items and their store_ids
    const items = await pool.query(
      `SELECT goi.product_id, p.name, p.store_id
       FROM grocery_order_items goi
       LEFT JOIN products p ON goi.product_id = p.id
       WHERE goi.grocery_order_id = $1`,
      [orderId]
    );
    report.steps.orderItems = items.rows;

    // Step 3: distinct non-null store_ids
    const storeIdResult = await pool.query(
      `SELECT DISTINCT p.store_id
       FROM grocery_order_items goi
       JOIN products p ON goi.product_id = p.id
       WHERE goi.grocery_order_id = $1 AND p.store_id IS NOT NULL
       LIMIT 1`,
      [orderId]
    );
    report.steps.storeId = storeIdResult.rows[0]?.store_id || null;

    // Step 4: owner lookup
    if (report.steps.storeId) {
      const ownerResult = await pool.query(
        `SELECT gso.id, gso.name, gso.email
         FROM grocery_store_owners gso
         JOIN grocery_stores gs ON gs.owner_id = gso.id
         WHERE gs.id = $1`,
        [report.steps.storeId]
      );
      report.steps.owner = ownerResult.rows[0] || null;
    } else {
      report.steps.owner = null;
    }

    // Step 5: existing notifications for this order
    const existingNotifs = await pool.query(
      `SELECT * FROM grocery_owner_notifications WHERE grocery_order_id = $1`,
      [orderId]
    );
    report.steps.existingNotifications = existingNotifs.rows;

    // Step 6: all grocery_store_owners and their stores
    const allOwners = await pool.query(
      `SELECT gso.id, gso.name, gso.email, gs.id as store_id, gs.name as store_name
       FROM grocery_store_owners gso
       LEFT JOIN grocery_stores gs ON gs.owner_id = gso.id`
    );
    report.steps.allOwnersAndStores = allOwners.rows;

    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, report });
  }
});

export default router;