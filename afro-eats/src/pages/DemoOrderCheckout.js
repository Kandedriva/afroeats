import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const DemoOrderCheckout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const orderId = searchParams.get('order_id');

  useEffect(() => {
    if (!orderId) {
      navigate('/');
      return;
    }

    // Fetch order details - using a simplified approach for demo
    const fetchOrderDetails = async () => {
      try {
        // For demo mode, we'll create a mock order details structure
        // since the order was already created in the backend
        const mockOrder = {
          id: orderId,
          total: localStorage.getItem('demo_order_total') || '25.00',
          status: 'pending',
          platform_fee: '1.20',
          items: JSON.parse(localStorage.getItem('demo_order_items') || '[]')
        };
        
        setOrderDetails(mockOrder);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error setting up demo order details:', error);
        // Set minimal order details for demo
        setOrderDetails({
          id: orderId,
          total: '25.00',
          status: 'pending',
          platform_fee: '1.20',
          items: []
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId, navigate]);

  const handleDemoPayment = async () => {
    setProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      // Redirect to order success page
      navigate(`/order-success?demo=true&order_id=${orderId}`);
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!orderDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Order not found</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center mb-6">
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
              <strong>🧪 Demo Mode</strong> - This is a test payment that won&apos;t charge your card
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Complete Your Order</h1>
            <p className="text-gray-600 mt-2">Order #{orderId}</p>
          </div>

          {/* Order Summary */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h3>
            
            {orderDetails.items && orderDetails.items.length > 0 ? (
              <div className="space-y-3">
                {orderDetails.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      {item.restaurant_name && (
                        <p className="text-sm text-gray-500">From {item.restaurant_name}</p>
                      )}
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No items found</p>
            )}

            <div className="border-t border-gray-200 mt-4 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Total</span>
                <span className="text-lg font-bold">${parseFloat(orderDetails.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Delivery Information */}
          {(orderDetails.delivery_address || orderDetails.guest_name) && (
            <div className="border-t border-gray-200 pt-6 mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Information</h3>
              {orderDetails.guest_name && (
                <p><strong>Name:</strong> {orderDetails.guest_name}</p>
              )}
              {orderDetails.guest_email && (
                <p><strong>Email:</strong> {orderDetails.guest_email}</p>
              )}
              {orderDetails.delivery_phone && (
                <p><strong>Phone:</strong> {orderDetails.delivery_phone}</p>
              )}
              {orderDetails.delivery_address && (
                <p><strong>Address:</strong> {orderDetails.delivery_address}</p>
              )}
            </div>
          )}

          {/* Demo Payment Section */}
          <div className="border-t border-gray-200 pt-6 mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Demo Payment</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="text-blue-400 text-xl">💳</div>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-900">Test Payment Mode</h4>
                  <div className="mt-1 text-sm text-blue-700">
                    <p>• No real money will be charged</p>
                    <p>• Order will be sent to restaurant dashboard</p>
                    <p>• You can test the complete order flow</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleDemoPayment}
              disabled={processing}
              className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
                processing 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {processing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processing Demo Payment...
                </div>
              ) : (
                'Complete Demo Payment'
              )}
            </button>

            <p className="text-xs text-gray-500 text-center mt-2">
              This is a demonstration payment that doesn&apos;t charge real money
            </p>
          </div>

          {/* Cancel Option */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/cart')}
              className="text-gray-600 hover:text-gray-800 underline"
            >
              Return to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoOrderCheckout;