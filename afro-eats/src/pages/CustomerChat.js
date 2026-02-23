import { useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import ChatConversationList from '../Components/ChatConversationList';
import ChatWindow from '../Components/ChatWindow';
import '../styles/CustomerChat.css';

/**
 * Full-page chat interface for customers
 * Shows list of conversations with restaurants and active chat
 */
export default function CustomerChat() {
  const { activeConversation, isConnected, unreadCount } = useSocket();
  const [isMobileConversationOpen, setIsMobileConversationOpen] = useState(false);

  const handleSelectConversation = () => {
    // On mobile, show chat window when conversation is selected
    setIsMobileConversationOpen(true);
  };

  const handleBackToList = () => {
    setIsMobileConversationOpen(false);
  };

  return (
    <div className="customer-chat-page">
      {/* Header */}
      <div className="chat-page-header">
        <h1>My Chats</h1>
        <div className="chat-page-status">
          {isConnected ? (
            <>
              <span className="status-dot online" />
              <span>Online</span>
            </>
          ) : (
            <>
              <span className="status-dot offline" />
              <span>Offline</span>
            </>
          )}
          {unreadCount > 0 && <span className="header-unread-badge">{unreadCount}</span>}
        </div>
      </div>

      {/* Chat Container */}
      <div className="chat-page-container">
        {/* Conversation List - Desktop always visible, Mobile conditional */}
        <div
          className={`chat-sidebar ${
            isMobileConversationOpen && activeConversation ? 'mobile-hidden' : ''
          }`}
        >
          <ChatConversationList onSelectConversation={handleSelectConversation} />
        </div>

        {/* Chat Window - Desktop always visible, Mobile conditional */}
        <div
          className={`chat-main ${
            !isMobileConversationOpen || !activeConversation ? 'mobile-hidden' : ''
          }`}
        >
          {activeConversation ? (
            <>
              {/* Mobile Back Button */}
              <button className="mobile-back-btn" onClick={handleBackToList}>
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <ChatWindow isMinimized={false} onMinimize={() => {}} />
            </>
          ) : (
            <div className="chat-main-empty">
              <svg
                width="120"
                height="120"
                viewBox="0 0 120 120"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M100 30a6 6 0 0 1-6 6H30l-12 12V24a6 6 0 0 1 6-6h70a6 6 0 0 1 6 6z" />
                <path d="M40 50h40M40 70h30" />
              </svg>
              <h2>Select a conversation</h2>
              <p>Choose a restaurant chat from the list to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
