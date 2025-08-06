// React import removed as it's not needed in React 17+
import { useState, useEffect } from "react";
import PropTypes from 'prop-types';
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";

export default function Checkout({ user }) {
  const { cart, clearCart } = useCart();
  const navigate = useNavigate();
  const [orderDetails, setOrderDetails] = useState("");
  const [currentAddress, setCurrentAddress] = useState("");
  const [currentPhone, setCurrentPhone] = useState("");
  const [useRegisteredAddress, setUseRegisteredAddress] = useState(false);
  const [useRegisteredPhone, setUseRegisteredPhone] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Fetch user information on component mount
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (user) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
            credentials: "include",
          });
          if (res.ok) {
            const userData = await res.json();
            setUserInfo(userData);
            // Set defaults based on whether user has registered info
            if (userData.address) {
              setUseRegisteredAddress(true);
            }
            if (userData.phone) {
              setUseRegisteredPhone(true);
            }
          }
        } catch (err) {
          // Handle error silently
        }
      }
    };

    fetchUserInfo();
  }, [user]);

  const handlePlaceOrder = async () => {
    if (!user) {
      toast.warning("Please login to place an order.");
      return;
    }

    if (cart.length === 0) {
      toast.warning("Your cart is empty.");
      return;
    }

    // Validate address if not using registered address
    if (!useRegisteredAddress && !currentAddress.trim()) {
      toast.warning("Please enter your current address or use your registered address.");
      return;
    }

    // Validate phone if not using registered phone  
    if (!useRegisteredPhone && !currentPhone.trim()) {
      toast.warning("Please enter your current phone number or use your registered phone.");
      return;
    }

    try {
      // Add restaurant_id to cart items for backend processing
      const cartWithRestaurantId = cart.map(item => ({
        ...item,
        restaurant_id: item.restaurantId
      }));

      const res = await fetch(`${API_BASE_URL}/api/orders/checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          items: cartWithRestaurantId,
          orderDetails: orderDetails.trim() || null,
          deliveryAddress: useRegisteredAddress ? null : currentAddress.trim(),
          deliveryPhone: useRegisteredPhone ? null : currentPhone.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.demo_mode) {
          // Demo mode - redirect to demo checkout (cart will be cleared after payment)
          navigate(`/demo-order-checkout?order_id=${data.order_id}`);
        } else {
          // Real Stripe checkout - redirect to Stripe (cart will be cleared after payment)
          window.location.href = data.url;
        }
      } else {
        if (data.fallback_to_demo && data.missing_connect_accounts) {
          const restaurantNames = data.missing_connect_accounts.map(r => r.name).join(', ');
          toast.error(`Payment failed: ${restaurantNames} haven't connected their Stripe accounts yet. Using demo mode instead.`);
          
          // Fall back to demo mode
          const demoRes = await fetch(`${API_BASE_URL}/api/orders`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              userId: user.id,
              items: cart,
              orderDetails: orderDetails.trim() || null,
              deliveryAddress: useRegisteredAddress ? null : currentAddress.trim(),
              deliveryPhone: useRegisteredPhone ? null : currentPhone.trim(),
            }),
          });
          
          if (demoRes.ok) {
            await demoRes.json();
            clearCart();
            toast.success("Order placed successfully in demo mode!");
            navigate("/");
          }
        } else {
          toast.error(`Checkout failed: ${data.error}`);
        }
      }
    } catch (err) {
      toast.error("Something went wrong during checkout.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white shadow rounded">
      <h2 className="text-2xl font-semibold mb-4">Order Summary</h2>
      {cart.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          <ul className="divide-y">
            {cart.map((item) => (
              <li key={item.id} className="py-3 flex justify-between">
                <span>{item.name} x {item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          
          {/* Delivery Address Section */}
          <div className="mt-6 border-t pt-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Delivery Address</h3>
            
            {userInfo && userInfo.address && (
              <div className="mb-4">
                <div className="flex items-center space-x-3">
                  <input
                    id="useRegisteredAddress"
                    type="radio"
                    name="addressOption"
                    checked={useRegisteredAddress}
                    onChange={() => setUseRegisteredAddress(true)}
                    className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                  />
                  <div>
                    <label htmlFor="useRegisteredAddress" className="text-sm font-medium text-gray-700 cursor-pointer">Use my registered address</label>
                    <p className="text-sm text-gray-500 mt-1">{userInfo.address}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mb-4">
              <label htmlFor="useDifferentAddress" className="flex items-start space-x-3">
                <input
                  id="useDifferentAddress"
                  type="radio"
                  name="addressOption"
                  checked={!useRegisteredAddress}
                  onChange={() => setUseRegisteredAddress(false)}
                  className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500 mt-1"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-700">
                    {userInfo && userInfo.address ? "Use different address for this order" : "Enter delivery address"}
                  </span>
                  {!useRegisteredAddress && (
                    <textarea
                      value={currentAddress}
                      onChange={(e) => setCurrentAddress(e.target.value)}
                      className="w-full mt-2 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                      rows="3"
                      placeholder="Enter your current delivery address (street, city, state, zip code)"
                      maxLength={300}
                    />
                  )}
                  {!useRegisteredAddress && (
                    <div className="text-right text-xs text-gray-500 mt-1">
                      {currentAddress.length}/300 characters
                    </div>
                  )}
                </div>
              </label>
            </div>

            {!userInfo?.address && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-yellow-600">⚠️</span>
                  </div>
                  <div className="ml-2">
                    <p className="text-sm text-yellow-700">
                      No registered address found. Please enter your delivery address above.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Delivery Phone Section */}
          <div className="mt-6 border-t pt-6">
            <h3 className="text-lg font-medium text-gray-800 mb-4">Contact Phone</h3>
            
            {userInfo && userInfo.phone && (
              <div className="mb-4">
                <div className="flex items-center space-x-3">
                  <input
                    id="useRegisteredPhone"
                    type="radio"
                    name="phoneOption"
                    checked={useRegisteredPhone}
                    onChange={() => setUseRegisteredPhone(true)}
                    className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                  />
                  <div>
                    <label htmlFor="useRegisteredPhone" className="text-sm font-medium text-gray-700 cursor-pointer">Use my registered phone</label>
                    <p className="text-sm text-gray-500 mt-1">{userInfo.phone}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mb-4">
              <label htmlFor="useDifferentPhone" className="flex items-start space-x-3">
                <input
                  id="useDifferentPhone"
                  type="radio"
                  name="phoneOption"
                  checked={!useRegisteredPhone}
                  onChange={() => setUseRegisteredPhone(false)}
                  className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500 mt-1"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-700">
                    {userInfo && userInfo.phone ? "Use different phone for this order" : "Enter contact phone"}
                  </span>
                  {!useRegisteredPhone && (
                    <input
                      type="tel"
                      value={currentPhone}
                      onChange={(e) => setCurrentPhone(e.target.value)}
                      className="w-full mt-2 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter your phone number for delivery contact"
                      maxLength={20}
                    />
                  )}
                </div>
              </label>
            </div>

            {!userInfo?.phone && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-yellow-600">⚠️</span>
                  </div>
                  <div className="ml-2">
                    <p className="text-sm text-yellow-700">
                      No registered phone found. Please enter your contact phone above.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-6">
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

          <div className="mt-6 flex justify-between font-bold text-lg">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <button
            onClick={handlePlaceOrder}
            className="mt-6 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 w-full"
          >
            Place Order
          </button>
        </>
      )}
    </div>
  );
}

Checkout.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    email: PropTypes.string,
    address: PropTypes.string,
    phone_number: PropTypes.string,
  }),
};
