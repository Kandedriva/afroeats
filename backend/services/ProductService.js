import pool from '../db.js';

/**
 * Product Service
 * Handles all product-related business logic for marketplace
 * Admin-only product management
 */

class ProductService {
  /**
   * Get all products with optional filtering
   * @param {Object} filters - { category, is_available, search, limit, offset }
   * @returns {Array} Products list
   */
  static async getAllProducts(filters = {}) {
    try {
      let query = `
        SELECT
          p.id, p.name, p.description, p.price, p.category, p.subcategory, p.unit,
          p.stock_quantity, p.low_stock_threshold, p.is_available, p.store_id,
          p.image_url, p.additional_images, p.origin, p.organic, p.gluten_free, p.vegan,
          p.tags, p.platform_fee, p.created_at, p.updated_at,
          gs.name AS store_name
        FROM products p
        LEFT JOIN grocery_stores gs ON p.store_id = gs.id
        WHERE p.is_deleted = false
      `;
      const params = [];
      let paramCount = 1;

      // Filter by store
      if (filters.store_id) {
        query += ` AND p.store_id = $${paramCount}`;
        params.push(filters.store_id);
        paramCount++;
      }

      // Filter by category
      if (filters.category) {
        query += ` AND p.category = $${paramCount}`;
        params.push(filters.category);
        paramCount++;
      }

      // Filter by availability
      if (filters.is_available !== undefined) {
        query += ` AND p.is_available = $${paramCount}`;
        params.push(filters.is_available);
        paramCount++;
      }

      // Search by name or description
      if (filters.search) {
        query += ` AND (
          p.name ILIKE $${paramCount} OR
          p.description ILIKE $${paramCount} OR
          p.search_terms ILIKE $${paramCount}
        )`;
        params.push(`%${filters.search}%`);
        paramCount++;
      }

      // Filter by tags
      if (filters.tags && Array.isArray(filters.tags)) {
        query += ` AND p.tags ?| $${paramCount}`;
        params.push(filters.tags);
        paramCount++;
      }

      // Order by
      query += ' ORDER BY p.created_at DESC';

      // Pagination
      if (filters.limit) {
        query += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
        paramCount++;
      }

      if (filters.offset) {
        query += ` OFFSET $${paramCount}`;
        params.push(filters.offset);
      }

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Get all products error:', error);
      throw error;
    }
  }

