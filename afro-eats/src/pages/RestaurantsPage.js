import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RestaurantCard from "../Components/RestaurantCard";
import GroceryStoreCard from "../Components/GroceryStoreCard";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";

export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [groceryStores, setGroceryStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [restRes, storesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/restaurants`),
          fetch(`${API_BASE_URL}/api/grocery/stores`),
        ]);

        if (!restRes.ok) {
          throw new Error(`Failed to fetch restaurants (${restRes.status}): ${restRes.statusText}`);
        }

        setRestaurants(await restRes.json());

        if (storesRes.ok) {
          setGroceryStores(await storesRes.json());
        }

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
        toast.error('Failed to load restaurants');
      }
    };

    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading restaurants...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Unable to Load Restaurants
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              to="/"
              className="text-white hover:text-green-100 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-4xl font-bold">🍽️ Restaurants & Stores</h1>
          </div>
          <p className="text-xl text-green-100">
            Order delicious African cuisine and fresh groceries
          </p>
        </div>
      </div>

      {/* Restaurants Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">🍽️ Restaurants</h2>
          <p className="text-gray-600">Authentic African cuisine from our restaurant partners</p>
        </div>
        {restaurants.length > 0 ? (
          <>
            <div className="mb-6">
              <p className="text-gray-600">
                {restaurants.length} {restaurants.length === 1 ? 'restaurant' : 'restaurants'} available
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {restaurants.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <div className="text-8xl mb-6">🍽️</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              No Restaurants Available
            </h2>
            <p className="text-gray-600 mb-8">
              Check back soon for delicious African cuisine!
            </p>
            <Link
              to="/marketplace"
              className="inline-block px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg"
            >
              Browse Marketplace Instead
            </Link>
          </div>
        )}
      </div>

      {/* Grocery Stores Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">🛒 Grocery Stores</h2>
          <p className="text-gray-600">Fresh African produce, spices, and ingredients — delivered to your door</p>
        </div>

        {groceryStores.length > 0 ? (
          <>
            <div className="mb-4">
              <p className="text-gray-600">
                {groceryStores.length} {groceryStores.length === 1 ? 'store' : 'stores'} available
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {groceryStores.map((store) => (
                <GroceryStoreCard key={store.id} store={store} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-100 shadow-sm">
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No grocery stores yet</h3>
            <p className="text-gray-500">Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
