import React, { useState } from "react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';

export default function CartPage() {
  const { cart, loading, updateQuantity, removeFromCart, clearCart, total } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [restaurantInstructions, setRestaurantInstructions] = useState({});

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
    if (!user) {
      toast.warning("Please log in to checkout");
      navigate("/login");
      return;
    }

    // Navigate to delivery options page with restaurant-specific instructions
    navigate("/delivery-options", {
      state: { restaurantInstructions }
    });
  };

  return (
    <div className="max-w-4xl mx-auto mt-4 sm:mt-10 p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Your Cart</h2>

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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Special Instructions for {restaurant} (Optional)
            </label>
            <textarea
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
        <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={clearCart}
            className="px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors touch-manipulation font-medium"
            style={{ WebkitTapHighlightColor: 'transparent', minHeight: '44px' }}
          >
            Clear Cart
          </button>
          <button
            onClick={handleCheckout}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors touch-manipulation"
            style={{ WebkitTapHighlightColor: 'transparent', minHeight: '44px' }}
          >
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
