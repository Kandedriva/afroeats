import React, { useEffect, useState, useContext } from "react";
import { OwnerAuthContext } from "../context/OwnerAuthContext";
import { Navigate, useNavigate, Link } from "react-router-dom";
import ToggleSwitch from "../Components/ToggleSwitch";
import { toast } from 'react-toastify';

function OwnerDashboard() {
  const { owner, loading: authLoading } = useContext(OwnerAuthContext);
  const [restaurant, setRestaurant] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [logoTimestamp, setLogoTimestamp] = useState(Date.now());
  const navigate = useNavigate();

  useEffect(() => {
    // Handle Stripe Connect returns
    const handleStripeReturns = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const stripeReturn = urlParams.get('stripe_return');
      const stripeRefresh = urlParams.get('stripe_refresh');
      
      if (stripeReturn || stripeRefresh) {
        // Returned from Stripe Connect onboarding
        // Clean URL and refresh Stripe Connect status
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
          fetchStripeConnectStatus();
        }, 1000); // Give Stripe a moment to process
        
        if (stripeReturn) {
          toast.success("Stripe Connect setup completed! You can now receive payments.");
        }
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
        // Dashboard error
      } finally {
        setLoading(false);
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
        // Orders fetch error
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
        // Notifications fetch error
      }
    };

    handleStripeReturns();
    fetchDashboard();
    fetchStripeConnectStatus();
    fetchOrders();
    fetchNotifications();
  }, []);

  const fetchStripeConnectStatus = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/stripe/connect-status", {
        credentials: "include",
      });
      
      if (res.ok) {
        const data = await res.json();
        setStripeStatus({
          connected: data.connected,
          payoutsEnabled: data.payouts_enabled,
          chargesEnabled: data.charges_enabled,
          detailsSubmitted: data.details_submitted,
          developmentMode: data.development_mode || false
        });
      } else {
        setStripeStatus({
          connected: false,
          payoutsEnabled: false,
          chargesEnabled: false,
          detailsSubmitted: false,
          developmentMode: false
        });
      }
    } catch (err) {
      // Stripe Connect status error
      setStripeStatus({
        connected: false,
        payoutsEnabled: false,
        chargesEnabled: false,
        detailsSubmitted: false,
        developmentMode: false
      });
    }
  };

  const handleConnectStripe = async () => {
    try {
      setConnecting(true);
      const res = await fetch("http://localhost:5001/api/stripe/create-stripe-account", {
        method: "POST",
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create Stripe account");
      }
      
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No redirect URL received");
      }
    } catch (err) {
      // Stripe connect error
      toast.error("Failed to connect to Stripe: " + err.message);
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
      // Toggle availability error
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

      // Update the order status to completed and add completion timestamp
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, status: 'completed', completed_at: new Date().toISOString() }
          : order
      ));
      toast.success("Order marked as completed!");
      setShowCompleteConfirm(null);
    } catch (err) {
      // Complete order error
      toast.error("Error completing order: " + err.message);
    }
  };

  const confirmRemoveOrder = (orderId) => {
    setShowRemoveConfirm(orderId);
  };

  const removeOrder = async (orderId) => {
    try {
      const res = await fetch(`http://localhost:5001/api/owners/orders/${orderId}`, {
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
      toast.error("Error removing order: " + err.message);
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
            <p><strong>Delivery Phone:</strong> ${order.delivery_phone || order.customer_phone || 'Not provided'}</p>
            <p><strong>Delivery Address:</strong> ${order.delivery_address || order.customer_address || 'Not provided'}</p>
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
      // Mark notification read error
    }
  };

  // Helper functions for order filtering
  const getActiveOrders = () => {
    return orders.filter(order => 
      order.status !== 'completed' && 
      order.status !== 'cancelled' && 
      order.status !== 'removed'
    );
  };

  const getCompletedOrders = () => {
    return orders.filter(order => order.status === 'completed');
  };

  const getTotalEarnings = () => {
    return orders.reduce((sum, order) => sum + (Number(order.total || 0) - Number(order.platform_fee || 0)), 0);
  };


  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Please upload a valid image file (JPEG, PNG, GIF, WebP)");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo file size must be less than 5MB");
      return;
    }

    try {
      setLogoUploading(true);
      const formData = new FormData();
      formData.append('logo', file);

      const res = await fetch("http://localhost:5001/api/owners/restaurant/logo", {
        method: "PUT",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to upload logo");
      }

      const data = await res.json();
      
      // Refetch complete restaurant data to ensure consistency
      const restaurantRes = await fetch("http://localhost:5001/api/owners/restaurant", {
        credentials: "include",
      });
      
      if (restaurantRes.ok) {
        const restaurantData = await restaurantRes.json();
        setRestaurant(restaurantData);
        
        // Update logo timestamp to force refresh
        setLogoTimestamp(Date.now());
        
        // Dispatch custom event to notify navbar about logo change
        window.dispatchEvent(new CustomEvent('logoUpdated', { 
          detail: { restaurant: restaurantData } 
        }));
      }

      toast.success("Logo updated successfully!");
      closeLogoModal();
    } catch (err) {
      toast.error("Error uploading logo: " + err.message);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoClick = () => {
    setShowLogoModal(true);
  };

  const closeLogoModal = () => {
    setShowLogoModal(false);
    // Reset file input
    const fileInput = document.getElementById('logo-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  if (authLoading || loading) {
    return <div className="text-center p-6">Loading dashboard...</div>;
  }

  if (!owner) {
    return <Navigate to="/owner/login" />;
  }

  


  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Welcome to your Dashboard</h1>


      {restaurant && (
        <div className="mb-6 p-4 border rounded bg-white">
          <h2 className="text-xl font-semibold">{restaurant.name}</h2>
          <p className="text-gray-600">📍 {restaurant.address}</p>
          
          {/* Logo Section */}
          <div className="mt-4">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Restaurant Logo</h3>
            {restaurant.image_url ? (
              <div className="relative inline-block">
                <img
                  src={`http://localhost:5001${restaurant.image_url.replace(/\\/g, "/")}?t=${logoTimestamp}`}
                  alt="Restaurant Logo"
                  className="w-32 h-32 object-cover rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-300"
                  onClick={handleLogoClick}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
                <div 
                  className="w-32 h-32 border-2 border-dashed border-red-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-red-400 hover:bg-red-50 transition-colors"
                  onClick={handleLogoClick}
                  style={{display: 'none'}}
                >
                  <svg className="w-8 h-8 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-red-500 text-center">Logo Error<br/>Click to re-upload</span>
                </div>
                <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 rounded-lg transition-all cursor-pointer flex items-center justify-center" onClick={handleLogoClick}>
                  <span className="text-white opacity-0 hover:opacity-100 transition-opacity text-sm font-medium">
                    Click to change
                  </span>
                </div>
              </div>
            ) : (
              <div 
                className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                onClick={handleLogoClick}
              >
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="text-sm text-gray-500 text-center">Upload Logo</span>
              </div>
            )}
          </div>

          {/* ✅ Stripe Connect Section */}
          <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <h4 className="text-lg font-medium text-gray-900 mb-3">Payment Processing</h4>
            {stripeStatus ? (
              stripeStatus.developmentMode ? (
                <div className="text-blue-600">
                  <p className="mb-2">🔧 Development Mode</p>
                  <p className="text-sm text-gray-600">Stripe is not configured. Payment processing is in demo mode.</p>
                </div>
              ) : stripeStatus.payoutsEnabled && stripeStatus.chargesEnabled ? (
                <div className="text-green-600">
                  <p className="mb-2">✅ Stripe Connect Active</p>
                  <p className="text-sm text-gray-600">Your Stripe account is fully set up and ready to receive payments.</p>
                </div>
              ) : stripeStatus.connected && stripeStatus.detailsSubmitted ? (
                <div className="text-yellow-600">
                  <p className="mb-2">⏳ Stripe Setup In Progress</p>
                  <p className="text-sm text-gray-600 mb-3">Your account is under review. You'll be able to receive payments once approved.</p>
                  <button
                    onClick={handleConnectStripe}
                    className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm"
                    disabled={connecting}
                  >
                    {connecting ? "Redirecting..." : "Check Status / Update Info"}
                  </button>
                </div>
              ) : stripeStatus.connected ? (
                <div className="text-orange-600">
                  <p className="mb-2">⚠️ Complete Stripe Setup</p>
                  <p className="text-sm text-gray-600 mb-3">Please complete your Stripe account setup to start receiving payments.</p>
                  <button
                    onClick={handleConnectStripe}
                    className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                    disabled={connecting}
                  >
                    {connecting ? "Redirecting..." : "Complete Setup"}
                  </button>
                </div>
              ) : (
                <div className="text-red-600">
                  <p className="mb-2">❌ Connect Stripe Account</p>
                  <p className="text-sm text-gray-600 mb-3">Connect your Stripe account to receive payments from customers.</p>
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
              <p className="text-sm text-gray-500">Checking Stripe account status...</p>
            )}
          </div>
        </div>
      )}

      {/* Notifications Summary Section */}
      <div className="mb-8 bg-white border rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              📋 Notifications & Alerts
            </h3>
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Total:</span>
                <span className="font-semibold text-blue-600">{notifications.length}</span>
              </div>
              {unreadCount > 0 && (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-gray-600">Unread:</span>
                  <span className="font-semibold text-red-600">{unreadCount}</span>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Pending Refunds:</span>
                <span className="font-semibold text-orange-600">
                  {notifications.filter(n => n.type === 'refund_request' && !n.data?.refundProcessed).length}
                </span>
              </div>
            </div>
          </div>
          <div className="flex space-x-3">
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
                    toast.success("All notifications marked as read");
                  } catch (err) {
                    toast.error("Failed to mark all notifications as read");
                  }
                }}
                className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
              >
                Mark All Read
              </button>
            )}
            <Link 
              to="/owner/notifications"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              View All Notifications →
            </Link>
          </div>
        </div>
        
        {/* Show only urgent notifications (unread refund requests) */}
        {notifications.filter(n => n.type === 'refund_request' && !n.read && !n.data?.refundProcessed).length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium text-red-700 mb-3">🚨 Urgent: Refund Requests Requiring Action</h4>
            <div className="space-y-2">
              {notifications.filter(n => n.type === 'refund_request' && !n.read && !n.data?.refundProcessed).slice(0, 2).map((notification) => (
                <div key={notification.id} className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-red-800">{notification.title}</p>
                      <p className="text-xs text-red-600 mt-1">
                        Amount: ${Number(notification.data?.restaurantTotal || 0).toFixed(2)}
                      </p>
                    </div>
                    <Link 
                      to="/owner/notifications"
                      className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
                    >
                      Review →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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

      {/* Orders Summary Section */}
      <div className="mb-8 bg-white border rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              📋 Order Management
            </h3>
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Total Orders:</span>
                <span className="font-semibold text-blue-600">{orders.length}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Active:</span>
                <span className="font-semibold text-orange-600">{getActiveOrders().length}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Completed:</span>
                <span className="font-semibold text-green-600">{getCompletedOrders().length}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Total Earnings:</span>
                <span className="font-semibold text-purple-600">
                  ${getTotalEarnings().toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <Link 
            to="/owner/orders"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Manage All Orders →
          </Link>
        </div>
        
        {/* Show urgent active orders */}
        {getActiveOrders().length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium text-orange-700 mb-3">🚨 Urgent: Active Orders Requiring Attention</h4>
            <div className="space-y-2">
              {getActiveOrders().slice(0, 3).map((order) => (
                <div key={order.id} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-orange-800">Order #{order.id} - {order.customer_name}</p>
                      <p className="text-xs text-orange-600 mt-1">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''} • ${(Number(order.total || 0) - Number(order.platform_fee || 0)).toFixed(2)} earnings
                      </p>
                      <p className="text-xs text-orange-500">
                        Ordered {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => printOrder(order)}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
                      >
                        🖨️ Print
                      </button>
                      {order.status !== 'completed' && (
                        <button
                          onClick={() => showCompleteModal(order.id)}
                          className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                        >
                          ✅ Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {getActiveOrders().length > 3 && (
                <div className="text-center">
                  <Link 
                    to="/owner/orders"
                    className="text-sm text-orange-600 hover:text-orange-800"
                  >
                    View {getActiveOrders().length - 3} more active orders →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Show completed orders */}
        {getCompletedOrders().length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium text-green-700 mb-3">✅ Recently Completed Orders</h4>
            <div className="space-y-2">
              {getCompletedOrders().slice(0, 3).map((order) => (
                <div key={order.id} className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-green-800">Order #{order.id} - {order.customer_name}</p>
                      <p className="text-xs text-green-600 mt-1">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''} • ${(Number(order.total || 0) - Number(order.platform_fee || 0)).toFixed(2)} earnings
                      </p>
                      <p className="text-xs text-green-500">
                        Completed {order.completed_at ? new Date(order.completed_at).toLocaleDateString() + ' at ' + new Date(order.completed_at).toLocaleTimeString() : 'recently'}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => printOrder(order)}
                        className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
                      >
                        🖨️ Print
                      </button>
                      <button
                        onClick={() => confirmRemoveOrder(order.id)}
                        className="text-xs bg-gray-600 text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                        title="Remove completed order from your view"
                      >
                        🗑️ Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {getCompletedOrders().length > 3 && (
                <div className="text-center">
                  <Link 
                    to="/owner/orders"
                    className="text-sm text-green-600 hover:text-green-800"
                  >
                    View {getCompletedOrders().length - 3} more completed orders →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>


      {/* Complete Order Confirmation Modal */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Complete Order
            </h3>
            <p className="text-gray-600 mb-6">
              Mark this order as completed? This will update the order status and notify the customer that their order is ready.
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

      {/* Remove Order Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Remove Order #{showRemoveConfirm}
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove this completed order from your view? This will hide it from your orders list but won't affect the customer's record.
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
                🗑️ Remove Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logo Upload Modal */}
      {showLogoModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !logoUploading) {
              closeLogoModal();
            }
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              {restaurant?.image_url ? 'Change Restaurant Logo' : 'Upload Restaurant Logo'}
            </h3>
            
            <div className="mb-4">
              <p className="text-gray-600 text-sm mb-4">
                Choose a high-quality image to represent your restaurant. Recommended size: 400x400 pixels or larger.
              </p>
              
              {/* Show current logo when changing */}
              {restaurant?.image_url && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Current Logo:</p>
                  <img
                    src={`http://localhost:5001${restaurant.image_url.replace(/\\/g, "/")}`}
                    alt="Current Logo"
                    className="w-20 h-20 object-cover rounded-lg border-2 border-gray-200"
                  />
                </div>
              )}
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                  disabled={logoUploading}
                />
                <label htmlFor="logo-upload" className="cursor-pointer block">
                  {logoUploading ? (
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                      <span className="text-blue-600">Uploading...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-blue-600 font-medium">Click to select image</span>
                      <span className="text-gray-500 text-sm mt-1">PNG, JPG, GIF, WebP (Max 5MB)</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeLogoModal}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                disabled={logoUploading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OwnerDashboard;
