import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { toast } from 'react-toastify';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import ProductCard from '../Components/ProductCard';

export default function GroceryStorePage() {
  const { storeSlug } = useParams();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const storesRes = await fetch(`${API_BASE_URL}/api/grocery/stores`);
        if (!storesRes.ok) { throw new Error('Failed to load stores'); }

        const stores = await storesRes.json();
        const found = stores.find((s) => s.slug === storeSlug);
        if (!found) { setLoading(false); return; }

        setStore(found);

        const productsRes = await fetch(
          `${API_BASE_URL}/api/products?store_id=${found.id}&is_available=true`
        );
        if (productsRes.ok) { setProducts(await productsRes.json()); }
      } catch (err) {
        toast.error('Failed to load store');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [storeSlug]);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading store...</p>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🏪</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Store not found</h2>
          <Link to="/restaurants" className="text-green-600 hover:underline">← Back to stores</Link>
        </div>
      </div>
    );
  }

  const storeImageUrl = getImageUrl(store.image_url, store.name);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Store Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Link
            to="/restaurants"
            className="inline-flex items-center gap-1 text-green-100 hover:text-white mb-6 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to all stores
          </Link>

          <div className="flex items-center gap-6">
            <img
              src={storeImageUrl}
              alt={store.name}
              className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
              onError={(e) => handleImageError(e, store.name)}
            />
            <div>
              <h1 className="text-3xl font-bold">{store.name}</h1>
              <p className="text-green-100 mt-1">📍 {store.address}</p>
              {store.phone_number && (
                <p className="text-green-100 text-sm mt-1">📞 {store.phone_number}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search + Products */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <h2 className="text-2xl font-bold text-gray-800">
            🛒 Products
            <span className="ml-2 text-base font-normal text-gray-500">
              ({filtered.length} available)
            </span>
          </h2>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-64"
          />
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {search ? 'No products match your search' : 'No products available yet'}
            </h3>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="mt-4 text-green-600 hover:text-green-700 font-medium"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
