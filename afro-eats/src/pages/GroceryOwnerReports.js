import { useState, useEffect, useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { GroceryOwnerAuthContext } from '../context/GroceryOwnerAuthContext';
import { API_BASE_URL } from '../config/api';
import { toast } from 'react-toastify';

function GroceryOwnerReports() {
  const { groceryOwner, loading: authLoading } = useContext(GroceryOwnerAuthContext);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('week'); // week, month, year, all
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    refundedOrders: 0,
    topProducts: [],
    recentActivity: [],
    salesByDate: []
  });

  useEffect(() => {
    if (groceryOwner) {
      fetchReports();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groceryOwner, timeRange]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/grocery-owners/reports?range=${timeRange}`,
        {
          credentials: 'include',
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        toast.error('Failed to load reports');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Reports fetch error:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  // Wait for auth to load
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!groceryOwner) {
    return <Navigate to="/grocery-owner/login" replace />;
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'new_order':
        return '🛒';
      case 'order_completed':
        return '✅';
      case 'order_cancelled':
        return '❌';
      case 'refund_request':
        return '💰';
      case 'product_added':
        return '➕';
      case 'product_updated':
        return '✏️';
      default:
        return '📝';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
              <p className="text-gray-600 mt-2">Track your store performance and sales</p>
            </div>

            {/* Time Range Selector */}
            <div className="mt-4 sm:mt-0">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="year">Last Year</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading reports...</p>
          </div>
        ) : (
          <>
            {/* Revenue & Orders Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Total Revenue */}
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">Total Revenue</p>
                    <p className="text-3xl font-bold mt-2">
                      ${stats.totalRevenue.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white bg-opacity-20 rounded-full p-3">
                    <span className="text-3xl">💰</span>
                  </div>
                </div>
              </div>

              {/* Total Orders */}
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">Total Orders</p>
                    <p className="text-3xl font-bold mt-2">{stats.totalOrders}</p>
                  </div>
                  <div className="bg-white bg-opacity-20 rounded-full p-3">
                    <span className="text-3xl">📦</span>
                  </div>
                </div>
              </div>

              {/* Average Order Value */}
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">Avg Order Value</p>
                    <p className="text-3xl font-bold mt-2">
                      ${stats.averageOrderValue.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white bg-opacity-20 rounded-full p-3">
                    <span className="text-3xl">📊</span>
                  </div>
                </div>
              </div>

              {/* Completed Orders */}
              <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-teal-100 text-sm font-medium">Completed Orders</p>
                    <p className="text-3xl font-bold mt-2">{stats.completedOrders}</p>
                  </div>
                  <div className="bg-white bg-opacity-20 rounded-full p-3">
                    <span className="text-3xl">✅</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Status Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="text-2xl">❌</span>
                  <h3 className="text-lg font-semibold text-gray-900">Cancelled Orders</h3>
                </div>
                <p className="text-3xl font-bold text-red-600">{stats.cancelledOrders}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {stats.totalOrders > 0
                    ? `${((stats.cancelledOrders / stats.totalOrders) * 100).toFixed(1)}% of total`
                    : '0% of total'}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="text-2xl">💸</span>
                  <h3 className="text-lg font-semibold text-gray-900">Refunded Orders</h3>
                </div>
                <p className="text-3xl font-bold text-orange-600">{stats.refundedOrders}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {stats.totalOrders > 0
                    ? `${((stats.refundedOrders / stats.totalOrders) * 100).toFixed(1)}% of total`
                    : '0% of total'}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="text-2xl">✅</span>
                  <h3 className="text-lg font-semibold text-gray-900">Success Rate</h3>
                </div>
                <p className="text-3xl font-bold text-green-600">
                  {stats.totalOrders > 0
                    ? `${((stats.completedOrders / stats.totalOrders) * 100).toFixed(1)}%`
                    : '0%'}
                </p>
                <p className="text-sm text-gray-600 mt-1">Order completion rate</p>
              </div>
            </div>

            {/* Top Products & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Products */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">🏆</span> Top Selling Products
                </h2>
                {stats.topProducts && stats.topProducts.length > 0 ? (
                  <div className="space-y-4">
                    {stats.topProducts.map((product, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                            index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{product.name}</p>
                            <p className="text-sm text-gray-600">{product.total_sold} units sold</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">${product.revenue.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">revenue</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <span className="text-4xl mb-2 block">📦</span>
                    <p>No product data available for this period</p>
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">📋</span> Recent Activity
                </h2>
                {stats.recentActivity && stats.recentActivity.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {stats.recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <span className="text-2xl">{getActivityIcon(activity.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(activity.created_at)}
                          </p>
                        </div>
                        {activity.amount && (
                          <div className="text-sm font-semibold text-green-600">
                            ${parseFloat(activity.amount).toFixed(2)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <span className="text-4xl mb-2 block">📭</span>
                    <p>No recent activity</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default GroceryOwnerReports;
