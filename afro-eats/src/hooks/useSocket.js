import { useContext } from 'react';
import { ChatContext } from '../context/ChatContext';

/**
 * Custom hook to access Socket.IO connection and chat functionality
 * @returns {Object} Chat context with socket connection and methods
 */
export function useSocket() {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error('useSocket must be used within a ChatProvider');
  }

  return context;
}
