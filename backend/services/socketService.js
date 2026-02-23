/**
 * Socket.IO Service for Real-Time Chat
 * Handles WebSocket connections between customers and restaurant owners
 */

import { Server } from 'socket.io';
import pool from '../db.js';
import { logger } from './logger.js';

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
    this.connectedOwners = new Map(); // ownerId -> socketId
    this.connectedDrivers = new Map(); // driverId -> socketId
  }

  /**
   * Initialize Socket.IO server
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'], // Support both for reliability
    });

    this.setupEventHandlers();
    logger.info('✅ Socket.IO server initialized');
  }

  /**
   * Set up socket event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Socket connected: ${socket.id}`);

      // Handle user authentication and registration
      socket.on('register_user', (data) => {
        this.handleUserRegistration(socket, data);
      });

      socket.on('register_owner', (data) => {
        this.handleOwnerRegistration(socket, data);
      });

      socket.on('register_driver', (data) => {
        this.handleDriverRegistration(socket, data);
      });

      // Chat message events
      socket.on('send_message', async (data) => {
        await this.handleSendMessage(socket, data);
      });

      socket.on('mark_messages_read', async (data) => {
        await this.handleMarkMessagesRead(socket, data);
      });

      socket.on('typing', (data) => {
        this.handleTyping(socket, data);
      });

      socket.on('stop_typing', (data) => {
        this.handleStopTyping(socket, data);
      });

      // Join/leave conversation rooms
      socket.on('join_conversation', (conversationId) => {
        socket.join(`conversation_${conversationId}`);
        logger.info(`Socket ${socket.id} joined conversation ${conversationId}`);
      });

      socket.on('leave_conversation', (conversationId) => {
        socket.leave(`conversation_${conversationId}`);
        logger.info(`Socket ${socket.id} left conversation ${conversationId}`);
      });

      // Disconnect handling
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Register customer user
   */
  handleUserRegistration(socket, data) {
    const { userId } = data;
    if (userId) {
      this.connectedUsers.set(userId, socket.id);
      socket.userId = userId;
      socket.userType = 'customer';
      logger.info(`Customer ${userId} registered with socket ${socket.id}`);

      // Emit connection success
      socket.emit('registration_success', { userType: 'customer', userId });
    }
  }

  /**
   * Register restaurant owner
   */
  handleOwnerRegistration(socket, data) {
    const { ownerId } = data;
    if (ownerId) {
      this.connectedOwners.set(ownerId, socket.id);
      socket.ownerId = ownerId;
      socket.userType = 'owner';
      logger.info(`Owner ${ownerId} registered with socket ${socket.id}`);

      // Emit connection success
      socket.emit('registration_success', { userType: 'owner', ownerId });
    }
  }

  /**
   * Register delivery driver
   */
  handleDriverRegistration(socket, data) {
    const { driverId } = data;
    if (driverId) {
      this.connectedDrivers.set(driverId, socket.id);
      socket.driverId = driverId;
      socket.userType = 'driver';
      logger.info(`Driver ${driverId} registered with socket ${socket.id}`);

      // Emit connection success
      socket.emit('registration_success', { userType: 'driver', driverId });
    }
  }

  /**
   * Handle sending a chat message
   */
  async handleSendMessage(socket, data) {
    try {
      const { conversationId, message, senderType, senderId } = data;

      // Validate input
      if (!conversationId || !message || !senderType || !senderId) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      // Insert message into database
      const result = await pool.query(
        `INSERT INTO chat_messages (conversation_id, sender_type, sender_id, message, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, conversation_id, sender_type, sender_id, message, is_read, created_at`,
        [conversationId, senderType, senderId, message.trim()]
      );

      const savedMessage = result.rows[0];

      // Get conversation details to find recipient
      const convResult = await pool.query(
        `SELECT c.*, u.name as customer_name, r.name as restaurant_name, ro.id as owner_id
         FROM chat_conversations c
         LEFT JOIN users u ON c.user_id = u.id
         LEFT JOIN restaurants r ON c.restaurant_id = r.id
         LEFT JOIN restaurant_owners ro ON r.owner_id = ro.id
         WHERE c.id = $1`,
        [conversationId]
      );

      if (convResult.rows.length === 0) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }

      const conversation = convResult.rows[0];

      // Broadcast message to all sockets in the conversation room
      this.io.to(`conversation_${conversationId}`).emit('new_message', {
        ...savedMessage,
        customer_name: conversation.customer_name,
        restaurant_name: conversation.restaurant_name,
      });

      // Send notification to recipient if they're online but not in the conversation room
      if (senderType === 'customer') {
        // Notify owner
        const ownerSocketId = this.connectedOwners.get(conversation.owner_id);
        if (ownerSocketId) {
          this.io.to(ownerSocketId).emit('new_chat_notification', {
            conversationId,
            message: savedMessage.message,
            from: conversation.customer_name,
            type: 'customer',
          });
        }
      } else {
        // Notify customer
        const customerSocketId = this.connectedUsers.get(conversation.user_id);
        if (customerSocketId) {
          this.io.to(customerSocketId).emit('new_chat_notification', {
            conversationId,
            message: savedMessage.message,
            from: conversation.restaurant_name,
            type: 'owner',
          });
        }
      }

      logger.info(`Message sent in conversation ${conversationId} by ${senderType} ${senderId}`);
    } catch (error) {
      logger.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  /**
   * Handle marking messages as read
   */
  async handleMarkMessagesRead(socket, data) {
    try {
      const { conversationId, userType } = data;

      // Update messages as read
      await pool.query(
        `UPDATE chat_messages
         SET is_read = true, read_at = NOW()
         WHERE conversation_id = $1
         AND sender_type != $2
         AND is_read = false`,
        [conversationId, userType]
      );

      // Reset unread count
      const unreadField = userType === 'customer' ? 'customer_unread_count' : 'owner_unread_count';
      await pool.query(
        `UPDATE chat_conversations
         SET ${unreadField} = 0
         WHERE id = $1`,
        [conversationId]
      );

      // Notify the conversation room
      this.io.to(`conversation_${conversationId}`).emit('messages_read', {
        conversationId,
        readBy: userType,
      });

      logger.info(`Messages marked as read in conversation ${conversationId} by ${userType}`);
    } catch (error) {
      logger.error('Error marking messages as read:', error);
      socket.emit('error', { message: 'Failed to mark messages as read' });
    }
  }

  /**
   * Handle typing indicator
   */
  handleTyping(socket, data) {
    const { conversationId, senderType } = data;
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      conversationId,
      senderType,
    });
  }

  /**
   * Handle stop typing indicator
   */
  handleStopTyping(socket, data) {
    const { conversationId, senderType } = data;
    socket.to(`conversation_${conversationId}`).emit('user_stopped_typing', {
      conversationId,
      senderType,
    });
  }

  /**
   * Handle socket disconnect
   */
  handleDisconnect(socket) {
    // Remove from connected users/owners/drivers
    if (socket.userId) {
      this.connectedUsers.delete(socket.userId);
      logger.info(`Customer ${socket.userId} disconnected`);
    }

    if (socket.ownerId) {
      this.connectedOwners.delete(socket.ownerId);
      logger.info(`Owner ${socket.ownerId} disconnected`);
    }

    if (socket.driverId) {
      this.connectedDrivers.delete(socket.driverId);
      logger.info(`Driver ${socket.driverId} disconnected`);
    }
  }

  /**
   * Get Socket.IO instance
   */
  getIO() {
    if (!this.io) {
      throw new Error('Socket.IO not initialized');
    }
    return this.io;
  }

  /**
   * Emit event to specific user
   */
  emitToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  /**
   * Emit event to specific owner
   */
  emitToOwner(ownerId, event, data) {
    const socketId = this.connectedOwners.get(ownerId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  /**
   * Emit event to conversation room
   */
  emitToConversation(conversationId, event, data) {
    this.io.to(`conversation_${conversationId}`).emit(event, data);
  }

  /**
   * Emit event to specific driver
   */
  emitToDriver(driverId, event, data) {
    const socketId = this.connectedDrivers.get(driverId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  /**
   * Emit event to all connected drivers
   */
  emitToAllDrivers(event, data) {
    this.connectedDrivers.forEach((socketId) => {
      this.io.to(socketId).emit(event, data);
    });
    logger.info(`Event '${event}' sent to ${this.connectedDrivers.size} connected drivers`);
  }

  /**
   * Get count of connected drivers
   */
  getConnectedDriversCount() {
    return this.connectedDrivers.size;
  }
}

export default new SocketService();
