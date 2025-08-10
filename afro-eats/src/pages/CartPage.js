// React import removed as it's not needed in React 17+
import { useState, useEffect } from "react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useGuest } from "../context/GuestContext";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from 'react-toastify';

export default function CartPage() {
  const { cart, loading, updateQuantity, removeFromCart, clearCart, total } = useCart();
  const { user } = useAuth();
  const { startGuestSession } = useGuest();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [restaurantInstructions, setRestaurantInstructions] = useState({});

  // Handle checkout cancellation
  useEffect(() => {
    if (searchParams.get('canceled') === 'true') {
      toast.info("Checkout was canceled. Your cart items are still saved.");
      // Remove the canceled parameter from the URL
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  if (loading) {
    return <p className="text-center mt-10">Loading cart...</p>;
  }

  if (cart.length === 0) {
    return <p className="text-center mt-10 text-gray-600">Your cart is empty.</p>;
  }

  // ✅ Group items by restaurant
  const grouped = cart.reduce((groups, item) => {
    const restaurantName = item.restaurantName || "Unknown Restaurant";
    if (!groups[restaurantName]) {
      groups[restaurantName] = [];
    }
    groups[restaurantName].push(item);
    return groups;
  }, {});

  const handleCheckout = () => {
    if (user) {
      // Authenticated user - normal checkout flow
      navigate("/delivery-options", {
        state: { restaurantInstructions }
      });
    } else {
      // Guest checkout - show options
      const guestCheckoutConfirm = window.confirm(
        "You can checkout as a guest or create an account. Would you like to continue as guest? (Click OK for guest checkout, Cancel to login/register)"
      );
      
      if (guestCheckoutConfirm) {
        startGuestSession();
        navigate("/guest-checkout");
      } else {
        navigate("/login");
      }
    }
  };

  const handleGuestCheckout = () => {
    startGuestSession();
    navigate("/guest-checkout");
  };

  return (
    <div className="max-w-4xl mx-auto mt-4 sm:mt-10 p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Your Cart</h2>
      
      {/* Show cancellation notice if user just canceled checkout */}
      {searchParams.get('canceled') === 'true' && (
        <div className="mb-4 sm:mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-blue-600 text-lg">💳</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Checkout Canceled</h3>
              <p className="text-sm text-blue-700 mt-1">
                No worries! Your cart items are still here. Ready to try again?
              </p>
            </div>
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([restaurant, items]) => (
        <div key={restaurant} className="mb-6 sm:mb-8 bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg sm:text-xl font-semibold text-green-700 mb-3 sm:mb-4">
            🏪 {restaurant}
          </h3>

          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 pb-4 border-b border-gray-100 last:border-b-0"
            >
              <div className="mb-3 sm:mb-0">
                <p className="font-medium text-gray-800">{item.name}</p>
                <p className="text-sm text-gray-500">
                  ${Number(item.price || 0).toFixed(2)} each
                </p>
              </div>

              <div className="flex items-center justify-between sm:flex-col sm:items-end sm:space-y-2">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300 transition-colors touch-manipulation"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    -
                  </button>
                  <span className="font-medium text-lg w-8 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300 transition-colors touch-manipulation"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    +
                  </button>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-gray-800">
                    ${(Number(item.price || 0) * item.quantity).toFixed(2)}
                  </span>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 hover:bg-red-50 rounded transition-colors touch-manipulation"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Special Instructions for this restaurant */}
          <div className="mt-4 pt-4 border-t">
            <label htmlFor={`instructions-${restaurant.replace(/\s+/g, '-').toLowerCase()}`} className="block text-sm font-medium text-gray-700 mb-2">
              Special Instructions for {restaurant} (Optional)
            </label>
            <textarea
              id={`instructions-${restaurant.replace(/\s+/g, '-').toLowerCase()}`}
              value={restaurantInstructions[restaurant] || ""}
              onChange={(e) => setRestaurantInstructions(prev => ({
                ...prev,
                [restaurant]: e.target.value
              }))}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              rows="2"
              placeholder={`Add any special instructions for ${restaurant} (e.g., no onions, extra spicy, cooking preferences, etc.)`}
              maxLength={300}
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {(restaurantInstructions[restaurant] || "").length}/300 characters
            </div>
          </div>
        </div>
      ))}


      <div className="text-right mt-6">
        <p className="text-lg font-semibold">
          Total: ${Number(total).toFixed(2)}
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Platform fee ($1.20) will be added at checkout
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <button
            onClick={clearCart}
            className="px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors touch-manipulation font-medium"
            style={{ WebkitTapHighlightColor: 'transparent', minHeight: '44px' }}
          >
            Clear Cart
          </button>
          
          {user ? (
            <button
              onClick={handleCheckout}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors touch-manipulation"
              style={{ WebkitTapHighlightColor: 'transparent', minHeight: '44px' }}
            >
              Proceed to Checkout
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <span className="text-blue-600 text-xl">🛒</span>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">Ready to Checkout?</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      You can checkout as a guest or create an account for faster future orders.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleGuestCheckout}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors touch-manipulation"
                  style={{ WebkitTapHighlightColor: 'transparent', minHeight: '44px' }}
                >
                  Checkout as Guest
                </button>
                <Link 
                  to="/login"
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors touch-manipulation text-center"
                  style={{ WebkitTapHighlightColor: 'transparent', minHeight: '44px' }}
                >
                  Login & Checkout
                </Link>
              </div>
              
              <p className="text-xs text-gray-500 text-center">
                New customer? 
                <Link to="/register" className="text-green-600 hover:text-green-700 font-medium ml-1">
                  Create an account
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
