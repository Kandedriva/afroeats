/**
 * Refund Routes
 *
 * Handles all refund-related API endpoints:
 * - Customer refund requests
 * - Admin refund management
 * - Refund status tracking
 */

import express from 'express';
import RefundService from '../services/RefundService.js';
import { auth } from '../middleware/auth.js';
import ownerAuth from '../middleware/ownerAuth.js';

const router = express.Router();

/**
 * POST /api/refunds/request
 * Customer requests a refund for their order
 * Requires authentication
 */
router.post('/request', auth, async (req, res) => {
  try {
    const { orderId, amount, reason, description } = req.body;
    const userId = req.session.userId;

    // Validate input
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid refund amount is required' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Refund reason is required' });
    }

    const validReasons = [
      'customer_request',
      'order_cancelled',
      'item_unavailable',
      'quality_issue',
      'wrong_item',
      'late_delivery',
      'other'
    ];

    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid refund reason' });
    }

    // Create refund request
    const refund = await RefundService.createRefundRequest({
      orderId,
      amount: parseFloat(amount),
      reason,
      description: description || '',
      requestedByUserId: userId,
      autoProcess: false // Customer requests need admin approval
    });

    res.status(201).json({
      message: 'Refund request submitted successfully',
      refund: {
        id: refund.id,
        orderId: refund.order_id,
        amount: refund.amount,
        reason: refund.reason,
        status: refund.status,
        requestedAt: refund.requested_at
      }
    });
  } catch (error) {
    console.error('Refund request error:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to create refund request'
    });
  }
});

/**
 * GET /api/refunds/my-refunds
 * Get current user's refund requests
 */
router.get('/my-refunds', auth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await RefundService.listRefunds(
      { requestedByUserId: userId },
      { page, limit }
    );

    res.json(result);
  } catch (error) {
    console.error('Get my refunds error:', error);
    res.status(500).json({ error: 'Failed to fetch refunds' });
  }
});

/**
 * GET /api/refunds/:refundId
 * Get refund details by ID
 */
router.get('/:refundId', auth, async (req, res) => {
  try {
    const refundId = parseInt(req.params.refundId);
    const userId = req.session.userId;

    const refund = await RefundService.getRefundById(refundId);

    // Check authorization
    if (refund.requested_by_user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(refund);
  } catch (error) {
    console.error('Get refund error:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to fetch refund'
    });
  }
});

/**
 * DELETE /api/refunds/:refundId
 * Cancel a pending refund request
 */
router.delete('/:refundId', auth, async (req, res) => {
  try {
    const refundId = parseInt(req.params.refundId);
    const userId = req.session.userId;

    // Get refund to check ownership
    const refund = await RefundService.getRefundById(refundId);

    if (refund.requested_by_user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const cancelledRefund = await RefundService.cancelRefund(
      refundId,
      `user_${userId}`
    );

    res.json({
      message: 'Refund request cancelled successfully',
      refund: cancelledRefund
    });
  } catch (error) {
    console.error('Cancel refund error:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to cancel refund'
    });
  }
});

// ==================== ADMIN ENDPOINTS ====================

/**
 * POST /api/refunds/admin/create
 * Admin creates and auto-processes a refund
 * TODO: Add admin auth middleware
 */
router.post('/admin/create', async (req, res) => {
  try {
    // TODO: Replace with proper admin auth
    const adminEmail = req.body.adminEmail || 'admin@orderdabaly.com';

    const { orderId, amount, reason, description } = req.body;

    if (!orderId || !amount || !reason) {
      return res.status(400).json({ error: 'Order ID, amount, and reason are required' });
    }

    // Admin can use any reason
    const validReasons = [
      'duplicate',
      'fraudulent',
      'customer_request',
      'order_cancelled',
      'item_unavailable',
      'quality_issue',
      'wrong_item',
      'late_delivery',
      'other'
    ];

    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid refund reason' });
    }

    // Create and auto-process refund
    const refund = await RefundService.createRefundRequest({
      orderId: parseInt(orderId),
      amount: parseFloat(amount),
      reason,
      description: description || '',
      requestedByAdminEmail: adminEmail,
      autoProcess: true // Admin refunds are auto-processed
    });

    res.status(201).json({
      message: 'Refund created and processing',
      refund
    });
  } catch (error) {
    console.error('Admin create refund error:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to create refund'
    });
  }
});

