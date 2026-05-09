import { Link } from 'react-router-dom';

export default function SellWithUs() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-green-700 text-white py-16 px-4 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">Sell with OrderDabaly</h1>
        <p className="text-green-100 text-lg max-w-xl mx-auto">
          Reach more customers and grow your business by partnering with us.
        </p>
      </div>

      {/* Cards */}
      <div className="max-w-4xl mx-auto px-4 py-12 grid sm:grid-cols-2 gap-6">

        {/* Grocery Store */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col">
          <div className="bg-green-50 px-6 py-8 text-center">
            <span className="text-6xl">🏪</span>
            <h2 className="text-2xl font-bold text-gray-900 mt-4">Grocery Store</h2>
            <p className="text-gray-500 mt-2 text-sm">
              List your products and deliver fresh groceries directly to customers.
            </p>
          </div>
          <div className="px-6 py-6 flex flex-col gap-3 flex-1 justify-end">
            <Link
              to="/register-grocery-owner"
              className="w-full text-center py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              Create a Store Account
            </Link>
            <Link
              to="/grocery-owner/login"
              className="w-full text-center py-3 border-2 border-green-600 text-green-700 font-semibold rounded-lg hover:bg-green-50 transition-colors"
            >
              Log in to my Store
            </Link>
          </div>
        </div>

        {/* Restaurant */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col">
          <div className="bg-orange-50 px-6 py-8 text-center">
            <span className="text-6xl">🍽️</span>
            <h2 className="text-2xl font-bold text-gray-900 mt-4">Restaurant</h2>
            <p className="text-gray-500 mt-2 text-sm">
              List your menu and receive food orders from customers near you.
            </p>
          </div>
          <div className="px-6 py-6 flex flex-col gap-3 flex-1 justify-end">
            <Link
              to="/register-owner"
              className="w-full text-center py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
            >
              Create a Restaurant Account
            </Link>
            <Link
              to="/owner/login"
              className="w-full text-center py-3 border-2 border-orange-500 text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors"
            >
              Log in to my Restaurant
            </Link>
          </div>
        </div>

      </div>

      {/* Footer note */}
      <p className="text-center text-sm text-gray-400 pb-12">
        Already a customer?{' '}
        <Link to="/login" className="text-green-600 hover:underline">Log in here</Link>
      </p>
    </div>
  );
}
