// Wrapper component to handle errors before OrderSuccess loads
import { Component } from 'react';
import OrderSuccess from './OrderSuccess';

class OrderSuccessWrapper extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      orderId: null
    };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error('OrderSuccess wrapper caught error:', error, errorInfo);

    // Extract order info from URL if possible
    try {
      const params = new URLSearchParams(window.location.search);
      this.setState({
        orderId: params.get('order_id')
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse URL params:', e);
    }
  }

  handleContinue = () => {
    try {
      window.location.href = '/';
    } catch {
      // Last resort
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // Minimal success message if page crashes
      return (
        <div className="max-w-2xl mx-auto mt-10 p-6">
          <div className="text-center mb-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h1 className="text-3xl font-bold text-green-800 mb-2">Payment Successful!</h1>
            <p className="text-gray-600 mb-4">
              Your order has been received and is being processed.
            </p>
            {this.state.orderId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800">
                  Order Number: #{this.state.orderId}
                </p>
              </div>
            )}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                You will receive order updates via email.
              </p>
            </div>
          </div>
          <div className="text-center">
            <button
              onClick={this.handleContinue}
              className="bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      );
    }

    return <OrderSuccess />;
  }
}

export default OrderSuccessWrapper;
