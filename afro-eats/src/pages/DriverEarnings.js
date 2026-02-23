import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api";
import { toast } from 'react-toastify';

function DriverEarnings() {
  const [period, setPeriod] = useState('all');
  const [summary, setSummary] = useState(null);
  const [recentEarnings, setRecentEarnings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEarnings();
  }, [period]);

  const fetchEarnings = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/drivers/earnings?period=${period}`,
        { credentials: "include" }
      );

      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary || {});
        setRecentEarnings(data.recent_earnings || []);
      } else {
        toast.error("Failed to load earnings");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Earnings</h1>
          <p className="text-gray-600">Track your delivery earnings and payouts</p>
        </div>

        {/* Period Selector */}
        <div className="flex space-x-2">
          {['today', 'week', 'month', 'all'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg font-semibold capitalize transition ${
                period === p
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-gray-500 text-sm mb-2">Total Earnings</div>
          <div className="text-3xl font-bold text-green-600">
            ${parseFloat(summary?.total_earnings || 0).toFixed(2)}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            {summary?.total_deliveries || 0} deliveries
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-gray-500 text-sm mb-2">Paid Out</div>
          <div className="text-3xl font-bold text-blue-600">
            ${parseFloat(summary?.paid_earnings || 0).toFixed(2)}
          </div>
          <div className="text-sm text-gray-500 mt-2">Already received</div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-gray-500 text-sm mb-2">Pending</div>
          <div className="text-3xl font-bold text-yellow-600">
            ${parseFloat(summary?.pending_earnings || 0).toFixed(2)}
          </div>
          <div className="text-sm text-gray-500 mt-2">Awaiting payout</div>
        </div>
      </div>

      {/* Recent Earnings Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Earnings</h2>

        {recentEarnings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No earnings in this period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Order ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Delivery Fee</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Your Payout</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentEarnings.map((earning) => (
                  <tr key={earning.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-800">#{earning.order_id}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(earning.delivered_at || earning.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      ${parseFloat(earning.delivery_fee).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-green-600">
                      ${parseFloat(earning.driver_payout).toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      {earning.payout_status === 'paid' ? (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                          Paid
                        </span>
                      ) : earning.payout_status === 'pending' ? (
                        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                          Pending
                        </span>
                      ) : (
                        <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-2xl">💡</span>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Payout Information</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>• Earnings are typically paid out 1-2 business days after delivery completion</p>
              <p>• Make sure your Stripe account is set up to receive payments</p>
              <p>• You receive 85% of the delivery fee, platform keeps 15%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DriverEarnings;
