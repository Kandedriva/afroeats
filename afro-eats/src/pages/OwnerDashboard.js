import React, { useEffect, useState, useContext } from "react";
import { OwnerAuthContext } from "../context/OwnerAuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import ToggleSwitch from "../Components/ToggleSwitch";

function OwnerDashboard() {
  const { owner, loading: authLoading } = useContext(OwnerAuthContext);
  const [restaurant, setRestaurant] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [orders, setOrders] = useState([]);
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
              fetchSubscriptionStatus();
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
          fetchSubscriptionStatus();
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

    const fetchSubscriptionStatus = async () => {
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

    handleSubscriptionSuccess();
    fetchDashboard();
    fetchSubscriptionStatus();
    fetchOrders();
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
      alert("Failed to connect to Stripe");
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
      alert("Error updating availability");
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
              <div key={order.id} className="border rounded-lg p-4 bg-white">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-lg">Order #{order.id}</h4>
                    <p className="text-sm text-gray-600">
                      Customer: {order.customer_name} ({order.customer_email})
                    </p>
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
                
                <div className="mt-3 pt-3 border-t">
                  <div className="flex space-x-2">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                      💰 Payment Received
                    </span>
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-800">
                      🍳 Ready to Prepare
                    </span>
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
    </div>
  );
}

export default OwnerDashboard;
