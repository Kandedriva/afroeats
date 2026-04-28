import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { toast } from "react-toastify";
import ProductCard from "../Components/ProductCard";

const MarketplaceHome = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [featuredProducts, setFeaturedProducts] = useState([]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/products/categories`);
      if (!res.ok) {
        throw new Error("Failed to load categories");
      }
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Load categories error:", err);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("is_available", "true"); // Only show available products

      if (selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }

      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const res = await fetch(`${API_BASE_URL}/api/products?${params}`);
      if (!res.ok) {
        throw new Error("Failed to load products");
      }

      const data = await res.json();
      setProducts(data);
    } catch (err) {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  const loadFeaturedProducts = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/products?is_available=true&tags=popular,featured&limit=6`
      );
      if (res.ok) {
        const data = await res.json();
        setFeaturedProducts(data);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Load featured error:", err);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadProducts();
    loadFeaturedProducts();
  }, [loadCategories, loadProducts, loadFeaturedProducts]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadProducts();
  };

  // Removed unused helper functions - they're defined in ProductCard component

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              🛒 Fresh African Groceries
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-green-100">
              Authentic produce, spices, and ingredients delivered to your door
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for fresh spinach, cassava flour, palm oil..."
                  className="flex-1 px-6 py-4 rounded-lg text-gray-900 text-lg focus:outline-none focus:ring-4 focus:ring-green-300"
                />
                <button
                  type="submit"
                  className="px-8 py-4 bg-white text-green-700 rounded-lg font-semibold hover:bg-green-50 transition-colors"
                >
                  Search
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category Filter */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Shop by Category</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                selectedCategory === "all"
                  ? "bg-green-600 text-white shadow-lg"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              All Products
            </button>
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  selectedCategory === cat.name
                    ? "bg-green-600 text-white shadow-lg"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="mr-2">{cat.icon}</span>
                {cat.display_name}
              </button>
            ))}
          </div>
        </div>

        {/* Featured Products Section */}
        {selectedCategory === "all" && !searchQuery && featuredProducts.length > 0 && (
          <div className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800">⭐ Featured Products</h2>
              <Link
                to="/marketplace/products"
                className="text-green-600 hover:text-green-700 font-medium"
              >
                View All →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* Results Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {searchQuery
              ? `Search Results for "${searchQuery}"`
              : selectedCategory === "all"
              ? "All Products"
              : categories.find((c) => c.name === selectedCategory)?.display_name || "Products"}
          </h2>
          <div className="text-gray-600">
            {products.length} {products.length === 1 ? "product" : "products"}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600"></div>
          </div>
        )}

        {/* Products Grid */}
        {!loading && products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && products.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-semibold text-gray-800 mb-2">No products found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery
                ? `No results for "${searchQuery}". Try a different search term.`
                : `No products available in this category yet.`}
            </p>
            {(searchQuery || selectedCategory !== "all") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                View All Products
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceHome;
