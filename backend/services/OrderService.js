/**
 * Order Service
 *
 * Handles all business logic related to orders
 * Separates concerns from route handlers
 */

import pool from '../db.js';
import { Errors, AppError } from '../utils/errorHandler.js';
import { paginateQuery, buildPaginationMeta } from '../utils/pagination.js';

class OrderService {
  /**
   * Get order by ID with full details
   *
   * @param {number} orderId - Order ID
   * @param {number} userId - User ID (for authorization)
   * @param {boolean} isOwner - Whether requester is restaurant owner
   * @returns {Promise<Object>} Order with items
   */
  async getOrderById(orderId, userId = null, isOwner = false) {
    // Get order
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw Errors.notFound('Order', orderId);
    }

    const order = orderResult.rows[0];

    // Authorization check
    if (!isOwner && userId && order.user_id !== userId) {
      throw Errors.forbidden('You do not have permission to view this order');
    }

    // Get order items with restaurant and dish details (optimized with JOIN)
    const itemsResult = await pool.query(`
      SELECT
        oi.*,
        r.id as restaurant_id,
        r.name as restaurant_name,
        r.phone_number as restaurant_phone,
        r.address as restaurant_address,
        d.image_url as dish_image
      FROM order_items oi
      LEFT JOIN restaurants r ON oi.restaurant_id = r.id
      LEFT JOIN dishes d ON oi.dish_id = d.id
      WHERE oi.order_id = $1
      ORDER BY oi.id
    `, [orderId]);

