import React, { useEffect, useState, useContext } from "react";
import { OwnerAuthContext } from "../context/OwnerAuthContext";
import { Navigate, useNavigate } from "react-router-dom";
import ToggleSwitch from "../Components/ToggleSwitch";

function OwnerDashboard() {
  const { owner, loading: authLoading } = useContext(OwnerAuthContext);
  const [restaurant, setRestaurant] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
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
        setRestaurant(data.restaurant);
        setDishes(data.dishes);
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

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Welcome to your Dashboard</h1>

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
            <div key={dish.id} className="border p-4 rounded bg-white flex justify-between items-center">
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

              {/* Toggle availability switch */}
              <div className="flex flex-col items-end">
                <ToggleSwitch
                  checked={!!dish.is_available}
                  onChange={() => toggleAvailability(dish.id, !!dish.is_available)}
                />
                <span className="text-xs mt-1 text-gray-500">
                  {dish.is_available ? "In Stock" : "Out of Stock"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default OwnerDashboard;
