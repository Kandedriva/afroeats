import { Link } from "react-router-dom";
import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { CartContext } from "../context/CartContext";
import { API_BASE_URL } from "../config/api";

function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const { cart } = useContext(CartContext);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

  // Fetch notification count for logged-in users
  useEffect(() => {
    if (user) {
      fetchNotificationCount();
      // Refresh notification count every 30 seconds
      const interval = setInterval(fetchNotificationCount, 30000);
      return () => clearInterval(interval);
    } else {
      setNotificationCount(0);
    }
  }, [user]);

  const fetchNotificationCount = async () => {
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
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="text-xl sm:text-2xl font-bold text-green-600 flex-shrink-0">
            A Food Zone
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <Link 
              to="/cart" 
              className="text-gray-700 hover:text-green-600 transition-colors duration-200 flex items-center relative"
            >
              🛒 Cart
              {cartItemCount > 0 && (
                <span className="ml-1 bg-green-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </Link>

            {user ? (
              <>
                <Link to="/my-orders" className="text-gray-700 hover:text-green-600 transition-colors duration-200">
                  Orders
                </Link>
                <Link to="/my-notifications" className="text-gray-700 hover:text-green-600 transition-colors duration-200 relative">
                  Notifications
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
                <Link to="/register-owner" className="text-blue-600 hover:text-blue-800 transition-colors duration-200 text-sm">
                  Restaurant Owner
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
                    className="block px-3 py-2 text-gray-700 hover:text-green-600 hover:bg-gray-50 rounded-md transition-colors duration-200 relative"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    🔔 Notifications
                    {notificationCount > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 inline-flex items-center justify-center">
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
                  <Link 
                    to="/register-owner" 
                    className="block px-3 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    🍴 Restaurant Owner
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
