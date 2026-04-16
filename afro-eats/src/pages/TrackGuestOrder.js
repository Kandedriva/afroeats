import { useState } from "react";
import { API_BASE_URL } from "../config/api";
import { toast } from "react-toastify";

const TrackGuestOrder = () => {
  const [formData, setFormData] = useState({
    orderId: "",
    email: "",
  });
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [orderType, setOrderType] = useState("restaurant"); // 'restaurant' or 'grocery'

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.orderId || !formData.email) {
      toast.error("Please enter both Order ID and Email");
      return;
    }

    setLoading(true);
    setOrderDetails(null);

    try {
      // Try restaurant order first
      let res = await fetch(`${API_BASE_URL}/api/orders/guest-track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: formData.orderId,
          email: formData.email,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOrderDetails(data);
        setOrderType("restaurant");
        toast.success("Order found!");
        return;
      }

      // If not found as restaurant order, try grocery order
      res = await fetch(`${API_BASE_URL}/api/grocery/guest-track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: formData.orderId,
          email: formData.email,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setOrderDetails(data);
        setOrderType("grocery");
        toast.success("Order found!");
      } else {
        const error = await res.json();
        toast.error(error.error || "Order not found");
      }
    } catch (err) {
      toast.error("Failed to track order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      pending: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      confirmed: "bg-blue-100 text-blue-800",
      preparing: "bg-purple-100 text-purple-800",
      ready: "bg-indigo-100 text-indigo-800",
      out_for_delivery: "bg-orange-100 text-orange-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return statusColors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusText = (status) => {
    const statusText = {
      pending: "Pending",
      paid: "Paid",
      confirmed: "Confirmed",
      preparing: "Preparing",
      ready: "Ready for Pickup",
      out_for_delivery: "Out for Delivery",
      delivered: "Delivered",
      cancelled: "Cancelled",
    };
    return statusText[status] || status;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Track Your Order
          </h1>
          <p className="text-gray-600">
            Enter your order details below to track your order status
          </p>
        </div>

        {/* Tracking Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="orderId"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Order ID
              </label>
              <input
                type="text"
                id="orderId"
                name="orderId"
                value={formData.orderId}
                onChange={handleInputChange}
                placeholder="e.g., 123"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                You can find your Order ID in your confirmation email
              </p>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="your.email@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
              <p className="mt-1 text-sm text-gray-500">
                Enter the email address used when placing the order
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Tracking Order...
                </>
              ) : (
                <>🔍 Track Order</>
              )}
            </button>
          </form>
        </div>

        {/* Order Details */}
        {orderDetails && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              Order Details
            </h2>

            {/* Order Header */}
            <div className="border-b pb-4 mb-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-700">
                    Order #{orderDetails.id}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {orderType === "grocery" ? "Grocery Order" : "Food Order"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Placed on:{" "}
                    {new Date(orderDetails.created_at).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </p>
                </div>
                <span
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(
                    orderDetails.status
                  )}`}
                >
                  {getStatusText(orderDetails.status)}
                </span>
              </div>
            </div>

            {/* Order Items */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">
                Items
              </h3>
              <div className="space-y-3">
                {orderDetails.items && orderDetails.items.map((item, index) => {
                  const itemName = item.product_name || item.name;
                  const itemPrice = Number(item.unit_price || item.price || 0);
                  const itemQuantity = Number(item.quantity || 0);
                  const itemUnit = item.unit || "";
                  const itemTotal = Number(
                    item.total_price || itemPrice * itemQuantity
                  );

                  return (
                    <div
                      key={index}
                      className="flex justify-between items-start py-3 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{itemName}</p>
                        {item.restaurant_name && (
                          <p className="text-sm text-gray-500">
                            From: {item.restaurant_name}
                          </p>
                        )}
                        {itemUnit && (
                          <p className="text-xs text-gray-400 mt-1">
                            Unit: {itemUnit}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-semibold text-gray-800">
                          ${itemTotal.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-500">
                          ${itemPrice.toFixed(2)} × {itemQuantity}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="border-t pt-4 mb-6">
              <div className="space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span>${Number(orderDetails.subtotal || 0).toFixed(2)}</span>
                </div>

                {orderDetails.delivery_fee !== undefined && (
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery Fee:</span>
                    <span>
                      ${Number(orderDetails.delivery_fee || 0).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-gray-600">
                  <span>Platform Fee:</span>
                  <span>
                    ${Number(orderDetails.platform_fee || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
                  <span>Total:</span>
                  <span className="text-green-600">
                    ${Number(orderDetails.total || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            {orderDetails.delivery_address && (
              <div className="border-t pt-4">
                <h3 className="font-semibold text-gray-700 mb-2">
                  Delivery Address
                </h3>
                <div className="text-gray-600 text-sm space-y-1">
                  <p className="font-medium">{orderDetails.delivery_name || orderDetails.guest_name}</p>
                  <p>{orderDetails.delivery_address}</p>
                  <p>
                    {orderDetails.delivery_city}
                    {orderDetails.delivery_state &&
                      `, ${orderDetails.delivery_state}`}
                    {orderDetails.delivery_zip &&
                      ` ${orderDetails.delivery_zip}`}
                  </p>
                  {orderDetails.delivery_phone && (
                    <p className="mt-2">Phone: {orderDetails.delivery_phone}</p>
                  )}
                </div>
              </div>
            )}

            {/* Special Instructions */}
            {(orderDetails.notes || orderDetails.special_instructions) && (
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold text-gray-700 mb-2">
                  Special Instructions
                </h3>
                <p className="text-gray-600 text-sm">
                  {orderDetails.notes || orderDetails.special_instructions}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Need Help?
          </h3>
          <p className="text-blue-800 text-sm mb-4">
            If you have any questions about your order, please contact our
            support team.
          </p>
          <div className="space-y-2 text-sm text-blue-700">
            <p>📧 Email: support@orderdabaly.com</p>
            <p>📞 Phone: +1 (855) 914-8543</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackGuestOrder;
