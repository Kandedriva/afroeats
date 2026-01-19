// React import removed as it's not needed in React 17+
import { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";

function CustomerOrders() {
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState("");
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [requestRefund, setRequestRefund] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();

  const fetchOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/orders`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch orders");
      }

      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/notifications`, {
        credentials: "include",
      });
      
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      // Handle notifications fetch error silently
    }
  }, []);

  useEffect(() => {
    // Component is now protected by ProtectedRoute, so user is guaranteed to exist
    if (user) {
      fetchOrders();
      fetchNotifications();
    }
  }, [user, fetchOrders, fetchNotifications]);

  const showCancelModal = (orderId) => {
    setShowCancelConfirm(orderId);
    setCancelReason("");
    setRequestRefund(false);
  };

  const cancelOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/orders/${orderId}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: cancelReason || "",
          requestRefund: requestRefund
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to cancel order");
      }

      const responseData = await res.json();

      // Update the order status in local state
      setOrders(prev => 
        prev.map(order => 
          order.id === orderId 
            ? { ...order, status: 'cancelled' }
            : order
        )
      );

      toast.success(responseData.message);
      setShowCancelConfirm(null);
    } catch (err) {
      toast.error(`Error cancelling order: ${err.message}`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'delivered': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pending Payment';
      case 'paid': return 'Payment Received';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      case 'delivered': return 'Delivered';
      default: return status || 'Unknown';
    }
  };

  const canCancelOrder = (status) => {
    return status === 'pending' || status === 'paid';
  };

  const canRemoveOrder = (status) => {
    return status === 'completed' || status === 'delivered' || status === 'cancelled';
  };

  const confirmRemoveOrder = (orderId) => {
    setShowRemoveConfirm(orderId);
  };

  const removeOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/orders/${orderId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to remove order");
      }

      const responseData = await res.json();

      // Remove the order from local state
      setOrders(prev => prev.filter(order => order.id !== orderId));

      toast.success(responseData.message);
      setShowRemoveConfirm(null);
    } catch (err) {
      toast.error(`Error removing order: ${err.message}`);
    }
  };

  // TEMPORARY: Testing function to update order status for debugging
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/orders/${orderId}/update-status`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update status");
      }

      const responseData = await res.json();
      
      // Update the order status in local state
      setOrders(prev => 
        prev.map(order => 
          order.id === orderId 
            ? { ...order, status: newStatus }
            : order
        )
      );

      toast.success(responseData.message);
    } catch (err) {
      toast.error(`Error updating status: ${err.message}`);
    }
  };

  if (authLoading || ordersLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? "Checking authentication..." : "Loading your orders..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 mb-4 sm:mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                My Orders
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Track and manage your orders
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="flex-shrink-0 bg-green-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg hover:bg-green-700 transition-all text-xs sm:text-sm font-medium shadow-sm whitespace-nowrap"
            >
              🍽️ Browse
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Notifications Summary Section */}
        <div className="bg-white rounded-xl shadow-sm p-3 sm:p-4 mb-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-gray-900">
                📢 Notifications
              </h3>
              <Link
                to="/my-notifications"
                className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-all text-xs font-medium shadow-sm whitespace-nowrap"
              >
                View All →
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <p className="text-xs text-blue-600 font-medium">Total</p>
                <p className="text-lg sm:text-xl font-bold text-blue-700">{notifications.length}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-2 text-center">
                <p className="text-xs text-orange-600 font-medium">Unread</p>
                <p className="text-lg sm:text-xl font-bold text-orange-700">{unreadCount}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-2 text-center">
                <p className="text-xs text-purple-600 font-medium">Refunds</p>
                <p className="text-lg sm:text-xl font-bold text-purple-700">
                  {notifications.filter(n => n.type.startsWith('refund_')).length}
                </p>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={async () => {
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
                }}
                className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-all text-xs sm:text-sm font-medium shadow-sm"
              >
                ✓ Mark All Read
              </button>
            )}
          </div>

          {/* Show only urgent unread notifications */}
          {notifications.filter(n => !n.read && n.type.startsWith('refund_')).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <h4 className="text-xs sm:text-sm font-bold text-purple-700 mb-2">🚨 Refund Updates</h4>
              <div className="space-y-2">
                {notifications.filter(n => !n.read && n.type.startsWith('refund_')).slice(0, 2).map((notification) => {
                  const data = notification.data || {};
                  return (
                    <div key={notification.id} className={`${notification.type === 'refund_approve' ? 'bg-green-50 border-l-4 border-green-500' : 'bg-red-50 border-l-4 border-red-500'} rounded-lg p-2.5`}>
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs sm:text-sm font-bold ${notification.type === 'refund_approve' ? 'text-green-900' : 'text-red-900'} truncate`}>
                            {notification.title}
                          </p>
                          <p className={`text-xs ${notification.type === 'refund_approve' ? 'text-green-700' : 'text-red-700'} mt-0.5 truncate`}>
                            {data.restaurantName} • ${Number(data.restaurantTotal || 0).toFixed(2)}
                          </p>
                        </div>
                        <Link
                          to="/my-notifications"
                          className={`flex-shrink-0 text-xs text-white px-2.5 py-1 rounded-lg transition-all font-medium ${notification.type === 'refund_approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm text-center py-12 sm:py-16 px-4">
            <div className="text-5xl sm:text-6xl mb-4">🍽️</div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">No Orders Yet</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              Start by browsing our delicious restaurants!
            </p>
            <button
              onClick={() => navigate("/")}
              className="bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition-all text-sm font-medium shadow-sm"
            >
              Explore Restaurants
            </button>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {orders.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs sm:text-sm text-blue-700">
                  💡 <strong>Tip:</strong> Remove completed, delivered, or cancelled orders using the Remove button.
                </p>
              </div>
            )}


            {/* Debug Tools - Hidden by default */}
            {orders.length > 0 && process.env.NODE_ENV === 'development' && (
              <details className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <summary className="text-xs font-bold text-yellow-700 cursor-pointer">🔧 Debug Tools</summary>
                <div className="mt-2 space-y-2">
                  {orders.slice(0, 3).map((order) => (
                    <div key={order.id} className="flex flex-wrap items-center gap-2 bg-white p-2 rounded border text-xs">
                      <span className="text-gray-600">#{order.id} ({order.status}):</span>
                      <button onClick={() => updateOrderStatus(order.id, 'completed')} className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600">Completed</button>
                      <button onClick={() => updateOrderStatus(order.id, 'delivered')} className="bg-purple-500 text-white px-2 py-1 rounded hover:bg-purple-600">Delivered</button>
                      <button onClick={() => updateOrderStatus(order.id, 'cancelled')} className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Cancelled</button>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Order Header */}
                <div className="bg-gradient-to-r from-gray-50 to-white px-3 sm:px-4 py-3 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-gray-900">
                        Order #{order.id}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      {order.paid_at && (
                        <p className="text-xs text-green-600 mt-0.5">
                          ✓ Paid {new Date(order.paid_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </span>
                      <div className="text-right">
                        <span className="text-lg sm:text-xl font-bold text-gray-900">
                          ${Number(order.total || 0).toFixed(2)}
                        </span>
                        <p className="text-xs text-gray-500">
                          +${Number(order.platform_fee || 0).toFixed(2)} fee
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="px-3 sm:px-4 py-3">
                  <h4 className="text-xs sm:text-sm font-bold text-gray-900 mb-2">Order Items</h4>
                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between items-start gap-2 py-2 border-b border-gray-100 last:border-b-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {item.restaurant_name || 'Restaurant'}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs sm:text-sm font-bold text-gray-900">
                            ${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            ${Number(item.price || 0).toFixed(2)} × {item.quantity}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Special Instructions */}
                {order.order_details && (
                  <div className="px-3 sm:px-4 py-2.5 bg-blue-50 border-t border-blue-100">
                    <p className="text-xs font-bold text-blue-800 mb-1">📝 Special Instructions:</p>
                    <p className="text-xs text-blue-700">{order.order_details}</p>
                  </div>
                )}

                {/* Order Actions */}
                <div className="bg-gradient-to-r from-gray-50 to-white px-3 sm:px-4 py-3 border-t border-gray-200">
                  {/* Status Badge */}
                  <div className="mb-3">
                    {order.status === 'paid' && (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        🍳 Being Prepared
                      </span>
                    )}
                    {order.status === 'pending' && (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        ⏳ Awaiting Payment
                      </span>
                    )}
                    {order.status === 'completed' && (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✅ Ready for Pickup
                      </span>
                    )}
                    {order.status === 'cancelled' && (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ❌ Cancelled
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {canCancelOrder(order.status) && (
                      <button
                        onClick={() => showCancelModal(order.id)}
                        className="flex-1 min-w-[120px] bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-red-700 transition-all shadow-sm"
                      >
                        Cancel Order
                      </button>
                    )}

                    <button
                      onClick={() => navigate(`/order-details/${order.id}`)}
                      className="flex-1 min-w-[120px] bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-blue-700 transition-all shadow-sm"
                    >
                      View Details
                    </button>

                    {(order.status === 'paid' || order.status === 'completed') && (
                      <button
                        onClick={() => navigate("/")}
                        className="flex-1 min-w-[120px] bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-green-700 transition-all shadow-sm"
                      >
                        Order Again
                      </button>
                    )}

                    {canRemoveOrder(order.status) && (
                      <button
                        onClick={() => confirmRemoveOrder(order.id)}
                        className="flex-1 min-w-[120px] bg-gray-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-gray-700 transition-all shadow-sm"
                        title="Remove from order history"
                      >
                        🗑️ Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {orders.length > 0 && (
          <div className="mt-4 sm:mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-sm p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-3 sm:mb-4">📊 Order Summary</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl sm:text-3xl font-bold text-blue-600">{orders.length}</div>
                <div className="text-xs sm:text-sm text-blue-700 mt-1">Total Orders</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl sm:text-3xl font-bold text-green-600">
                  {orders.filter(o => o.status === 'completed' || o.status === 'delivered').length}
                </div>
                <div className="text-xs sm:text-sm text-green-700 mt-1">Completed</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl sm:text-3xl font-bold text-yellow-600">
                  {orders.filter(o => o.status === 'pending' || o.status === 'paid').length}
                </div>
                <div className="text-xs sm:text-sm text-yellow-700 mt-1">In Progress</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl sm:text-3xl font-bold text-purple-600">
                  ${orders.reduce((sum, order) => sum + Number(order.total || 0), 0).toFixed(2)}
                </div>
                <div className="text-xs sm:text-sm text-purple-700 mt-1">Total Value</div>
              </div>
            </div>
          </div>
        )}

        {/* Remove Order Confirmation Modal */}
        {showRemoveConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-6 max-w-sm w-full">
              <div className="text-center mb-4">
                <div className="text-4xl mb-3">🗑️</div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                  Remove Order?
                </h3>
                <p className="text-sm text-gray-600">
                  This will permanently delete this order from your history. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowRemoveConfirm(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => removeOrder(showRemoveConfirm)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Order Confirmation Modal */}
        {showCancelConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-5 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="mb-4">
                <div className="text-center mb-3">
                  <div className="text-4xl mb-2">❌</div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">
                    Cancel Order
                  </h3>
                </div>
                <p className="text-sm text-gray-600 text-center mb-4">
                  Are you sure you want to cancel this order?
                </p>

                <div className="mb-4">
                  <label htmlFor="cancel-reason" className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Reason for cancellation (optional):
                  </label>
                  <textarea
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="3"
                    placeholder="Please provide a reason..."
                  />
                </div>

                <div className="mb-4">
                  <label htmlFor="request-refund" className="flex items-start">
                    <input
                      id="request-refund"
                      type="checkbox"
                      checked={requestRefund}
                      onChange={(e) => setRequestRefund(e.target.checked)}
                      className="mt-0.5 mr-2 flex-shrink-0"
                    />
                    <span className="text-xs sm:text-sm text-gray-700">
                      Request a refund (This will notify the restaurant owner to process your refund)
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowCancelConfirm(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
                >
                  Keep Order
                </button>
                <button
                  onClick={() => cancelOrder(showCancelConfirm)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-sm"
                >
                  Cancel Order
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomerOrders;