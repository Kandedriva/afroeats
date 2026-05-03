import express from 'express';
import ProductService from '../services/ProductService.js';
import adminAuth from '../middleware/adminAuth.js';
import { uploadProductImage, handleR2UploadResult, deleteOldR2Image } from '../middleware/r2Upload.js';

const router = express.Router();

/**
 * Product Routes
 *
 * Public routes (customer-facing):
 * - GET /api/products - Get all products (with filters)
 * - GET /api/products/:id - Get single product
 * - GET /api/products/categories - Get all categories
 *
 * Admin routes (protected):
 * - POST /api/products/admin - Create product
 * - PUT /api/products/admin/:id - Update product
 * - DELETE /api/products/admin/:id - Delete product
 * - PATCH /api/products/admin/:id/stock - Update stock
 * - GET /api/products/admin/stats - Get statistics
 * - GET /api/products/admin/:id/audit - Get audit log
 */

// ==================== PUBLIC ROUTES ====================

/**
 * GET /api/products
 * Get all products with optional filters
 * Query params: category, is_available, search, limit, offset, tags
 */
router.get('/', async (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      is_available: req.query.is_available === 'true' ? true : req.query.is_available === 'false' ? false : undefined,
      search: req.query.search,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined,
      tags: req.query.tags ? req.query.tags.split(',') : undefined,
      store_id: req.query.store_id ? parseInt(req.query.store_id) : undefined,
    };

    const products = await ProductService.getAllProducts(filters);
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/**
 * GET /api/products/categories
 * Get all product categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await ProductService.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * GET /api/products/:id
 * Get single product by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const numericId = parseInt(param);
    const product = isNaN(numericId)
      ? await ProductService.getProductBySlug(param)
      : await ProductService.getProductById(numericId);

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);

    if (error.message === 'Product not found') {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// ==================== ADMIN ROUTES (PROTECTED) ====================

/**
 * POST /api/products/admin
 * Create new product (admin only)
 */
router.post('/admin', adminAuth, ...uploadProductImage, async (req, res) => {
  try {
    console.log('=== PRODUCT CREATION DEBUG ===');
    console.log('req.body:', req.body);
    console.log('req.file:', req.file ? 'File present' : 'No file');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('=== END DEBUG ===');

    const productData = { ...req.body };
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    // Convert tags from comma-separated string to array if needed
    if (productData.tags && typeof productData.tags === 'string') {
      productData.tags = productData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    }

    // Convert boolean strings from FormData
    if (typeof productData.is_available === 'string') {
      productData.is_available = productData.is_available === 'true';
    }
    if (typeof productData.organic === 'string') {
      productData.organic = productData.organic === 'true';
    }
    if (typeof productData.gluten_free === 'string') {
      productData.gluten_free = productData.gluten_free === 'true';
    }
    if (typeof productData.vegan === 'string') {
      productData.vegan = productData.vegan === 'true';
    }

    // Convert numeric strings from FormData
    if (typeof productData.price === 'string') {
      productData.price = parseFloat(productData.price);
    }
    if (typeof productData.stock_quantity === 'string') {
      productData.stock_quantity = parseInt(productData.stock_quantity);
    }
    if (typeof productData.low_stock_threshold === 'string') {
      productData.low_stock_threshold = parseInt(productData.low_stock_threshold);
    }

    // Handle R2 upload result
    const uploadResult = handleR2UploadResult(req);

    if (uploadResult.success && uploadResult.imageUrl) {
      productData.image_url = uploadResult.imageUrl;
    } else if (uploadResult.error) {
      console.warn('Product image upload to R2 failed:', uploadResult.error);
      // Continue without image
    }

    const product = await ProductService.createProduct(productData, adminId, adminEmail);

    res.status(201).json({
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);

    if (error.message.includes('Missing required fields')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to create product' });
  }
});

/**
 * PUT /api/products/admin/:id
 * Update product (admin only)
 */
router.put('/admin/:id', adminAuth, ...uploadProductImage, async (req, res) => {
  try {
    console.log('=== PRODUCT UPDATE DEBUG ===');
    console.log('productId:', req.params.id);
    console.log('req.body:', req.body);
    console.log('req.file:', req.file ? 'File present' : 'No file');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('=== END DEBUG ===');

    const productId = parseInt(req.params.id);

    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const updates = { ...req.body };
    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    // Convert tags from comma-separated string to array if needed
    if (updates.tags && typeof updates.tags === 'string') {
      updates.tags = updates.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    }

    // Convert boolean strings from FormData
    if (typeof updates.is_available === 'string') {
      updates.is_available = updates.is_available === 'true';
    }
    if (typeof updates.organic === 'string') {
      updates.organic = updates.organic === 'true';
    }
    if (typeof updates.gluten_free === 'string') {
      updates.gluten_free = updates.gluten_free === 'true';
    }
    if (typeof updates.vegan === 'string') {
      updates.vegan = updates.vegan === 'true';
    }

    // Convert numeric strings from FormData
    if (typeof updates.price === 'string') {
      updates.price = parseFloat(updates.price);
    }
    if (typeof updates.stock_quantity === 'string') {
      updates.stock_quantity = parseInt(updates.stock_quantity);
    }
    if (typeof updates.low_stock_threshold === 'string') {
      updates.low_stock_threshold = parseInt(updates.low_stock_threshold);
    }

    // Get existing product to find old image
    const existingProduct = await ProductService.getProductById(productId);

    // Handle R2 upload result for new image
    const uploadResult = handleR2UploadResult(req);

    if (uploadResult.success && uploadResult.imageUrl) {
      // New image uploaded successfully
      updates.image_url = uploadResult.imageUrl;

      // Delete old image from R2 if it exists and is different
      if (existingProduct.image_url && existingProduct.image_url !== uploadResult.imageUrl) {
        try {
          await deleteOldR2Image(existingProduct.image_url);
        } catch (deleteErr) {
          console.warn('Failed to delete old product image from R2:', deleteErr);
          // Continue anyway - don't fail the update
        }
      }
    } else if (uploadResult.error) {
      console.warn('Product image upload to R2 failed:', uploadResult.error);
      // Continue without changing image
    }

    const product = await ProductService.updateProduct(productId, updates, adminId, adminEmail);

    res.json({
      message: 'Product updated successfully',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);

    if (error.message === 'Product not found') {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (error.message === 'No valid fields to update') {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to update product' });
  }
});

/**
 * DELETE /api/products/admin/:id
 * Delete product (soft delete, admin only)
 */
router.delete('/admin/:id', adminAuth, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);

    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    // Get product to find image URL before deletion
    const product = await ProductService.getProductById(productId);

    // Delete product from database
    await ProductService.deleteProduct(productId, adminId, adminEmail);

    // Delete associated image from R2 if it exists
    if (product.image_url) {
      try {
        await deleteOldR2Image(product.image_url);
      } catch (deleteErr) {
        console.warn('Failed to delete product image from R2:', deleteErr);
        // Continue anyway - product is already deleted from database
      }
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to delete product' });
  }
});

/**
 * PATCH /api/products/admin/:id/stock
 * Update product stock quantity (admin only)
 */
router.patch('/admin/:id/stock', adminAuth, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const { quantity } = req.body;

    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({ error: 'Valid quantity required (must be >= 0)' });
    }

    const adminId = req.admin.id;
    const adminEmail = req.admin.email;

    const product = await ProductService.updateStock(productId, quantity, adminId, adminEmail);

    res.json({
      message: 'Stock updated successfully',
      product
    });
  } catch (error) {
    console.error('Update stock error:', error);

    if (error.message === 'Product not found') {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(500).json({ error: 'Failed to update stock' });
  }
});

/**
 * GET /api/products/admin/stats
 * Get product statistics (admin only)
 */
router.get('/admin/stats', adminAuth, async (req, res) => {
  try {
    const stats = await ProductService.getProductStats();
    res.json(stats);
  } catch (error) {
    console.error('Get product stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/products/admin/:id/audit
 * Get product audit log (admin only)
 */
router.get('/admin/:id/audit', adminAuth, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);

    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const auditLog = await ProductService.getProductAuditLog(productId);
    res.json(auditLog);
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

export default router;
