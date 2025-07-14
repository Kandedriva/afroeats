import React, { useEffect, useState } from "react";

function OwnerDashboard() {
  const [restaurant, setRestaurant] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="text-center p-6">Loading dashboard...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Welcome to your Dashboard</h1>

      {restaurant && (
        <div className="mb-6 p-4 border rounded bg-white">
          <h2 className="text-xl font-semibold">{restaurant.name}</h2>
          <p className="text-gray-600">📍 {restaurant.address}</p>
          {restaurant.image_url && (
            <img
              src={`http://localhost:5001/${restaurant.image_url}`}
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
          onClick={() => window.location.href = "/owner/add-dish"}
        >
          ➕ Add Dish
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {dishes.length === 0 ? (
          <p>No dishes yet.</p>
        ) : (
          dishes.map((dish) => (
            <div key={dish.id} className="border p-4 rounded bg-white">
              <h4 className="font-semibold">{dish.name}</h4>
              <p>${dish.price}</p>
              <p className="text-sm text-gray-500">{dish.available ? "Available" : "Not Available"}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default OwnerDashboard;
