/* eslint-disable jsx-a11y/label-has-associated-control */
import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { useGroceryCart } from "../context/GroceryCartContext";
import { AuthContext } from "../context/AuthContext";
import { API_BASE_URL } from "../config/api";
import { toast } from "react-toastify";

const GroceryCheckout = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const {
    groceryCart,
    getGrocerySubtotal,
    getGroceryPlatformFee,
  } = useGroceryCart();

  const [loading, setLoading] = useState(false);
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(null);
  const [deliveryInfo, setDeliveryInfo] = useState(null);

  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    notes: "",
  });

  // Redirect if cart is empty (but allow returning from cancelled Stripe checkout)
  useEffect(() => {
    // Check if user is returning from a cancelled Stripe checkout
    const urlParams = new URLSearchParams(window.location.search);
    const cancelled = urlParams.get('cancelled');

    if (groceryCart.length === 0 && !cancelled) {
      toast.error("Your grocery cart is empty");
      navigate("/marketplace");
    } else if (cancelled) {
      toast.info("Payment was cancelled. Your cart is still available.");
      // Remove the cancelled param from URL
      window.history.replaceState({}, '', '/grocery-checkout');
    }
  }, [groceryCart, navigate]);

  // Pre-fill user data
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
      }));
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCalculateDeliveryFee = async () => {
    // Validate address fields
    if (!formData.address || !formData.city || !formData.state) {
      toast.error("Please enter your complete delivery address");
      return;
    }

    try {
      setCalculatingFee(true);

      const fullAddress = `${formData.address}, ${formData.city}, ${formData.state} ${formData.zipCode}`;

      // Call backend to calculate delivery fee
      // Note: This will use the first product's category to determine a "warehouse" location
      // In production, you'd have actual warehouse/store locations
      const res = await fetch(`${API_BASE_URL}/api/grocery/calculate-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          deliveryAddress: fullAddress,
          items: groceryCart.map((item) => ({
            id: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to calculate delivery fee");
      }

      const data = await res.json();
      setDeliveryFee(data.delivery_fee);
      setDeliveryInfo(data);

      toast.success(`Delivery fee calculated: $${data.delivery_fee.toFixed(2)}`);
    } catch (err) {
      toast.error(err.message);
      // Set fallback delivery fee
      setDeliveryFee(5.0);
      setDeliveryInfo({
        delivery_fee: 5.0,
        distance_miles: 0,
        estimated: true,
      });
    } finally {
      setCalculatingFee(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.name || !formData.email || !formData.phone) {
      toast.error("Please fill in all contact information");
      return;
    }

    if (!formData.address || !formData.city || !formData.state) {
      toast.error("Please fill in all delivery address fields");
      return;
    }

    if (deliveryFee === null) {
      toast.error("Please calculate delivery fee first");
      return;
    }

    // Guest checkout is allowed - no login required

    try {
      setLoading(true);

      const subtotal = getGrocerySubtotal();
      const platformFee = getGroceryPlatformFee();
      const total = subtotal + platformFee + deliveryFee;

      // Create grocery order (supports both authenticated and guest users)
      const res = await fetch(`${API_BASE_URL}/api/grocery/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items: groceryCart,
          deliveryAddress: {
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zipCode: formData.zipCode,
            name: formData.name,
            phone: formData.phone,
            email: formData.email, // Include email in delivery address
          },
          notes: formData.notes,
          subtotal,
          platformFee,
          deliveryFee,
          total,
          deliveryInfo,
          guestEmail: !user ? formData.email : undefined, // For guest checkout
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create order");
      }

      const { sessionUrl } = await res.json();

      // DON'T clear cart here - only clear after successful payment on OrderSuccess page
      // This allows users to return to checkout if they cancel payment

      // Redirect to Stripe checkout
      window.location.href = sessionUrl;
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const subtotal = getGrocerySubtotal();
  const platformFee = getGroceryPlatformFee();
  const total = subtotal + platformFee + (deliveryFee || 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Checkout</h1>
          <p className="text-gray-600">Complete your grocery order</p>
          {!user && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <span className="text-blue-600 text-xl">ℹ️</span>
              <div>
                <p className="text-sm text-blue-800 font-medium">Guest Checkout Available</p>
                <p className="text-sm text-blue-700 mt-1">
                  You can checkout as a guest, or{" "}
                  <a href="/login" className="underline font-semibold hover:text-blue-900">
                    log in
                  </a>{" "}
                  /{" "}
                  <a href="/register" className="underline font-semibold hover:text-blue-900">
                    create an account
                  </a>{" "}
                  to track your orders.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Contact Information */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Contact Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Delivery Address</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Street Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="123 Main Street"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        City <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="New York"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        State <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="state"
                        value={formData.state}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="NY"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ZIP Code
                      </label>
                      <input
                        type="text"
                        name="zipCode"
                        value={formData.zipCode}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="10001"
                      />
                    </div>
                  </div>

                  {!deliveryInfo && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                      <p className="text-sm text-blue-800 text-center font-medium">
                        ℹ️ Calculate your delivery fee to proceed with checkout
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleCalculateDeliveryFee}
                    disabled={calculatingFee || !formData.address || !formData.city || !formData.state}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                  >
                    {calculatingFee ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Calculating...
                      </>
                    ) : (
                      <>📍 Calculate Delivery Fee</>
                    )}
                  </button>

                  {deliveryInfo && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-green-600 font-semibold">✓ Delivery Fee Calculated</span>
                      </div>
                      <div className="text-sm text-gray-700 space-y-1">
                        {deliveryInfo.distance_miles > 0 && (
                          <p>Distance: {deliveryInfo.distance_miles} miles</p>
                        )}
                        <p className="font-semibold text-lg text-green-700">
                          Delivery Fee: ${deliveryFee.toFixed(2)}
                        </p>
                        {deliveryInfo.estimated && (
                          <p className="text-gray-600 text-xs">* Estimated delivery fee</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Notes */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Order Notes (Optional)</h2>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  placeholder="Any special instructions for delivery..."
                />
              </div>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Order Summary</h2>

              {/* Items */}
              <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
                {groceryCart.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-gray-600">
                        {item.quantity} {item.unit} × ${item.price.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-semibold text-gray-900">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal:</span>
                  <span className="font-semibold">${subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-gray-700">
                  <span>Platform Fee:</span>
                  <span className="font-semibold">${platformFee.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-gray-700">
                  <span>Delivery Fee:</span>
                  <span className="font-semibold">
                    {deliveryFee !== null ? `$${deliveryFee.toFixed(2)}` : "Calculate above"}
                  </span>
                </div>

                <div className="border-t pt-3 flex justify-between text-xl font-bold text-gray-900">
                  <span>Total:</span>
                  <span className="text-green-600">${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Place Order Button */}
              {deliveryFee === null ? (
                <div className="mt-6">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-3">
                    <p className="text-sm text-yellow-800 text-center">
                      ⚠️ Please calculate delivery fee first to continue
                    </p>
                  </div>
                  <button
                    disabled
                    className="w-full py-4 bg-gray-400 text-white rounded-lg font-semibold text-lg cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    🔒 Place Order
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full mt-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>🔒 Place Order - ${total.toFixed(2)}</>
                  )}
                </button>
              )}

              <p className="text-xs text-gray-500 text-center mt-4">
                You will be redirected to secure Stripe payment
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroceryCheckout;
