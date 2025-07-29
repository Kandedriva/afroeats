import React, { useState, useEffect, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { toast } from 'react-toastify';

function CustomerNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // all, refund, order_update
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const { user, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !authLoading) {
      fetchNotifications();
    }
  }, [user, authLoading]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://localhost:5001/api/auth/notifications", {
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
  };

  const markNotificationRead = async (notificationId) => {
    try {
      const res = await fetch(`http://localhost:5001/api/auth/notifications/${notificationId}/mark-read`, {
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
      await fetch("http://localhost:5001/api/auth/notifications/mark-all-read", {
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
      const res = await fetch("http://localhost:5001/api/auth/notifications/delete-read", {
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
      console.error('Delete notifications error:', err);
      toast.error("Failed to delete read notifications");
    }
  };

  const getFilteredNotifications = () => {
    if (filterType === 'all') return notifications;
    if (filterType === 'refund') return notifications.filter(n => n.type.startsWith('refund_'));
    if (filterType === 'order_update') return notifications.filter(n => n.type === 'order_update' || n.type === 'order_completed');
    return notifications;
  };

  const getNotificationIcon = (type) => {
    if (type.startsWith('refund_approve')) return '✅';
    if (type.startsWith('refund_deny')) return '❌';
    if (type === 'order_completed') return '🍽️';
    if (type === 'order_update') return '📋';
    return '📢';
  };

  const getNotificationColor = (type) => {
    if (type.startsWith('refund_approve')) return 'bg-green-50 border-green-200';
    if (type.startsWith('refund_deny')) return 'bg-red-50 border-red-200';
    if (type === 'order_completed') return 'bg-blue-50 border-blue-200';
    if (type === 'order_update') return 'bg-yellow-50 border-yellow-200';
    return 'bg-gray-50 border-gray-200';
  };

  const filteredNotifications = getFilteredNotifications();
  const refundNotifications = notifications.filter(n => n.type.startsWith('refund_'));
  const orderNotifications = notifications.filter(n => n.type === 'order_update' || n.type === 'order_completed');

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
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">My Notifications</h1>
          <p className="text-gray-600">Stay updated on your orders and refund requests</p>
        </div>
        <Link 
          to="/my-orders"
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          ← Back to Orders
        </Link>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800">Total</h3>
          <p className="text-2xl font-bold text-blue-600">{notifications.length}</p>
          <p className="text-sm text-gray-500 mt-1">All notifications</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800">Unread</h3>
          <p className="text-2xl font-bold text-orange-600">{unreadCount}</p>
          <p className="text-sm text-gray-500 mt-1">Need attention</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800">Refund Updates</h3>
          <p className="text-2xl font-bold text-purple-600">{refundNotifications.length}</p>
          <p className="text-sm text-gray-500 mt-1">Refund responses</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800">Order Updates</h3>
          <p className="text-2xl font-bold text-green-600">{orderNotifications.length}</p>
          <p className="text-sm text-gray-500 mt-1">Order status changes</p>
        </div>
      </div>

      {/* Actions and Filters */}
      {notifications.length > 0 && (
        <div className="bg-white p-4 rounded-lg border mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
            <div className="flex flex-wrap gap-4">
              {/* Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="all">All Notifications ({notifications.length})</option>
                  <option value="refund">Refund Updates ({refundNotifications.length})</option>
                  <option value="order_update">Order Updates ({orderNotifications.length})</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-3">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Mark All Read ({unreadCount})
                </button>
              )}
              {notifications.filter(n => n.read).length > 0 && (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  Clear Read Notifications
                </button>
              )}
            </div>
          </div>

          <div className="text-sm text-gray-500 mt-2">
            Showing {filteredNotifications.length} of {notifications.length} notifications
          </div>
        </div>
      )}

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">🔔</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            {filterType === 'all' ? 'No Notifications' : 
             filterType === 'refund' ? 'No Refund Updates' : 'No Order Updates'}
          </h3>
          <p className="text-gray-500 mb-6">
            {filterType === 'all' ? "You're all caught up! New notifications will appear here." :
             filterType === 'refund' ? "No refund responses yet." : "No order status updates yet."}
          </p>
          <Link 
            to="/my-orders"
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
          >
            View My Orders
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotifications.map((notification) => {
            const data = notification.data || {};
            const isRefundNotification = notification.type.startsWith('refund_');
            
            return (
              <div 
                key={notification.id} 
                className={`border rounded-lg p-6 transition-all hover:shadow-md ${
                  !notification.read ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white'
                } ${getNotificationColor(notification.type)}`}
                onClick={() => !notification.read && markNotificationRead(notification.id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${!notification.read ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                    <div className="text-2xl">{getNotificationIcon(notification.type)}</div>
                    <div>
                      <h4 className="font-semibold text-lg text-gray-800">
                        {notification.title}
                      </h4>
                      {isRefundNotification && data.restaurantName && (
                        <p className="text-sm text-gray-600">From: {data.restaurantName}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(notification.created_at).toLocaleDateString()} at{' '}
                    {new Date(notification.created_at).toLocaleTimeString()}
                  </span>
                </div>
                
                <p className="text-gray-600 mb-4 leading-relaxed">{notification.message}</p>
                
                {/* Refund Details */}
                {isRefundNotification && (
                  <div className={`p-4 rounded-lg mb-4 ${
                    notification.type === 'refund_approve' 
                      ? 'bg-green-100 border border-green-200' 
                      : 'bg-red-100 border border-red-200'
                  }`}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-800">
                        {notification.type === 'refund_approve' ? 'Refund Approved' : 'Refund Denied'}
                      </span>
                      {data.restaurantTotal && (
                        <span className="text-lg font-bold">
                          ${Number(data.restaurantTotal).toFixed(2)}
                        </span>
                      )}
                    </div>
                    {data.itemCount && (
                      <div className="text-sm text-gray-600 mb-2">
                        For {data.itemCount} item{data.itemCount !== 1 ? 's' : ''} from your order
                      </div>
                    )}
                    {data.refundNotes && (
                      <div className="text-sm text-gray-700 mt-2 p-2 bg-white rounded border-l-4 border-gray-400">
                        <strong>Restaurant Notes:</strong> {data.refundNotes}
                      </div>
                    )}
                  </div>
                )}

                {/* Order Details */}
                {data.orderId && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Order #{data.orderId}</span>
                      <Link 
                        to={`/order-details/${data.orderId}`}
                        className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
                      >
                        View Order →
                      </Link>
                    </div>
                    {data.orderTotal && (
                      <div className="text-sm text-gray-600 mt-1">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Clear Read Notifications
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to permanently delete all read notifications? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deleteAllRead}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Read Notifications
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerNotifications;