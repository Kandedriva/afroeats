// React import removed as it's not needed in React 17+
import { useEffect, useState, useContext } from "react";
import { OwnerAuthContext } from "../context/OwnerAuthContext";
import { Navigate, useNavigate, Link } from "react-router-dom";
import ToggleSwitch from "../Components/ToggleSwitch";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";
import { getImageUrl, handleImageError } from "../utils/imageUtils";

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
        const res = await fetch(`${API_BASE_URL}/api/owners/dashboard`, {
          credentials: "include",
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || "Failed to load dashboard");
        }

        const data = await res.json();
        setDishes(data.dishes);
        
        // Get restaurant info separately
        const restaurantRes = await fetch(`${API_BASE_URL}/api/owners/restaurant`, {
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
        const res = await fetch(`${API_BASE_URL}/api/owners/orders`, {
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
        const res = await fetch(`${API_BASE_URL}/api/owners/notifications`, {
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
      const res = await fetch(`${API_BASE_URL}/api/stripe/connect-status`, {
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
      
      const res = await fetch(`${API_BASE_URL}/api/stripe/create-stripe-account`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      if (!res.ok) {
        const error = await res.json();
        
        // Handle specific activation required error
        if (error.activation_required) {
          toast.error(
            <div>
              <p><strong>Stripe Account Activation Required</strong></p>
              <p>{error.details}</p>
              <p>
                <a 
                  href={error.activation_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Activate your Stripe account →
                </a>
              </p>
            </div>,
            { autoClose: false }
          );
          return;
        }
        
        throw new Error(error.error || "Failed to create Stripe account");
      }
      
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else if (data.development) {
        toast.info("Development mode: Stripe is not configured with real API keys");
      } else {
        throw new Error("No redirect URL received");
      }
    } catch (err) {
      toast.error(`Failed to connect to Stripe: ${err.message}`);
    } finally {
      setConnecting(false);
    }
  };

  const toggleAvailability = async (dishId, currentStatus) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/owners/dishes/${dishId}/availability`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isAvailable: !currentStatus }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to update availability");
      }

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
      const res = await fetch(`${API_BASE_URL}/api/owners/orders/${orderId}/complete`, {
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
      toast.error(`Error completing order: ${err.message}`);
    }
  };

  const confirmRemoveOrder = (orderId) => {
    setShowRemoveConfirm(orderId);
  };

  const removeOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/owners/orders/${orderId}`, {
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
    if (!file) {
      return;
    }

    // Validate file type - match backend validation
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload a valid image file (JPEG, PNG, GIF, WebP, AVIF)");
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

      const res = await fetch(`${API_BASE_URL}/api/owners/restaurant/logo`, {
        method: "PUT",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to upload logo");
      }

      // Refetch complete restaurant data to ensure consistency
      const restaurantRes = await fetch(`${API_BASE_URL}/api/owners/restaurant`, {
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
      toast.error(`Error uploading logo: ${err.message}`);
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
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Welcome to your Dashboard</h1>


      {restaurant && (
        <div className="mb-6 p-4 sm:p-6 border rounded-lg bg-white shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold mb-1">{restaurant.name}</h2>
              <p className="text-gray-600 text-sm sm:text-base">📍 {restaurant.address}</p>
            </div>
          </div>
          
          {/* Logo Section */}
          <div className="mt-4">
            <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-3">Restaurant Logo</h3>
            <div className="flex justify-center sm:justify-start">
              {restaurant.image_url ? (
                <div className="relative inline-block">
                  <button
                    onClick={handleLogoClick}
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg shadow-md hover:shadow-lg transition-shadow border-2 border-gray-200 hover:border-blue-300 p-0 overflow-hidden"
                    aria-label="Change restaurant logo"
                  >
                    <img
                      src={`${getImageUrl(restaurant.image_url, "Logo")}?t=${logoTimestamp}`}
                      alt="Restaurant Logo"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        handleImageError(e, "Logo");
                        e.target.parentNode.nextSibling.style.display = 'block';
                        e.target.style.display = 'none';
                      }}
                    />
                  </button>
                  <button 
                    className="w-24 h-24 sm:w-32 sm:h-32 border-2 border-dashed border-red-300 rounded-lg flex flex-col items-center justify-center hover:border-red-400 hover:bg-red-50 transition-colors"
                    onClick={handleLogoClick}
                    style={{display: 'none'}}
                    aria-label="Upload restaurant logo"
                  >
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-red-400 mb-1 sm:mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs sm:text-sm text-red-500 text-center px-1">Logo Error<br/>Click to re-upload</span>
                  </button>
                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 rounded-lg transition-all cursor-pointer flex items-center justify-center" onClick={handleLogoClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLogoClick(); } }} tabIndex={0} role="button" aria-label="Change logo">
                    <span className="text-white opacity-0 hover:opacity-100 transition-opacity text-xs sm:text-sm font-medium px-2 text-center">
                      Click to change
                    </span>
                  </div>
                </div>
              ) : (
                <div 
                  className="w-24 h-24 sm:w-32 sm:h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  onClick={handleLogoClick}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleLogoClick();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 mb-1 sm:mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-xs sm:text-sm text-gray-500 text-center px-1">Upload Logo</span>
                </div>
              )}
            </div>
          </div>

          {/* ✅ Stripe Connect Section */}
          <div className="mt-6 p-4 sm:p-6 border rounded-lg bg-gray-50">
            <h4 className="text-base sm:text-lg font-medium text-gray-900 mb-3">Payment Processing</h4>
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
                  <p className="text-sm text-gray-600 mb-3">Your account is under review. You&apos;ll be able to receive payments once approved.</p>
                  <button
                    onClick={handleConnectStripe}
                    className="bg-purple-600 text-white px-4 py-3 sm:py-2 rounded hover:bg-purple-700 text-sm font-medium w-full sm:w-auto min-h-[44px] sm:min-h-0"
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
                    className="bg-purple-600 text-white px-4 py-3 sm:py-2 rounded hover:bg-purple-700 font-medium w-full sm:w-auto min-h-[44px] sm:min-h-0"
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
                    className="bg-purple-600 text-white px-4 py-3 sm:py-2 rounded hover:bg-purple-700 font-medium w-full sm:w-auto min-h-[44px] sm:min-h-0"
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
      <div className="mb-8 bg-white border rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">
              📋 Notifications & Alerts
            </h3>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
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
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            {unreadCount > 0 && (
              <button
                onClick={async () => {
                  try {
                    await fetch(`${API_BASE_URL}/api/owners/notifications/mark-all-read`, {
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
                className="text-sm bg-green-600 text-white px-4 py-3 sm:py-2 rounded hover:bg-green-700 transition-colors font-medium min-h-[44px] sm:min-h-0"
              >
                Mark All Read
              </button>
            )}
            <Link 
              to="/owner/notifications"
              className="bg-blue-600 text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium text-center sm:text-left min-h-[44px] sm:min-h-0 flex items-center justify-center"
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

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-semibold">Your Dishes</h3>
        <button
          className="bg-green-600 text-white px-4 py-3 sm:py-2 rounded-lg font-medium min-h-[44px] sm:min-h-0 w-full sm:w-auto"
          onClick={() => navigate("/owner/add-dish")}
        >
          ➕ Add Dish
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        {dishes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg mb-2">No dishes yet</p>
            <p className="text-sm">Add your first dish to get started!</p>
          </div>
        ) : (
          dishes.map((dish) => (
            <div
              key={dish.id}
              className="border p-4 sm:p-6 rounded-lg bg-white shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {dish.image_url && (
                    <img
                      src={getImageUrl(dish.image_url, dish.name)}
                      alt={dish.name}
                      className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg mx-auto sm:mx-0"
                      onError={(e) => handleImageError(e, dish.name)}
                    />
                  )}
                  <div className="text-center sm:text-left">
                    <h4 className="font-semibold text-lg sm:text-xl mb-1">{dish.name}</h4>
                    <p className="text-gray-600 text-lg font-medium mb-1">${dish.price}</p>
                    <p className="text-sm text-gray-500">
                      {dish.is_available ? "✅ Available" : "❌ Not Available"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center sm:items-end space-y-2">
                  <ToggleSwitch
                    checked={!!dish.is_available}
                    onChange={() =>
                      toggleAvailability(dish.id, !!dish.is_available)
                    }
                  />
                  <span className="text-xs text-gray-500 text-center sm:text-right">
                    {dish.is_available ? "In Stock" : "Out of Stock"}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Orders Summary Section */}
      <div className="mb-8 bg-white border rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2">
              📋 Order Management
            </h3>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 sm:gap-6 text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-gray-600">Total:</span>
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
              <div className="flex items-center space-x-2 col-span-2 sm:col-span-1">
                <span className="text-gray-600">Earnings:</span>
                <span className="font-semibold text-purple-600">
                  ${getTotalEarnings().toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <Link 
            to="/owner/orders"
            className="bg-blue-600 text-white px-4 py-3 sm:py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium text-center min-h-[44px] sm:min-h-0 flex items-center justify-center"
          >
            Manage All Orders →
          </Link>
        </div>
        
        {/* Show urgent active orders */}
        {getActiveOrders().length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium text-orange-700 mb-3">🚨 Urgent: Active Orders Requiring Attention</h4>
            <div className="space-y-3">
              {getActiveOrders().slice(0, 3).map((order) => (
                <div key={order.id} className="bg-orange-50 border border-orange-200 rounded-lg p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-800">Order #{order.id} - {order.customer_name}</p>
                      <p className="text-xs text-orange-600 mt-1">
                        {order.items.length} item{order.items.length !== 1 ? 's' : ''} • ${(Number(order.total || 0) - Number(order.platform_fee || 0)).toFixed(2)} earnings
                      </p>
                      <p className="text-xs text-orange-500">
                        Ordered {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="flex flex-row sm:flex-col lg:flex-row gap-2">
                      <button
                        onClick={() => printOrder(order)}
                        className="text-xs bg-blue-600 text-white px-3 py-2 sm:py-1 rounded hover:bg-blue-700 transition-colors font-medium flex-1 sm:flex-none min-h-[40px] sm:min-h-0"
                      >
                        🖨️ Print
                      </button>
                      {order.status !== 'completed' && (
                        <button
                          onClick={() => showCompleteModal(order.id)}
                          className="text-xs bg-green-600 text-white px-3 py-2 sm:py-1 rounded hover:bg-green-700 transition-colors font-medium flex-1 sm:flex-none min-h-[40px] sm:min-h-0"
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
                        Completed {order.completed_at ? `${new Date(order.completed_at).toLocaleDateString()} at ${new Date(order.completed_at).toLocaleTimeString()}` : 'recently'}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-lg sm:text-xl font-semibold mb-4 text-gray-800">
              Complete Order
            </h3>
            <p className="text-gray-600 mb-6 text-sm sm:text-base">
              Mark this order as completed? This will update the order status and notify the customer that their order is ready.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setShowCompleteConfirm(null)}
                className="px-4 py-3 sm:py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium min-h-[44px] sm:min-h-0 order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                onClick={() => completeOrder(showCompleteConfirm)}
                className="px-4 py-3 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium min-h-[44px] sm:min-h-0 order-1 sm:order-2"
              >
                ✅ Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Order Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-lg sm:text-xl font-semibold mb-4 text-gray-800">
              Remove Order #{showRemoveConfirm}
            </h3>
            <p className="text-gray-600 mb-6 text-sm sm:text-base">
              Are you sure you want to remove this completed order from your view? This will hide it from your orders list but won&apos;t affect the customer&apos;s record.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                onClick={() => setShowRemoveConfirm(null)}
                className="px-4 py-3 sm:py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium min-h-[44px] sm:min-h-0 order-2 sm:order-1"
              >
                Cancel
              </button>
              <button
                onClick={() => removeOrder(showRemoveConfirm)}
                className="px-4 py-3 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium min-h-[44px] sm:min-h-0 order-1 sm:order-2"
              >
                🗑️ Remove Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logo Upload Modal */}
      {showLogoModal && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !logoUploading) {
              closeLogoModal();
            }
          }}
        >
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-semibold mb-4 text-gray-800">
              {restaurant?.image_url ? 'Change Restaurant Logo' : 'Upload Restaurant Logo'}
            </h3>
            
            <div className="mb-4">
              <p className="text-gray-600 text-sm sm:text-base mb-4">
                Choose a high-quality image to represent your restaurant. Recommended size: 400x400 pixels or larger.
              </p>
              
              {/* Show current logo when changing */}
              {restaurant?.image_url && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Current Logo:</p>
                  <div className="flex justify-center sm:justify-start">
                    <img
                      src={getImageUrl(restaurant.image_url, "Current Logo")}
                      alt="Current Logo"
                      className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border-2 border-gray-200"
                      onError={(e) => handleImageError(e, "Current Logo")}
                    />
                  </div>
                </div>
              )}
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                  disabled={logoUploading}
                />
                <label htmlFor="logo-upload" className="cursor-pointer block min-h-[120px] sm:min-h-[140px] flex items-center justify-center">
                  {logoUploading ? (
                    <div className="flex flex-col items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                      <span className="text-blue-600 font-medium">Uploading...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mb-2 sm:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-blue-600 font-medium text-sm sm:text-base">Click to select image</span>
                      <span className="text-gray-500 text-xs sm:text-sm mt-1">PNG, JPG, GIF, WebP (Max 5MB)</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={closeLogoModal}
                className="px-6 py-3 sm:py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium min-h-[44px] sm:min-h-0 w-full sm:w-auto"
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
