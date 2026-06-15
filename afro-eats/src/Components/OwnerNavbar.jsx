import { useEffect, useState, useCallback, useContext, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOwnerAuth } from "../context/OwnerAuthContext";
import { ChatContext } from "../context/ChatContext";
import { API_BASE_URL } from "../config/api";
import { getImageUrl, handleImageError } from "../utils/imageUtils";

const OwnerNavbar = () => {
  const { owner, logout } = useOwnerAuth();
  const { latestOrderEvent } = useContext(ChatContext);
  const [restaurant, setRestaurant] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeOrderCount, setActiveOrderCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const audioRef = useRef(null);
  const soundIntervalRef = useRef(null);
  const [hasNewAlert, setHasNewAlert] = useState(false);
  const navigate = useNavigate();

  const fetchRestaurant = useCallback(async () => {
    if (owner) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/owners/restaurant`, {
          credentials: "include",
        });

        if (res.ok) {
          const restaurantData = await res.json();
          setRestaurant(restaurantData);
        }
      } catch (err) {
        // Restaurant fetch failed
      }
    }
  }, [owner]);

  const fetchNotificationCount = useCallback(async () => {
    if (owner) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/owners/notifications`, {
          credentials: "include",
        });
        
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (err) {
        // Notifications fetch failed
      }
    }
  }, [owner]);

  const fetchActiveOrderCount = useCallback(async () => {
    if (owner) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/owners/orders`, {
          credentials: "include",
        });
        
        if (res.ok) {
          const data = await res.json();
          const activeOrders = (data.orders || []).filter(order => order.status !== 'completed');
          setActiveOrderCount(activeOrders.length);
        }
      } catch (err) {
        // Orders fetch failed
      }
    }
  }, [owner]);

  useEffect(() => {
    fetchRestaurant();
    fetchNotificationCount();
    fetchActiveOrderCount();

    // Poll for updates every 30 seconds
    const updateInterval = setInterval(() => {
      fetchNotificationCount();
      fetchActiveOrderCount();
    }, 30000);

    // Listen for logo update events
    const handleLogoUpdate = (event) => {
      if (event.detail && event.detail.restaurant) {
        setRestaurant(event.detail.restaurant);
      }
    };

    window.addEventListener('logoUpdated', handleLogoUpdate);

    // Cleanup event listener and interval
    return () => {
      window.removeEventListener('logoUpdated', handleLogoUpdate);
      clearInterval(updateInterval);
    };
  }, [owner, fetchRestaurant, fetchNotificationCount, fetchActiveOrderCount]);

  const stopRepeatingSound = useCallback(() => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
    setHasNewAlert(false);
  }, []);

  const startRepeatingSound = useCallback(() => {
    // Clear any existing loop first
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
    }
    // Play immediately
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
    setHasNewAlert(true);
    // Then repeat every 8 seconds until owner acknowledges
    soundIntervalRef.current = setInterval(() => {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    }, 8000);
  }, []);

  // Initialise notification sound
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.7;
    return () => {
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // React to real-time socket events — update badge instantly, start repeating sound on new order
  useEffect(() => {
    if (!latestOrderEvent) { return; }
    if (latestOrderEvent.type === 'new_order' || latestOrderEvent.type === 'order_delivered') {
      fetchNotificationCount();
      fetchActiveOrderCount();
    }
    if (latestOrderEvent.type === 'new_order') {
      startRepeatingSound();
    }
  }, [latestOrderEvent, fetchNotificationCount, fetchActiveOrderCount, startRepeatingSound]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/owner/login");
    } catch (err) {
      // console.error("Logout error:", err.message);
    }
  };

  const bellActive = unreadCount > 0 || hasNewAlert;
  const bellSVG = (
    <svg
      className={`w-5 h-5 transition-colors ${bellActive ? 'animate-bounce text-yellow-300' : 'text-white'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );

  return (
    <nav className="bg-gray-800 text-white">
      {/* Desktop and mobile header */}
      <div className="px-4 py-3 flex justify-between items-center">
        {/* Restaurant branding */}
        {owner && restaurant && (
          <div className="flex items-center space-x-3">
            {restaurant.image_url && (
              <img
                src={getImageUrl(restaurant.image_url, restaurant.name)}
                alt={restaurant.name}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-gray-300"
                onError={(e) => handleImageError(e, restaurant.name)}
              />
            )}
            <Link to="/owner/dashboard" className="text-lg sm:text-xl font-bold truncate max-w-32 sm:max-w-none">
              {restaurant.name}
            </Link>
          </div>
        )}
        
        {/* Desktop navigation */}
        {owner && (
          <div className="hidden lg:flex items-center space-x-4">
            <Link to="/owner/add-dish" className="hover:underline bg-green-600 px-3 py-2 rounded transition-colors">
              + Add Dish
            </Link>
            <Link to="/owner/orders" className="hover:underline bg-purple-600 px-3 py-2 rounded relative transition-colors">
              📋 Orders
              {activeOrderCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {activeOrderCount > 9 ? '9+' : activeOrderCount}
                </span>
              )}
            </Link>
            <Link to="/owner/notifications" onClick={stopRepeatingSound} className="hover:underline bg-orange-600 px-3 py-2 rounded relative transition-colors flex items-center gap-2">
              {bellSVG} Notifications
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <Link to="/owner/completed-orders" className="hover:underline bg-blue-600 px-3 py-2 rounded transition-colors">
              📋 Completed Orders
            </Link>
            <Link to="/owner/reports" className="hover:underline bg-yellow-600 px-3 py-2 rounded transition-colors">
              📊 Reports
            </Link>
            <Link to="/owner/account" className="hover:underline bg-indigo-600 px-3 py-2 rounded transition-colors">
              ⚙️ Account
            </Link>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 px-3 py-2 rounded transition-colors"
            >
              Logout
            </button>
          </div>
        )}
        
        {/* Mobile menu button */}
        {owner && (
          <div className="lg:hidden flex items-center space-x-2">
            {/* Quick action buttons for mobile */}
            <Link to="/owner/orders" className="bg-purple-600 p-2 rounded relative">
              📋
              {activeOrderCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold text-[10px]">
                  {activeOrderCount > 9 ? '9+' : activeOrderCount}
                </span>
              )}
            </Link>
            <Link to="/owner/notifications" onClick={stopRepeatingSound} className="bg-orange-600 p-2 rounded relative flex items-center justify-center">
              {bellSVG}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold text-[10px]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="bg-gray-700 hover:bg-gray-600 p-2 rounded transition-colors"
              aria-label="Toggle mobile menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        )}
      </div>
      
      {/* Mobile menu */}
      {owner && isMobileMenuOpen && (
        <div className="lg:hidden bg-gray-700 border-t border-gray-600">
          <div className="px-4 py-2 space-y-2">
            <Link 
              to="/owner/add-dish" 
              className="block bg-green-600 hover:bg-green-700 px-4 py-3 rounded transition-colors text-center font-medium"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              + Add Dish
            </Link>
            <Link 
              to="/owner/orders" 
              className="flex items-center justify-between bg-purple-600 hover:bg-purple-700 px-4 py-3 rounded transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>📋 Orders</span>
              {activeOrderCount > 0 && (
                <span className="bg-orange-500 text-white text-sm rounded-full px-2 py-1 font-bold">
                  {activeOrderCount}
                </span>
              )}
            </Link>
            <Link
              to="/owner/notifications"
              className="flex items-center justify-between bg-orange-600 hover:bg-orange-700 px-4 py-3 rounded transition-colors"
              onClick={() => { stopRepeatingSound(); setIsMobileMenuOpen(false); }}
            >
              <span className="flex items-center gap-2">{bellSVG} Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-sm rounded-full px-2 py-1 font-bold">
                  {unreadCount}
                </span>
              )}
            </Link>
            <Link
              to="/owner/completed-orders"
              className="block bg-blue-600 hover:bg-blue-700 px-4 py-3 rounded transition-colors text-center font-medium"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              📋 Completed Orders
            </Link>
            <Link
              to="/owner/reports"
              className="block bg-yellow-600 hover:bg-yellow-700 px-4 py-3 rounded transition-colors text-center font-medium"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              📊 Reports
            </Link>
            <Link
              to="/owner/account"
              className="block bg-indigo-600 hover:bg-indigo-700 px-4 py-3 rounded transition-colors text-center font-medium"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              ⚙️ Account
            </Link>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full bg-red-500 hover:bg-red-600 px-4 py-3 rounded transition-colors font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default OwnerNavbar;
