import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../config/api';

/**
 * Custom hook for real-time order notifications with sound alerts
 * Polls the backend for new orders and plays a sound when detected
 */
export const useOrderNotifications = (userRole = null, _restaurantId = null) => {
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [lastOrderId, setLastOrderId] = useState(null);
  const [isEnabled, setIsEnabled] = useState(true);
  const audioRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const lastCheckRef = useRef(Date.now());

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.7; // Set volume to 70%

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (audioRef.current && isEnabled) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((error) => {
        // eslint-disable-next-line no-console
        console.log('Audio play failed:', error);
        // Some browsers block autoplay, user interaction may be needed first
      });
    }
  }, [isEnabled]);

  // Show browser notification
  const showBrowserNotification = useCallback((title, body) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/logo192.png',
        badge: '/favicon.ico',
        tag: 'order-notification',
        requireInteraction: false,
        silent: false,
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      // Handle notification click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }, []);

  // Check for new orders
  const checkForNewOrders = useCallback(async () => {
    if (!isEnabled || !userRole) {
      return;
    }

    try {
      let endpoint = '';

      // Different endpoints based on user role
      if (userRole === 'owner') {
        endpoint = `${API_BASE_URL}/api/owners/orders`;
      } else if (userRole === 'admin') {
        endpoint = `${API_BASE_URL}/api/admin/orders`;
      } else {
        return; // No notifications for regular customers
      }

      const response = await fetch(endpoint, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const orders = data.orders || data || [];

        if (orders.length > 0) {
          // Get the most recent order
          const sortedOrders = [...orders].sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
          );
          const latestOrder = sortedOrders[0];

          // Check if this is a new order (created in the last 30 seconds)
          const orderTime = new Date(latestOrder.created_at).getTime();
          const isNewOrder = (Date.now() - orderTime) < 30000; // Within last 30 seconds

          // If we have a new order ID and it's actually new
          if (lastOrderId && latestOrder.id !== lastOrderId && isNewOrder) {
            // New order detected!
            setNewOrderCount(prev => prev + 1);
            playNotificationSound();

            showBrowserNotification(
              '🍽️ New Order Received!',
              `Order #${latestOrder.id} - $${Number(latestOrder.total || 0).toFixed(2)}`
            );
          }

          setLastOrderId(latestOrder.id);
        }

        lastCheckRef.current = Date.now();
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error checking for new orders:', error);
    }
  }, [isEnabled, userRole, lastOrderId, playNotificationSound, showBrowserNotification]);

  // Start polling for new orders
  useEffect(() => {
    if (userRole && isEnabled) {
      // Request notification permission on mount
      requestNotificationPermission();

      // Initial check
      checkForNewOrders();

      // Poll every 10 seconds
      pollingIntervalRef.current = setInterval(checkForNewOrders, 10000);
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [userRole, isEnabled, checkForNewOrders, requestNotificationPermission]);

  // Clear notification count
  const clearNotificationCount = useCallback(() => {
    setNewOrderCount(0);
  }, []);

  // Toggle notifications
  const toggleNotifications = useCallback(() => {
    setIsEnabled(prev => !prev);
  }, []);

  return {
    newOrderCount,
    clearNotificationCount,
    isEnabled,
    toggleNotifications,
    requestNotificationPermission,
  };
};

export default useOrderNotifications;
