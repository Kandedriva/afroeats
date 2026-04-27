// React import removed as it's not needed in React 17+
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useGroceryCart } from "../context/GroceryCartContext";
import { useAuth } from "../context/AuthContext";
import { useGuest } from "../context/GuestContext";
import { API_BASE_URL } from "../config/api";

function OrderSuccess() {
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Safely get context values with fallbacks
  const cartContext = useCart();
  const groceryCartContext = useGroceryCart();
  const authContext = useAuth();
  const guestContext = useGuest();

  const forceRefreshCart = cartContext?.forceRefreshCart;
  const clearCart = cartContext?.clearCart;
  const clearGroceryCart = groceryCartContext?.clearGroceryCart;
  const user = authContext?.user;
  const clearGuestCartAfterSuccessfulOrder = guestContext?.clearGuestCartAfterSuccessfulOrder;

  const orderId = searchParams.get('order_id');
  const sessionId = searchParams.get('session_id');
  const orderType = searchParams.get('type'); // 'grocery' or undefined (restaurant)
  const isDemo = searchParams.get('demo');
  const isGuestFromStripe = searchParams.get('guest') === 'true';

  // Check if this is a guest order from navigation state
  const guestOrderInfo = location.state;
  const isGroceryOrder = orderType === 'grocery';

  useEffect(() => {
    const handleOrderSuccess = async () => {
      try {
        // Reset error state
        setError(null);
        let finalOrderId = orderId;

        if (sessionId && !isDemo) {
          if (isGroceryOrder) {
            // For grocery orders, the order is already created by the webhook
            // We just need to verify the session
            try {
              const res = await fetch(`${API_BASE_URL}/api/grocery/verify-session?session_id=${sessionId}`, {
                credentials: "include",
              });

              if (res.ok) {
                const data = await res.json();
                finalOrderId = data.orderId;
              } else {
                // eslint-disable-next-line no-console
                console.warn('Failed to verify grocery session:', res.status);
              }
            } catch (verifyError) {
              // eslint-disable-next-line no-console
              console.error('Error verifying grocery session:', verifyError);
            }
          } else {
            // Handle restaurant order - this will create the order
            const res = await fetch(`${API_BASE_URL}/api/orders/success?session_id=${sessionId}`, {
              credentials: "include",
            });

            if (!res.ok) {
              const errorData = await res.json();
              throw new Error(errorData.error || "Failed to confirm payment");
            }

            const successData = await res.json();
            finalOrderId = successData.orderId;
          }
        }

        if (!finalOrderId) {
          // eslint-disable-next-line no-console
          console.warn('No order ID found, redirecting to home');
          try {
            navigate('/');
          } catch (navError) {
            // eslint-disable-next-line no-console
            console.error('Navigation error:', navError);
            window.location.href = '/';
          }
          return;
        }

        // Get order details
        // For grocery orders, the endpoint supports both authenticated and guest users
        // For restaurant orders, only authenticated users can access order details
        if (isGroceryOrder) {
          // Grocery orders: fetch details for both authenticated and guest users
          const endpoint = `${API_BASE_URL}/api/grocery/orders/${finalOrderId}`;
          try {
            const orderRes = await fetch(endpoint, {
              credentials: "include",
            });

            if (orderRes.ok) {
              const orderData = await orderRes.json();
              setOrderDetails(orderData);
            } else {
              // If we can't fetch details, set basic info from URL
              // eslint-disable-next-line no-console
              console.warn('Could not fetch order details, using basic info');
              setOrderDetails({
                id: finalOrderId,
                total: 0,
                subtotal: 0,
                delivery_fee: 0,
                platform_fee: 0,
                status: 'paid',
                items: []
              });
            }
          } catch (fetchError) {
            // eslint-disable-next-line no-console
            console.error('Error fetching grocery order details:', fetchError);
            // Set basic info so page doesn't crash
            setOrderDetails({
              id: finalOrderId,
              total: 0,
              subtotal: 0,
              delivery_fee: 0,
              platform_fee: 0,
              status: 'paid',
              items: []
            });
          }
        } else if (user && !isGuestFromStripe && !guestOrderInfo?.guestOrder) {
          // Restaurant orders: only authenticated users
          const endpoint = `${API_BASE_URL}/api/orders/${finalOrderId}`;
          const orderRes = await fetch(endpoint, {
            credentials: "include",
          });

          if (orderRes.ok) {
            const orderData = await orderRes.json();
            setOrderDetails(orderData);
          }
        } else if (guestOrderInfo?.guestOrder || isGuestFromStripe) {
          // Guest restaurant orders: set basic info
          setOrderDetails({
            id: finalOrderId,
            total: 0,
            subtotal: 0,
            delivery_fee: 0,
            platform_fee: 0,
            status: 'paid',
            items: []
          });
        }

        // Clear appropriate cart based on order type and user type
        try {
          if (user && !isGuestFromStripe) {
            if (isGroceryOrder) {
              // Clear grocery cart
              if (clearGroceryCart) {
                clearGroceryCart();
              }
            } else {
              // Authenticated user - clear restaurant cart
              if (clearCart) {
                await clearCart();
              }
              await new Promise(resolve => setTimeout(resolve, 500));
              if (forceRefreshCart) {
                await forceRefreshCart();
              }
            }
          } else if (isGuestFromStripe || guestOrderInfo?.guestOrder) {
            // Guest user - clear guest cart after successful order
            if (clearGuestCartAfterSuccessfulOrder) {
              clearGuestCartAfterSuccessfulOrder();
            }
          }
        } catch (cartError) {
          // eslint-disable-next-line no-console
          console.error('Error clearing cart:', cartError);
          // Don't block the success page if cart clearing fails
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Order success error:', err);
        setError(err.message || 'An error occurred');
        // Don't block the success page if we can't fetch details
        // The order was still successful - set minimal order info
        if (!orderDetails && (orderId || sessionId)) {
          setOrderDetails({
            id: orderId || 'unknown',
            status: 'paid',
            total: 0,
            subtotal: 0,
            delivery_fee: 0,
            platform_fee: 0,
            items: []
          });
        }
      } finally {
        setLoading(false);
      }
    };

    handleOrderSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, sessionId, isDemo, isGroceryOrder, isGuestFromStripe]);

  if (loading) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Confirming your order...</p>
      </div>
    );
  }

  // Show error state but still show success message
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('Order success page had errors, but order was still successful:', error);
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
          {isGroceryOrder
            ? "Thank you for your grocery order. We'll prepare it for delivery!"
            : "Thank you for your order. Your food is being prepared!"}
        </p>
        {(guestOrderInfo?.guestOrder || isGuestFromStripe) && (
          <div className="mt-4 inline-block bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">
            Guest Order - Updates will be sent to your email
          </div>
        )}
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
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Order Number:</span>
              <span className="font-semibold text-lg">#{orderDetails.id}</span>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-2 py-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">${Number(orderDetails.subtotal || 0).toFixed(2)}</span>
              </div>

              {orderDetails.delivery_fee !== undefined && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Delivery Fee:</span>
                  <span className="font-medium">${Number(orderDetails.delivery_fee || 0).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Platform Fee:</span>
                <span className="font-medium">${Number(orderDetails.platform_fee || 0).toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-gray-800 font-semibold">Total Amount:</span>
                <span className="font-bold text-xl text-green-600">
                  ${Number(orderDetails.total || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <span className="text-gray-600">Status:</span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                ✓ Confirmed
              </span>
            </div>

            {/* Delivery Address for Grocery Orders */}
            {isGroceryOrder && orderDetails.delivery_address && (
              <div className="pt-3 border-t">
                <h3 className="font-semibold text-gray-700 mb-2">Delivery Address</h3>
                <div className="text-gray-600 text-sm space-y-1">
                  <p className="font-medium">{orderDetails.delivery_name}</p>
                  <p>{orderDetails.delivery_address}</p>
                  <p>
                    {orderDetails.delivery_city}
                    {orderDetails.delivery_state && `, ${orderDetails.delivery_state}`}
                    {orderDetails.delivery_zip && ` ${orderDetails.delivery_zip}`}
                  </p>
                  {orderDetails.delivery_phone && (
                    <p className="mt-2">Phone: {orderDetails.delivery_phone}</p>
                  )}
                </div>
              </div>
            )}

            {/* Order Items */}
            {orderDetails.items && orderDetails.items.length > 0 && (
              <div className="pt-4 border-t">
                <h3 className="text-lg font-semibold mb-3">Order Items</h3>
                <div className="space-y-3">
                  {orderDetails.items.map((item, index) => {
                    // Support both grocery and restaurant order item formats
                    const itemName = item.product_name || item.name;
                    const itemPrice = Number(item.unit_price || item.price || 0);
                    const itemQuantity = Number(item.quantity || 0);
                    const itemUnit = item.unit || '';
                    const itemTotal = Number(item.total_price || (itemPrice * itemQuantity));

                    return (
                      <div key={index} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">{itemName}</p>
                          {item.restaurant_name && (
                            <p className="text-sm text-gray-500">From: {item.restaurant_name}</p>
                          )}
                          {itemUnit && (
                            <p className="text-xs text-gray-400 mt-1">Unit: {itemUnit}</p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-semibold text-gray-800">${itemTotal.toFixed(2)}</p>
                          <p className="text-sm text-gray-500">
                            ${itemPrice.toFixed(2)} × {itemQuantity}
                          </p>
                        </div>
                      </div>
                    );
                  })}
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
        <h3 className="text-lg font-semibold text-blue-800 mb-3">What&apos;s Next?</h3>
        <div className="space-y-2 text-blue-700">
          {isGroceryOrder ? (
            <>
              <div className="flex items-center">
                <span className="text-blue-600 mr-2">📦</span>
                <span>Your grocery order is being prepared</span>
              </div>
              <div className="flex items-center">
                <span className="text-blue-600 mr-2">📧</span>
                <span>You&apos;ll receive updates via email</span>
              </div>
              <div className="flex items-center">
                <span className="text-blue-600 mr-2">🚚</span>
                <span>Your order will be delivered to your address</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center">
                <span className="text-blue-600 mr-2">🍳</span>
                <span>Restaurants are preparing your order</span>
              </div>
              <div className="flex items-center">
                <span className="text-blue-600 mr-2">📧</span>
                <span>You&apos;ll receive updates via email</span>
              </div>
              <div className="flex items-center">
                <span className="text-blue-600 mr-2">🚚</span>
                <span>Delivery will be coordinated directly with restaurants</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <button
          onClick={async () => {
            if (isGroceryOrder) {
              if (clearGroceryCart) {
                clearGroceryCart(); // Ensure grocery cart is cleared
              }
            } else {
              if (clearCart) {
                await clearCart(); // Ensure restaurant cart is cleared
              }
              if (forceRefreshCart) {
                await forceRefreshCart(); // Ensure cart is refreshed
              }
            }
            navigate('/');
          }}
          className="flex-1 bg-gray-200 text-gray-800 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
        >
          {isGroceryOrder ? 'Browse More Products' : 'Browse More Restaurants'}
        </button>
        {(guestOrderInfo?.guestOrder || isGuestFromStripe) ? (
          <button
            onClick={() => navigate('/register')}
            className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            Create Account for Future Orders
          </button>
        ) : (
          <button
            onClick={() => navigate('/my-orders')}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            View My Orders
          </button>
        )}
      </div>
    </div>
  );
}

export default OrderSuccess;