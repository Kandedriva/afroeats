import { format } from 'date-fns';
import '../styles/ChatMessage.css';

/**
 * Individual chat message component
 * Displays message content, sender info, timestamp, and read status
 */
export default function ChatMessage({ message, isOwnMessage }) {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return format(date, 'h:mm a');
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${format(date, 'h:mm a')}`;
    } else {
      return format(date, 'MMM d, h:mm a');
    }
  };

  return (
    <div className={`chat-message ${isOwnMessage ? 'own-message' : 'other-message'}`}>
      <div className="message-bubble">
        <p className="message-text">{message.message}</p>
        <div className="message-meta">
          <span className="message-time">{formatTime(message.created_at)}</span>
          {isOwnMessage && (
            <span className="message-status">
              {message.is_read ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M2 8l3 3 8-8" />
                  <path d="M6 8l3 3 8-8" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M2 8l3 3 8-8" />
                </svg>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
