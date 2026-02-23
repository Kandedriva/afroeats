import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import FloatingChatWindow from './FloatingChatWindow';
import '../styles/ChatButton.css';

/**
 * Floating chat button with unread badge
 * Toggles chat window when clicked
 */
export default function ChatButton() {
  const { unreadCount, isChatOpen, setIsChatOpen, isConnected, fetchConversations } = useSocket();
  const [isMinimized, setIsMinimized] = useState(false);

  // Fetch conversations when component mounts
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleToggle = () => {
    if (isChatOpen && !isMinimized) {
      setIsMinimized(true);
    } else {
      setIsChatOpen(!isChatOpen);
      setIsMinimized(false);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        className={`chat-button ${isChatOpen && !isMinimized ? 'active' : ''}`}
        onClick={handleToggle}
        aria-label="Open chat"
      >
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
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="chat-button-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}

        {/* Connection Status */}
        {!isConnected && <span className="chat-button-offline" />}
      </button>

      {/* Chat Window */}
      {isChatOpen && (
        <FloatingChatWindow isMinimized={isMinimized} onMinimize={() => setIsMinimized(!isMinimized)} />
      )}
    </>
  );
}
