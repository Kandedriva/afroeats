import { useState } from 'react';
import { format } from 'date-fns';
import { useSocket } from '../hooks/useSocket';
import '../styles/ChatConversationList.css';

/**
 * List of chat conversations with search/filter
 * Shows conversation preview, last message, and unread badge
 */
export default function ChatConversationList({ onSelectConversation }) {
  const { conversations, activeConversation, openConversation } = useSocket();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter((conv) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      conv.restaurant_name?.toLowerCase().includes(searchLower) ||
      conv.customer_name?.toLowerCase().includes(searchLower) ||
      conv.last_message?.toLowerCase().includes(searchLower)
    );
  });

  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) {
      return '';
    }
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return format(date, 'h:mm a');
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d');
    }
  };

  const getConversationTitle = (conv) => {
    return conv.restaurant_name || conv.customer_name || 'Chat';
  };

  const getUnreadCount = (conv) => {
    return conv.customer_unread_count || conv.owner_unread_count || 0;
  };

  const handleSelectConversation = (conv) => {
    openConversation(conv);
    if (onSelectConversation) {
      onSelectConversation(conv);
    }
  };

  return (
    <div className="conversation-list">
      {/* Search Bar */}
      <div className="conversation-search">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="9" r="7" />
          <path d="M14 14l5 5" />
        </svg>
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Conversations */}
      <div className="conversation-items">
        {filteredConversations.length === 0 ? (
          <div className="no-conversations">
            <p>No conversations yet</p>
            <span>Start chatting with restaurants or customers!</span>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const unreadCount = getUnreadCount(conv);
            const isActive = activeConversation?.id === conv.id;

            return (
              <div
                key={conv.id}
                className={`conversation-item ${isActive ? 'active' : ''} ${
                  unreadCount > 0 ? 'unread' : ''
                }`}
                onClick={() => handleSelectConversation(conv)}
              >
                {/* Avatar */}
                <div className="conversation-avatar">
                  {conv.restaurant_image ? (
                    <img src={conv.restaurant_image} alt={getConversationTitle(conv)} />
                  ) : (
                    <div className="avatar-placeholder">
                      {getConversationTitle(conv).charAt(0).toUpperCase()}
                    </div>
                  )}
                  {unreadCount > 0 && <span className="avatar-badge">{unreadCount}</span>}
                </div>

                {/* Content */}
                <div className="conversation-content">
                  <div className="conversation-header">
                    <h4 className="conversation-title">{getConversationTitle(conv)}</h4>
                    <span className="conversation-time">
                      {formatLastMessageTime(conv.last_message_time)}
                    </span>
                  </div>

                  <div className="conversation-preview">
                    <p className="last-message">
                      {conv.last_message_sender === 'customer' && conv.restaurant_name && (
                        <span className="message-prefix">You: </span>
                      )}
                      {conv.last_message_sender === 'owner' && conv.customer_name && (
                        <span className="message-prefix">Owner: </span>
                      )}
                      {conv.last_message || 'No messages yet'}
                    </p>
                    {conv.order_id && (
                      <span className="order-badge">Order #{conv.order_id}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
