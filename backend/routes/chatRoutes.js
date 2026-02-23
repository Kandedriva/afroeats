/**
 * Chat Routes
 * RESTful API endpoints for chat functionality
 */

import express from 'express';
import pool from '../db.js';
import { logger } from '../services/logger.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { requireOwnerAuth } from '../middleware/ownerAuth.js';

const router = express.Router();

// ============================================================================
// CUSTOMER ENDPOINTS
// ============================================================================

/**
 * GET /api/chat/conversations
 * Get all conversations for authenticated customer
 */
router.get('/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const result = await pool.query(
      `SELECT
        c.*,
        r.name as restaurant_name,
        r.image_url as restaurant_image,
        o.id as order_id,
        o.total as order_total,
        o.status as order_status,
        (SELECT message FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT sender_type FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_sender,
        (SELECT created_at FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM chat_conversations c
      LEFT JOIN restaurants r ON c.restaurant_id = r.id
      LEFT JOIN orders o ON c.order_id = o.id
      WHERE c.user_id = $1 AND c.status = 'active'
      ORDER BY c.last_message_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      conversations: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching customer conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * POST /api/chat/conversations
 * Create or get existing conversation with a restaurant
 */
router.post('/conversations', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { restaurantId, orderId } = req.body;

    if (!restaurantId) {
      return res.status(400).json({ error: 'Restaurant ID is required' });
    }

    // Check if conversation already exists
    let result = await pool.query(
      `SELECT * FROM chat_conversations
       WHERE user_id = $1 AND restaurant_id = $2 AND (order_id = $3 OR ($3 IS NULL AND order_id IS NULL))`,
      [userId, restaurantId, orderId || null]
    );

    if (result.rows.length > 0) {
      // Conversation exists
      return res.json({
        success: true,
        conversation: result.rows[0],
        isNew: false,
      });
    }

    // Create new conversation
    result = await pool.query(
      `INSERT INTO chat_conversations (user_id, restaurant_id, order_id, created_at, last_message_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [userId, restaurantId, orderId || null]
    );

    res.status(201).json({
      success: true,
      conversation: result.rows[0],
      isNew: true,
    });
  } catch (error) {
    logger.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * GET /api/chat/conversations/:id/messages
 * Get all messages for a conversation
 */
router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const conversationId = req.params.id;
    const { limit = 50, offset = 0 } = req.query;

    // Verify user owns this conversation
    const convCheck = await pool.query(
      'SELECT * FROM chat_conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );

    if (convCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get messages
    const result = await pool.query(
      `SELECT
        m.*,
        u.name as sender_name,
        'customer' as sender_display_type
      FROM chat_messages m
      LEFT JOIN users u ON m.sender_id = u.id AND m.sender_type = 'customer'
      WHERE m.conversation_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3`,
      [conversationId, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      messages: result.rows.reverse(), // Reverse to get chronological order
    });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * GET /api/chat/unread-count
 * Get total unread message count for customer
 */
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const result = await pool.query(
      `SELECT COALESCE(SUM(customer_unread_count), 0) as total_unread
       FROM chat_conversations
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    res.json({
      success: true,
      unreadCount: parseInt(result.rows[0].total_unread) || 0,
    });
  } catch (error) {
    logger.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// ============================================================================
// OWNER ENDPOINTS
// ============================================================================

/**
 * GET /api/chat/owner/conversations
 * Get all conversations for authenticated owner
 */
router.get('/owner/conversations', requireOwnerAuth, async (req, res) => {
  try {
    const ownerId = req.owner.id;

    // Get owner's restaurant
    const restaurantResult = await pool.query(
      'SELECT id FROM restaurants WHERE owner_id = $1',
      [ownerId]
    );

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const restaurantId = restaurantResult.rows[0].id;

    const result = await pool.query(
      `SELECT
        c.*,
        u.name as customer_name,
        u.email as customer_email,
        o.id as order_id,
        o.total as order_total,
        o.status as order_status,
        (SELECT message FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT sender_type FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_sender,
        (SELECT created_at FROM chat_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM chat_conversations c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN orders o ON c.order_id = o.id
      WHERE c.restaurant_id = $1 AND c.status = 'active'
      ORDER BY c.last_message_at DESC`,
      [restaurantId]
    );

    res.json({
      success: true,
      conversations: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching owner conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * GET /api/chat/owner/conversations/:id/messages
 * Get all messages for a conversation (owner view)
 */
router.get('/owner/conversations/:id/messages', requireOwnerAuth, async (req, res) => {
  try {
    const ownerId = req.owner.id;
    const conversationId = req.params.id;
    const { limit = 50, offset = 0 } = req.query;

    // Get owner's restaurant
    const restaurantResult = await pool.query(
      'SELECT id FROM restaurants WHERE owner_id = $1',
      [ownerId]
    );

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const restaurantId = restaurantResult.rows[0].id;

    // Verify owner's restaurant owns this conversation
    const convCheck = await pool.query(
      'SELECT * FROM chat_conversations WHERE id = $1 AND restaurant_id = $2',
      [conversationId, restaurantId]
    );

    if (convCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get messages
    const result = await pool.query(
      `SELECT
        m.*,
        CASE
          WHEN m.sender_type = 'customer' THEN u.name
          WHEN m.sender_type = 'owner' THEN ro.name
        END as sender_name
      FROM chat_messages m
      LEFT JOIN users u ON m.sender_id = u.id AND m.sender_type = 'customer'
      LEFT JOIN restaurant_owners ro ON m.sender_id = ro.id AND m.sender_type = 'owner'
      WHERE m.conversation_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3`,
      [conversationId, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      messages: result.rows.reverse(),
    });
  } catch (error) {
    logger.error('Error fetching owner messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * GET /api/chat/owner/unread-count
 * Get total unread message count for owner
 */
router.get('/owner/unread-count', requireOwnerAuth, async (req, res) => {
  try {
    const ownerId = req.owner.id;

    // Get owner's restaurant
    const restaurantResult = await pool.query(
      'SELECT id FROM restaurants WHERE owner_id = $1',
      [ownerId]
    );

    if (restaurantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const restaurantId = restaurantResult.rows[0].id;

    const result = await pool.query(
      `SELECT COALESCE(SUM(owner_unread_count), 0) as total_unread
       FROM chat_conversations
       WHERE restaurant_id = $1 AND status = 'active'`,
      [restaurantId]
    );

    res.json({
      success: true,
      unreadCount: parseInt(result.rows[0].total_unread) || 0,
    });
  } catch (error) {
    logger.error('Error fetching owner unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// ============================================================================
// SHARED ENDPOINTS
// ============================================================================

/**
 * DELETE /api/chat/conversations/:id
 * Archive a conversation (soft delete)
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    const conversationId = req.params.id;
    const userId = req.session?.userId;
    const ownerId = req.owner?.id;

    // Verify ownership
    let query;
    let params;

    if (userId) {
      query = 'SELECT * FROM chat_conversations WHERE id = $1 AND user_id = $2';
      params = [conversationId, userId];
    } else if (ownerId) {
      // Get restaurant ID for owner
      const restaurantResult = await pool.query(
        'SELECT id FROM restaurants WHERE owner_id = $1',
        [ownerId]
      );

      if (restaurantResult.rows.length === 0) {
        return res.status(404).json({ error: 'Restaurant not found' });
      }

      query = 'SELECT * FROM chat_conversations WHERE id = $1 AND restaurant_id = $2';
      params = [conversationId, restaurantResult.rows[0].id];
    } else {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const convCheck = await pool.query(query, params);

    if (convCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Archive conversation
    await pool.query(
      'UPDATE chat_conversations SET status = $1 WHERE id = $2',
      ['archived', conversationId]
    );

    res.json({
      success: true,
      message: 'Conversation archived',
    });
  } catch (error) {
    logger.error('Error archiving conversation:', error);
    res.status(500).json({ error: 'Failed to archive conversation' });
  }
});

export default router;
