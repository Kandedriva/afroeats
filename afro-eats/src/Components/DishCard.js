import React, { useState } from "react";
import PropTypes from 'prop-types';
import { useCart } from "../context/CartContext";
import { toast } from 'react-toastify';
import { getImageUrl, handleImageError } from "../utils/imageUtils";

function DishCard({ dish }) {
  const { addToCart } = useCart();
  const [showImageModal, setShowImageModal] = useState(false);

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
      // console.error('Add to cart error:', error);
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
    <>
      <div className={`bg-white rounded-2xl shadow-md transition-all duration-200 p-4 sm:p-6 relative ${
        !dish.is_available 
          ? "opacity-75 border border-gray-300 bg-gray-50" 
          : "hover:shadow-lg"
      }`}>
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
          onClick={() => setShowImageModal(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowImageModal(true);
            }
          }}
        >
          <img
            src={imageUrl}
            alt={dish.name}
            className={`w-full h-40 sm:h-48 object-cover transition-transform duration-300 ease-in-out ${dish.is_available ? 'group-hover:scale-110' : 'group-hover:scale-105'}`}
            onError={(e) => handleImageError(e, "No Dish Image")}
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

      {/* Full-size Image Modal */}
      {showImageModal && (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dish-card-image-title"
          onClick={() => setShowImageModal(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowImageModal(false);
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
                src={imageUrl}
                alt={dish.name}
                className="max-w-full max-h-full object-contain rounded-lg"
                onError={(e) => handleImageError(e, "No Dish Image")}
              />
            </div>
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-4 left-4 right-4 text-white bg-black bg-opacity-50 rounded-lg p-3">
              <h3 id="dish-card-image-title" className="text-lg font-semibold mb-1">{dish.name}</h3>
              <p className="text-sm opacity-90">{dish.description}</p>
              <p className="text-green-400 font-bold text-lg mt-2">${Number(dish.price).toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

DishCard.propTypes = {
  dish: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    image_url: PropTypes.string,
    is_available: PropTypes.bool.isRequired,
    restaurant_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  }).isRequired,
};

export default DishCard;
