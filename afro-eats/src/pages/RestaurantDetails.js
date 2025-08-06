// React import removed as it's not needed in React 17+
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";

export default function RestaurantDetails() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [error, setError] = useState("");

  const { addToCart } = useCart();

  useEffect(() => {
    const fetchRestaurantDetails = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/restaurants/${id}`);
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

  async function handleAddToCart(dish) {
    if (!dish.is_available) {
      toast.warning(`${dish.name} is currently unavailable.`);
      return;
    }

    const dishWithRestaurantInfo = {
      ...dish,
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
    };

    try {
      await addToCart(dishWithRestaurantInfo);
      toast.success(`${dish.name} added to cart!`);
    } catch (error) {
      // console.error('Add to cart error:', error);
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        toast.error("Please log in to add items to cart.");
      } else {
        toast.error("Failed to add item to cart. Please try again.");
      }
    }
  }

  if (error) {
    return <p className="text-red-600 text-center mt-10">{error}</p>;
  }

  if (!restaurant) {
    return <p className="text-gray-500 text-center mt-10">Loading restaurant...</p>;
  }

  return (
    <div className="max-w-6xl mx-auto mt-4 sm:mt-10 p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mb-2">{restaurant.name}</h2>
        <p className="text-gray-600 text-sm sm:text-base">{restaurant.address}</p>
      </div>

      <h3 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Menu</h3>
      {dishes.length === 0 ? (
        <div className="text-center py-8 sm:py-12">
          <div className="text-4xl sm:text-6xl mb-4">🍽️</div>
          <p className="text-gray-600 text-sm sm:text-base">No dishes available at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {dishes.map((dish) => (
            <div
              key={dish.id}
              className={`border rounded-xl p-4 sm:p-6 shadow-md hover:shadow-lg transition-shadow duration-200 bg-white ${
                !dish.is_available ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <img
                src={`${API_BASE_URL}${dish.image_url}`}
                alt={dish.name}
                className="w-full h-40 sm:h-48 object-cover rounded-lg mb-3"
                onError={(e) => {
                  e.target.src = '/placeholder-dish.jpg';
                }}
              />
              <h4 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2 line-clamp-2">{dish.name}</h4>
              <p className="text-gray-600 text-sm sm:text-base mb-3 line-clamp-2">{dish.description}</p>
              <div className="flex justify-between items-center mb-3">
                <p className="text-lg sm:text-xl font-bold text-green-600">${Number(dish.price).toFixed(2)}</p>
                <p className="text-xs sm:text-sm text-gray-500 px-2 py-1 rounded-full bg-gray-100">
                  {dish.is_available ? "✅ Available" : "❌ Not Available"}
                </p>
              </div>
              <button
                onClick={() => handleAddToCart(dish)}
                disabled={!dish.is_available}
                className={`mt-3 px-4 py-3 rounded-lg text-white w-full font-medium text-sm transition-all duration-200 touch-manipulation ${
                  dish.is_available
                    ? "bg-green-600 hover:bg-green-700 active:bg-green-800 active:scale-95 shadow-md hover:shadow-lg"
                    : "bg-gray-400 cursor-not-allowed opacity-60"
                }`}
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  minHeight: '44px'
                }}
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
