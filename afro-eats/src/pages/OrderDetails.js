// React import removed as it's not needed in React 17+
import { useState, useEffect, useContext, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";

function OrderDetails() {
  const [order, setOrder] = useState(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const [error, setError] = useState("");
  const [showRestaurantModal, setShowRestaurantModal] = useState(false);
  const [availableRestaurants, setAvailableRestaurants] = useState([]);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("quality_issue");
  const [refundDescription, setRefundDescription] = useState("");
  const [submittingRefund, setSubmittingRefund] = useState(false);
  const { user, loading: authLoading } = useContext(AuthContext);
  const { orderId } = useParams();
  const navigate = useNavigate();

  const fetchOrderDetails = useCallback(async () => {
    try {
      setOrderLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch order details");
      }

      const orderData = await res.json();
      setOrder(orderData);
    } catch (err) {
      setError(err.message);
    } finally {
      setOrderLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    // Component is now protected by ProtectedRoute, so user is guaranteed to exist
    if (user) {
      fetchOrderDetails();
    }
  }, [user, orderId, fetchOrderDetails]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'delivered': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pending Payment';
      case 'paid': return 'Payment Received - Being Prepared';
      case 'completed': return 'Ready for Pickup/Delivery';
      case 'cancelled': return 'Cancelled';
      case 'delivered': return 'Delivered';
      default: return status || 'Unknown';
    }
  };

  const handleCallSupport = () => {
    // Get unique restaurants from order items with their items
    const restaurants = order.items?.reduce((acc, item) => {
      if (item.restaurant_phone && !acc.find(r => r.phone === item.restaurant_phone)) {
        acc.push({
          name: item.restaurant_name,
          phone: item.restaurant_phone,
          items: order.items.filter(orderItem => orderItem.restaurant_name === item.restaurant_name)
        });
      }
      return acc;
    }, []) || [];
    
    if (restaurants.length === 1) {
      // Single restaurant - direct call
      window.location.href = `tel:${restaurants[0].phone}`;
    } else if (restaurants.length > 1) {
      // Multiple restaurants - show custom modal
      setAvailableRestaurants(restaurants);
      setShowRestaurantModal(true);
    } else {
      toast.error("Restaurant phone number not available");
    }
  };

  const callRestaurant = (phoneNumber) => {
    setShowRestaurantModal(false);
    window.location.href = `tel:${phoneNumber}`;
  };

  const closeRestaurantModal = () => {
    setShowRestaurantModal(false);
    setAvailableRestaurants([]);
  };

  const openRefundModal = () => {
    const maxRefund = Number(order.total || 0) - Number(order.refunded_amount || 0);
    setRefundAmount(maxRefund.toFixed(2));
    setRefundReason("quality_issue");
    setRefundDescription("");
    setShowRefundModal(true);
  };

  const closeRefundModal = () => {
    setShowRefundModal(false);
    setRefundAmount("");
    setRefundReason("quality_issue");
    setRefundDescription("");
  };

  const submitRefund = async () => {
    try {
      // Validate inputs
      const amount = parseFloat(refundAmount);
      const maxRefund = Number(order.total || 0) - Number(order.refunded_amount || 0);

      if (!amount || amount <= 0) {
        toast.error("Please enter a valid refund amount");
        return;
      }

      if (amount > maxRefund) {
        toast.error(`Refund amount cannot exceed $${maxRefund.toFixed(2)}`);
        return;
      }

      if (!refundDescription.trim()) {
        toast.error("Please provide a description for the refund request");
        return;
      }

      setSubmittingRefund(true);

      const res = await fetch(`${API_BASE_URL}/api/refunds/request`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: parseInt(orderId),
          amount,
          reason: refundReason,
          description: refundDescription,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to submit refund request");
      }

      await res.json();
      toast.success("Refund request submitted successfully! We'll review it shortly.");

      closeRefundModal();

      // Refresh order details to show updated refund status
      fetchOrderDetails();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmittingRefund(false);
    }
  };

  const canRequestRefund = () => {
    // Can request refund if order is paid and not fully refunded
    const isPaid = order.status === 'paid' || order.status === 'completed' || order.status === 'delivered';
    const refundedAmount = Number(order.refunded_amount || 0);
    const totalAmount = Number(order.total || 0);
    const hasRefundableAmount = refundedAmount < totalAmount;
    const notCancelled = order.status !== 'cancelled';

    return isPaid && hasRefundableAmount && notCancelled;
  };

  const getRefundStatusBadge = () => {
    if (!order.refund_status || order.refund_status === 'none') {
      return null;
    }

    const statusColors = {
      requested: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-orange-100 text-orange-800',
      full: 'bg-purple-100 text-purple-800',
      processing: 'bg-blue-100 text-blue-800',
    };

    const statusText = {
      requested: 'Refund Requested',
      partial: 'Partially Refunded',
      full: 'Fully Refunded',
      processing: 'Refund Processing',
    };

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.refund_status]}`}>
        {statusText[order.refund_status]}
      </span>
    );
  };

  if (authLoading || orderLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? "Checking authentication..." : "Loading order details..."}
          </p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Order Not Found</h2>
          <p className="text-red-600 mb-4">{error || "This order could not be found."}</p>
          <button
            onClick={() => navigate("/my-orders")}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Back to My Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Order #{order.id}</h1>
          <p className="text-gray-600">
            Placed on {new Date(order.created_at).toLocaleDateString()} at{' '}
            {new Date(order.created_at).toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => navigate("/my-orders")}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
        >
          ← Back to Orders
        </button>
      </div>

      {/* Order Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Order Status</h2>
          <div className="flex gap-2">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
              {getStatusText(order.status)}
            </span>
            {getRefundStatusBadge()}
          </div>
        </div>
        
        {/* Status Timeline */}
        <div className="flex items-center space-x-4 text-sm">
          <div className={`flex items-center ${order.created_at ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-3 h-3 rounded-full mr-2 ${order.created_at ? 'bg-green-600' : 'bg-gray-400'}`}></div>
            Order Placed
          </div>
          <div className="flex-1 h-px bg-gray-200"></div>
          <div className={`flex items-center ${order.paid_at ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-3 h-3 rounded-full mr-2 ${order.paid_at ? 'bg-green-600' : 'bg-gray-400'}`}></div>
            Payment Confirmed
          </div>
          <div className="flex-1 h-px bg-gray-200"></div>
          <div className={`flex items-center ${order.status === 'completed' || order.status === 'delivered' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-3 h-3 rounded-full mr-2 ${order.status === 'completed' || order.status === 'delivered' ? 'bg-green-600' : 'bg-gray-400'}`}></div>
            Completed
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Order Items</h2>
        <div className="space-y-4">
          {order.items && order.items.map((item) => (
            <div key={item.id} className="flex justify-between items-center py-3 border-b border-gray-100 last:border-b-0">
              <div className="flex-1">
                <h3 className="font-medium text-gray-800">{item.name}</h3>
                <p className="text-sm text-gray-500">
                  From: {item.restaurant_name || 'Restaurant'}
                </p>
                <p className="text-sm text-gray-600">
                  Quantity: {item.quantity}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-800">
                  ${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}
                </p>
                <p className="text-sm text-gray-500">
                  ${Number(item.price || 0).toFixed(2)} each
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Special Instructions */}
      {order.order_details && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Special Instructions</h2>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-gray-700 whitespace-pre-wrap">{order.order_details}</p>
          </div>
        </div>
      )}

      {/* Order Summary */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal:</span>
            <span className="text-gray-800">${(Number(order.total || 0) - Number(order.platform_fee || 0)).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Platform Fee:</span>
            <span className="text-gray-800">${Number(order.platform_fee || 0).toFixed(2)}</span>
          </div>
          {order.refunded_amount && Number(order.refunded_amount) > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Refunded:</span>
              <span>-${Number(order.refunded_amount).toFixed(2)}</span>
            </div>
          )}
          <div className="border-t pt-2 flex justify-between">
            <span className="font-semibold text-gray-800">Total:</span>
            <span className="font-semibold text-gray-800">${Number(order.total || 0).toFixed(2)}</span>
          </div>
          {order.refunded_amount && Number(order.refunded_amount) > 0 && (
            <div className="flex justify-between text-sm text-purple-600">
              <span className="font-medium">Net Amount:</span>
              <span className="font-medium">${(Number(order.total || 0) - Number(order.refunded_amount || 0)).toFixed(2)}</span>
            </div>
          )}
          {order.paid_at && (
            <div className="text-sm text-green-600 mt-2">
              ✅ Payment confirmed on {new Date(order.paid_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Need Help?</h2>
        
        {/* Restaurant Contact Info */}
        {order.items && order.items.length > 0 && (
          <div className="mb-4 p-3 bg-white rounded-lg border">
            <p className="text-sm text-gray-600 mb-2">Restaurant Contact{order.items.reduce((acc, item) => {
              if (item.restaurant_name && !acc.find(r => r.name === item.restaurant_name)) {
                acc.push({ name: item.restaurant_name, phone: item.restaurant_phone });
              }
              return acc;
            }, []).length > 1 ? 's' : ''}:</p>
            
            {order.items.reduce((acc, item) => {
              if (item.restaurant_name && !acc.find(r => r.name === item.restaurant_name)) {
                acc.push({ name: item.restaurant_name, phone: item.restaurant_phone });
              }
              return acc;
            }, []).map((restaurant, index) => (
              <div key={index} className={index > 0 ? 'mt-2 pt-2 border-t border-gray-100' : ''}>
                <p className="font-medium text-gray-800">{restaurant.name}</p>
                {restaurant.phone && (
                  <p className="text-sm text-blue-600">📞 {restaurant.phone}</p>
                )}
              </div>
            ))}
          </div>
        )}
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate("/")}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            Order Again
          </button>
          <button
            onClick={handleCallSupport}
            className={`px-4 py-2 rounded transition-colors ${
              order.items?.some(item => item.restaurant_phone)
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
            disabled={!order.items?.some(item => item.restaurant_phone)}
          >
            📞 Call Restaurant
          </button>
          {canRequestRefund() && (
            <button
              onClick={openRefundModal}
              className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors"
            >
              💰 Request Refund
            </button>
          )}
          <button
            onClick={() => navigate("/my-refunds")}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors"
          >
            View Refund Status
          </button>
        </div>
      </div>

      {/* Refund Request Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-orange-100 mb-4">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                Request Refund
              </h3>
              <p className="text-sm text-gray-600">
                Please provide details about your refund request. Our team will review it shortly.
              </p>
            </div>

            <div className="space-y-4 mb-6">
              {/* Refund Amount */}
              <div>
                <label htmlFor="refund-amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Refund Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 text-lg">$</span>
                  <input
                    id="refund-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={(Number(order.total || 0) - Number(order.refunded_amount || 0)).toFixed(2)}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Maximum refundable: ${(Number(order.total || 0) - Number(order.refunded_amount || 0)).toFixed(2)}
                </p>
              </div>

              {/* Refund Reason */}
              <div>
                <label htmlFor="refund-reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Refund
                </label>
                <select
                  id="refund-reason"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="quality_issue">Quality Issue</option>
                  <option value="wrong_item">Wrong Item Delivered</option>
                  <option value="late_delivery">Late Delivery</option>
                  <option value="item_unavailable">Item Unavailable</option>
                  <option value="customer_request">Changed My Mind</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="refund-description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <textarea
                  id="refund-description"
                  value={refundDescription}
                  onChange={(e) => setRefundDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                  placeholder="Please describe the issue in detail..."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Please provide specific details to help us process your request faster.
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">What happens next?</h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <ul className="list-disc list-inside space-y-1">
                        <li>Your request will be reviewed by our team</li>
                        <li>You&apos;ll receive an email confirmation</li>
                        <li>Refunds typically process within 5-7 business days</li>
                        <li>The money will return to your original payment method</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeRefundModal}
                disabled={submittingRefund}
                className="px-5 py-2.5 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitRefund}
                disabled={submittingRefund}
                className="px-5 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submittingRefund ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Submitting...
                  </>
                ) : (
                  "Submit Refund Request"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restaurant Selection Modal */}
      {showRestaurantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <span className="text-2xl">📞</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Choose Restaurant to Call
              </h3>
              <p className="text-sm text-gray-600">
                Your order contains items from multiple restaurants. Please select which restaurant you&apos;d like to contact for support.
              </p>
            </div>
            
            <div className="space-y-4 mb-6">
              {availableRestaurants.map((restaurant, index) => (
                <div
                  key={index}
                  onClick={() => callRestaurant(restaurant.phone)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      callRestaurant(restaurant.phone);
                    }
                  }}
                  role="button"
                  tabIndex="0"
                  aria-label={`Call ${restaurant.name} at ${restaurant.phone}`}
                  className="border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all duration-200 group"
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                          <span className="text-blue-600 font-semibold text-sm">
                            {restaurant.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 group-hover:text-blue-800">
                          {restaurant.name}
                        </p>
                        <p className="text-sm text-gray-500 group-hover:text-blue-600">
                          📞 {restaurant.phone}
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Show items from this restaurant */}
                  <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50 group-hover:bg-blue-25">
                    <p className="text-xs text-gray-600 mb-2 mt-2 font-medium">Your items from this restaurant:</p>
                    <div className="space-y-1">
                      {restaurant.items?.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex justify-between text-xs">
                          <span className="text-gray-700">{item.name} x{item.quantity}</span>
                          <span className="text-gray-600">${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={closeRestaurantModal}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderDetails;