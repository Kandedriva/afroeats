import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "../context/CartContext";

function OrderSuccess() {
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchCart } = useCart();
  const orderId = searchParams.get('order_id');
  const sessionId = searchParams.get('session_id');
  const isDemo = searchParams.get('demo');

  useEffect(() => {
    const handleOrderSuccess = async () => {
      if (!orderId) {
        console.log("No order ID provided, redirecting to home");
        navigate('/');
        return;
      }

      try {
        if (sessionId && !isDemo) {
          // Handle real Stripe payment success
          console.log("Processing Stripe payment confirmation...");
          const res = await fetch(`http://localhost:5001/api/orders/success?session_id=${sessionId}&order_id=${orderId}`, {
            credentials: "include",
          });
          
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "Failed to confirm payment");
          }
        }

        // Get order details
        console.log("Fetching order details for order:", orderId);
        const orderRes = await fetch(`http://localhost:5001/api/orders/${orderId}`, {
          credentials: "include",
        });

        if (orderRes.ok) {
          const orderData = await orderRes.json();
          console.log("Order details retrieved:", orderData);
          setOrderDetails(orderData);
        } else {
          console.warn("Could not fetch order details");
        }

        // Refresh cart to reflect cleared state
        await fetchCart();
      } catch (err) {
        console.error("Order success handler error:", err);
        // Don't block the success page if we can't fetch details
        // The order was still successful
      } finally {
        setLoading(false);
      }
    };

    handleOrderSuccess();
  }, [orderId, sessionId, isDemo, navigate, fetchCart]);

  if (loading) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Confirming your order...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
          <span className="text-3xl">✅</span>
        </div>
        <h1 className="text-3xl font-bold text-green-800 mb-2">Order Confirmed!</h1>
        <p className="text-gray-600">
          Thank you for your order. Your food is being prepared!
        </p>
        {isDemo && (
          <div className="mt-4 inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
            Demo Mode - No actual payment processed
          </div>
        )}
      </div>

      {/* Order Details */}
      <div className="bg-white shadow-lg rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Order Details</h2>
        
        {orderDetails ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Order ID:</span>
              <span className="font-medium">#{orderId}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Amount:</span>
              <span className="font-bold text-lg text-green-600">
                ${Number(orderDetails.total || 0).toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600">Platform Fee:</span>
              <span className="text-sm text-gray-500">${Number(orderDetails.platform_fee || 1.20).toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600">Status:</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Confirmed
              </span>
            </div>

            {/* Order Items */}
            {orderDetails.items && orderDetails.items.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Order Items</h3>
                <div className="space-y-3">
                  {orderDetails.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.restaurant_name && (
                          <p className="text-sm text-gray-500">From: {item.restaurant_name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</p>
                        <p className="text-sm text-gray-500">${Number(item.price || 0).toFixed(2)} x {item.quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500">Order details not available</p>
          </div>
        )}
      </div>

      {/* What's Next */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-3">What's Next?</h3>
        <div className="space-y-2 text-blue-700">
          <div className="flex items-center">
            <span className="text-blue-600 mr-2">🍳</span>
            <span>Restaurants are preparing your order</span>
          </div>
          <div className="flex items-center">
            <span className="text-blue-600 mr-2">📧</span>
            <span>You'll receive updates via email</span>
          </div>
          <div className="flex items-center">
            <span className="text-blue-600 mr-2">🚚</span>
            <span>Delivery will be coordinated directly with restaurants</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <button
          onClick={() => navigate('/')}
          className="flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
        >
          Browse More Restaurants
        </button>
        <button
          onClick={() => navigate('/my-orders')}
          className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          View My Orders
        </button>
      </div>
    </div>
  );
}

export default OrderSuccess;