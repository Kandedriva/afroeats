// React import removed as it's not needed in React 17+
import { useEffect, useState } from "react";
import RestaurantCard from "../Components/RestaurantCard";
import { API_BASE_URL } from "../config/api";

export default function RestaurantList() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/restaurants`);
        if (!res.ok) {
          throw new Error("Failed to fetch restaurants");
        }
        const data = await res.json();
        setRestaurants(data);
      } catch (err) {
        setError('Failed to load restaurants. Please try again later.');
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('Error fetching restaurants:', err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  if (loading) {
    return <p className="text-center mt-10">Loading restaurants...</p>;
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-center">
          <span className="text-red-600 text-4xl mb-4 block">⚠️</span>
          <h2 className="text-lg font-semibold text-red-800 mb-2">Unable to Load Restaurants</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
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