  /**
   * Get product by ID
   * @param {number} productId
   * @returns {Object} Product details
   */
  static async getProductById(productId) {
    try {
      const result = await pool.query(
        `SELECT
          id, name, description, price, category, subcategory, unit,
          stock_quantity, low_stock_threshold, is_available,
          image_url, additional_images, origin, organic, gluten_free, vegan,
          tags, search_terms, created_at, updated_at
        FROM products
        WHERE id = $1 AND is_deleted = false`,
        [productId]
      );

      if (result.rows.length === 0) {
        throw new Error('Product not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Get product by ID error:', error);
      throw error;
    }
  }

  /**
   * Create new product (Admin only)
   * @param {Object} productData - Product details
   * @param {number} adminId - Admin creating the product
   * @returns {Object} Created product
   */
  static async createProduct(productData, adminId, adminEmail) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const {
        name, description, price, category, subcategory, unit,
        stock_quantity, low_stock_threshold, is_available,
        image_url, additional_images, origin, organic, gluten_free, vegan,
        tags, search_terms
      } = productData;

      // Validate required fields
      if (!name || !price || !category || !unit) {
        throw new Error('Missing required fields: name, price, category, unit');
      }

      // Insert product
      const result = await client.query(
        `INSERT INTO products (
          name, description, price, category, subcategory, unit,
          stock_quantity, low_stock_threshold, is_available,
          image_url, additional_images, origin, organic, gluten_free, vegan,
          tags, search_terms, created_by_admin_id, updated_by_admin_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18
        ) RETURNING *`,
        [
          name, description || null, price, category, subcategory || null, unit,
          stock_quantity || 0, low_stock_threshold || 10, is_available !== false,
          image_url || null, JSON.stringify(additional_images || []), origin || null,
          organic || false, gluten_free || false, vegan || false,
          JSON.stringify(tags || []), search_terms || null, adminId
        ]
      );

      const product = result.rows[0];

      // Log audit trail
      await client.query(
        `INSERT INTO product_audit_log (product_id, admin_id, admin_email, action, changes)
         VALUES ($1, $2, $3, 'created', $4)`,
        [product.id, adminId, adminEmail, JSON.stringify({ product })]
      );

      await client.query('COMMIT');

      console.log(`✅ Product created: ${product.name} (ID: ${product.id}) by admin ${adminEmail}`);
      return product;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create product error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update product (Admin only)
   * @param {number} productId
   * @param {Object} updates - Fields to update
   * @param {number} adminId - Admin making the update
   * @returns {Object} Updated product
   */
  static async updateProduct(productId, updates, adminId, adminEmail) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get old product data for audit log
      const oldProductResult = await client.query(
        'SELECT * FROM products WHERE id = $1 AND is_deleted = false',
        [productId]
      );

      if (oldProductResult.rows.length === 0) {
        throw new Error('Product not found');
      }

      const oldProduct = oldProductResult.rows[0];

      // Build update query dynamically
      const allowedFields = [
        'name', 'description', 'price', 'category', 'subcategory', 'unit',
        'stock_quantity', 'low_stock_threshold', 'is_available',
        'image_url', 'additional_images', 'origin', 'organic', 'gluten_free', 'vegan',
        'tags', 'search_terms'
      ];

      const updateFields = [];
      const values = [];
      let paramCount = 1;

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          updateFields.push(`${key} = $${paramCount}`);

          // Handle JSONB fields
          if (key === 'additional_images' || key === 'tags') {
            values.push(JSON.stringify(updates[key]));
          } else {
            values.push(updates[key]);
          }
          paramCount++;
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      // Add updated_by_admin_id
      updateFields.push(`updated_by_admin_id = $${paramCount}`);
      values.push(adminId);
      paramCount++;

      // Add product ID for WHERE clause
      values.push(productId);

      const query = `
        UPDATE products
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount} AND is_deleted = false
        RETURNING *
      `;

      const result = await client.query(query, values);
      const updatedProduct = result.rows[0];

      // Log audit trail with changes
      const changes = {};
      Object.keys(updates).forEach(key => {
        if (oldProduct[key] !== updatedProduct[key]) {
          changes[key] = {
            old: oldProduct[key],
            new: updatedProduct[key]
          };
        }
      });

      await client.query(
        `INSERT INTO product_audit_log (product_id, admin_id, admin_email, action, changes)
         VALUES ($1, $2, $3, 'updated', $4)`,
        [productId, adminId, adminEmail, JSON.stringify(changes)]
      );

      await client.query('COMMIT');

      console.log(`✅ Product updated: ${updatedProduct.name} (ID: ${productId}) by admin ${adminEmail}`);
      return updatedProduct;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Update product error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete product (soft delete)
   * @param {number} productId
   * @param {number} adminId
   * @returns {boolean} Success
   */
  static async deleteProduct(productId, adminId, adminEmail) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE products
         SET is_deleted = true, deleted_at = NOW(), updated_by_admin_id = $1
         WHERE id = $2 AND is_deleted = false
         RETURNING name`,
        [adminId, productId]
      );

      if (result.rows.length === 0) {
        throw new Error('Product not found or already deleted');
      }

      const productName = result.rows[0].name;

      // Log audit trail
      await client.query(
        `INSERT INTO product_audit_log (product_id, admin_id, admin_email, action, changes)
         VALUES ($1, $2, $3, 'deleted', $4)`,
        [productId, adminId, adminEmail, JSON.stringify({ deleted: true })]
      );

      await client.query('COMMIT');

      console.log(`✅ Product deleted: ${productName} (ID: ${productId}) by admin ${adminEmail}`);
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Delete product error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update stock quantity
   * @param {number} productId
   * @param {number} newQuantity
   * @param {number} adminId
   * @returns {Object} Updated product
   */
  static async updateStock(productId, newQuantity, adminId, adminEmail) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const oldStockResult = await client.query(
        'SELECT stock_quantity, name FROM products WHERE id = $1 AND is_deleted = false',
        [productId]
      );

      if (oldStockResult.rows.length === 0) {
        throw new Error('Product not found');
      }

      const oldStock = oldStockResult.rows[0].stock_quantity;
      const productName = oldStockResult.rows[0].name;

      const result = await client.query(
        `UPDATE products
         SET stock_quantity = $1, updated_by_admin_id = $2
         WHERE id = $3 AND is_deleted = false
         RETURNING *`,
        [newQuantity, adminId, productId]
      );

      // Log audit trail
      await client.query(
        `INSERT INTO product_audit_log (product_id, admin_id, admin_email, action, changes)
         VALUES ($1, $2, $3, 'stock_updated', $4)`,
        [productId, adminId, adminEmail, JSON.stringify({
          old_stock: oldStock,
          new_stock: newQuantity,
          difference: newQuantity - oldStock
        })]
      );

      await client.query('COMMIT');

      console.log(`✅ Stock updated for ${productName}: ${oldStock} → ${newQuantity} by admin ${adminEmail}`);
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Update stock error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all product categories
   * @returns {Array} Categories
   */
  static async getCategories() {
    try {
      const result = await pool.query(
        `SELECT id, name, display_name, description, icon, sort_order
         FROM product_categories
         WHERE is_active = true
         ORDER BY sort_order ASC`
      );
      return result.rows;
    } catch (error) {
      console.error('Get categories error:', error);
      throw error;
    }
  }

  /**
   * Get product statistics (for admin dashboard)
   * @returns {Object} Statistics
   */
  static async getProductStats() {
    try {
      const result = await pool.query(`
        SELECT
          COUNT(*) as total_products,
          COUNT(*) FILTER (WHERE is_available = true) as available_products,
          COUNT(*) FILTER (WHERE stock_quantity <= low_stock_threshold) as low_stock_products,
          COUNT(*) FILTER (WHERE stock_quantity = 0) as out_of_stock_products,
          ROUND(AVG(price)::numeric, 2) as average_price,
          SUM(stock_quantity) as total_stock_quantity
        FROM products
        WHERE is_deleted = false
      `);

      return result.rows[0];
    } catch (error) {
      console.error('Get product stats error:', error);
      throw error;
    }
  }

  /**
   * Get audit log for a product
   * @param {number} productId
   * @returns {Array} Audit log entries
   */
  static async getProductAuditLog(productId) {
    try {
      const result = await pool.query(
        `SELECT id, admin_id, admin_email, action, changes, created_at
         FROM product_audit_log
         WHERE product_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [productId]
      );
      return result.rows;
    } catch (error) {
      console.error('Get audit log error:', error);
      throw error;
    }
  }
}

export default ProductService;
