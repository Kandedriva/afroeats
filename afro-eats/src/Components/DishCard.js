import React from "react";
import { useCart } from "../context/CartContext";
import { Link } from "react-router-dom";

function DishCard({ dish }) {
  const { addToCart } = useCart();
  console.log("Dish image:", dish.image_url);


  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <img
  src={`http://localhost:5001/${dish.image_url}`}
  alt={dish.name}
  className="w-full h-40 object-cover rounded"
/>
      <h3 className="text-lg font-semibold text-gray-800">{dish.name}</h3>
      <p className="text-green-600 font-bold mb-2">${dish.price}</p>
      <button
        onClick={() => {addToCart(dish)
          console.log("Clicked:", dish.name);
        
        }}
        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
      >
        Add to Cart
      </button>
      
    </div>
  );
}

export default DishCard;
