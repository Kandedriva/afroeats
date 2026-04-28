import { useContext, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { GroceryOwnerAuthContext } from '../context/GroceryOwnerAuthContext';
import { API_BASE_URL } from '../config/api';
import { toast } from 'react-toastify';
import NotificationBell from './NotificationBell';

function GroceryOwnerNavbar() {
  const { groceryOwner, logout } = useContext(GroceryOwnerAuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!groceryOwner) { return undefined; }
    const fetchUnread = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/grocery-owners/notifications`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (_) {
        // silent fail
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [groceryOwner]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/grocery-owner/login');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Logout error:', error);
      toast.error('Logout failed');
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link to="/grocery-owner/dashboard" className="flex items-center space-x-2">
              <span className="text-2xl font-bold">🛒</span>
              <span className="text-xl font-semibold hidden sm:block">Order Dabaly</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            <Link
              to="/grocery-owner/dashboard"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/grocery-owner/dashboard')
                  ? 'bg-green-800 text-white'
                  : 'text-green-100 hover:bg-green-700'
              }`}
            >
              📊 Dashboard
            </Link>
            <Link
              to="/grocery-owner/orders"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/grocery-owner/orders')
                  ? 'bg-green-800 text-white'
                  : 'text-green-100 hover:bg-green-700'
              }`}
            >
              📦 Orders
            </Link>
            <Link
              to="/grocery-owner/products"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/grocery-owner/products')
                  ? 'bg-green-800 text-white'
                  : 'text-green-100 hover:bg-green-700'
              }`}
            >
              🛍️ Products
            </Link>
            <Link
              to="/grocery-owner/notifications"
              className={`relative px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/grocery-owner/notifications')
                  ? 'bg-green-800 text-white'
                  : 'text-green-100 hover:bg-green-700'
              }`}
            >
              🔔 Notifications
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            <Link
              to="/grocery-owner/store"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/grocery-owner/store')
                  ? 'bg-green-800 text-white'
                  : 'text-green-100 hover:bg-green-700'
              }`}
            >
              🏪 Store Settings
            </Link>
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {/* Notification Bell */}
            {groceryOwner && (
              <NotificationBell userRole="grocery-owner" theme="dark" />
            )}
            <div className="hidden md:block text-right">
              <div className="text-sm font-medium">{groceryOwner?.name}</div>
              <div className="text-xs text-green-200">{groceryOwner?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-3 space-y-1">
          <Link
            to="/grocery-owner/dashboard"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              isActive('/grocery-owner/dashboard')
                ? 'bg-green-800 text-white'
                : 'text-green-100 hover:bg-green-700'
            }`}
          >
            📊 Dashboard
          </Link>
          <Link
            to="/grocery-owner/orders"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              isActive('/grocery-owner/orders')
                ? 'bg-green-800 text-white'
                : 'text-green-100 hover:bg-green-700'
            }`}
          >
            📦 Orders
          </Link>
          <Link
            to="/grocery-owner/products"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              isActive('/grocery-owner/products')
                ? 'bg-green-800 text-white'
                : 'text-green-100 hover:bg-green-700'
            }`}
          >
            🛍️ Products
          </Link>
          <Link
            to="/grocery-owner/notifications"
            className={`flex items-center justify-between px-3 py-2 rounded-md text-base font-medium ${
              isActive('/grocery-owner/notifications')
                ? 'bg-green-800 text-white'
                : 'text-green-100 hover:bg-green-700'
            }`}
          >
            <span>🔔 Notifications</span>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
          <Link
            to="/grocery-owner/store"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              isActive('/grocery-owner/store')
                ? 'bg-green-800 text-white'
                : 'text-green-100 hover:bg-green-700'
            }`}
          >
            🏪 Store Settings
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default GroceryOwnerNavbar;
