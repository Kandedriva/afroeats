// React import removed as it's not needed in React 17+
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";
import { getImageUrl, handleImageError } from "../utils/imageUtils";

export default function RestaurantDetails() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [error, setError] = useState("");
  const [showImageModal, setShowImageModal] = useState(null);

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
              className={`border rounded-xl p-4 sm:p-6 shadow-md transition-all duration-200 bg-white relative ${
                !dish.is_available 
                  ? "opacity-75 border-gray-300 bg-gray-50" 
                  : "hover:shadow-lg border-gray-200"
              }`}
            >
              {!dish.is_available && (
                <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full z-10">
                  UNAVAILABLE
                </div>
              )}
              <div 
                className={`relative overflow-hidden rounded-lg mb-3 cursor-pointer group ${!dish.is_available ? 'grayscale-[50%]' : ''}`} 
                role="button"
                tabIndex={0}
                aria-label={`View full size image of ${dish.name}`}
                onClick={() => setShowImageModal(dish)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowImageModal(dish);
                  }
                }}
              >
                <img
                  src={getImageUrl(dish.image_url, dish.name)}
                  alt={dish.name}
                  className={`w-full h-40 sm:h-48 object-cover transition-transform duration-300 ease-in-out ${dish.is_available ? 'group-hover:scale-110' : 'group-hover:scale-105'}`}
                  onError={(e) => handleImageError(e, dish.name)}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity duration-300 flex items-center justify-center">
                  <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm font-medium px-3 py-1 bg-black bg-opacity-50 rounded-full">
                    Click to view
                  </div>
                </div>
                {!dish.is_available && (
                  <div className="absolute inset-0 bg-gray-900 bg-opacity-40 flex items-center justify-center">
                    <div className="text-white text-sm font-medium px-3 py-1 bg-red-600 rounded-full">
                      Currently Unavailable
                    </div>
                  </div>
                )}
              </div>
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

      {/* Full-size Image Modal */}
      {showImageModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dish-image-title"
          onClick={() => setShowImageModal(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowImageModal(null);
            }
          }}
          tabIndex={-1}
        >
          <div className="relative max-w-4xl max-h-full">
            <div 
              role="button"
              tabIndex={0}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <img
                src={getImageUrl(showImageModal.image_url, showImageModal.name)}
                alt={showImageModal.name}
                className="max-w-full max-h-full object-contain rounded-lg"
                onError={(e) => handleImageError(e, showImageModal.name)}
              />
            </div>
            <button
              onClick={() => setShowImageModal(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-4 left-4 right-4 text-white bg-black bg-opacity-50 rounded-lg p-3">
              <h3 id="dish-image-title" className="text-lg font-semibold mb-1">{showImageModal.name}</h3>
              <p className="text-sm opacity-90">{showImageModal.description}</p>
              <div className="flex justify-between items-center mt-2">
                <p className="text-green-400 font-bold text-lg">${Number(showImageModal.price).toFixed(2)}</p>
                <p className="text-xs px-2 py-1 rounded-full bg-gray-700">
                  {showImageModal.is_available ? "✅ Available" : "❌ Not Available"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
