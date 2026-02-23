import { useState, useEffect, useRef, useContext } from 'react';
import { useSocket } from '../hooks/useSocket';
import { AuthContext } from '../context/AuthContext';
import { OwnerAuthContext } from '../context/OwnerAuthContext';
import ChatMessage from './ChatMessage';
import '../styles/ChatWindow.css';

/**
 * Main chat window component
 * Displays active conversation messages and input field
 */
export default function ChatWindow({ isMinimized, onMinimize, isFloating = false }) {
  const { user } = useContext(AuthContext);
  const { owner } = useContext(OwnerAuthContext);
  const {
    activeConversation,
    messages,
    sendMessage,
    closeConversation,
    sendTyping,
    sendStopTyping,
    isConnected,
  } = useSocket();

  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!messageInput.trim() || !activeConversation || !isConnected) {
      return;
    }

    sendMessage(activeConversation.id, messageInput);
    setMessageInput('');
    sendStopTyping(activeConversation.id);
  };

  const handleInputChange = (e) => {
    setMessageInput(e.target.value);

    if (!activeConversation) {
      return;
    }

    // Send typing indicator
    if (!isTyping) {
      setIsTyping(true);
      sendTyping(activeConversation.id);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendStopTyping(activeConversation.id);
    }, 2000);
  };

  const handleClose = () => {
    closeConversation();
  };

  const getConversationTitle = () => {
    if (!activeConversation) {
      return 'Chat';
    }
    return activeConversation.restaurant_name || activeConversation.customer_name || 'Chat';
  };

  if (isMinimized) {
    return null;
  }

  return (
    <div className={`chat-window ${isFloating ? 'floating-mode' : ''}`}>
      {/* Header - Only show when not in floating mode */}
      {!isFloating && (
        <div className="chat-header">
          <div className="chat-header-info">
            <h3>{getConversationTitle()}</h3>
            {activeConversation?.order_id && (
              <span className="chat-order-badge">Order #{activeConversation.order_id}</span>
            )}
            {!isConnected && <span className="chat-offline-indicator">Offline</span>}
          </div>

          <div className="chat-header-actions">
            <button onClick={onMinimize} className="chat-action-btn" aria-label="Minimize">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <button onClick={handleClose} className="chat-action-btn" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path
                  d="M6 6l8 8M14 6l-8 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {!activeConversation ? (
          <div className="chat-empty-state">
            <svg
              width="64"
              height="64"
              viewBox="0 0 64 64"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M54 18a4 4 0 0 1-4 4H18l-8 8V14a4 4 0 0 1 4-4h36a4 4 0 0 1 4 4z" />
            </svg>
            <p>Select a conversation to start chatting</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty-state">
            <p>No messages yet</p>
            <span>Send a message to start the conversation!</span>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              // Determine if this message is from the current user
              const isOwnMessage = user
                ? message.sender_type === 'customer' && message.sender_id === user.id
                : message.sender_type === 'owner' && message.sender_id === owner?.id;

              return <ChatMessage key={message.id} message={message} isOwnMessage={isOwnMessage} />;
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      {activeConversation && (
        <form className="chat-input-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            placeholder="Type a message..."
            value={messageInput}
            onChange={handleInputChange}
            disabled={!isConnected}
            className="chat-input"
          />
          <button
            type="submit"
            disabled={!messageInput.trim() || !isConnected}
            className="chat-send-btn"
            aria-label="Send message"
          >
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
              <path d="M18 2L9 11M18 2l-7 16-2-7-7-2 16-7z" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}
