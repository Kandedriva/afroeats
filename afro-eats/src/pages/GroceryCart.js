import { Link, useNavigate } from "react-router-dom";
import { useGroceryCart } from "../context/GroceryCartContext";
import { toast } from "react-toastify";

const GroceryCart = () => {
  const navigate = useNavigate();
  const {
    groceryCart,
    updateGroceryQuantity,
    removeFromGroceryCart,
    clearGroceryCart,
    getGrocerySubtotal,
    getGroceryPlatformFee,
    getGroceryTotal,
  } = useGroceryCart();

  const handleQuantityChange = (productId, newQuantity) => {
    try {
      updateGroceryQuantity(productId, newQuantity);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRemove = (productId, productName) => {
    removeFromGroceryCart(productId);
    toast.success(`${productName} removed from cart`);
  };

  const handleClearCart = () => {
    if (window.confirm("Are you sure you want to clear your entire grocery cart?")) {
      clearGroceryCart();
      toast.success("Grocery cart cleared");
    }
  };

  const handleCheckout = () => {
    navigate("/grocery-checkout");
  };

  const subtotal = getGrocerySubtotal();
  const platformFee = getGroceryPlatformFee();
  const total = getGroceryTotal();

  if (groceryCart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-8xl mb-6">🛒</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Your Grocery Cart is Empty</h2>
          <p className="text-gray-600 mb-8">
            Start adding fresh produce, spices, and ingredients to your cart!
          </p>
          <Link
            to="/marketplace"
            className="inline-block px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg"
          >
            Browse Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">🥬 Grocery Cart</h1>
            <p className="text-gray-600">
              {groceryCart.length} {groceryCart.length === 1 ? "item" : "items"} in your cart
            </p>
          </div>
          <button
            onClick={handleClearCart}
            className="mt-4 sm:mt-0 px-4 py-2 text-red-600 hover:text-red-700 font-medium transition-colors"
          >
            Clear Cart
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {groceryCart.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onQuantityChange={handleQuantityChange}
                onRemove={handleRemove}
              />
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Order Summary</h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal ({groceryCart.length} items):</span>
                  <span className="font-semibold">${subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-gray-700">
                  <span>Platform Fee:</span>
                  <span className="font-semibold">${platformFee.toFixed(2)}</span>
                </div>

                <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg">
                  💡 Delivery fee will be calculated at checkout based on your address
                </div>

                <div className="border-t pt-4 flex justify-between text-lg font-bold text-gray-900">
                  <span>Total (before delivery):</span>
                  <span className="text-green-600">${total.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg mb-4"
              >
                Proceed to Checkout
              </button>

              <Link
                to="/marketplace"
                className="block text-center text-green-600 hover:text-green-700 font-medium"
              >
                ← Continue Shopping
              </Link>

              {/* Info Section */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="font-semibold text-gray-800 mb-3">✅ Benefits</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>🌱 Fresh, authentic ingredients</li>
                  <li>📦 Carefully packaged</li>
                  <li>🚚 Fast delivery</li>
                  <li>💳 Secure payment</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Cart Item Component
const CartItem = ({ item, onQuantityChange, onRemove }) => {
  const handleIncrement = () => {
    onQuantityChange(item.id, item.quantity + 1);
  };

  const handleDecrement = () => {
    if (item.quantity > 1) {
      onQuantityChange(item.id, item.quantity - 1);
    }
  };

  const handleInputChange = (e) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 1 && value <= item.stock_quantity) {
      onQuantityChange(item.id, value);
    }
  };

  const itemTotal = (item.price * item.quantity).toFixed(2);
  const isLowStock = item.quantity >= item.stock_quantity;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Product Image */}
        <div className="flex-shrink-0">
          <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.parentElement.innerHTML = `<div class="flex items-center justify-center h-full text-5xl">${
                    item.category === "vegetables"
                      ? "🥬"
                      : item.category === "fruits"
                      ? "🍎"
                      : item.category === "grains"
                      ? "🌾"
                      : item.category === "spices"
                      ? "🌶️"
                      : "📦"
                  }</div>`;
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-5xl">
                {item.category === "vegetables"
                  ? "🥬"
                  : item.category === "fruits"
                  ? "🍎"
                  : item.category === "grains"
                  ? "🌾"
                  : item.category === "spices"
                  ? "🌶️"
                  : "📦"}
              </div>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="flex-1">
          <div className="flex justify-between items-start mb-2">
            <div>
              <Link
                to={`/marketplace/product/${item.id}`}
                className="text-xl font-semibold text-gray-800 hover:text-green-600 transition-colors"
              >
                {item.name}
              </Link>
              <p className="text-gray-600 mt-1 capitalize">{item.category.replace("_", " ")}</p>
            </div>
            <button
              onClick={() => onRemove(item.id, item.name)}
              className="text-red-600 hover:text-red-700 p-2"
              title="Remove from cart"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>

          {/* Price per unit */}
          <div className="mb-4">
            <span className="text-2xl font-bold text-green-600">${item.price.toFixed(2)}</span>
            <span className="text-gray-600 ml-2">/ {item.unit}</span>
          </div>

          {/* Quantity Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-gray-700 font-medium">Quantity:</span>
              <div className="flex items-center border-2 border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={handleDecrement}
                  disabled={item.quantity <= 1}
                  className="px-4 py-2 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  -
                </button>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={handleInputChange}
                  className="w-16 text-center border-x-2 border-gray-300 py-2 font-semibold"
                  min="1"
                  max={item.stock_quantity}
                />
                <button
                  onClick={handleIncrement}
                  disabled={item.quantity >= item.stock_quantity}
                  className="px-4 py-2 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  +
                </button>
              </div>
              <span className="text-gray-600">{item.unit}</span>
            </div>

            {/* Item Total */}
            <div className="text-right">
              <div className="text-sm text-gray-600">Item Total</div>
              <div className="text-2xl font-bold text-gray-900">${itemTotal}</div>
            </div>
          </div>

          {/* Stock Warning */}
          {isLowStock && (
            <div className="mt-3 text-sm text-orange-600 font-medium">
              ⚠️ You&apos;ve reached the maximum available quantity
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroceryCart;
