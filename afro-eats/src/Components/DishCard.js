import React from "react";
import { useCart } from "../context/CartContext";
import { toast } from 'react-toastify';
import { getImageUrl, handleImageError } from "../utils/imageUtils";

function DishCard({ dish }) {
  const { addToCart } = useCart();

  const handleAddToCart = async (e) => {
    // Prevent event bubbling and ensure proper touch handling
    e.preventDefault();
    e.stopPropagation();
    
    if (!dish.is_available) {
      toast.warning("This dish is currently unavailable.");
      return;
    }

    try {
      await addToCart(dish);
      toast.success(`${dish.name} added to cart!`);
    } catch (error) {
      console.error('Add to cart error:', error);
      // More specific error handling for mobile users
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        toast.error("Please log in to add items to cart.");
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        toast.error("Network error. Please check your connection and try again.");
      } else {
        toast.error("Failed to add item to cart. Please try again.");
      }
    }
  };

  const imageUrl = getImageUrl(dish.image_url, "No Dish Image");

  return (
    <div className="bg-white rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-200 p-4 sm:p-6">
      <img
        src={imageUrl}
        alt={dish.name}
        className="w-full h-40 sm:h-48 object-cover rounded-lg mb-3"
        onError={(e) => handleImageError(e, "No Dish Image")}
      />
      <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2 line-clamp-2">{dish.name}</h3>
      <p className="text-gray-600 text-sm sm:text-base mb-3 line-clamp-2">{dish.description}</p>
      <p className="text-green-600 font-bold text-lg sm:text-xl mb-4">${Number(dish.price).toFixed(2)}</p>

      <button
        onClick={handleAddToCart}
        disabled={!dish.is_available}
        className={`px-4 py-3 rounded-lg w-full font-medium text-sm transition-all duration-200 touch-manipulation ${
          dish.is_available
            ? "bg-green-600 text-white hover:bg-green-700 active:bg-green-800 active:scale-95 shadow-md hover:shadow-lg"
            : "bg-gray-400 text-white cursor-not-allowed opacity-60"
        }`}
        style={{
          WebkitTapHighlightColor: 'transparent',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          minHeight: '44px' // Minimum touch target size for mobile
        }}
      >
        {dish.is_available ? "Add to Cart" : "Unavailable"}
      </button>
    </div>
  );
}

export default DishCard;