    return {
      ...order,
      items: itemsResult.rows,
    };
  }

  /**
   * Get user's orders with pagination
   *
   * @param {number} userId - User ID
   * @param {Object} pagination - Pagination params { page, limit, offset }
   * @param {Object} filters - Optional filters { status }
   * @returns {Promise<Object>} Orders with pagination metadata
   */
  async getUserOrders(userId, pagination, filters = {}) {
    const { page, limit, offset } = pagination;

    // Build WHERE clause
    let whereConditions = ['user_id = $1'];
    let params = [userId];
    let paramIndex = 2;

    if (filters.status) {
      whereConditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM orders WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated orders with item count (using subquery for efficiency)
    const ordersResult = await pool.query(`
      SELECT
        o.*,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
        (SELECT json_agg(DISTINCT r.name)
         FROM order_items oi
         LEFT JOIN restaurants r ON oi.restaurant_id = r.id
         WHERE oi.order_id = o.id
        ) as restaurant_names
      FROM orders o
      WHERE ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    return {
      orders: ordersResult.rows,
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Get restaurant's orders with pagination
   *
   * @param {number} restaurantId - Restaurant ID
   * @param {Object} pagination - Pagination params
   * @param {Object} filters - Optional filters { status }
   * @returns {Promise<Object>} Orders with pagination metadata
   */
  async getRestaurantOrders(restaurantId, pagination, filters = {}) {
    const { page, limit, offset } = pagination;

    // Build WHERE clause
    let whereConditions = ['oi.restaurant_id = $1'];
    let params = [restaurantId];
    let paramIndex = 2;

    if (filters.status) {
      whereConditions.push(`o.status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(DISTINCT o.id) as total
      FROM orders o
      INNER JOIN order_items oi ON o.id = oi.order_id
      WHERE ${whereClause}
    `, params);
    const total = parseInt(countResult.rows[0].total);

    // Get orders for this restaurant
    const ordersResult = await pool.query(`
      SELECT DISTINCT
        o.*,
        COALESCE(u.name, o.guest_name) as customer_name,
        COALESCE(u.phone, o.delivery_phone) as customer_phone,
        COALESCE(u.email, o.guest_email) as customer_email,
        (
          SELECT json_agg(
            json_build_object(
              'id', oi2.id,
              'dish_id', oi2.dish_id,
              'name', oi2.name,
              'price', oi2.price,
              'quantity', oi2.quantity
            )
          )
          FROM order_items oi2
          WHERE oi2.order_id = o.id AND oi2.restaurant_id = $1
        ) as items
      FROM orders o
      INNER JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    return {
      orders: ordersResult.rows,
      pagination: buildPaginationMeta(page, limit, total),
    };
  }

  /**
   * Create a new order
   *
   * @param {Object} orderData - Order data
   * @returns {Promise<Object>} Created order
   */
  async createOrder(orderData) {
    const {
      userId,
      items,
      total,
      orderDetails,
      deliveryAddress,
      deliveryPhone,
      deliveryType = 'delivery',
      restaurantInstructions,
      platformFee = 0,
      guestInfo = null,
    } = orderData;

    // Validate items
    if (!items || items.length === 0) {
      throw Errors.validationError('Order must contain at least one item');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Create order
      const orderResult = await client.query(`
        INSERT INTO orders (
          user_id, total, order_details, delivery_address, delivery_phone,
          delivery_type, restaurant_instructions, platform_fee, status,
          guest_name, guest_email, is_guest_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, created_at
      `, [
        guestInfo ? null : userId,
        total,
        orderDetails || '',
        deliveryAddress,
        deliveryPhone,
        deliveryType,
        restaurantInstructions ? JSON.stringify(restaurantInstructions) : null,
        platformFee,
        'pending',
        guestInfo?.name || null,
        guestInfo?.email || null,
        guestInfo ? true : false,
      ]);

      const orderId = orderResult.rows[0].id;

      // Insert order items
      for (const item of items) {
        await client.query(`
          INSERT INTO order_items (order_id, dish_id, name, price, quantity, restaurant_id)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          orderId,
          item.dishId || item.id,
          item.name,
          item.price,
          item.quantity,
          item.restaurantId || item.restaurant_id,
        ]);
      }

      // Clear user's cart if authenticated user
      if (userId) {
        await client.query('DELETE FROM carts WHERE user_id = $1', [userId]);
      }

      await client.query('COMMIT');

      return {
        id: orderId,
        ...orderResult.rows[0],
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw Errors.databaseError('Failed to create order', error.message);
    } finally {
      client.release();
    }
  }

  /**
   * Update order status
   *
   * @param {number} orderId - Order ID
   * @param {string} status - New status
   * @param {number} restaurantId - Restaurant ID (for authorization)
   * @returns {Promise<Object>} Updated order
   */
  async updateOrderStatus(orderId, status, restaurantId = null) {
    const validStatuses = ['pending', 'paid', 'received', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      throw Errors.invalidInput('status', `Status must be one of: ${validStatuses.join(', ')}`);
    }

    // Verify restaurant owns items in this order if restaurantId provided
    if (restaurantId) {
      const verifyResult = await pool.query(
        'SELECT COUNT(*) as count FROM order_items WHERE order_id = $1 AND restaurant_id = $2',
        [orderId, restaurantId]
      );

      if (verifyResult.rows[0].count == 0) {
        throw Errors.forbidden('You do not have permission to update this order');
      }
    }

    // Update order status
    const result = await pool.query(`
      UPDATE orders
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, orderId]);

    if (result.rows.length === 0) {
      throw Errors.notFound('Order', orderId);
    }

    return result.rows[0];
  }

  /**
   * Cancel an order
   *
   * @param {number} orderId - Order ID
   * @param {number} userId - User ID (for authorization)
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Cancelled order
   */
  async cancelOrder(orderId, userId, reason = null) {
    // Get order
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw Errors.notFound('Order', orderId);
    }

    const order = orderResult.rows[0];

    // Authorization check
    if (order.user_id !== userId) {
      throw Errors.forbidden('You do not have permission to cancel this order');
    }

    // Check if order can be cancelled
    const nonCancellableStatuses = ['delivered', 'cancelled', 'out_for_delivery'];
    if (nonCancellableStatuses.includes(order.status)) {
      throw Errors.invalidState(
        `Cannot cancel order in ${order.status} status`,
        order.status,
        'pending, confirmed, or preparing'
      );
    }

    // Cancel order
    const result = await pool.query(`
      UPDATE orders
      SET status = 'cancelled',
          order_details = COALESCE(order_details, '') || ' | Cancellation reason: ' || $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [orderId, reason || 'Customer requested']);

    return result.rows[0];
  }

  /**
   * Get order statistics for a user
   *
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Order statistics
   */
  async getUserOrderStats(userId) {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        COALESCE(SUM(CASE WHEN status = 'delivered' THEN total END), 0) as total_spent,
        COALESCE(AVG(CASE WHEN status = 'delivered' THEN total END), 0) as avg_order_value,
        MAX(created_at) as last_order_date
      FROM orders
      WHERE user_id = $1
    `, [userId]);

    return result.rows[0];
  }

  /**
   * Get order statistics for a restaurant
   *
   * @param {number} restaurantId - Restaurant ID
   * @returns {Promise<Object>} Order statistics
   */
  async getRestaurantOrderStats(restaurantId) {
    const result = await pool.query(`
      SELECT
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END) as delivered_orders,
        COUNT(DISTINCT CASE WHEN o.status IN ('pending', 'confirmed', 'preparing') THEN o.id END) as active_orders,
        COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN oi.price * oi.quantity END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN o.status = 'delivered' THEN oi.price * oi.quantity END), 0) as avg_order_value
      FROM orders o
      INNER JOIN order_items oi ON o.id = oi.order_id
      WHERE oi.restaurant_id = $1
    `, [restaurantId]);

    return result.rows[0];
  }
}

export default new OrderService();
