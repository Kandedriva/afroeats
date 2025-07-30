import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOwnerAuth } from "../context/OwnerAuthContext";

const OwnerNavbar = () => {
  const { owner, logout } = useOwnerAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeOrderCount, setActiveOrderCount] = useState(0);
  const navigate = useNavigate();

  const fetchRestaurant = useCallback(async () => {
    if (owner) {
      try {
        const res = await fetch("http://localhost:5001/api/owners/restaurant", {
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
        const res = await fetch("http://localhost:5001/api/owners/notifications", {
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
        const res = await fetch("http://localhost:5001/api/owners/orders", {
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

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/owner/login");
    } catch (err) {
      console.error("Logout error:", err.message);
    }
  };

  return (
    <nav className="bg-gray-800 text-white p-4 flex justify-between items-center">
      <div className="flex items-center space-x-6">
        {owner && restaurant && (
          <div className="flex items-center space-x-3">
            {restaurant.image_url && (
              <img
                src={`http://localhost:5001/${restaurant.image_url.replace(/\\/g, "/")}`}
                alt={restaurant.name}
                className="w-8 h-8 rounded-full object-cover border-2 border-gray-300"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            )}
            <Link to="/owner/dashboard" className="text-xl font-bold">
              {restaurant.name}
            </Link>
          </div>
        )}
        
        {owner && (
          <>
            <Link to="/owner/add-dish" className="hover:underline bg-green-600 px-3 py-1 rounded">
              + Add Dish
            </Link>
            <Link to="/owner/orders" className="hover:underline bg-purple-600 px-3 py-1 rounded relative">
              📋 Orders
              {activeOrderCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {activeOrderCount > 9 ? '9+' : activeOrderCount}
                </span>
              )}
            </Link>
            <Link to="/owner/notifications" className="hover:underline bg-orange-600 px-3 py-1 rounded relative">
              🔔 Notifications
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <Link to="/owner/completed-orders" className="hover:underline bg-blue-600 px-3 py-1 rounded">
              📋 Completed Orders
            </Link>
          </>
        )}
      </div>

      {owner && (
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded"
        >
          Logout
        </button>
      )}
    </nav>
  );
};

export default OwnerNavbar;
