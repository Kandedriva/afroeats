import React, { useEffect, useState, useContext } from "react";
import { OwnerAuthContext } from "../context/OwnerAuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import ToggleSwitch from "../Components/ToggleSwitch";
import { toast } from 'react-toastify';

function OwnerDashboard() {
  const { owner, loading: authLoading, fetchSubscriptionStatus: refreshSubscriptionStatus } = useContext(OwnerAuthContext);
  const [restaurant, setRestaurant] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAction, setRefundAction] = useState('');
  const [refundNotes, setRefundNotes] = useState('');
  const [selectedNotificationId, setSelectedNotificationId] = useState(null);
  const [processingRefund, setProcessingRefund] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Handle subscription success callback
    const handleSubscriptionSuccess = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');
      const devSubscription = urlParams.get('dev_subscription');
      const subscriptionSuccess = urlParams.get('subscription_success');
      const subscriptionError = urlParams.get('subscription_error');
      
      if (sessionId) {
        try {
          const res = await fetch(`http://localhost:5001/api/subscription/success?session_id=${sessionId}`, {
            credentials: "include",
          });
          
          if (res.ok) {
            console.log("Subscription activated successfully");
            // Clean URL and refresh subscription status
            window.history.replaceState({}, document.title, window.location.pathname);
            setTimeout(() => {
              refreshSubscriptionStatus();
            }, 500);
          }
        } catch (err) {
          console.error("Subscription success handler error:", err);
        }
      } else if (devSubscription || subscriptionSuccess) {
        console.log("Demo subscription activated");
        // Clean URL and refresh subscription status
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
          refreshSubscriptionStatus();
        }, 500);
      } else if (subscriptionError) {
        console.log("Subscription error occurred");
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    const fetchDashboard = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/owners/dashboard", {
          credentials: "include",
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to load dashboard");
        }

        const data = await res.json();
        setDishes(data.dishes);
        
        // Get restaurant info separately
        const restaurantRes = await fetch("http://localhost:5001/api/owners/restaurant", {
          credentials: "include",
        });
        
        if (restaurantRes.ok) {
          const restaurantData = await restaurantRes.json();
          setRestaurant(restaurantData);
        }
      } catch (err) {
        console.error("Dashboard error:", err.message);
      } finally {
        setLoading(false);
      }
    };

    const fetchLocalSubscriptionStatus = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/subscription/status", {
          credentials: "include",
        });
        
        if (res.ok) {
          const data = await res.json();
          setSubscriptionStatus(data);
        } else {
          setSubscriptionStatus({ active: false });
        }
      } catch (err) {
        console.error("Subscription status fetch error:", err);
        setSubscriptionStatus({ active: false });
      }
    };

    const fetchOrders = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/owners/orders", {
          credentials: "include",
        });
        
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
        }
      } catch (err) {
        console.error("Orders fetch error:", err);
      }
    };

    const fetchNotifications = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/owners/notifications", {
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

    handleSubscriptionSuccess();
    fetchDashboard();
    fetchLocalSubscriptionStatus();
    fetchOrders();
    fetchNotifications();
  }, []);

  const handleConnectStripe = async () => {
    try {
      setConnecting(true);
      const res = await fetch("http://localhost:5001/api/owners/stripe/create-stripe-account", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      window.location.href = data.url;
    } catch (err) {
      console.error("Stripe connect error:", err);
      toast.error("Failed to connect to Stripe");
    } finally {
      setConnecting(false);
    }
  };

  const toggleAvailability = async (dishId, currentStatus) => {
    try {
      const res = await fetch(
        `http://localhost:5001/api/owners/dishes/${dishId}/availability`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isAvailable: !currentStatus }),
        }
      );

      if (!res.ok) throw new Error("Failed to update availability");

      setDishes((prev) =>
        prev.map((dish) =>
          dish.id === dishId
            ? { ...dish, is_available: !currentStatus }
            : dish
        )
      );
    } catch (err) {
      console.error(err);
      toast.error("Error updating availability");
    }
  };

  const showCompleteModal = (orderId) => {
    setShowCompleteConfirm(orderId);
  };

  const completeOrder = async (orderId) => {
    try {
      const res = await fetch(`http://localhost:5001/api/owners/orders/${orderId}/complete`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to complete order");
      }

      // Remove the completed order from the list
      setOrders(prev => prev.filter(order => order.id !== orderId));
      toast.success("Order marked as completed!");
      setShowCompleteConfirm(null);
    } catch (err) {
      console.error("Complete order error:", err);
      toast.error("Error completing order: " + err.message);
    }
  };

  const printOrder = (order) => {
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order #${order.id} - ${restaurant?.name || 'Restaurant'}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .order-info { margin-bottom: 20px; }
            .customer-info { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .items-table th { background-color: #f2f2f2; }
            .total-section { text-align: right; font-weight: bold; font-size: 18px; }
            .print-footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${restaurant?.name || 'Restaurant'}</h1>
            <h2>Order Receipt #${order.id}</h2>
            <p>Order Date: ${new Date(order.created_at).toLocaleDateString()} at ${new Date(order.created_at).toLocaleTimeString()}</p>
          </div>
          
          <div class="customer-info">
            <h3>Customer Information</h3>
            <p><strong>Name:</strong> ${order.customer_name}</p>
            <p><strong>Email:</strong> ${order.customer_email}</p>
            <p><strong>Phone:</strong> ${order.customer_phone || 'Not provided'}</p>
            <p><strong>Address:</strong> ${order.customer_address || 'Not provided'}</p>
          </div>
          
          <div class="order-info">
            <h3>Order Details</h3>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${order.items.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>$${Number(item.price || 0).toFixed(2)}</td>
                    <td>$${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="total-section">
            <p>Platform Fee: $${Number(order.platform_fee || 0).toFixed(2)}</p>
            <p>Total Amount: $${Number(order.total || 0).toFixed(2)}</p>
            <p style="color: green;">Restaurant Earnings: $${(Number(order.total || 0) - Number(order.platform_fee || 0)).toFixed(2)}</p>
          </div>
          
          <div class="print-footer">
            <p>Thank you for using our platform!</p>
            <p>Printed on: ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const markNotificationRead = async (notificationId) => {
    try {
      const res = await fetch(`http://localhost:5001/api/owners/notifications/${notificationId}/mark-read`, {
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

  const showRefundConfirm = (notificationId, action) => {
    setSelectedNotificationId(notificationId);
    setRefundAction(action);
    setRefundNotes('');
    setShowRefundModal(true);
  };

  const processRefund = async () => {
    if (!selectedNotificationId || !refundAction) return;
    
    try {
      setProcessingRefund(true);
      const res = await fetch(`http://localhost:5001/api/owners/refunds/${selectedNotificationId}/process`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: refundAction,
          notes: refundNotes.trim()
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to process refund");
      }

      const responseData = await res.json();
      
      // Update notification in local state
      setNotifications(prev => 
        prev.map(notification => {
          if (notification.id === selectedNotificationId) {
            const updatedData = {
              ...notification.data,
              refundProcessed: true,
              refundAction: refundAction,
              refundNotes: refundNotes.trim(),
              processedAt: new Date().toISOString()
            };
            return {
              ...notification,
              read: true,
              data: updatedData
            };
          }
          return notification;
        })
      );

      toast.success(responseData.message);
      setShowRefundModal(false);
      setSelectedNotificationId(null);
      setRefundAction('');
      setRefundNotes('');
    } catch (err) {
      console.error("Process refund error:", err);
      toast.error("Error processing refund: " + err.message);
    } finally {
      setProcessingRefund(false);
    }
  };

  if (authLoading || loading) {
    return <div className="text-center p-6">Loading dashboard...</div>;
  }

  if (!owner) {
    return <Navigate to="/owner/login" />;
  }

  

  const handleSubscribe = () => {
    navigate("/owner/subscribe");
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Welcome to your Dashboard</h1>

      {/* Subscription Status Section */}
      {subscriptionStatus && (
        <div className={`mb-6 p-4 border rounded ${subscriptionStatus.active ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          {subscriptionStatus.active ? (
            <div className="flex items-center">
              <span className="text-green-600 text-xl mr-2">✅</span>
              <div>
                <h3 className="font-semibold text-green-800">Subscription Active</h3>
                <p className="text-green-600">You can add dishes and manage your restaurant.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-yellow-600 text-xl mr-2">⚠️</span>
                <div>
                  <h3 className="font-semibold text-yellow-800">Subscription Required</h3>
                  <p className="text-yellow-600">Subscribe to add dishes and start receiving orders.</p>
                </div>
              </div>
              <button
                onClick={handleSubscribe}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Subscribe Now
              </button>
            </div>
          )}
        </div>
      )}

      {restaurant && (
        <div className="mb-6 p-4 border rounded bg-white">
          <h2 className="text-xl font-semibold">{restaurant.name}</h2>
          <p className="text-gray-600">📍 {restaurant.address}</p>
          {restaurant.image_url && (
            <img
              src={`http://localhost:5001/${restaurant.image_url.replace(/\\/g, "/")}`}
              alt="Logo"
              className="w-32 h-32 object-cover mt-4 rounded"
            />
          )}

          {/* ✅ Stripe Connect Section */}
          {stripeStatus ? (
            stripeStatus.payoutsEnabled ? (
              <p className="text-green-600 mt-4">
                ✅ Your Stripe account is active and ready to receive payments.
              </p>
            ) : (
              <div className="mt-4">
                <p className="text-yellow-600 mb-2">
                  ⚠️ You need to finish setting up Stripe to receive payments.
                </p>
                <button
                  onClick={handleConnectStripe}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                  disabled={connecting}
                >
                  {connecting ? "Redirecting..." : "Connect with Stripe"}
                </button>
              </div>
            )
          ) : (
            <p className="text-sm text-gray-500 mt-4">Checking Stripe account...</p>
          )}
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
                    await fetch("http://localhost:5001/api/owners/notifications/mark-all-read", {
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
              const isRefundRequest = notification.type === 'refund_request';
              const isProcessed = data.refundProcessed;
              
              return (
                <div 
                  key={notification.id} 
                  className={`border rounded-lg p-4 ${!notification.read ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}
                  onClick={() => !notification.read && markNotificationRead(notification.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className={`font-medium ${isRefundRequest ? 'text-orange-700' : 'text-gray-800'}`}>
                      {notification.title}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {new Date(notification.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{notification.message}</p>
                  
                  {data.reason && (
                    <div className="bg-gray-50 p-2 rounded text-sm mb-3">
                      <strong>Reason:</strong> {data.reason}
                    </div>
                  )}
                  
                  {isRefundRequest && !isProcessed && (
                    <div className="flex space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showRefundConfirm(notification.id, 'approve');
                        }}
                        className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                      >
                        ✅ Approve Refund
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showRefundConfirm(notification.id, 'deny');
                        }}
                        className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                      >
                        ❌ Deny Refund
                      </button>
                    </div>
                  )}
                  
                  {isProcessed && (
                    <div className={`text-sm p-2 rounded ${data.refundAction === 'approve' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      <strong>Refund {data.refundAction}d</strong>
                      {data.refundNotes && <div>Notes: {data.refundNotes}</div>}
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

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Your Dishes</h3>
        <button
          className="bg-green-600 text-white px-4 py-2 rounded"
          onClick={() => navigate("/owner/add-dish")}
        >
          ➕ Add Dish
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {dishes.length === 0 ? (
          <p>No dishes yet.</p>
        ) : (
          dishes.map((dish) => (
            <div
              key={dish.id}
              className="border p-4 rounded bg-white flex justify-between items-center"
            >
              <div className="flex items-center gap-4">
                {dish.image_url && (
                  <img
                    src={`http://localhost:5001${dish.image_url.replace(/\\/g, "/")}`}
                    alt={dish.name}
                    className="w-24 h-24 object-cover rounded"
                  />
                )}
                <div>
                  <h4 className="font-semibold text-lg">{dish.name}</h4>
                  <p className="text-gray-600">${dish.price}</p>
                  <p className="text-sm text-gray-500">
                    {dish.is_available ? "✅ Available" : "❌ Not Available"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end">
                <ToggleSwitch
                  checked={!!dish.is_available}
                  onChange={() =>
                    toggleAvailability(dish.id, !!dish.is_available)
                  }
                />
                <span className="text-xs mt-1 text-gray-500">
                  {dish.is_available ? "In Stock" : "Out of Stock"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Orders Section */}
      <div className="mt-12">
        <h3 className="text-lg font-semibold mb-4">Recent Orders</h3>
        
        {orders.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No orders yet.</p>
            <p className="text-sm text-gray-400 mt-1">Orders will appear here when customers place them.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.slice(0, 10).map((order) => (
              <div key={order.id} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-blue-800">Order #{order.id}</h4>
                    <p className="text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString()} at{' '}
                      {new Date(order.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {order.status || 'Received'}
                    </span>
                    <div className="mt-1">
                      <span className="text-lg font-bold text-green-600">
                        ${(Number(order.total || 0) - Number(order.platform_fee || 0)).toFixed(2)}
                      </span>
                      <p className="text-xs text-gray-500">
                        (Total: ${Number(order.total || 0).toFixed(2)} - Platform fee: ${Number(order.platform_fee || 0).toFixed(2)})
                      </p>
                    </div>
                  </div>
                </div>

                {/* Customer Information Section */}
                <div className="bg-blue-50 p-3 rounded-lg mb-3">
                  <h5 className="font-medium text-blue-800 mb-2">Customer Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Name:</span> {order.customer_name}
                    </div>
                    <div>
                      <span className="font-medium">Email:</span> {order.customer_email}
                    </div>
                    <div>
                      <span className="font-medium">Phone:</span> {order.customer_phone || 'Not provided'}
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium">Address:</span> {order.customer_address || 'Not provided'}
                    </div>
                  </div>
                </div>

                {/* Special Instructions */}
                {order.order_details && (
                  <div className="bg-yellow-50 p-3 rounded-lg mb-3">
                    <h5 className="font-medium text-yellow-800 mb-2">🗒️ Special Instructions</h5>
                    <p className="text-sm text-yellow-700 whitespace-pre-wrap">{order.order_details}</p>
                  </div>
                )}
                
                <div className="border-t pt-3">
                  <h5 className="font-medium mb-2">Items ordered:</h5>
                  <div className="space-y-1">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.name} x {item.quantity}</span>
                        <span>${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <div className="flex space-x-2">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                        💰 Payment Received
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                        🍳 Ready to Prepare
                      </span>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => printOrder(order)}
                        className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors"
                        title="Print order for delivery"
                      >
                        🖨️ Print
                      </button>
                      <button
                        onClick={() => showCompleteModal(order.id)}
                        className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors"
                        title="Mark order as completed"
                      >
                        ✅ Complete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {orders.length > 10 && (
              <div className="text-center">
                <button
                  className="text-blue-600 hover:text-blue-800 font-medium"
                  onClick={() => {/* TODO: Show all orders */}}
                >
                  View All Orders ({orders.length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Refund Processing Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className={`text-lg font-semibold mb-4 ${refundAction === 'approve' ? 'text-green-800' : 'text-red-800'}`}>
              {refundAction === 'approve' ? '✅ Approve Refund Request' : '❌ Deny Refund Request'}
            </h3>
            <p className="text-gray-600 mb-4">
              {refundAction === 'approve' 
                ? 'Are you sure you want to approve this refund request? The customer will be notified of your decision.'
                : 'Are you sure you want to deny this refund request? The customer will be notified of your decision.'
              }
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes for customer (optional):
              </label>
              <textarea
                value={refundNotes}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setRefundNotes(e.target.value);
                  }
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows="4"
                placeholder={refundAction === 'approve' 
                  ? "Add any additional information about the refund process..."
                  : "Explain why the refund request is being denied..."
                }
                autoFocus
              />
              <div className="text-xs text-gray-500 mt-1">
                {refundNotes.length}/500 characters
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setSelectedNotificationId(null);
                  setRefundAction('');
                  setRefundNotes('');
                }}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                disabled={processingRefund}
              >
                Cancel
              </button>
              <button
                onClick={processRefund}
                disabled={processingRefund}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${
                  refundAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-400'
                    : 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                }`}
              >
                {processingRefund ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  refundAction === 'approve' ? '✅ Approve Refund' : '❌ Deny Refund'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Order Confirmation Modal */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Complete Order
            </h3>
            <p className="text-gray-600 mb-6">
              Mark this order as completed? This will remove it from your orders list and notify the customer that their order is ready.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCompleteConfirm(null)}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => completeOrder(showCompleteConfirm)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                ✅ Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OwnerDashboard;
