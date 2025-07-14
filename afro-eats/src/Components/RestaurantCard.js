import React from "react";
import { Link } from "react-router-dom";

function RestaurantCard({ restaurant }) {
  return (
    <Link to={`/restaurants/${restaurant.id}`}>
      <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 cursor-pointer">
        <img
          className="w-full h-40 object-cover"
          src={restaurant.imageUrl}
          alt={restaurant.name}
        />
        <div className="p-4">
          <h3 className="text-xl font-semibold text-gray-800">{restaurant.name}</h3>
          <p className="text-gray-600 mt-1">{restaurant.address}</p>
        </div>
      </div>
    </Link>
  );
}

export default RestaurantCard;
