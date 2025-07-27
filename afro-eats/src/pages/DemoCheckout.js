import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function DemoCheckout() {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  // Simulate checkout steps
  useEffect(() => {
    const timer = setTimeout(() => {
      setStep(2);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handlePayment = async () => {
    setLoading(true);

    // Simulate payment processing
    setTimeout(async () => {
      try {
        // Simulate successful subscription activation
        const res = await fetch("http://localhost:5001/api/subscription/activate-demo", {
          method: "POST",
          credentials: "include",
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (res.ok) {
          // Redirect to dashboard with success message
          navigate("/owner/dashboard?subscription_success=true");
        } else {
          throw new Error("Failed to activate subscription");
        }
      } catch (err) {
        navigate("/owner/dashboard?subscription_error=true");
      }
    }, 3000);
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white shadow-lg rounded-lg">
      {/* Demo Stripe Header */}
      <div className="text-center mb-8">
        <div className="bg-indigo-600 text-white py-3 px-6 rounded-lg mb-4">
          <h1 className="text-xl font-bold">🚀 Demo Checkout</h1>
          <p className="text-sm opacity-90">Stripe Integration Simulation</p>
        </div>
      </div>

      {step === 1 && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading checkout...</p>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Restaurant Owner Subscription</h2>
          
          {/* Subscription Details */}
          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-medium">Monthly Subscription</span>
              <span className="text-2xl font-bold text-green-600">$29.00</span>
            </div>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>✅ Add unlimited dishes</li>
              <li>✅ Manage restaurant profile</li>
              <li>✅ Receive customer orders</li>
              <li>✅ Dashboard analytics</li>
            </ul>
          </div>

          {/* Demo Payment Form */}
          <div className="border rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Payment Information</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Card Number
                </label>
                <input
                  type="text"
                  value="4242 4242 4242 4242"
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">Demo test card (always succeeds)</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    value="12/25"
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CVC
                  </label>
                  <input
                    type="text"
                    value="123"
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Demo Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-blue-600">ℹ️</span>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-blue-800">Demo Mode Active</h4>
                <p className="text-sm text-blue-700 mt-1">
                  This is a demonstration of the Stripe checkout flow. No real payment will be processed.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={() => navigate("/owner/dashboard")}
              className="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-400 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handlePayment}
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processing...
                </div>
              ) : (
                "Complete Subscription"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DemoCheckout;