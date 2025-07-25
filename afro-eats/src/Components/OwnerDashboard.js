import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useOwnerAuth from "../hooks/useOwnerAuth";
import OwnerNavbar from "./OwnerNavbar";
import ToggleSwitch from "./ToggleSwitch";
import { toast } from 'react-toastify';

const OwnerDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [subscriptionActive, setSubscriptionActive] = useState(false);

  const navigate = useNavigate();
  const { checking } = useOwnerAuth();

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/stripe/subscription-status", {
          credentials: "include",
        });

        if (res.status === 403) {
          // Not subscribed
          return navigate("/owner/subscribe");
        } else if (res.status === 401) {
          // Not logged in
          return navigate("/owner/login");
        }

        const data = await res.json();
        setSubscriptionActive(data.subscription_active);
      } catch (err) {
        console.error("Subscription status check error:", err);
      }
    };

    const fetchStripeStatus = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/owners/stripe/account-status", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Could not fetch Stripe account status");
        const data = await res.json();
        setStripeStatus(data.details_submitted);
      } catch (err) {
        console.error("Stripe status error:", err.message);
      }
    };

    const fetchDashboardData = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/owners/dashboard", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Error fetching dashboard data");
        const data = await res.json();
        setDishes(Array.isArray(data.dishes) ? data.dishes : []);
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      } catch (err) {
        console.error("Dashboard error:", err.message);
      } finally {
        setLoading(false);
      }
    };

    // Check auth/subscription first before fetching data
    checkSubscriptionStatus().then(() => {
      fetchStripeStatus();
      fetchDashboardData();
    });
  }, [navigate]);

  const connectStripe = async () => {
    try {
      setStripeLoading(true);
      const res = await fetch("http://localhost:5001/api/owners/stripe/create-stripe-account", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error("Stripe onboarding failed");
      const data = await res.json();
      window.location.href = data.url;
    } catch (err) {
      console.error("Stripe Connect error", err.message);
      toast.error("Failed to connect to Stripe.");
    } finally {
      setStripeLoading(false);
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
          dish.id === dishId ? { ...dish, is_available: !currentStatus } : dish
        )
      );
    } catch (err) {
      console.error(err);
      toast.error("Error updating dish availability");
    }
  };

  const handleAddDish = () => {
    navigate("/owner/add-dish");
  };

  if (checking || loading) return <p>Loading dashboard...</p>;

  return (
    <>
      <OwnerNavbar />
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Owner Dashboard</h1>

        {/* Stripe Connect Section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Stripe Connect</h2>
          {stripeStatus ? (
            <p className="text-green-600 font-medium">
              ✅ Stripe account connected.
            </p>
          ) : (
            <button
              onClick={connectStripe}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              disabled={stripeLoading}
            >
              {stripeLoading ? "Redirecting..." : "Connect with Stripe"}
            </button>
          )}
        </section>

        {/* Add Dish Button */}
        <div className="mb-6">
          <button
            onClick={handleAddDish}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            + Add Dish
          </button>
        </div>

        {/* Dishes Section */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Your Dishes</h2>
          {dishes.length === 0 ? (
            <p>No dishes added yet.</p>
          ) : (
            <ul className="space-y-4">
              {dishes.map((dish) => (
                <li
                  key={dish.id}
                  className="p-4 bg-white shadow rounded flex justify-between items-center"
                >
                  <div className="flex items-center gap-4">
                    {dish.image_url && (
                      <img
                        src={`http://localhost:5001${dish.image_url.replace(/\\/g, "/")}`}
                        alt={dish.name}
                        className="w-20 h-20 object-cover rounded"
                      />
                    )}
                    <div>
                      <h3 className="font-semibold">{dish.name}</h3>
                      <p className="text-gray-600">{dish.description}</p>
                      <p className="font-semibold">${dish.price.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">
                      {dish.is_available ? "Available" : "Unavailable"}
                    </span>
                    <ToggleSwitch
                      checked={!!dish.is_available}
                      onChange={() =>
                        toggleAvailability(dish.id, !!dish.is_available)
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Orders Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>
          {orders.length === 0 ? (
            <p>No recent orders found.</p>
          ) : (
            <div className="grid gap-4">
              {orders.map((order) => (
                <div
                  key={order.order_id}
                  className="bg-white shadow p-4 rounded-lg"
                >
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">
                      Order ID: {order.order_id}
                    </span>
                    <span className="text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {order.image_url && (
                      <img
                        src={`http://localhost:5001${order.image_url.replace(/\\/g, "/")}`}
                        alt={order.dish_name}
                        className="w-20 h-20 object-cover rounded"
                      />
                    )}
                    <div>
                      <h3 className="font-semibold">{order.dish_name}</h3>
                      <p>Quantity: {order.quantity}</p>
                      <p>Price: ${order.price}</p>
                      <p className="text-sm text-gray-500">
                        Customer: {order.customer_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        Restaurant: {order.restaurant_name}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default OwnerDashboard;
