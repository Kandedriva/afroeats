/**
 * Refund Service
 *
 * Handles all refund-related business logic including:
 * - Creating refund requests
 * - Processing refunds via Stripe
 * - Tracking refund status
 * - Calculating restaurant/platform refund splits
 */

import Stripe from 'stripe';
import pool from '../db.js';
import { Errors } from '../utils/errorHandler.js';
import NotificationService from './NotificationService.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class RefundService {
  /**
   * Create a refund request
   *
   * @param {Object} refundData - Refund request data
   * @returns {Promise<Object>} Created refund
   */
  async createRefundRequest({
    orderId,
    amount,
    reason,
    description,
    requestedByUserId = null,
    requestedByAdminEmail = null,
    autoProcess = false
  }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get order details
      const orderResult = await client.query(
        'SELECT * FROM orders WHERE id = $1',
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        throw Errors.notFound('Order', orderId);
      }

      const order = orderResult.rows[0];

      // Validate refund amount
      const maxRefundable = parseFloat(order.total) - parseFloat(order.refunded_amount || 0);
      if (amount > maxRefundable) {
        throw Errors.validationError(
          `Refund amount ($${amount}) exceeds remaining refundable amount ($${maxRefundable.toFixed(2)})`
        );
      }

      // Check if order can be refunded
      if (order.payment_status !== 'paid') {
        throw Errors.invalidState(
          'Order must be paid before refund can be issued',
          order.payment_status,
          'paid'
        );
      }

      // Calculate restaurant and platform split
      const platformFee = parseFloat(order.platform_fee || 0);
      const deliveryFee = parseFloat(order.delivery_fee || 0);
      const subtotal = parseFloat(order.total) - platformFee - deliveryFee;

      // Determine how much each party refunds
      let restaurantRefundAmount = 0;
      let platformRefundAmount = 0;

      if (amount <= platformFee) {
        // Refund comes entirely from platform fee
        platformRefundAmount = amount;
      } else if (amount <= (platformFee + deliveryFee)) {
        // Platform fee + part of delivery fee
        platformRefundAmount = platformFee + (amount - platformFee);
      } else {
        // Platform fee + delivery fee + part of restaurant amount
        platformRefundAmount = platformFee + deliveryFee;
        restaurantRefundAmount = amount - platformRefundAmount;
      }

      // Get restaurant ID from order items
      const restaurantResult = await client.query(
        'SELECT DISTINCT restaurant_id FROM order_items WHERE order_id = $1 LIMIT 1',
        [orderId]
      );
      const restaurantId = restaurantResult.rows[0]?.restaurant_id || null;

      // Create refund record
      const refundResult = await client.query(`
        INSERT INTO refunds (
          order_id, amount, reason, description,
          requested_by_user_id, requested_by_admin_email,
          restaurant_id, restaurant_refund_amount, platform_refund_amount,
          status, requested_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING *
      `, [
        orderId,
        amount,
        reason,
        description,
        requestedByUserId,
        requestedByAdminEmail,
        restaurantId,
        restaurantRefundAmount,
        platformRefundAmount,
        autoProcess ? 'processing' : 'pending'
      ]);

      const refund = refundResult.rows[0];

      // Update order refund status
      const newRefundStatus = (parseFloat(order.refunded_amount || 0) + amount) >= parseFloat(order.total)
        ? 'full'
        : 'partial';

      await client.query(`
        UPDATE orders
        SET refund_status = $1, refunded_amount = refunded_amount + $2, updated_at = NOW()
        WHERE id = $3
      `, [newRefundStatus, amount, orderId]);

      // Log the action
      await client.query(`
        INSERT INTO refund_logs (refund_id, action, new_status, performed_by_admin_email, performed_by_user_id, notes)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        refund.id,
        'created',
        refund.status,
        requestedByAdminEmail,
        requestedByUserId,
        `Refund request created: ${reason} - ${description || 'No description'}`
      ]);

      await client.query('COMMIT');

      // Send email notification to customer
      if (requestedByUserId) {
        // Get user details for email
        const userResult = await pool.query(
          'SELECT email, name FROM users WHERE id = $1',
          [requestedByUserId]
        );

        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          // Send asynchronously to avoid blocking
          NotificationService.sendRefundRequestEmail(user.email, user.name, {
            refundId: refund.id,
            orderId,
            amount,
            reason,
            status: refund.status
          }).catch(err => {
            console.error('Failed to send refund request email:', err);
          });
        }
      }

      // Auto-process if requested and Stripe key available
      if (autoProcess && process.env.STRIPE_SECRET_KEY) {
        // Process asynchronously
        this.processRefund(refund.id).catch(err => {
          console.error(`Failed to auto-process refund ${refund.id}:`, err);
        });
      }

      return refund;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process a refund through Stripe
   *
   * @param {number} refundId - Refund ID
   * @param {string} approvedByAdminEmail - Admin who approved
   * @returns {Promise<Object>} Processed refund
   */
  async processRefund(refundId, approvedByAdminEmail = null) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get refund details
      const refundResult = await client.query(
        'SELECT * FROM refunds WHERE id = $1',
        [refundId]
      );

      if (refundResult.rows.length === 0) {
        throw Errors.notFound('Refund', refundId);
      }

      const refund = refundResult.rows[0];

      if (refund.status !== 'pending' && refund.status !== 'processing') {
        throw Errors.invalidState(
          `Refund cannot be processed in ${refund.status} status`,
          refund.status,
          'pending or processing'
        );
      }

      // Update to processing
      await client.query(`
        UPDATE refunds
        SET status = 'processing', approved_by_admin_email = $1, processed_at = NOW(), updated_at = NOW()
        WHERE id = $2
      `, [approvedByAdminEmail, refundId]);

      // Get order payment intent
      const orderResult = await client.query(
        'SELECT stripe_payment_intent_id FROM orders WHERE id = $1',
        [refund.order_id]
      );

      const paymentIntentId = orderResult.rows[0]?.stripe_payment_intent_id;

      if (!paymentIntentId) {
        throw new Error('Order has no Stripe payment intent ID');
      }

      // Process refund through Stripe
      let stripeRefund;
      try {
        stripeRefund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: Math.round(parseFloat(refund.amount) * 100), // Convert to cents
          reason: this.mapReasonToStripe(refund.reason),
          metadata: {
            order_id: refund.order_id.toString(),
            refund_id: refundId.toString(),
            reason: refund.reason,
            description: refund.description || ''
          }
        });

        console.log(`✅ Stripe refund created: ${stripeRefund.id} for $${refund.amount}`);
      } catch (stripeError) {
        console.error('Stripe refund failed:', stripeError);

        // Update refund as failed
        await client.query(`
          UPDATE refunds
          SET status = 'failed', updated_at = NOW()
          WHERE id = $1
        `, [refundId]);

        // Log failure
        await client.query(`
          INSERT INTO refund_logs (refund_id, action, old_status, new_status, notes, performed_by_admin_email)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [refundId, 'processing_failed', 'processing', 'failed', stripeError.message, approvedByAdminEmail]);

        await client.query('COMMIT');
        throw new Error(`Stripe refund failed: ${stripeError.message}`);
      }

      // Update refund with Stripe details
      await client.query(`
        UPDATE refunds
        SET
          status = $1,
          stripe_refund_id = $2,
          stripe_payment_intent_id = $3,
          succeeded_at = CASE WHEN $1 = 'succeeded' THEN NOW() ELSE NULL END,
          updated_at = NOW()
        WHERE id = $4
      `, [
        stripeRefund.status === 'succeeded' ? 'succeeded' : 'processing',
        stripeRefund.id,
        paymentIntentId,
        refundId
      ]);

      // Log success
      await client.query(`
        INSERT INTO refund_logs (refund_id, action, old_status, new_status, notes, performed_by_admin_email)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        refundId,
        'processed',
        'processing',
        stripeRefund.status,
        `Stripe refund ${stripeRefund.id} created`,
        approvedByAdminEmail
      ]);

      await client.query('COMMIT');

      // Fetch updated refund
      const updatedRefundResult = await pool.query(
        'SELECT * FROM refunds WHERE id = $1',
        [refundId]
      );

      const updatedRefund = updatedRefundResult.rows[0];

      // Send approval email to customer
      if (refund.requested_by_user_id) {
        const userResult = await pool.query(
          'SELECT email, name FROM users WHERE id = $1',
          [refund.requested_by_user_id]
        );

        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          // Send asynchronously
          NotificationService.sendRefundApprovedEmail(user.email, user.name, {
            refundId: updatedRefund.id,
            orderId: updatedRefund.order_id,
            amount: updatedRefund.amount
          }).catch(err => {
            console.error('Failed to send refund approved email:', err);
          });
        }
      }

      return updatedRefund;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get refund by ID
   *
   * @param {number} refundId - Refund ID
   * @returns {Promise<Object>} Refund with logs
   */
  async getRefundById(refundId) {
    const refundResult = await pool.query(
      'SELECT * FROM refunds WHERE id = $1',
      [refundId]
    );

    if (refundResult.rows.length === 0) {
      throw Errors.notFound('Refund', refundId);
    }

    const refund = refundResult.rows[0];

    // Get refund logs
    const logsResult = await pool.query(
      'SELECT * FROM refund_logs WHERE refund_id = $1 ORDER BY created_at DESC',
      [refundId]
    );

    return {
      ...refund,
      logs: logsResult.rows
    };
  }

  /**
   * List refunds with filters
   *
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} Refunds and pagination
   */
  async listRefunds(filters = {}, pagination = { page: 1, limit: 20 }) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (filters.orderId) {
      whereConditions.push(`order_id = $${paramIndex}`);
      params.push(filters.orderId);
      paramIndex++;
    }

    if (filters.status) {
      whereConditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.restaurantId) {
      whereConditions.push(`restaurant_id = $${paramIndex}`);
      params.push(filters.restaurantId);
      paramIndex++;
    }

    if (filters.requestedByUserId) {
      whereConditions.push(`requested_by_user_id = $${paramIndex}`);
      params.push(filters.requestedByUserId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM refunds ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get refunds
    const refundsResult = await pool.query(`
      SELECT
        r.*,
        o.total as order_total,
        o.payment_status as order_payment_status,
        u.email as requester_email
      FROM refunds r
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN users u ON r.requested_by_user_id = u.id
      ${whereClause}
      ORDER BY r.requested_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    return {
      refunds: refundsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Cancel a pending refund
   *
   * @param {number} refundId - Refund ID
   * @param {string} cancelledBy - Who cancelled it
   * @returns {Promise<Object>} Cancelled refund
   */
  async cancelRefund(refundId, cancelledBy) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const refundResult = await client.query(
        'SELECT * FROM refunds WHERE id = $1',
        [refundId]
      );

      if (refundResult.rows.length === 0) {
        throw Errors.notFound('Refund', refundId);
      }

      const refund = refundResult.rows[0];

      if (refund.status !== 'pending') {
        throw Errors.invalidState(
          `Only pending refunds can be cancelled (current status: ${refund.status})`,
          refund.status,
          'pending'
        );
      }

      // Update refund status
      await client.query(`
        UPDATE refunds
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
      `, [refundId]);

      // Restore order refund amount
      await client.query(`
        UPDATE orders
        SET
          refunded_amount = refunded_amount - $1,
          refund_status = CASE
            WHEN (refunded_amount - $1) <= 0 THEN 'none'
            WHEN (refunded_amount - $1) < total THEN 'partial'
            ELSE 'full'
          END,
          updated_at = NOW()
        WHERE id = $2
      `, [refund.amount, refund.order_id]);

      // Log cancellation
      await client.query(`
        INSERT INTO refund_logs (refund_id, action, old_status, new_status, notes, performed_by_admin_email)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [refundId, 'cancelled', 'pending', 'cancelled', 'Refund request cancelled', cancelledBy]);

      await client.query('COMMIT');

      return await this.getRefundById(refundId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Map internal refund reason to Stripe reason
   *
   * @param {string} reason - Internal reason
   * @returns {string} Stripe reason
   */
  mapReasonToStripe(reason) {
    const mapping = {
      'duplicate': 'duplicate',
      'fraudulent': 'fraudulent',
      'customer_request': 'requested_by_customer',
      'order_cancelled': 'requested_by_customer',
      'item_unavailable': 'requested_by_customer',
      'quality_issue': 'requested_by_customer',
      'wrong_item': 'requested_by_customer',
      'late_delivery': 'requested_by_customer',
      'other': 'requested_by_customer'
    };

    return mapping[reason] || 'requested_by_customer';
  }

  /**
   * Get refund statistics
   *
   * @param {Object} filters - Optional filters (restaurantId, dateFrom, dateTo)
   * @returns {Promise<Object>} Refund statistics
   */
  async getRefundStats(filters = {}) {
    let whereConditions = ['1=1'];
    let params = [];
    let paramIndex = 1;

    if (filters.restaurantId) {
      whereConditions.push(`restaurant_id = $${paramIndex}`);
      params.push(filters.restaurantId);
      paramIndex++;
    }

    if (filters.dateFrom) {
      whereConditions.push(`requested_at >= $${paramIndex}`);
      params.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      whereConditions.push(`requested_at <= $${paramIndex}`);
      params.push(filters.dateTo);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total_refunds,
        COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as succeeded_refunds,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_refunds,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_refunds,
        COALESCE(SUM(CASE WHEN status = 'succeeded' THEN amount END), 0) as total_refunded_amount,
        COALESCE(AVG(CASE WHEN status = 'succeeded' THEN amount END), 0) as avg_refund_amount,
        COALESCE(SUM(CASE WHEN status = 'succeeded' THEN restaurant_refund_amount END), 0) as total_restaurant_refunds,
        COALESCE(SUM(CASE WHEN status = 'succeeded' THEN platform_refund_amount END), 0) as total_platform_refunds
      FROM refunds
      WHERE ${whereClause}
    `, params);

    return statsResult.rows[0];
  }
}

export default new RefundService();
