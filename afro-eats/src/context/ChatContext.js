import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import PropTypes from 'prop-types';
import { AuthContext } from './AuthContext';
import { OwnerAuthContext } from './OwnerAuthContext';
import { API_BASE_URL } from '../config/api';
import { io } from 'socket.io-client';

export const ChatContext = createContext();

export function ChatProvider({ children }) {
  const { user } = useContext(AuthContext);
  const { owner } = useContext(OwnerAuthContext);

  const [socket, setSocket] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!user && !owner) {
      return undefined;
    }

    const newSocket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);

      // Register user or owner
      if (user) {
        newSocket.emit('register_user', { userId: user.id });
      } else if (owner) {
        newSocket.emit('register_owner', { ownerId: owner.id });
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('registration_success', () => {
      // Registration successful
    });

    // Listen for new messages
    newSocket.on('new_message', (message) => {

      // Add message to current conversation if it's active
      if (activeConversation && message.conversation_id === activeConversation.id) {
        setMessages(prev => [...prev, message]);
      }

      // Update conversation last message
      setConversations(prev =>
        prev.map(conv =>
          conv.id === message.conversation_id
            ? {
                ...conv,
                last_message: message.message,
                last_message_sender: message.sender_type,
                last_message_time: message.created_at,
              }
            : conv
        )
      );
    });

    // Listen for new chat notifications (when not in conversation)
    newSocket.on('new_chat_notification', () => {
      fetchUnreadCount();
      fetchConversations();
    });

    // Listen for messages marked as read
    newSocket.on('messages_read', ({ conversationId }) => {
      if (activeConversation && conversationId === activeConversation.id) {
        setMessages(prev =>
          prev.map(msg => ({ ...msg, is_read: true, read_at: new Date().toISOString() }))
        );
      }
    });

    // Listen for typing indicators
    newSocket.on('user_typing', ({ conversationId }) => {
      if (activeConversation && conversationId === activeConversation.id) {
        // Show typing indicator (you can implement this in UI)
      }
    });

    newSocket.on('user_stopped_typing', ({ conversationId }) => {
      if (activeConversation && conversationId === activeConversation.id) {
        // Hide typing indicator
      }
    });

    newSocket.on('error', () => {
      // Socket error occurred
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user, owner, activeConversation, fetchConversations, fetchUnreadCount]);

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const endpoint = owner
        ? `${API_BASE_URL}/api/chat/owner/conversations`
        : `${API_BASE_URL}/api/chat/conversations`;

      const response = await fetch(endpoint, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      // Error fetching conversations
    }
  }, [owner]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const endpoint = owner
        ? `${API_BASE_URL}/api/chat/owner/unread-count`
        : `${API_BASE_URL}/api/chat/unread-count`;

      const response = await fetch(endpoint, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      // Error fetching unread count
    }
  }, [owner]);

  // Fetch messages for a conversation
  const fetchMessages = useCallback(async (conversationId) => {
    try {
      const endpoint = owner
        ? `${API_BASE_URL}/api/chat/owner/conversations/${conversationId}/messages`
        : `${API_BASE_URL}/api/chat/conversations/${conversationId}/messages`;

      const response = await fetch(endpoint, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      // Error fetching messages
    }
  }, [owner]);

  // Create or get conversation
  const createConversation = useCallback(async (restaurantId, orderId = null) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/conversations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, orderId }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.isNew) {
          setConversations(prev => [data.conversation, ...prev]);
        }

        return data.conversation;
      }
      return null;
    } catch (error) {
      return null;
    }
  }, []);

  // Send message via Socket.IO
  const sendMessage = useCallback((conversationId, message) => {
    if (!socket || !isConnected) {
      return;
    }

    const senderType = user ? 'customer' : 'owner';
    const senderId = user ? user.id : owner?.id;

    socket.emit('send_message', {
      conversationId,
      message: message.trim(),
      senderType,
      senderId,
    });
  }, [socket, isConnected, user, owner]);

  // Mark messages as read
  const markMessagesRead = useCallback((conversationId) => {
    if (!socket || !isConnected) {
      return;
    }

    const userType = user ? 'customer' : 'owner';

    socket.emit('mark_messages_read', {
      conversationId,
      userType,
    });

    // Update unread count locally
    fetchUnreadCount();
  }, [socket, isConnected, user, fetchUnreadCount]);

  // Open conversation
  const openConversation = useCallback(async (conversation) => {
    setActiveConversation(conversation);
    await fetchMessages(conversation.id);

    // Join conversation room
    if (socket && isConnected) {
      socket.emit('join_conversation', conversation.id);

      // Mark messages as read
      markMessagesRead(conversation.id);
    }

    setIsChatOpen(true);
  }, [socket, isConnected, fetchMessages, markMessagesRead]);

  // Close conversation
  const closeConversation = useCallback(() => {
    if (activeConversation && socket && isConnected) {
      socket.emit('leave_conversation', activeConversation.id);
    }

    setActiveConversation(null);
    setMessages([]);
  }, [activeConversation, socket, isConnected]);

  // Send typing indicator
  const sendTyping = useCallback((conversationId) => {
    if (!socket || !isConnected) {
      return;
    }

    const senderType = user ? 'customer' : 'owner';
    socket.emit('typing', { conversationId, senderType });
  }, [socket, isConnected, user]);

  // Send stop typing indicator
  const sendStopTyping = useCallback((conversationId) => {
    if (!socket || !isConnected) {
      return;
    }

    const senderType = user ? 'customer' : 'owner';
    socket.emit('stop_typing', { conversationId, senderType });
  }, [socket, isConnected, user]);

  // Load conversations and unread count on mount
  useEffect(() => {
    if (user || owner) {
      fetchConversations();
      fetchUnreadCount();
    }
  }, [user, owner, fetchConversations, fetchUnreadCount]);

  const value = {
    socket,
    isConnected,
    conversations,
    unreadCount,
    activeConversation,
    messages,
    isChatOpen,
    setIsChatOpen,
    fetchConversations,
    fetchUnreadCount,
    createConversation,
    sendMessage,
    markMessagesRead,
    openConversation,
    closeConversation,
    sendTyping,
    sendStopTyping,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

ChatProvider.propTypes = {
  children: PropTypes.node.isRequired
};
