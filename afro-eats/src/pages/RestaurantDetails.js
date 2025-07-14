import React, { useState } from "react";
import { useParams } from "react-router-dom";
import restaurants from "../restaurants";
import dishes from "../dishes";
import DishCard from "../Components/DishCard";

export default function RestaurantDetails() {
  const { id } = useParams();
  const restaurantId = parseInt(id, 10);

  const restaurant = restaurants.find((r) => r.id === restaurantId);
  const restaurantDishes = dishes.filter((d) => d.restaurantId === restaurantId);
console.log(restaurants)
  const [cart, setCart] = useState([]);

  function handleAddToCart(dish) {
    setCart((prev) => [...prev, dish]);
  }

  return (
    <div className="max-w-6xl mx-auto mt-10 p-4">
      {restaurant ? (
        <>
          <h2 className="text-3xl font-semibold text-gray-800">{restaurant.name}</h2>
          <p className="text-gray-600 mb-6">{restaurant.address}</p>

          <h3 className="text-2xl font-semibold mb-4">Menu</h3>
          {restaurantDishes.length === 0 ? (
            <p className="text-gray-600">No dishes available.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {restaurantDishes.map((dish) => (
                <DishCard key={dish.id} dish={dish} onAddToCart={handleAddToCart} />
              ))}
            </div>
          )}
{/* 
          <div className="mt-10">
            <h3 className="text-2xl font-semibold mb-2">Your Cart</h3>
            {cart.length === 0 ? (
              <p className="text-gray-600"></p>
            ) : (
              <ul className="list-disc list-inside">
                {cart.map((dish, index) => (
                  <li key={index}>
                    {dish.name} - ${dish.price.toFixed(2)}
                  </li>
                ))}
              </ul>
            )}
          </div> */}
        </>
      ) : (
        <p className="text-red-600">Restaurant not found.</p>
      )}
    </div>
  );
}
