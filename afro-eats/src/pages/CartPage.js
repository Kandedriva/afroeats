import React from "react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function CartPage() {
  const { cart, loading, updateQuantity, removeFromCart, clearCart, total } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

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

  const handleCheckout = async () => {
    if (!user) {
      alert("Please log in to checkout");
      navigate("/login");
      return;
    }

    try {
      // Create Stripe checkout session
      const res = await fetch("http://localhost:5001/api/orders/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items: cart }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create checkout session");
      }

      const { url } = await res.json();
      window.location.href = url; // Redirect to Stripe checkout
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Failed to proceed to checkout: " + err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-4">
      <h2 className="text-2xl font-bold mb-6">Your Cart</h2>

      {Object.entries(grouped).map(([restaurant, items]) => (
        <div key={restaurant} className="mb-8">
          <h3 className="text-xl font-semibold text-green-700 mb-4">
            🏪 {restaurant}
          </h3>

          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between mb-4 border-b pb-2"
            >
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-gray-500">
                  ${Number(item.price || 0).toFixed(2)} x {item.quantity}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  -
                </button>
                <span>{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  +
                </button>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="ml-4 text-red-500 hover:underline text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="text-right mt-6">
        <p className="text-lg font-semibold">
          Total: ${Number(total).toFixed(2)}
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Platform fee ($1.20) will be added at checkout
        </p>
        <div className="mt-4 space-x-3">
          <button
            onClick={clearCart}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear Cart
          </button>
          <button
            onClick={handleCheckout}
            className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
          >
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
