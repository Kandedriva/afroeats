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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 mb-4 sm:mb-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                  Notifications
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  Stay updated on orders & refunds
                </p>
              </div>
              <Link
                to="/my-orders"
                className="flex-shrink-0 bg-green-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg hover:bg-green-700 transition-all text-xs sm:text-sm font-medium shadow-sm"
              >
                ← Orders
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-4 sm:mb-5">
          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-medium">Total</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-0.5">{notifications.length}</p>
              </div>
              <div className="text-2xl">📬</div>
            </div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-medium">Unread</p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-600 mt-0.5">{unreadCount}</p>
              </div>
              <div className="text-2xl">🔔</div>
            </div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-medium">Refunds</p>
                <p className="text-2xl sm:text-3xl font-bold text-purple-600 mt-0.5">{refundNotifications.length}</p>
              </div>
              <div className="text-2xl">💰</div>
            </div>
          </div>
          <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-medium">Orders</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-0.5">{orderNotifications.length}</p>
              </div>
              <div className="text-2xl">🍽️</div>
            </div>
          </div>
        </div>

        {/* Actions and Filters */}
        {notifications.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 mb-4">
            {/* Filter */}
            <div className="mb-3">
              <select
                id="filterType"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 font-medium"
              >
                <option value="all">📋 All ({notifications.length})</option>
                <option value="refund">💰 Refunds ({refundNotifications.length})</option>
                <option value="order_update">🍽️ Orders ({orderNotifications.length})</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex-1 min-w-[140px] bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-all text-xs sm:text-sm font-medium shadow-sm"
                >
                  ✓ Mark All Read
                </button>
              )}
              {notifications.filter(n => n.read).length > 0 && (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="flex-1 min-w-[140px] bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-all text-xs sm:text-sm font-medium shadow-sm"
                >
                  🗑️ Clear Read
                </button>
              )}
            </div>

            <div className="text-xs text-gray-500 mt-2.5 text-center">
              Showing {filteredNotifications.length} of {notifications.length}
            </div>
          </div>
        )}

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm text-center py-10 sm:py-16 px-4">
            <div className="text-5xl sm:text-6xl mb-4">🔔</div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">
              {filterType === 'all' ? 'No Notifications' :
               filterType === 'refund' ? 'No Refund Updates' : 'No Order Updates'}
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              {filterType === 'all' ? "You're all caught up! New notifications will appear here." :
               filterType === 'refund' ? "No refund responses yet." : "No order status updates yet."}
            </p>
            <Link
              to="/my-orders"
              className="inline-block bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-all text-sm font-medium shadow-sm"
            >
              View My Orders
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            {filteredNotifications.map((notification) => {
              const data = notification.data || {};
              const isRefundNotification = notification.type.startsWith('refund_');

              return (
                <div
                  key={notification.id}
                  className={`rounded-xl border shadow-sm transition-all hover:shadow-md ${
                    !notification.read
                      ? 'bg-gradient-to-r from-blue-50 to-white border-blue-200'
                      : 'bg-white border-gray-200'
                  }`}
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
                  <div className="p-3 sm:p-4">
                    {/* Header */}
                    <div className="flex items-start gap-2.5 mb-2.5">
                      {/* Icon Badge */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                        !notification.read ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-bold text-sm sm:text-base text-gray-900 leading-tight">
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1"></span>
                          )}
                        </div>

                        {isRefundNotification && data.restaurantName && (
                          <p className="text-xs text-gray-500 mb-1.5">
                            <span className="font-medium">From:</span> {data.restaurantName}
                          </p>
                        )}

                        <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-2">
                          {notification.message}
                        </p>

                        <p className="text-xs text-gray-400">
                          {new Date(notification.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Refund Details */}
                    {isRefundNotification && (
                      <div className={`rounded-lg p-3 border-l-4 ${
                        notification.type === 'refund_approve'
                          ? 'bg-green-50 border-green-500'
                          : 'bg-red-50 border-red-500'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm text-gray-900">
                            {notification.type === 'refund_approve' ? '✅ Approved' : '❌ Denied'}
                          </span>
                          {data.restaurantTotal && (
                            <span className="text-lg font-bold text-gray-900">
                              ${Number(data.restaurantTotal).toFixed(2)}
                            </span>
                          )}
                        </div>
                        {data.itemCount && (
                          <p className="text-xs text-gray-600 mb-2">
                            {data.itemCount} item{data.itemCount !== 1 ? 's' : ''}
                          </p>
                        )}
                        {data.refundNotes && (
                          <div className="text-xs text-gray-700 mt-2 p-2 bg-white rounded">
                            <strong>Note:</strong> {data.refundNotes}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Order Details */}
                    {data.orderId && (
                      <div className="bg-gray-50 rounded-lg p-2.5 mt-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-700">
                              Order #{data.orderId}
                            </p>
                            {data.orderTotal && (
                              <p className="text-xs text-gray-500">
                                ${Number(data.orderTotal).toFixed(2)}
                              </p>
                            )}
                          </div>
                          <Link
                            to={`/order-details/${data.orderId}`}
                            className="flex-shrink-0 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-all text-xs font-medium"
                          >
                            View →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

        {/* Delete Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-6 max-w-sm w-full">
              <div className="text-center mb-4">
                <div className="text-4xl mb-3">🗑️</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Clear Read Notifications?
                </h3>
                <p className="text-sm text-gray-600">
                  This will permanently delete all read notifications. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteAllRead}
                  className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerNotifications;