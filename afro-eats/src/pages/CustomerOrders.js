import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { toast } from 'react-toastify';

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

  useEffect(() => {
    // Component is now protected by ProtectedRoute, so user is guaranteed to exist
    if (user && !authLoading) {
      fetchOrders();
      fetchNotifications();
    }
  }, [user, authLoading]);

  const fetchOrders = async () => {
    try {
      setOrdersLoading(true);
      const res = await fetch("http://localhost:5001/api/auth/orders", {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch orders");
      }

      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      console.error("Fetch orders error:", err);
      setError(err.message);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/auth/notifications", {
        credentials: "include",
      });
      
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Notifications fetch error:", err);
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
      console.error("Mark notification read error:", err);
    }
  };

  const showCancelModal = (orderId) => {
    setShowCancelConfirm(orderId);
    setCancelReason("");
    setRequestRefund(false);
  };

  const cancelOrder = async (orderId) => {
    try {
      const res = await fetch(`http://localhost:5001/api/auth/orders/${orderId}/cancel`, {
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
      console.error("Cancel order error:", err);
      toast.error("Error cancelling order: " + err.message);
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
    console.log('Checking if order can be removed, status:', status); // Debug log
    return status === 'completed' || status === 'delivered' || status === 'cancelled';
  };

  const confirmRemoveOrder = (orderId) => {
    setShowRemoveConfirm(orderId);
  };

  const removeOrder = async (orderId) => {
    try {
      const res = await fetch(`http://localhost:5001/api/auth/orders/${orderId}`, {
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
      console.error("Remove order error:", err);
      toast.error("Error removing order: " + err.message);
    }
  };

  // TEMPORARY: Testing function to update order status for debugging
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`http://localhost:5001/api/auth/orders/${orderId}/update-status`, {
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
      console.error("Update order status error:", err);
      toast.error("Error updating status: " + err.message);
    }
  };

  if (authLoading || ordersLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? "Checking authentication..." : "Loading your orders..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">My Orders</h1>
        <button
          onClick={() => navigate("/")}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
        >
          Browse Restaurants
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Notifications Section */}
      {notifications.length > 0 && (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              Notifications {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full ml-2">
                  {unreadCount}
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={async () => {
                  try {
                    await fetch("http://localhost:5001/api/auth/notifications/mark-all-read", {
                      method: "POST",
                      credentials: "include",
                    });
                    setNotifications(prev => prev.map(n => ({...n, read: true})));
                    setUnreadCount(0);
                  } catch (err) {
                    console.error("Mark all read error:", err);
                  }
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Mark All Read
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {notifications.slice(0, 5).map((notification) => {
              const data = notification.data || {};
              const isRefundNotification = notification.type.startsWith('refund_');
              
              return (
                <div 
                  key={notification.id} 
                  className={`border rounded-lg p-4 ${!notification.read ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}
                  onClick={() => !notification.read && markNotificationRead(notification.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className={`font-medium ${isRefundNotification ? 
                      (notification.type === 'refund_approve' ? 'text-green-700' : 'text-red-700') 
                      : 'text-gray-800'}`}>
                      {notification.title}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {new Date(notification.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{notification.message}</p>
                  
                  {data.refundNotes && (
                    <div className="bg-gray-50 p-2 rounded text-sm mb-3">
                      <strong>Restaurant Notes:</strong> {data.refundNotes}
                    </div>
                  )}
                  
                  {isRefundNotification && (
                    <div className={`text-sm p-2 rounded ${notification.type === 'refund_approve' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      <strong>Order #${data.orderId}</strong> - ${Number(data.orderTotal || 0).toFixed(2)}
                      <div className="text-xs opacity-75">
                        Processed on {new Date(data.processedAt).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {notifications.length > 5 && (
            <div className="text-center mt-4">
              <button className="text-blue-600 hover:text-blue-800 text-sm">
                View All Notifications ({notifications.length})
              </button>
            </div>
          )}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">🍽️</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No orders yet</h2>
          <p className="text-gray-500 mb-6">Start by browsing our delicious restaurants!</p>
          <button
            onClick={() => navigate("/")}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
          >
            Explore Restaurants
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-700">
                💡 <strong>Tip:</strong> You can remove completed, delivered, or cancelled orders from your history using the Remove button. This action permanently deletes the order record.
              </p>
            </div>
          )}

          {/* TEMPORARY: Testing buttons for debugging remove functionality */}
          {orders.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-700 mb-3">
                🔧 <strong>Debug Tools:</strong> Use these buttons to test the remove functionality by changing order status.
              </p>
              <div className="flex flex-wrap gap-2">
                {orders.slice(0, 3).map((order) => (
                  <div key={order.id} className="flex items-center space-x-2 bg-white p-2 rounded border">
                    <span className="text-xs text-gray-600">Order #{order.id} ({order.status}):</span>
                    <button
                      onClick={() => updateOrderStatus(order.id, 'completed')}
                      className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                    >
                      Mark Completed
                    </button>
                    <button
                      onClick={() => updateOrderStatus(order.id, 'delivered')}
                      className="bg-purple-500 text-white px-2 py-1 rounded text-xs hover:bg-purple-600"
                    >
                      Mark Delivered
                    </button>
                    <button
                      onClick={() => updateOrderStatus(order.id, 'cancelled')}
                      className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                    >
                      Mark Cancelled
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-lg shadow-md border overflow-hidden">
              {/* Order Header */}
              <div className="bg-gray-50 px-6 py-4 border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      Order #{order.id}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Placed on {new Date(order.created_at).toLocaleDateString()} at{' '}
                      {new Date(order.created_at).toLocaleTimeString()}
                    </p>
                    {order.paid_at && (
                      <p className="text-sm text-green-600">
                        Paid on {new Date(order.paid_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {getStatusText(order.status)}
                    </span>
                    <div className="mt-1">
                      <span className="text-lg font-bold text-gray-800">
                        ${Number(order.total || 0).toFixed(2)}
                      </span>
                      <p className="text-xs text-gray-500">
                        Including $${Number(order.platform_fee || 0).toFixed(2)} platform fee
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="px-6 py-4">
                <h4 className="font-medium text-gray-800 mb-3">Order Items</h4>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                      <div>
                        <p className="font-medium text-gray-800">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          From: {item.restaurant_name || 'Restaurant'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-800">
                          ${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-500">
                          ${Number(item.price || 0).toFixed(2)} x {item.quantity}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Instructions */}
              {order.order_details && (
                <div className="px-6 py-3 bg-blue-50 border-t">
                  <p className="text-sm font-medium text-blue-800 mb-1">Special Instructions:</p>
                  <p className="text-sm text-blue-700">{order.order_details}</p>
                </div>
              )}

              {/* Order Actions */}
              <div className="bg-gray-50 px-6 py-4 border-t">
                <div className="flex justify-between items-center">
                  <div className="flex space-x-3">
                    {order.status === 'paid' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                        🍳 Being Prepared
                      </span>
                    )}
                    {order.status === 'pending' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 text-yellow-800">
                        ⏳ Awaiting Payment
                      </span>
                    )}
                    {order.status === 'completed' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                        ✅ Ready for Pickup/Delivery
                      </span>
                    )}
                    {order.status === 'cancelled' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">
                        ❌ Cancelled
                      </span>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    {canCancelOrder(order.status) && (
                      <button
                        onClick={() => showCancelModal(order.id)}
                        className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600 transition-colors"
                      >
                        Cancel Order
                      </button>
                    )}
                    
                    <button
                      onClick={() => navigate(`/order-details/${order.id}`)}
                      className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition-colors"
                    >
                      View Details
                    </button>
                    
                    {order.status === 'paid' || order.status === 'completed' ? (
                      <button
                        onClick={() => navigate("/")}
                        className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 transition-colors"
                      >
                        Order Again
                      </button>
                    ) : null}

                    {canRemoveOrder(order.status) && (
                      <button
                        onClick={() => confirmRemoveOrder(order.id)}
                        className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600 transition-colors"
                        title="Remove from order history"
                      >
                        🗑️ Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {orders.length > 0 && (
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">Order Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{orders.length}</div>
              <div className="text-sm text-blue-700">Orders in History</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {orders.filter(o => o.status === 'completed' || o.status === 'delivered').length}
              </div>
              <div className="text-sm text-green-700">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {orders.filter(o => o.status === 'pending' || o.status === 'paid').length}
              </div>
              <div className="text-sm text-yellow-700">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                ${orders.reduce((sum, order) => sum + Number(order.total || 0), 0).toFixed(2)}
              </div>
              <div className="text-sm text-gray-700">Total Value</div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Order Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Confirm Order Removal
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove this order from your order history? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRemoveConfirm(null)}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => removeOrder(showRemoveConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Remove Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Cancel Order
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel this order?
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for cancellation (optional):
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="Please provide a reason..."
              />
            </div>

            <div className="mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={requestRefund}
                  onChange={(e) => setRequestRefund(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">
                  Request a refund (This will notify the restaurant owner to process your refund)
                </span>
              </label>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelConfirm(null)}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                Keep Order
              </button>
              <button
                onClick={() => cancelOrder(showCancelConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerOrders;