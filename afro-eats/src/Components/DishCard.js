import React from "react";
import { useCart } from "../context/CartContext";
import { toast } from 'react-toastify';
import { getImageUrl, handleImageError } from "../utils/imageUtils";

function DishCard({ dish }) {
  const { addToCart } = useCart();

  const handleAddToCart = async () => {
    if (!dish.is_available) {
      toast.warning("This dish is currently unavailable.");
      return;
    }

    try {
      await addToCart(dish);
      toast.success(`${dish.name} added to cart!`);
    } catch (error) {
      toast.error("Failed to add item to cart. Please try again.");
      console.error('Add to cart error:', error);
    }
  };

  const imageUrl = getImageUrl(dish.image_url, "No Dish Image");

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <img
        src={imageUrl}
        alt={dish.name}
        className="w-full h-40 object-cover rounded mb-2"
        onError={(e) => handleImageError(e, "No Dish Image")}
      />
      <h3 className="text-lg font-semibold text-gray-800">{dish.name}</h3>
      <p className="text-gray-600">{dish.description}</p>
      <p className="text-green-600 font-bold mb-2">${Number(dish.price).toFixed(2)}</p>

      <button
        onClick={handleAddToCart}
        disabled={!dish.is_available}
        className={`px-4 py-2 rounded-lg w-full ${
          dish.is_available
            ? "bg-green-600 text-white hover:bg-green-700"
            : "bg-gray-400 text-white cursor-not-allowed"
        }`}
      >
        {dish.is_available ? "Add to Cart" : "Unavailable"}
      </button>
    </div>
  );
}

export default DishCard;
