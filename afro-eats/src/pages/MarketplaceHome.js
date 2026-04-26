import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { API_BASE_URL } from "../config/api";
import { toast } from "react-toastify";
import { useGroceryCart } from "../context/GroceryCartContext";

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

// Product Card Component
const ProductCard = ({ product }) => {
  const { addToGroceryCart } = useGroceryCart();
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weight, setWeight] = useState(0);
  const formatPrice = (price) => parseFloat(price).toFixed(2);

  const isWeightBased = ['lb', 'kg', 'oz', 'g'].includes(product.unit);

  const getBadges = (product) => {
    const badges = [];
    if (product.organic) {
      badges.push({ text: "Organic", color: "bg-green-100 text-green-800" });
    }
    if (product.gluten_free) {
      badges.push({ text: "Gluten-Free", color: "bg-blue-100 text-blue-800" });
    }
    if (product.vegan) {
      badges.push({ text: "Vegan", color: "bg-purple-100 text-purple-800" });
    }
    return badges;
  };

  const handleAddToCart = (e) => {
    e.preventDefault(); // Prevent navigation to product details
    e.stopPropagation();

    if (product.stock_quantity === 0 || !product.is_available) {
      toast.error("This product is currently unavailable");
      return;
    }

    // If weight-based, show modal to enter weight
    if (isWeightBased) {
      setShowWeightModal(true);
      return;
    }

    // For non-weight items, add directly
    try {
      addToGroceryCart(product, 1); // Add 1 unit by default
      toast.success(`Added ${product.name} to grocery cart!`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleConfirmWeight = () => {
    if (weight < 0.1 || weight > product.stock_quantity) {
      toast.error(`Please enter a valid weight between 0.1 and ${product.stock_quantity} ${product.unit}`);
      return;
    }

    try {
      addToGroceryCart(product, parseFloat(weight));
      toast.success(`Added ${weight} ${product.unit} of ${product.name} to grocery cart!`);
      setShowWeightModal(false);
      setWeight(0); // Reset weight
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCancelWeight = () => {
    setShowWeightModal(false);
    setWeight(0); // Reset weight
  };

  const badges = getBadges(product);
  const isLowStock = product.stock_quantity <= product.low_stock_threshold;
  const isOutOfStock = product.stock_quantity === 0;
  const pricePerUnit = product.price + (product.platform_fee || 0);
  const calculatedTotal = (pricePerUnit * weight).toFixed(2);

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group relative">
      <Link to={`/marketplace/product/${product.id}`} className="block">
        {/* Product Image */}
        <div className="relative h-56 bg-gray-100 overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.parentElement.innerHTML = `<div class="flex items-center justify-center h-full text-6xl">${
                  product.category === "vegetables"
                    ? "🥬"
                    : product.category === "fruits"
                    ? "🍎"
                    : product.category === "grains"
                    ? "🌾"
                    : product.category === "spices"
                    ? "🌶️"
                    : "📦"
                }</div>`;
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-6xl">
              {product.category === "vegetables"
                ? "🥬"
                : product.category === "fruits"
                ? "🍎"
                : product.category === "grains"
                ? "🌾"
                : product.category === "spices"
                ? "🌶️"
                : "📦"}
            </div>
          )}

          {/* Stock Badge */}
          {isLowStock && (
            <div className="absolute top-3 right-3">
              <span className="px-3 py-1 bg-orange-500 text-white text-xs font-semibold rounded-full shadow-lg">
                {product.stock_quantity === 0 ? "Out of Stock" : "Low Stock"}
              </span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="p-4">
          {/* Name */}
          <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2 group-hover:text-green-600 transition-colors">
            {product.name}
          </h3>

          {/* Origin */}
          {product.origin && (
            <p className="text-sm text-gray-500 mb-2">📍 {product.origin}</p>
          )}

          {/* Badges */}
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {badges.map((badge, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}
                >
                  {badge.text}
                </span>
              ))}
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <span className="text-2xl font-bold text-green-600">
                ${formatPrice(product.price + (product.platform_fee || 0))}
              </span>
              <span className="text-sm text-gray-500 ml-1">/ {product.unit}</span>
            </div>
          </div>

          {/* Description Preview */}
          {product.description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {product.description}
            </p>
          )}
        </div>
      </Link>

      {/* Action Buttons - Outside the Link to prevent navigation */}
      <div className="px-4 pb-4 flex gap-2">
        {isOutOfStock || !product.is_available ? (
          <button
            disabled
            className="flex-1 py-2 bg-gray-300 text-gray-500 rounded-lg font-medium text-sm cursor-not-allowed"
          >
            Out of Stock
          </button>
        ) : (
          <button
            onClick={handleAddToCart}
            className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center justify-center gap-1"
          >
            <span>🛒</span>
            Add to Cart
          </button>
        )}
        <Link
          to={`/marketplace/product/${product.id}`}
          className="px-4 py-2 border-2 border-green-600 text-green-600 rounded-lg hover:bg-green-50 transition-colors font-medium text-sm"
        >
          View
        </Link>
      </div>

      {/* Weight Input Modal */}
      {showWeightModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Enter Weight for {product.name}
            </h3>

            <div className="mb-6">
              <label htmlFor="weight-input" className="block text-sm font-medium text-gray-700 mb-2">
                How much do you want? ({product.unit})
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const newWeight = Math.max(0.1, parseFloat((weight - 0.1).toFixed(1)));
                    setWeight(newWeight);
                  }}
                  className="px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold text-lg"
                >
                  -
                </button>
                <input
                  id="weight-input"
                  type="number"
                  value={weight || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setWeight(0);
                    } else {
                      const numVal = parseFloat(val);
                      if (!isNaN(numVal) && numVal >= 0) {
                        setWeight(numVal);
                      }
                    }
                  }}
                  step="0.1"
                  min="0"
                  max={product.stock_quantity}
                  placeholder="0.0"
                  className="flex-1 text-center text-xl font-semibold border-2 border-gray-300 rounded-lg py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <button
                  onClick={() => {
                    const newWeight = Math.min(product.stock_quantity, parseFloat((weight + 0.1).toFixed(1)));
                    setWeight(newWeight);
                  }}
                  className="px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold text-lg"
                >
                  +
                </button>
                <span className="text-gray-600 font-medium">{product.unit}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Available: {product.stock_quantity} {product.unit}
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Price per {product.unit}:</span>
                <span className="font-semibold text-gray-900">${formatPrice(pricePerUnit)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">Total:</span>
                <span className="text-2xl font-bold text-green-600">${calculatedTotal}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelWeight}
                className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmWeight}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <span>🛒</span>
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ProductCard.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    unit: PropTypes.string.isRequired,
    image_url: PropTypes.string,
    origin: PropTypes.string,
    description: PropTypes.string,
    is_available: PropTypes.bool,
    stock_quantity: PropTypes.number,
    category: PropTypes.string,
    organic: PropTypes.bool,
    gluten_free: PropTypes.bool,
    vegan: PropTypes.bool,
    low_stock_threshold: PropTypes.number,
    platform_fee: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }).isRequired,
};

export default MarketplaceHome;
