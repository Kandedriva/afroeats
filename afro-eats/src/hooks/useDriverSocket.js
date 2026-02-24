import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';
import { toast } from 'react-toastify';

/**
 * Custom hook for driver socket connection and real-time notifications
 * Connects drivers to the socket server and handles new delivery order alerts
 */
export function useDriverSocket(driverId, isAvailable) {
  const socketRef = useRef(null);
  const audioRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [newOrderNotification, setNewOrderNotification] = useState(null);
  const soundIntervalRef = useRef(null);

  // Play single sound
  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Audio play failed
      });
    }
  }, []);

  // Stop repeating sound
  const stopRepeatingSound = useCallback(() => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
  }, []);

  // Play notification sound repeatedly
  const playRepeatingSound = useCallback(() => {
    // Clear any existing interval
    stopRepeatingSound();

    // Play sound immediately
    playSound();

    // Set up interval to play every 3 seconds
    soundIntervalRef.current = setInterval(() => {
      playSound();
    }, 3000);
  }, [playSound, stopRepeatingSound]);

  useEffect(() => {
    // Only connect if driver is logged in
    if (!driverId) {
      return undefined;
    }

    // Initialize audio for notifications
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.7;

    // Connect to socket server
    const socketUrl = API_BASE_URL.replace('/api', '').replace(/\/+$/, '');
    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    // Register as driver
    socketRef.current.on('connect', () => {
      socketRef.current.emit('register_driver', { driverId });
      setIsConnected(true);
    });

    // Handle registration success
    socketRef.current.on('registration_success', () => {
      // Driver registered successfully
    });

    // Listen for new delivery orders
    socketRef.current.on('new_delivery_order', (orderData) => {
      // Only play sound and show notification if driver is available
      if (isAvailable) {
        setNewOrderNotification(orderData);

        // Show toast notification
        toast.info(
          `🚗 New Delivery Order!\n${orderData.restaurantName}\nPayout: $${orderData.driverPayout.toFixed(2)}`,
          {
            position: 'top-center',
            autoClose: 10000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          }
        );

        // Play sound repeatedly until acknowledged
        playRepeatingSound();
      }
    });

    // Handle disconnect
    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      stopRepeatingSound();
    });

    // Handle connection errors
    socketRef.current.on('connect_error', () => {
      // Connection error occurred
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        stopRepeatingSound();
        socketRef.current.disconnect();
      }
    };
  }, [driverId, isAvailable, playRepeatingSound, stopRepeatingSound]);

  // Acknowledge notification (stops repeating sound)
  const acknowledgeNotification = () => {
    stopRepeatingSound();
    setNewOrderNotification(null);
  };

  return {
    socket: socketRef.current,
    isConnected,
    newOrderNotification,
    acknowledgeNotification,
  };
}
