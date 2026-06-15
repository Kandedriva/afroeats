import { Link } from "react-router-dom";
import { useContext, useState, useEffect, useRef, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import { CartContext } from "../context/CartContext";
import { useGroceryCart } from "../context/GroceryCartContext";
import { ChatContext } from "../context/ChatContext";
import { API_BASE_URL } from "../config/api";

function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const { cart } = useContext(CartContext);
  const { getGroceryItemCount } = useGroceryCart();
  const { latestOrderEvent } = useContext(ChatContext);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const audioRef = useRef(null);

  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const groceryItemCount = getGroceryItemCount();

  const fetchNotificationCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/notifications`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setNotificationCount(data.unreadCount || 0);
      }
    } catch (err) {
      // Silent fail for notification count fetch
    }
  }, []);

  // Poll for updates every 30 seconds
  useEffect(() => {
    if (user) {
      fetchNotificationCount();
      const interval = setInterval(fetchNotificationCount, 30000);
      return () => clearInterval(interval);
    } else {
      setNotificationCount(0);
      return undefined;
    }
  }, [user, fetchNotificationCount]);

  // Initialise notification sound
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.7;
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // React to real-time socket events — play sound once and refresh badge instantly
  useEffect(() => {
    if (!latestOrderEvent) { return; }
    if (latestOrderEvent.type === 'order_status_update') {
      fetchNotificationCount();
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    }
  }, [latestOrderEvent, fetchNotificationCount]);

  const bellSVG = (
    <svg
      className={`w-5 h-5 transition-colors ${notificationCount > 0 ? 'animate-bounce text-green-600' : 'text-gray-500'}`}
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
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="text-xl sm:text-2xl font-bold text-green-600 flex-shrink-0">
            OrderDabaly
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link
              to="/marketplace"
              className="text-gray-700 hover:text-green-600 transition-colors duration-200 font-medium"
            >
              🛒 Marketplace
            </Link>
            <Link
              to="/restaurants"
              className="text-gray-700 hover:text-green-600 transition-colors duration-200 font-medium"
            >
              🍽️ Restaurants
            </Link>
            <Link
              to="/cart"
              className="text-gray-700 hover:text-green-600 transition-colors duration-200 flex items-center relative"
            >
              Food Cart
              {cartItemCount > 0 && (
                <span className="ml-1 bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </Link>
            {groceryItemCount > 0 && (
              <Link
                to="/grocery-cart"
                className="text-gray-700 hover:text-green-600 transition-colors duration-200 flex items-center relative"
              >
                🥬 Grocery Cart
                <span className="ml-1 bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {groceryItemCount}
                </span>
              </Link>
            )}

            {user ? (
              <>
                <Link to="/my-orders" className="text-gray-700 hover:text-green-600 transition-colors duration-200">
                  Orders
                </Link>
                <Link to="/my-notifications" className="text-gray-700 hover:text-green-600 transition-colors duration-200 relative flex items-center gap-1">
                  {bellSVG}
                  <span>Notifications</span>
                  {notificationCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  )}
                </Link>
                <Link to="/my-profile" className="text-gray-700 hover:text-green-600 transition-colors duration-200">
                  Profile
                </Link>
                <span className="text-gray-600 text-sm">Hi, {user.name.split(" ")[0]}</span>
                <button
                  onClick={logout}
                  className="text-red-600 hover:text-red-800 transition-colors duration-200 font-medium"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-700 hover:text-green-600 transition-colors duration-200">
                  Login
                </Link>
                <Link to="/register" className="text-gray-700 hover:text-green-600 transition-colors duration-200">
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-3">
            {/* Mobile Cart Icon */}
            <Link
              to="/cart"
              className="text-gray-700 hover:text-green-600 transition-colors duration-200 relative p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 8.5M7 13v7a2 2 0 002 2h10a2 2 0 002-2v-7M7 13H5.4" />
              </svg>
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </Link>

            {/* Mobile Bell Icon — only for logged-in users */}
            {user && (
              <Link
                to="/my-notifications"
                className="text-gray-700 hover:text-green-600 transition-colors duration-200 relative p-2"
              >
                {bellSVG}
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold text-[10px]">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </Link>
            )}

            {/* Hamburger menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-green-600 transition-colors duration-200 p-2"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link
                to="/marketplace"
                className="block px-3 py-2 text-gray-700 hover:text-green-600 hover:bg-gray-50 rounded-md transition-colors duration-200 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                🛒 Marketplace
              </Link>
              <Link
                to="/restaurants"
                className="block px-3 py-2 text-gray-700 hover:text-green-600 hover:bg-gray-50 rounded-md transition-colors duration-200 font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                🍽️ Restaurants
              </Link>
              {groceryItemCount > 0 && (
                <Link
                  to="/grocery-cart"
                  className="block px-3 py-2 text-gray-700 hover:text-green-600 hover:bg-gray-50 rounded-md transition-colors duration-200"
                  onClick={() => setIsMenuOpen(false)}
                >
                  🥬 Grocery Cart ({groceryItemCount})
                </Link>
              )}
              {user ? (
                <>
                  <Link
                    to="/my-orders"
                    className="block px-3 py-2 text-gray-700 hover:text-green-600 hover:bg-gray-50 rounded-md transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    📋 My Orders
                  </Link>
                  <Link
                    to="/my-notifications"
                    className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-green-600 hover:bg-gray-50 rounded-md transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {bellSVG}
                    <span>Notifications</span>
                    {notificationCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {notificationCount > 9 ? '9+' : notificationCount}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/my-profile"
                    className="block px-3 py-2 text-gray-700 hover:text-green-600 hover:bg-gray-50 rounded-md transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    👤 My Profile
                  </Link>
                  <div className="px-3 py-2 text-gray-600 text-sm border-t border-gray-100">
                    Welcome, {user.name.split(" ")[0]}
                  </div>
                  <button
                    onClick={() => {
                      logout();
                      setIsMenuOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors duration-200"
                  >
                    🚪 Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="block px-3 py-2 text-gray-700 hover:text-green-600 hover:bg-gray-50 rounded-md transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    🔑 Login
                  </Link>
                  <Link
                    to="/register"
                    className="block px-3 py-2 text-gray-700 hover:text-green-600 hover:bg-gray-50 rounded-md transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    📝 Register
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
