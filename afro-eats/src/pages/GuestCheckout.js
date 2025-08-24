import { useState, useEffect } from "react";
import { useGuest } from "../context/GuestContext";
import { useNavigate, Link } from "react-router-dom";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";

export default function GuestCheckout() {
  const { guestCart, guestTotal } = useGuest();
  const navigate = useNavigate();
  
  const [guestInfo, setGuestInfo] = useState({
    name: "",
    email: "",
    phone: "",
    address: ""
  });
  const [deliveryType, setDeliveryType] = useState("delivery"); // "delivery" or "pickup"
  const [orderDetails, setOrderDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [restaurantDetails, setRestaurantDetails] = useState(null);

  useEffect(() => {
    if (guestCart.length === 0) {
      navigate("/cart");
    }
  }, [guestCart.length, navigate]);

  // Fetch restaurant details to get delivery fee
  useEffect(() => {
    const fetchRestaurantDetails = async () => {
      if (guestCart.length > 0) {
        const restaurantId = guestCart[0].restaurantId;
        if (restaurantId) {
          try {
            const res = await fetch(`${API_BASE_URL}/api/restaurants/${restaurantId}`);
            if (res.ok) {
              const data = await res.json();
              setRestaurantDetails(data.restaurant);
            }
          } catch (err) {
            console.error('Error fetching restaurant details:', err);
          }
        }
      }
    };

    fetchRestaurantDetails();
  }, [guestCart]);

  const handleInputChange = (field, value) => {
    setGuestInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePlaceOrder = async () => {
    // Validation
    if (!guestInfo.name.trim()) {
      toast.warning("Please enter your name.");
      return;
    }
    
    if (!guestInfo.email.trim()) {
      toast.warning("Please enter your email address.");
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(guestInfo.email)) {
      toast.warning("Please enter a valid email address.");
      return;
    }
    
    if (!guestInfo.phone.trim()) {
      toast.warning("Please enter your phone number.");
      return;
    }
    
    if (deliveryType === "delivery" && !guestInfo.address.trim()) {
      toast.warning("Please enter your delivery address.");
      return;
    }

    setLoading(true);
    
    try {
      const cartWithRestaurantId = guestCart.map(item => ({
        ...item,
        restaurant_id: item.restaurantId
      }));

      const res = await fetch(`${API_BASE_URL}/api/orders/guest-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guestInfo,
          items: cartWithRestaurantId,
          orderDetails: orderDetails.trim() || null,
          deliveryType,
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        if (data.demo_mode) {
          // Demo mode - redirect to demo checkout
          navigate(`/demo-order-checkout?order_id=${data.order_id}`);
        } else {
          // Real Stripe checkout - redirect to Stripe
          // Don't clear cart here - it will be cleared after successful payment
          window.location.href = data.url;
        }
      } else {
        toast.error(`Checkout failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Guest checkout error:', err);
      toast.error("Something went wrong during checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals with delivery fee
  const subtotal = guestTotal;
  const platformFee = 1.20;
  const deliveryFee = (deliveryType === "delivery" && restaurantDetails?.delivery_fee) 
    ? parseFloat(restaurantDetails.delivery_fee) 
    : 0;
  const total = subtotal + platformFee + deliveryFee;

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white shadow rounded">
      <h2 className="text-2xl font-semibold mb-6">Guest Checkout</h2>
      
      {/* Guest Information Form */}
      <div className="mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-blue-600 text-xl">👤</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Ordering as Guest</h3>
              <p className="text-sm text-blue-700 mt-1">
                Want to save time on future orders? 
                <Link to="/register" className="font-medium text-blue-800 hover:text-blue-900 underline ml-1">
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </div>

        <h3 className="text-lg font-medium text-gray-800 mb-4">Contact Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              id="name"
              value={guestInfo.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter your full name"
              required
            />
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              value={guestInfo.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter your email address"
              required
            />
          </div>
        </div>
        
        <div className="mb-6">
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number *
          </label>
          <input
            type="tel"
            id="phone"
            value={guestInfo.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Enter your phone number"
            required
          />
        </div>
        
        {/* Delivery/Pickup Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Order Type</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setDeliveryType("delivery")}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                deliveryType === "delivery"
                  ? "border-green-500 bg-green-50 text-green-800"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center">
                <span className="text-2xl mr-3">🚚</span>
                <div>
                  <div className="font-medium">Delivery</div>
                  <div className="text-sm text-gray-600">Get your order delivered to your address</div>
                </div>
              </div>
            </button>
            
            <button
              type="button"
              onClick={() => setDeliveryType("pickup")}
              className={`p-4 border-2 rounded-lg text-left transition-all ${
                deliveryType === "pickup"
                  ? "border-green-500 bg-green-50 text-green-800"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center">
                <span className="text-2xl mr-3">🏪</span>
                <div>
                  <div className="font-medium">Pickup</div>
                  <div className="text-sm text-gray-600">Pick up your order from the restaurant</div>
                </div>
              </div>
            </button>
          </div>
        </div>
        
        {/* Delivery Address - Only show if delivery is selected */}
        {deliveryType === "delivery" && (
          <div className="mb-6">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Address *
            </label>
            <textarea
              id="address"
              value={guestInfo.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              rows="3"
              placeholder="Enter your full delivery address (street, city, state, zip code)"
              required
              maxLength={300}
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {guestInfo.address.length}/300 characters
            </div>
          </div>
        )}
      </div>

      {/* Order Summary */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Order Summary</h3>
        <ul className="divide-y">
          {guestCart.map((item) => (
            <li key={item.id} className="py-3 flex justify-between items-center">
              <div>
                <span className="font-medium">{item.name}</span>
                <span className="text-sm text-gray-500 ml-2">x {item.quantity}</span>
                <div className="text-sm text-gray-600">{item.restaurantName}</div>
              </div>
              <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Special Instructions */}
      <div className="mb-8">
        <label htmlFor="orderDetails" className="block text-sm font-medium text-gray-700 mb-2">
          Special Instructions (Optional)
        </label>
        <textarea
          id="orderDetails"
          value={orderDetails}
          onChange={(e) => setOrderDetails(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
          rows="3"
          placeholder="Add any special instructions for your order (e.g., no onions, extra spicy, delivery notes, etc.)"
          maxLength={500}
        />
        <div className="text-right text-xs text-gray-500 mt-1">
          {orderDetails.length}/500 characters
        </div>
      </div>

      {/* Total and Place Order */}
      <div className="border-t pt-6">
        {/* Order Summary Breakdown */}
        <div className="mb-6 space-y-2">
          <div className="flex justify-between text-gray-700">
            <span>Subtotal:</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>Platform Fee:</span>
            <span>${platformFee.toFixed(2)}</span>
          </div>
          {deliveryType === "delivery" && (
            <div className="flex justify-between text-gray-700">
              <span>Delivery Fee:</span>
              <span>${deliveryFee.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t pt-2 mt-2">
            <div className="flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={handlePlaceOrder}
          disabled={loading}
          className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
            loading
              ? 'bg-gray-400 cursor-not-allowed text-gray-700'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {loading ? 'Placing Order...' : 'Place Order'}
        </button>
        
        <p className="text-xs text-gray-500 text-center mt-3">
          By placing this order, you agree to receive order updates via email and SMS.
        </p>
      </div>
    </div>
  );
}