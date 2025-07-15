import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DishCard from "../Components/DishCard";

export default function RestaurantDetails() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [cart, setCart] = useState([]);
  const [error, setError] = useState("");

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
    setCart((prev) => [...prev, dish]);
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
            <DishCard key={dish.id} dish={dish} onAddToCart={handleAddToCart} />
          ))}
        </div>
      )}
    </div>
  );
}
