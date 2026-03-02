// React import removed as it's not needed in React 17+
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";

export default function DeliveryOptions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { cart, total } = useCart();
  const [deliveryType, setDeliveryType] = useState(""); // "delivery" or "pickup"
  const [useRegisteredAddress, setUseRegisteredAddress] = useState(true);
  const [customAddress, setCustomAddress] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deliveryFeeData, setDeliveryFeeData] = useState(null);
  const [calculatingFee, setCalculatingFee] = useState(false);

  // Get restaurant-specific instructions from cart page
  const restaurantInstructions = location.state?.restaurantInstructions || {};

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    if (cart.length === 0) {
      navigate("/cart");
      return;
    }

    // Fetch user profile to get registered address
    fetchUserProfile();
  }, [user, cart, navigate]);

  const fetchUserProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setUserProfile(data.user);
        setCustomAddress(data.user.address || "");
        setCustomPhone(data.user.phone || "");
      }
    } catch (err) {
      toast.error("Failed to load profile information");
    } finally {
      setLoading(false);
    }
  };

  // Calculate delivery fee when delivery type or address changes
  useEffect(() => {
    if (deliveryType === "delivery" && cart.length > 0) {
      const address = useRegisteredAddress ? userProfile?.address : customAddress;
      if (address && address.trim()) {
        calculateDeliveryFee(address);
      }
    } else if (deliveryType === "pickup") {
      setDeliveryFeeData(null); // No delivery fee for pickup
    }
  }, [deliveryType, useRegisteredAddress, customAddress, userProfile, cart]);

  const calculateDeliveryFee = async (deliveryAddress) => {
    if (!deliveryAddress || !cart.length) {
      return;
    }

    setCalculatingFee(true);

    try {
      // Get restaurant ID from first cart item (assuming single restaurant per order)
      const restaurantId = cart[0].restaurantId || cart[0].restaurant_id;

      if (!restaurantId) {
        console.warn("No restaurant ID found in cart");
        setDeliveryFeeData(null);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/orders/calculate-delivery-fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          deliveryAddress
        })
      });

      if (res.ok) {
        const feeData = await res.json();
        setDeliveryFeeData(feeData);
        console.log("Delivery fee calculated:", feeData);
      } else {
        // Use fallback fee if calculation fails
        setDeliveryFeeData({
          deliveryFee: 5.00,
          estimated: true,
          fallback: true,
          message: "Using estimated delivery fee"
        });
      }
    } catch (err) {
      console.error("Failed to calculate delivery fee:", err);
      // Use fallback fee on error
      setDeliveryFeeData({
        deliveryFee: 5.00,
        estimated: true,
        fallback: true,
        message: "Using estimated delivery fee"
      });
    } finally {
      setCalculatingFee(false);
    }
  };

  const handleContinueToPayment = async () => {
    if (!deliveryType) {
      toast.error("Please select delivery or pickup option");
      return;
    }

    if (deliveryType === "delivery") {
      const finalAddress = useRegisteredAddress ? userProfile?.address : customAddress;
      const finalPhone = useRegisteredAddress ? userProfile?.phone : customPhone;

      if (!finalAddress || !finalPhone) {
        toast.error("Please provide delivery address and phone number");
        return;
      }
    }

    try {
      // Prepare delivery preferences
      const deliveryPreferences = {
        type: deliveryType,
        address: deliveryType === "delivery" ? 
          (useRegisteredAddress ? userProfile?.address : customAddress) : null,
        phone: deliveryType === "delivery" ? 
          (useRegisteredAddress ? userProfile?.phone : customPhone) : null,
        useRegisteredAddress: deliveryType === "delivery" ? useRegisteredAddress : false
      };

      // Create Stripe checkout session with delivery preferences
      const res = await fetch(`${API_BASE_URL}/api/orders/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          items: cart, 
          restaurantInstructions,
          deliveryPreferences
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create checkout session");
      }

      const { url } = await res.json();
      window.location.href = url; // Redirect to Stripe checkout
    } catch (err) {
      toast.error(`Failed to proceed to checkout: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="text-center mt-10">Loading...</div>;
  }

  if (!userProfile) {
    return <div className="text-center mt-10">Unable to load profile information</div>;
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6">
      <h2 className="text-2xl font-bold mb-6">Delivery Options</h2>
      
      {/* Order Summary */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <h3 className="font-semibold mb-3">Order Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal ({cart.length} item{cart.length !== 1 ? 's' : ''})</span>
            <span className="font-medium">${Number(total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Platform fee</span>
            <span className="font-medium">$1.20</span>
          </div>
          {deliveryType === "delivery" && deliveryFeeData && (
            <div className="flex justify-between">
              <span className="text-gray-600">
                Delivery fee
                {deliveryFeeData.distanceMiles > 0 && (
                  <span className="text-xs ml-1">({deliveryFeeData.distanceMiles} mi)</span>
                )}
                {deliveryFeeData.fallback && (
                  <span className="text-xs ml-1 text-yellow-600">(estimated)</span>
                )}
              </span>
              <span className="font-medium">${deliveryFeeData.deliveryFee.toFixed(2)}</span>
            </div>
          )}
          {deliveryType === "delivery" && calculatingFee && (
            <div className="flex justify-between">
              <span className="text-gray-600">Delivery fee</span>
              <span className="text-gray-500 text-xs">Calculating...</span>
            </div>
          )}
          {deliveryType === "pickup" && (
            <div className="flex justify-between">
              <span className="text-gray-600">Delivery fee</span>
              <span className="font-medium text-green-600">$0.00 (Pickup)</span>
            </div>
          )}
          <div className="pt-2 border-t border-gray-300 flex justify-between">
            <span className="font-semibold text-gray-800">Estimated Total</span>
            <span className="font-bold text-lg text-green-600">
              ${(
                Number(total) +
                1.20 +
                (deliveryType === "delivery" && deliveryFeeData ? deliveryFeeData.deliveryFee : 0)
              ).toFixed(2)}
            </span>
          </div>
        </div>

        {deliveryType === "delivery" && deliveryFeeData && deliveryFeeData.fallback && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
            ℹ️ {deliveryFeeData.message || "Using estimated delivery fee"}
          </div>
        )}
        
        {/* Show restaurant-specific instructions if any */}
        {Object.keys(restaurantInstructions).length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <h4 className="font-medium text-gray-700 mb-2">Special Instructions:</h4>
            {Object.entries(restaurantInstructions).map(([restaurant, instructions]) => 
              instructions.trim() && (
                <div key={restaurant} className="mb-2">
                  <p className="text-sm font-medium text-gray-600">🏪 {restaurant}:</p>
                  <p className="text-sm text-gray-500 ml-4 italic">&quot;{instructions}&quot;</p>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Delivery Type Selection */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">How would you like to receive your order?</h3>
        
        <div className="space-y-4">
          {/* Delivery Option */}
          <div 
            className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
              deliveryType === "delivery" 
                ? "border-green-500 bg-green-50" 
                : "border-gray-300 hover:border-gray-400"
            }`}
            onClick={() => setDeliveryType("delivery")}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setDeliveryType("delivery");
              }
            }}
            role="button"
            tabIndex="0"
            aria-label="Select delivery option"
          >
            <div className="flex items-center">
              <input
                type="radio"
                name="deliveryType"
                value="delivery"
                checked={deliveryType === "delivery"}
                onChange={(e) => setDeliveryType(e.target.value)}
                className="mr-3"
              />
              <div className="flex-1">
                <h4 className="font-medium">🚚 Delivery</h4>
                <p className="text-sm text-gray-600">Have your order delivered to your address</p>
                {deliveryType === "delivery" && deliveryFeeData && (
                  <p className="text-sm text-green-600 mt-1">
                    Delivery fee: ${deliveryFeeData.deliveryFee.toFixed(2)}
                    {deliveryFeeData.distanceMiles > 0 && ` (${deliveryFeeData.distanceMiles} miles)`}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Pickup Option */}
          <div 
            className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
              deliveryType === "pickup" 
                ? "border-green-500 bg-green-50" 
                : "border-gray-300 hover:border-gray-400"
            }`}
            onClick={() => setDeliveryType("pickup")}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setDeliveryType("pickup");
              }
            }}
            role="button"
            tabIndex="0"
            aria-label="Select pickup option"
          >
            <div className="flex items-center">
              <input
                type="radio"
                name="deliveryType"
                value="pickup"
                checked={deliveryType === "pickup"}
                onChange={(e) => setDeliveryType(e.target.value)}
                className="mr-3"
              />
              <div>
                <h4 className="font-medium">🏪 Pickup</h4>
                <p className="text-sm text-gray-600">Pick up your order from the restaurant</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Address Options (only show if delivery is selected) */}
      {deliveryType === "delivery" && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Delivery Address</h3>
          
          <div className="space-y-4">
            {/* Use Registered Address */}
            <div 
              className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                useRegisteredAddress 
                  ? "border-blue-500 bg-blue-50" 
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onClick={() => setUseRegisteredAddress(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setUseRegisteredAddress(true);
                }
              }}
              role="button"
              tabIndex="0"
              aria-label="Use registered address"
            >
              <div className="flex items-start">
                <input
                  type="radio"
                  name="addressOption"
                  checked={useRegisteredAddress}
                  onChange={() => setUseRegisteredAddress(true)}
                  className="mr-3 mt-1"
                />
                <div>
                  <h4 className="font-medium">📍 Use Registered Address</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>Address:</strong> {userProfile.address || "No address on file"}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Phone:</strong> {userProfile.phone || "No phone on file"}
                  </p>
                </div>
              </div>
            </div>

            {/* Use Custom Address */}
            <div 
              className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                !useRegisteredAddress 
                  ? "border-blue-500 bg-blue-50" 
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onClick={() => setUseRegisteredAddress(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setUseRegisteredAddress(false);
                }
              }}
              role="button"
              tabIndex="0"
              aria-label="Enter different address"
            >
              <div className="flex items-start">
                <input
                  type="radio"
                  name="addressOption"
                  checked={!useRegisteredAddress}
                  onChange={() => setUseRegisteredAddress(false)}
                  className="mr-3 mt-1"
                />
                <div className="flex-1">
                  <h4 className="font-medium">✏️ Use Different Address</h4>
                  
                  {!useRegisteredAddress && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label htmlFor="delivery-address" className="block text-sm font-medium text-gray-700 mb-1">
                          Delivery Address
                        </label>
                        <textarea
                          id="delivery-address"
                          value={customAddress}
                          onChange={(e) => setCustomAddress(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          rows="2"
                          placeholder="Enter complete delivery address..."
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="delivery-phone" className="block text-sm font-medium text-gray-700 mb-1">
                          Phone Number
                        </label>
                        <input
                          id="delivery-phone"
                          type="tel"
                          value={customPhone}
                          onChange={(e) => setCustomPhone(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter phone number for delivery..."
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <button
          onClick={() => navigate("/cart")}
          className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          ← Back to Cart
        </button>
        
        <button
          onClick={handleContinueToPayment}
          className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
          disabled={!deliveryType}
        >
          Continue to Payment →
        </button>
      </div>

      {/* Info Messages */}
      {deliveryType === "pickup" && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800">📋 Pickup Instructions</h4>
          <p className="text-sm text-yellow-700 mt-1">
            After payment, you&apos;ll receive order confirmation with pickup details. 
            Please bring a valid ID when picking up your order.
          </p>
        </div>
      )}

      {deliveryType === "delivery" && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-800">🚚 Delivery Information</h4>
          <p className="text-sm text-blue-700 mt-1">
            Estimated delivery time will be provided after order confirmation. 
            Please ensure someone is available at the delivery address.
          </p>
        </div>
      )}
    </div>
  );
}