import { useEffect, useState, useContext, useCallback } from 'react';
import { GroceryOwnerAuthContext } from '../context/GroceryOwnerAuthContext';
import { Navigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../config/api';

function GroceryOwnerNotifications() {
  const { groceryOwner, loading: authLoading } = useContext(GroceryOwnerAuthContext);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, new_order, refund_request

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/grocery-owners/notifications`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Notifications fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markNotificationRead = async (notificationId) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/grocery-owners/notifications/${notificationId}/mark-read`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      if (res.ok) {
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId ? { ...notification, read: true } : notification
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Mark notification read error:', err);
    }
  };

  const markAllRead = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/grocery-owners/notifications/mark-all-read`, {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
        toast.success('All notifications marked as read');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Mark all read error:', err);
      toast.error('Failed to mark all as read');
    }
  };

  // Wait for auth to load
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Redirect if not authenticated
  if (!groceryOwner) {
    return <Navigate to="/grocery-owner/login" replace />;
  }

  // Filter notifications
  const filteredNotifications = notifications.filter((notification) => {
    if (filter === 'all') {
      return true;
    }
    if (filter === 'unread') {
      return !notification.read;
    }
    return notification.type === filter;
  });

  // Get notification icon and color based on type
  const getNotificationStyle = (type) => {
    switch (type) {
      case 'new_order':
        return { icon: '🛒', bgColor: 'bg-green-50', borderColor: 'border-green-200', textColor: 'text-green-800' };
      case 'order_change':
        return { icon: '🔄', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-800' };
      case 'refund_request':
        return { icon: '💰', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', textColor: 'text-yellow-800' };
      case 'order_cancelled':
        return { icon: '❌', bgColor: 'bg-red-50', borderColor: 'border-red-200', textColor: 'text-red-800' };
      default:
        return { icon: '📢', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', textColor: 'text-gray-800' };
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) {
      return 'Just now';
    }
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} minutes ago`;
    }
    if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)} hours ago`;
    }
    if (seconds < 604800) {
      return `${Math.floor(seconds / 86400)} days ago`;
    }
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
              <p className="text-gray-600 mt-2">
                {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="mt-4 sm:mt-0 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Mark All as Read
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow mb-6 overflow-x-auto">
          <div className="flex border-b">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                filter === 'all'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-600 hover:text-green-600'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                filter === 'unread'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-600 hover:text-green-600'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('new_order')}
              className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                filter === 'new_order'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-600 hover:text-green-600'
              }`}
            >
              New Orders
            </button>
            <button
              onClick={() => setFilter('refund_request')}
              className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                filter === 'refund_request'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-600 hover:text-green-600'
              }`}
            >
              Refund Requests
            </button>
          </div>
        </div>

        {/* Notifications List */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Notifications</h3>
            <p className="text-gray-600">
              {filter === 'all'
                ? 'You have no notifications yet.'
                : `No ${filter === 'unread' ? 'unread' : filter.replace('_', ' ')} notifications.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotifications.map((notification) => {
              const style = getNotificationStyle(notification.type);
              return (
                <div
                  key={notification.id}
                  className={`bg-white rounded-lg shadow-md border-l-4 ${style.borderColor} p-6 transition-all hover:shadow-lg ${
                    !notification.read ? 'bg-green-50 cursor-pointer' : ''
                  }`}
                  onClick={() => !notification.read && markNotificationRead(notification.id)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !notification.read) {
                      markNotificationRead(notification.id);
                    }
                  }}
                  role={!notification.read ? 'button' : 'article'}
                  tabIndex={!notification.read ? 0 : -1}
                  aria-label={!notification.read ? 'Mark notification as read' : undefined}
                >
                  <div className="flex items-start">
                    {/* Icon */}
                    <div className={`${style.bgColor} rounded-full p-3 mr-4`}>
                      <span className="text-2xl">{style.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <h3 className={`font-semibold ${style.textColor}`}>{notification.title}</h3>
                          {!notification.read && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-600 text-white">
                              New
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500 ml-4 whitespace-nowrap">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                      </div>

                      <p className="text-gray-700 mb-3">{notification.message}</p>

                      {/* Additional Info */}
                      {notification.data && (
                        <div className="bg-gray-50 rounded-md p-3 mb-3 text-sm">
                          {notification.data.orderId && (
                            <p className="text-gray-600">
                              <span className="font-medium">Order ID:</span> #{notification.data.orderId}
                            </p>
                          )}
                          {notification.data.total && (
                            <p className="text-gray-600">
                              <span className="font-medium">Amount:</span> ${Number(notification.data.total).toFixed(2)}
                            </p>
                          )}
                          {notification.data.customerName && (
                            <p className="text-gray-600">
                              <span className="font-medium">Customer:</span> {notification.data.customerName}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action Button */}
                      {notification.grocery_order_id && (
                        <Link
                          to="/grocery-owner/orders"
                          className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors text-sm font-medium"
                        >
                          View Order →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default GroceryOwnerNotifications;
