import React, { useEffect, useState } from "react";
import useOwnerAuth from "../hooks/useOwnerAuth";

const OwnerDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);

  const { checking } = useOwnerAuth();


  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/owners/dashboard", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Server error while fetching dashboard data");

        const data = await res.json();
        setDishes(Array.isArray(data.dishes) ? data.dishes : []);
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      } catch (err) {
        console.error("Dashboard error:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

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
      alert("Error updating dish availability");
    }
  };

  if (checking || loading) return <p>Loading dashboard...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Owner Dashboard</h1>

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
                <label className="flex items-center cursor-pointer">
                  <span className="mr-2 text-sm">
                    {dish.is_available ? "Available" : "Unavailable"}
                  </span>
                  <input
                    type="checkbox"
                    checked={!!dish.is_available}
                    onChange={() => toggleAvailability(dish.id, !!dish.is_available)}
                  />
                </label>
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
              <div key={order.order_id} className="bg-white shadow p-4 rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Order ID: {order.order_id}</span>
                  <span className="text-sm text-gray-600">
                    {new Date(order.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {order.image_url && (
                    <img
                   src={`http://localhost:5001${dish.image_url}`}
                   alt={dish.name}
                   className="w-20 h-20 object-cover rounded"
/>

                  )}
                  <div>
                    <h3 className="font-semibold">{order.dish_name}</h3>
                    <p>Quantity: {order.quantity}</p>
                    <p>Price: ${order.price}</p>
                    <p className="text-sm text-gray-500">Customer: {order.customer_name}</p>
                    <p className="text-sm text-gray-500">Restaurant: {order.restaurant_name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default OwnerDashboard;
