import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOwnerAuth } from "../context/OwnerAuthContext";

const OwnerNavbar = () => {
  const { owner, logout } = useOwnerAuth();
  const [restaurant, setRestaurant] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRestaurant = async () => {
      if (owner) {
        try {
          const res = await fetch("http://localhost:5001/api/owners/restaurant", {
            credentials: "include",
          });

          if (res.ok) {
            const restaurantData = await res.json();
            setRestaurant(restaurantData);
          }
        } catch (err) {
          console.error("Restaurant fetch failed", err);
        }
      }
    };

    fetchRestaurant();
  }, [owner]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/owner/login");
    } catch (err) {
      console.error("Logout error:", err.message);
    }
  };

  return (
    <nav className="bg-gray-800 text-white p-4 flex justify-between items-center">
      <div className="flex items-center space-x-6">
        {owner && restaurant && (
          <div className="flex items-center space-x-3">
            {restaurant.image_url && (
              <img
                src={`http://localhost:5001/${restaurant.image_url}`}
                alt={restaurant.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            )}
            <Link to="/owner/dashboard" className="text-xl font-bold">
              {restaurant.name}
            </Link>
          </div>
        )}
        
        {owner && (
          <Link to="/owner/add-dish" className="hover:underline bg-green-600 px-3 py-1 rounded">
            + Add Dish
          </Link>
        )}
      </div>

      {owner && (
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded"
        >
          Logout
        </button>
      )}
    </nav>
  );
};

export default OwnerNavbar;
