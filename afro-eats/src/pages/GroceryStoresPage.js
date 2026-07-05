import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import GroceryStoreCard from "../Components/GroceryStoreCard";
import { toast } from 'react-toastify';
import PageSeo from "../Components/SEO";
import { API_BASE_URL } from "../config/api";

export default function GroceryStoresPage() {
  const [groceryStores, setGroceryStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/grocery/stores`);
        if (!res.ok) {
          throw new Error(`Failed to fetch grocery stores (${res.status}): ${res.statusText}`);
        }
        setGroceryStores(await res.json());
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
        toast.error('Failed to load grocery stores');
      }
    };

    fetchStores();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading grocery stores...</p>
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
            Unable to Load Grocery Stores
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageSeo
        title="African Grocery Stores Near You"
        description="Browse local African grocery stores on OrderDabaly. Order fresh produce, spices, and authentic ingredients for delivery or pickup."
        path="/grocery-stores"
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              to="/"
              className="text-white hover:text-purple-100 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-4xl font-bold">🛒 Grocery Stores</h1>
          </div>
          <p className="text-xl text-purple-100">
            Fresh African produce, spices, and ingredients — delivered to your door
          </p>
        </div>
      </div>

      {/* Stores Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {groceryStores.length > 0 ? (
          <>
            <div className="mb-6">
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
          <div className="text-center py-20">
            <div className="text-8xl mb-6">🏪</div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              No Grocery Stores Yet
            </h2>
            <p className="text-gray-600 mb-8">
              Check back soon for fresh African produce and ingredients!
            </p>
            <Link
              to="/marketplace"
              className="inline-block px-8 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-lg"
            >
              Browse Marketplace Instead
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
