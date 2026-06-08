import { useEffect, useState, useCallback } from "react";
import PropTypes from 'prop-types';
import { API_BASE_URL } from "../config/api";
import { toast } from 'react-toastify';

const PERIODS = ['today', 'week', 'month', 'all'];

const STATUS_STYLES = {
  paid:    'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed:  'bg-red-100 text-red-800',
};

function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[status] || STATUS_STYLES.failed}`}>
      {status}
    </span>
  );
}

StatusBadge.propTypes = { status: PropTypes.string.isRequired };

function DriverEarnings() {
  const [period, setPeriod] = useState('all');
  const [summary, setSummary] = useState(null);
  const [recentEarnings, setRecentEarnings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEarnings = useCallback(async () => {
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
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchEarnings(); }, [fetchEarnings]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6">

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Earnings</h1>
          <p className="text-gray-500 text-sm mt-1">Track your delivery earnings and payouts</p>
        </div>

        {/* Period selector */}
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold capitalize transition ${
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Earnings', value: summary?.total_earnings, color: 'text-green-600', sub: `${summary?.total_deliveries || 0} deliveries` },
          { label: 'Paid Out',       value: summary?.paid_earnings,  color: 'text-blue-600',  sub: 'Already received' },
          { label: 'Pending',        value: summary?.pending_earnings, color: 'text-yellow-600', sub: 'Awaiting payout' },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="bg-white rounded-lg shadow p-5">
            <div className="text-gray-500 text-sm mb-1">{label}</div>
            <div className={`text-2xl sm:text-3xl font-bold ${color}`}>
              ${parseFloat(value || 0).toFixed(2)}
            </div>
            <div className="text-xs text-gray-400 mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* Earnings list */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Recent Earnings</h2>

        {recentEarnings.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No earnings in this period</p>
        ) : (
          <>
            {/* Desktop table — hidden on mobile */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Order</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Delivery Fee</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Your Payout</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEarnings.map((e) => (
                    <tr key={e.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-800">#{e.order_id}</td>
                      <td className="py-3 px-4 text-gray-500">
                        {new Date(e.delivered_at || e.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-gray-600">${parseFloat(e.delivery_fee).toFixed(2)}</td>
                      <td className="py-3 px-4 font-semibold text-green-600">${parseFloat(e.driver_payout).toFixed(2)}</td>
                      <td className="py-3 px-4"><StatusBadge status={e.payout_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards — hidden on sm+ */}
            <div className="sm:hidden space-y-3">
              {recentEarnings.map((e) => (
                <div key={e.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-gray-800">Order #{e.order_id}</span>
                    <StatusBadge status={e.payout_status} />
                  </div>
                  <div className="text-xs text-gray-400 mb-3">
                    {new Date(e.delivered_at || e.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Delivery fee</span>
                    <span className="text-gray-700">${parseFloat(e.delivery_fee).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-500">Your payout</span>
                    <span className="font-bold text-green-600">${parseFloat(e.driver_payout).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Info box */}
      <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
        <div className="flex gap-3">
          <span className="text-xl flex-shrink-0">💡</span>
          <div>
            <h3 className="text-sm font-semibold text-blue-800 mb-1">Payout Information</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Earnings are typically paid out 1–2 business days after delivery completion</li>
              <li>• Make sure your Stripe account is set up to receive payments</li>
              <li>• You receive 85% of the delivery fee, platform keeps 15%</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DriverEarnings;
