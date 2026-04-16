import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { toast } from "react-toastify";

const HomePage = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHomePageData();
  }, []);

  const loadHomePageData = async () => {
    try {
      setLoading(true);

      // Load featured products, categories, and restaurants in parallel
      const [productsRes, categoriesRes, restaurantsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/products?is_available=true&limit=6`),
        fetch(`${API_BASE_URL}/api/products/categories`),
        fetch(`${API_BASE_URL}/api/restaurants`),
      ]);

      if (productsRes.ok) {
        const products = await productsRes.json();
        setFeaturedProducts(products.slice(0, 6));
      }

      if (categoriesRes.ok) {
        const cats = await categoriesRes.json();
        setCategories(cats.slice(0, 8)); // Show first 8 categories
      }

      if (restaurantsRes.ok) {
        const rests = await restaurantsRes.json();
        setRestaurants(rests.slice(0, 6)); // Show first 6 restaurants
      }
    } catch (err) {
      console.error("Load homepage data error:", err);
      toast.error("Failed to load page content");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section - Marketplace Focus */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Fresh African Groceries & Cuisine
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-green-100">
              Shop authentic ingredients or order delicious meals from local restaurants
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/marketplace"
                className="inline-block px-8 py-4 bg-white text-green-700 rounded-lg hover:bg-green-50 transition-colors font-semibold text-lg shadow-lg"
              >
                🛒 Shop Marketplace
              </Link>
              <a
                href="#restaurants"
                className="inline-block px-8 py-4 bg-green-800 text-white rounded-lg hover:bg-green-900 transition-colors font-semibold text-lg border-2 border-white"
              >
                🍽️ Order Food
              </a>
              <Link
                to="/driver/register"
                className="inline-block px-8 py-4 bg-yellow-500 text-gray-900 rounded-lg hover:bg-yellow-400 transition-colors font-semibold text-lg shadow-lg border-2 border-yellow-300"
              >
                🚗 Become a Driver
              </Link>
            </div>

            {/* Driver Login Link */}
            <div className="mt-4 text-center">
              <p className="text-green-100">
                Already a driver?{" "}
                <Link
                  to="/driver/login"
                  className="text-white font-semibold underline hover:text-yellow-300 transition-colors"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Category Quick Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">
            Shop by Category
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                to={`/marketplace?category=${cat.name}`}
                className="flex flex-col items-center p-4 hover:bg-gray-50 rounded-lg transition-colors group"
              >
                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">
                  {cat.icon}
                </div>
                <div className="text-sm font-medium text-gray-700 text-center">
                  {cat.display_name.split(" ")[0]}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Featured Products Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">🌟 Featured Products</h2>
            <p className="text-gray-600 mt-2">Fresh ingredients delivered to your door</p>
          </div>
          <Link
            to="/marketplace"
            className="text-green-600 hover:text-green-700 font-semibold flex items-center gap-2"
          >
            View All
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {featuredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-600">No featured products available yet.</p>
            <Link to="/marketplace" className="text-green-600 hover:text-green-700 font-medium mt-2 inline-block">
              Browse all products →
            </Link>
          </div>
        )}
      </div>

      {/* Why Shop With Us */}
      <div className="bg-green-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-800 text-center mb-12">
            Why Shop With OrderDabaly?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-5xl mb-4">🌱</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Authentic Ingredients</h3>
              <p className="text-gray-600">
                Genuine African produce, spices, and specialty items
              </p>
            </div>
            <div className="text-center">
              <div className="text-5xl mb-4">🚚</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Fast Delivery</h3>
              <p className="text-gray-600">
                Same-day delivery on marketplace and restaurant orders
              </p>
            </div>
            <div className="text-center">
              <div className="text-5xl mb-4">💳</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Secure Payment</h3>
              <p className="text-gray-600">
                Safe and encrypted transactions with Stripe
              </p>
            </div>
            <div className="text-center">
              <div className="text-5xl mb-4">⭐</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Quality Guaranteed</h3>
              <p className="text-gray-600">
                Fresh products and delicious food, every time
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Become a Driver Section */}
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-4">🚗 Earn Money as a Driver</h2>
              <p className="text-lg mb-6 text-gray-800">
                Join our delivery team and earn on your own schedule. Deliver groceries and food to customers in your area.
              </p>
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">✅</div>
                  <div>
                    <h3 className="font-semibold text-lg">Flexible Schedule</h3>
                    <p className="text-gray-800">Work when you want, as much as you want</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-2xl">💰</div>
                  <div>
                    <h3 className="font-semibold text-lg">Competitive Earnings</h3>
                    <p className="text-gray-800">Earn per delivery plus tips from customers</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-2xl">📱</div>
                  <div>
                    <h3 className="font-semibold text-lg">Easy to Use App</h3>
                    <p className="text-gray-800">Simple interface to manage your deliveries</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🎯</div>
                  <div>
                    <h3 className="font-semibold text-lg">Quick Approval</h3>
                    <p className="text-gray-800">Get approved and start earning in days</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/driver/register"
                  className="inline-block px-8 py-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold text-lg text-center shadow-lg"
                >
                  Sign Up to Drive
                </Link>
                <Link
                  to="/driver/login"
                  className="inline-block px-8 py-4 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors font-semibold text-lg text-center border-2 border-gray-900"
                >
                  Driver Login
                </Link>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border-2 border-white/20">
                <div className="text-6xl mb-4 text-center">🚗💨</div>
                <h3 className="text-2xl font-bold text-center mb-4">Join Our Team</h3>
                <div className="space-y-3 text-gray-800">
                  <p className="flex items-center gap-2">
                    <span className="text-xl">📋</span>
                    <span>Simple registration process</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-xl">🚘</span>
                    <span>Use your own vehicle</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-xl">📍</span>
                    <span>Deliver in your local area</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-xl">⭐</span>
                    <span>Build your driver rating</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Restaurants Section */}
      <div id="restaurants" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">🍽️ Featured Restaurants</h2>
            <p className="text-gray-600 mt-2">Order delicious African cuisine</p>
          </div>
          <Link
            to="/restaurants"
            className="text-green-600 hover:text-green-700 font-semibold flex items-center gap-2"
          >
            View All
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {restaurants.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((restaurant) => (
              <RestaurantCard key={restaurant.id} restaurant={restaurant} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-gray-600">No restaurants available yet.</p>
          </div>
        )}
      </div>

      {/* Call to Action */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 text-green-100">
            Join thousands of customers enjoying authentic African groceries and cuisine
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-block px-8 py-4 bg-white text-green-700 rounded-lg hover:bg-green-50 transition-colors font-semibold text-lg"
            >
              Create Account
            </Link>
            <Link
              to="/marketplace"
              className="inline-block px-8 py-4 bg-green-800 text-white rounded-lg hover:bg-green-900 transition-colors font-semibold text-lg border-2 border-white"
            >
              Start Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// Product Card Component
const ProductCard = ({ product }) => {
  const formatPrice = (price) => parseFloat(price).toFixed(2);

  return (
    <Link
      to={`/marketplace/product/${product.id}`}
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
    >
      <div className="relative h-56 bg-gray-100 overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.parentElement.innerHTML = `<div class="flex items-center justify-center h-full text-6xl">📦</div>`;
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
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2 group-hover:text-green-600 transition-colors">
          {product.name}
        </h3>

        {product.origin && (
          <p className="text-sm text-gray-500 mb-2">📍 {product.origin}</p>
        )}

        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-2xl font-bold text-green-600">${formatPrice(product.price)}</span>
            <span className="text-sm text-gray-500 ml-1">/ {product.unit}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

// Restaurant Card Component
const RestaurantCard = ({ restaurant }) => {
  return (
    <Link
      to={`/restaurants/${restaurant.id}`}
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
    >
      <div className="relative h-48 bg-gray-100 overflow-hidden">
        {restaurant.image_url ? (
          <img
            src={restaurant.image_url}
            alt={restaurant.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.parentElement.innerHTML = `<div class="flex items-center justify-center h-full text-6xl">🍽️</div>`;
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-6xl">🍽️</div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-xl font-semibold text-gray-800 mb-2 group-hover:text-green-600 transition-colors">
          {restaurant.name}
        </h3>

        {restaurant.address && (
          <p className="text-sm text-gray-600 mb-2">📍 {restaurant.address}</p>
        )}

        {restaurant.phone && (
          <p className="text-sm text-gray-600">📞 {restaurant.phone}</p>
        )}
      </div>
    </Link>
  );
};

export default HomePage;
