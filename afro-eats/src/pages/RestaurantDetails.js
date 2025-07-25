import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { toast } from 'react-toastify';

export default function RestaurantDetails() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [error, setError] = useState("");

  const { addToCart } = useCart();

  useEffect(() => {
    const fetchRestaurantDetails = async () => {
      try {
        const res = await fetch(`http://localhost:5001/api/restaurants/${id}`);
        if (!res.ok) {
          throw new Error("Restaurant not found");
        }
        const data = await res.json();
        setRestaurant(data.restaurant);
        setDishes(data.dishes || []);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchRestaurantDetails();
  }, [id]);

  function handleAddToCart(dish) {
    if (!dish.is_available) {
      toast.warning(`${dish.name} is currently unavailable.`);
      return;
    }

    const dishWithRestaurantInfo = {
      ...dish,
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
    };

    addToCart(dishWithRestaurantInfo);
  }

  if (error) {
    return <p className="text-red-600 text-center mt-10">{error}</p>;
  }

  if (!restaurant) {
    return <p className="text-gray-500 text-center mt-10">Loading restaurant...</p>;
  }

  return (
    <div className="max-w-6xl mx-auto mt-10 p-4">
      <h2 className="text-3xl font-semibold text-gray-800">{restaurant.name}</h2>
      <p className="text-gray-600 mb-6">{restaurant.address}</p>

      <h3 className="text-2xl font-semibold mb-4">Menu</h3>
      {dishes.length === 0 ? (
        <p className="text-gray-600">No dishes available.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {dishes.map((dish) => (
            <div
              key={dish.id}
              className={`border rounded-lg p-4 shadow-sm bg-white ${
                !dish.is_available ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <img
                src={`http://localhost:5001${dish.image_url}`}
                alt={dish.name}
                className="w-full h-40 object-cover rounded mb-3"
              />
              <h4 className="text-lg font-semibold">{dish.name}</h4>
              <p className="text-gray-600">{dish.description}</p>
              <p className="text-sm text-gray-500 mb-1">
                {dish.is_available ? "✅ Available" : "❌ Not Available"}
              </p>
              <p className="font-bold">${Number(dish.price).toFixed(2)}</p>
              <button
                onClick={() => handleAddToCart(dish)}
                disabled={!dish.is_available}
                className={`mt-2 px-4 py-2 rounded text-white w-full ${
                  dish.is_available
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                {dish.is_available ? "Add to Cart" : "Unavailable"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
