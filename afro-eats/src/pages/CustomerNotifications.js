// React import removed as it's not needed in React 17+
import { useState, useEffect, useContext, useCallback } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";

function CustomerNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // all, refund, order_update
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const { user, loading: authLoading } = useContext(AuthContext);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/notifications`, {
        credentials: "include",
      });
      
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  const markNotificationRead = async (notificationId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/notifications/${notificationId}/mark-read`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, read: true }
              : notification
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      // Handle mark notification read error silently
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/notifications/mark-all-read`, {
        method: "POST",
        credentials: "include",
      });
      setNotifications(prev => prev.map(n => ({...n, read: true})));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error("Failed to mark all notifications as read");
    }
  };

  const deleteAllRead = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/notifications/delete-read`, {
        method: "DELETE",
        credentials: "include",
      });
      
      if (res.ok) {
        const data = await res.json();
        setNotifications(prev => prev.filter(n => !n.read));
        toast.success(`${data.deletedCount || 0} read notification${data.deletedCount !== 1 ? 's' : ''} deleted successfully`);
        setShowConfirmModal(false);
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to delete read notifications");
      }
    } catch (err) {
      // console.error('Delete notifications error:', err);
      toast.error("Failed to delete read notifications");
    }
  };

  const getFilteredNotifications = () => {
    if (filterType === 'all') {
      return notifications;
    }
    if (filterType === 'refund') {
      return notifications.filter(n => n.type.startsWith('refund_'));
    }
    if (filterType === 'order_update') {
      return notifications.filter(n =>
        n.type === 'order_update' ||
        n.type === 'order_completed' ||
        n.type === 'order_confirmed' ||
        n.type === 'order_ready'
      );
    }
    return notifications;
  };

  const getNotificationIcon = (type) => {
    if (type.startsWith('refund_approve')) {
      return '✅';
    }
    if (type.startsWith('refund_deny')) {
      return '❌';
    }
    if (type === 'order_confirmed') {
      return '🎉';
    }
    if (type === 'order_ready') {
      return '🍽️';
    }
    if (type === 'order_completed') {
      return '✅';
    }
    if (type === 'order_update') {
      return '📋';
    }
    return '📢';
  };

  const getNotificationColor = (type) => {
    if (type.startsWith('refund_approve')) {
      return 'bg-green-50 border-green-200';
    }
    if (type.startsWith('refund_deny')) {
      return 'bg-red-50 border-red-200';
    }
    if (type === 'order_confirmed') {
      return 'bg-green-50 border-green-200';
    }
    if (type === 'order_ready') {
      return 'bg-blue-50 border-blue-200';
    }
    if (type === 'order_completed') {
      return 'bg-green-50 border-green-200';
    }
    if (type === 'order_update') {
      return 'bg-yellow-50 border-yellow-200';
    }
    return 'bg-gray-50 border-gray-200';
  };

  const filteredNotifications = getFilteredNotifications();
  const refundNotifications = notifications.filter(n => n.type.startsWith('refund_'));
  const orderNotifications = notifications.filter(n =>
    n.type === 'order_update' ||
    n.type === 'order_completed' ||
    n.type === 'order_confirmed' ||
    n.type === 'order_ready'
  );

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6 sm:py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">My Notifications</h1>
          <p className="text-sm sm:text-base text-gray-600">Stay updated on your orders and refund requests</p>
        </div>
        <Link
          to="/my-orders"
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base text-center whitespace-nowrap"
        >
          ← Back to Orders
        </Link>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-white p-3 sm:p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-800">Total</h3>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">{notifications.length}</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">All notifications</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-800">Unread</h3>
          <p className="text-xl sm:text-2xl font-bold text-orange-600">{unreadCount}</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Need attention</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-800">Refunds</h3>
          <p className="text-xl sm:text-2xl font-bold text-purple-600">{refundNotifications.length}</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Refund responses</p>
        </div>
        <div className="bg-white p-3 sm:p-4 rounded-lg border shadow-sm">
          <h3 className="text-sm sm:text-lg font-semibold text-gray-800">Orders</h3>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{orderNotifications.length}</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Status changes</p>
        </div>
      </div>

      {/* Actions and Filters */}
      {notifications.length > 0 && (
        <div className="bg-white p-3 sm:p-4 rounded-lg border mb-4 sm:mb-6">
          <div className="flex flex-col space-y-3 sm:space-y-4">
            {/* Filter */}
            <div className="w-full">
              <label htmlFor="filterType" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Filter by Type</label>
              <select
                id="filterType"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Notifications ({notifications.length})</option>
                <option value="refund">Refund Updates ({refundNotifications.length})</option>
                <option value="order_update">Order Updates ({orderNotifications.length})</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm"
                >
                  Mark All Read ({unreadCount})
                </button>
              )}
              {notifications.filter(n => n.read).length > 0 && (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="w-full sm:w-auto bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-xs sm:text-sm"
                >
                  Clear Read
                </button>
              )}
            </div>

            <div className="text-xs sm:text-sm text-gray-500">
              Showing {filteredNotifications.length} of {notifications.length} notifications
            </div>
          </div>
        </div>
      )}

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="text-center py-8 sm:py-12 bg-gray-50 rounded-lg px-4">
          <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">🔔</div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
            {filterType === 'all' ? 'No Notifications' :
             filterType === 'refund' ? 'No Refund Updates' : 'No Order Updates'}
          </h3>
          <p className="text-sm sm:text-base text-gray-500 mb-4 sm:mb-6">
            {filterType === 'all' ? "You're all caught up! New notifications will appear here." :
             filterType === 'refund' ? "No refund responses yet." : "No order status updates yet."}
          </p>
          <Link
            to="/my-orders"
            className="inline-block bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base"
          >
            View My Orders
          </Link>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {filteredNotifications.map((notification) => {
            const data = notification.data || {};
            const isRefundNotification = notification.type.startsWith('refund_');

            return (
              <div
                key={notification.id}
                className={`border rounded-lg p-3 sm:p-4 md:p-6 transition-all hover:shadow-md cursor-pointer ${
                  !notification.read ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white'
                } ${getNotificationColor(notification.type)}`}
                onClick={() => !notification.read && markNotificationRead(notification.id)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !notification.read) {
                    e.preventDefault();
                    markNotificationRead(notification.id);
                  }
                }}
                role="button"
                tabIndex={!notification.read ? 0 : -1}
                aria-label={!notification.read ? "Mark notification as read" : "Notification already read"}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                  <div className="flex items-start space-x-2 sm:space-x-3 flex-1">
                    <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full mt-1 flex-shrink-0 ${!notification.read ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                    <div className="text-xl sm:text-2xl flex-shrink-0">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm sm:text-base md:text-lg text-gray-800 break-words">
                        {notification.title}
                      </h4>
                      {isRefundNotification && data.restaurantName && (
                        <p className="text-xs sm:text-sm text-gray-600">From: {data.restaurantName}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                    {new Date(notification.created_at).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-3 sm:mb-4 leading-relaxed break-words">{notification.message}</p>
                
                {/* Refund Details */}
                {isRefundNotification && (
                  <div className={`p-3 sm:p-4 rounded-lg mb-3 sm:mb-4 ${
                    notification.type === 'refund_approve'
                      ? 'bg-green-100 border border-green-200'
                      : 'bg-red-100 border border-red-200'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                      <span className="font-medium text-sm sm:text-base text-gray-800">
                        {notification.type === 'refund_approve' ? 'Refund Approved' : 'Refund Denied'}
                      </span>
                      {data.restaurantTotal && (
                        <span className="text-base sm:text-lg font-bold">
                          ${Number(data.restaurantTotal).toFixed(2)}
                        </span>
                      )}
                    </div>
                    {data.itemCount && (
                      <div className="text-xs sm:text-sm text-gray-600 mb-2">
                        For {data.itemCount} item{data.itemCount !== 1 ? 's' : ''} from your order
                      </div>
                    )}
                    {data.refundNotes && (
                      <div className="text-xs sm:text-sm text-gray-700 mt-2 p-2 bg-white rounded border-l-4 border-gray-400 break-words">
                        <strong>Restaurant Notes:</strong> {data.refundNotes}
                      </div>
                    )}
                  </div>
                )}

                {/* Order Details */}
                {data.orderId && (
                  <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Order #{data.orderId}</span>
                      <Link
                        to={`/order-details/${data.orderId}`}
                        className="text-xs sm:text-sm bg-green-600 text-white px-3 py-1.5 sm:py-1 rounded hover:bg-green-700 transition-colors text-center whitespace-nowrap"
                      >
                        View Order →
                      </Link>
                    </div>
                    {data.orderTotal && (
                      <div className="text-xs sm:text-sm text-gray-600 mt-1">
                        Order Total: ${Number(data.orderTotal).toFixed(2)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-800">
              Clear Read Notifications
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
              Are you sure you want to permanently delete all read notifications? This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteAllRead}
                className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Read
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerNotifications;