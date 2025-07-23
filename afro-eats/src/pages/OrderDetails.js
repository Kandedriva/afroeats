import React, { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

function OrderDetails() {
  const [order, setOrder] = useState(null);
  const [orderLoading, setOrderLoading] = useState(true);
  const [error, setError] = useState("");
  const { user, loading: authLoading } = useContext(AuthContext);
  const { orderId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Don't redirect if auth is still loading
    if (authLoading) return;
    
    if (!user) {
      navigate("/login");
      return;
    }

    fetchOrderDetails();
  }, [user, authLoading, orderId, navigate]);

  const fetchOrderDetails = async () => {
    try {
      setOrderLoading(true);
      const res = await fetch(`http://localhost:5001/api/orders/${orderId}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch order details");
      }

      const orderData = await res.json();
      setOrder(orderData);
    } catch (err) {
      console.error("Fetch order details error:", err);
      setError(err.message);
    } finally {
      setOrderLoading(false);
    }
  };

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
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
            {getStatusText(order.status)}
          </span>
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
          <div className="border-t pt-2 flex justify-between">
            <span className="font-semibold text-gray-800">Total:</span>
            <span className="font-semibold text-gray-800">${Number(order.total || 0).toFixed(2)}</span>
          </div>
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
        <div className="flex space-x-4">
          <button
            onClick={() => navigate("/")}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
          >
            Order Again
          </button>
          <button
            onClick={() => alert("Customer support feature coming soon!")}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
}

export default OrderDetails;