/**
 * POST /api/refunds/admin/:refundId/approve
 * Admin approves and processes a pending refund
 * TODO: Add admin auth middleware
 */
router.post('/admin/:refundId/approve', async (req, res) => {
  try {
    // TODO: Replace with proper admin auth
    const adminEmail = req.body.adminEmail || 'admin@orderdabaly.com';
    const refundId = parseInt(req.params.refundId);

    const refund = await RefundService.processRefund(refundId, adminEmail);

    res.json({
      message: 'Refund approved and processed',
      refund
    });
  } catch (error) {
    console.error('Approve refund error:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to approve refund'
    });
  }
});

/**
 * GET /api/refunds/admin/list
 * Admin lists all refunds with filters
 * TODO: Add admin auth middleware
 */
router.get('/admin/list', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const orderId = req.query.orderId ? parseInt(req.query.orderId) : null;
    const restaurantId = req.query.restaurantId ? parseInt(req.query.restaurantId) : null;

    const filters = {};
    if (status) filters.status = status;
    if (orderId) filters.orderId = orderId;
    if (restaurantId) filters.restaurantId = restaurantId;

    const result = await RefundService.listRefunds(filters, { page, limit });

    res.json(result);
  } catch (error) {
    console.error('Admin list refunds error:', error);
    res.status(500).json({ error: 'Failed to fetch refunds' });
  }
});

/**
 * GET /api/refunds/admin/stats
 * Get refund statistics
 * TODO: Add admin auth middleware
 */
router.get('/admin/stats', async (req, res) => {
  try {
    const restaurantId = req.query.restaurantId ? parseInt(req.query.restaurantId) : null;
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;

    const filters = {};
    if (restaurantId) filters.restaurantId = restaurantId;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const stats = await RefundService.getRefundStats(filters);

    res.json(stats);
  } catch (error) {
    console.error('Refund stats error:', error);
    res.status(500).json({ error: 'Failed to fetch refund statistics' });
  }
});

/**
 * DELETE /api/refunds/admin/:refundId
 * Admin cancels a pending refund
 * TODO: Add admin auth middleware
 */
router.delete('/admin/:refundId', async (req, res) => {
  try {
    // TODO: Replace with proper admin auth
    const adminEmail = req.body.adminEmail || 'admin@orderdabaly.com';
    const refundId = parseInt(req.params.refundId);

    const cancelledRefund = await RefundService.cancelRefund(refundId, adminEmail);

    res.json({
      message: 'Refund cancelled by admin',
      refund: cancelledRefund
    });
  } catch (error) {
    console.error('Admin cancel refund error:', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Failed to cancel refund'
    });
  }
});

// ==================== RESTAURANT OWNER ENDPOINTS ====================

/**
 * GET /api/refunds/owner/list
 * Restaurant owner lists refunds for their orders
 */
router.get('/owner/list', ownerAuth, async (req, res) => {
  try {
    const ownerId = req.session.ownerId;

    // Get owner's restaurant ID
    const restaurantResult = await import('../db.js').then(module => {
      return module.default.query(
        'SELECT id FROM restaurants WHERE owner_id = $1',
        [ownerId]
      );
    });

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const restaurantId = restaurantResult.rows[0].id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;

    const filters = { restaurantId };
    if (status) filters.status = status;

    const result = await RefundService.listRefunds(filters, { page, limit });

    res.json(result);
  } catch (error) {
    console.error('Owner list refunds error:', error);
    res.status(500).json({ error: 'Failed to fetch refunds' });
  }
});

/**
 * GET /api/refunds/owner/stats
 * Restaurant owner gets refund statistics
 */
router.get('/owner/stats', ownerAuth, async (req, res) => {
  try {
    const ownerId = req.session.ownerId;

    // Get owner's restaurant ID
    const restaurantResult = await import('../db.js').then(module => {
      return module.default.query(
        'SELECT id FROM restaurants WHERE owner_id = $1',
        [ownerId]
      );
    });

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const restaurantId = restaurantResult.rows[0].id;

    const stats = await RefundService.getRefundStats({ restaurantId });

    res.json(stats);
  } catch (error) {
    console.error('Owner refund stats error:', error);
    res.status(500).json({ error: 'Failed to fetch refund statistics' });
  }
});

export default router;
