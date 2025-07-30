import React, { useEffect, useState } from "react";
import RestaurantCard from "../Components/RestaurantCard";
import { API_BASE_URL } from "../config/api";

export default function RestaurantList() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/restaurants`);
        if (!res.ok) throw new Error("Failed to fetch restaurants");
        const data = await res.json();
        setRestaurants(data);
      } catch (error) {
        // Handle error silently
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  if (loading) {
    return <p className="text-center mt-10">Loading restaurants...</p>;
  }

  if (restaurants.length === 0) {
    return <p className="text-center mt-10">No restaurants found.</p>;
  }

  return (
    <main className="max-w-6xl mx-auto mt-10 p-4 grid gap-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
      {restaurants.map((restaurant) => (
        <RestaurantCard key={restaurant.id} restaurant={restaurant} />
      ))}
    </main>
  );
}
