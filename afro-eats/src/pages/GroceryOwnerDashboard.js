import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { GroceryOwnerAuthContext } from '../context/GroceryOwnerAuthContext';
import { API_BASE_URL } from '../config/api';
import { toast } from 'react-toastify';

function GroceryOwnerDashboard() {
  const { groceryOwner } = useContext(GroceryOwnerAuthContext);
  const [store, setStore] = useState(null);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch store information
      const storeResponse = await fetch(`${API_BASE_URL}/api/grocery-owners/store`, {
        credentials: 'include',
      });

      if (storeResponse.ok) {
        const storeData = await storeResponse.json();
        setStore(storeData);

        // Fetch orders statistics
        const ordersResponse = await fetch(
          `${API_BASE_URL}/api/grocery-orders?store_id=${storeData.id}`,
          {
            credentials: 'include',
          }
        );

        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          calculateStats(ordersData);
        }
      } else {
        toast.error('Failed to load store information');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Dashboard data fetch error:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (orders) => {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(
      (order) => order.status === 'pending' || order.status === 'confirmed'
    ).length;
    const completedOrders = orders.filter((order) => order.status === 'delivered').length;
    const totalRevenue = orders
      .filter((order) => order.status === 'delivered')
      .reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0);

    setStats({
      totalOrders,
      pendingOrders,
      completedOrders,
      totalRevenue,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {groceryOwner?.name}! 👋
          </h1>
          {store && (
            <div className="mt-2 text-gray-600">
              <p className="text-lg font-medium">{store.name}</p>
              <p className="text-sm">{store.address}</p>
            </div>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Orders */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalOrders}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <span className="text-3xl">📦</span>
              </div>
            </div>
          </div>

          {/* Pending Orders */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Orders</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">{stats.pendingOrders}</p>
              </div>
              <div className="bg-orange-100 rounded-full p-3">
                <span className="text-3xl">⏳</span>
              </div>
            </div>
            {stats.pendingOrders > 0 && (
              <Link
                to="/grocery-owner/orders"
                className="text-sm text-orange-600 hover:text-orange-700 mt-2 inline-block"
              >
                View pending orders →
              </Link>
            )}
          </div>

          {/* Completed Orders */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed Orders</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{stats.completedOrders}</p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <span className="text-3xl">✅</span>
              </div>
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">
                  ${stats.totalRevenue.toFixed(2)}
                </p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <span className="text-3xl">💰</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/grocery-owner/orders"
              className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all"
            >
              <span className="text-2xl">📦</span>
              <div>
                <p className="font-semibold text-gray-900">View Orders</p>
                <p className="text-sm text-gray-600">Manage your orders</p>
              </div>
            </Link>

            <Link
              to="/grocery-owner/products"
              className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all"
            >
              <span className="text-2xl">🛍️</span>
              <div>
                <p className="font-semibold text-gray-900">Manage Products</p>
                <p className="text-sm text-gray-600">Add or edit products</p>
              </div>
            </Link>

            <Link
              to="/grocery-owner/store"
              className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all"
            >
              <span className="text-2xl">🏪</span>
              <div>
                <p className="font-semibold text-gray-900">Store Settings</p>
                <p className="text-sm text-gray-600">Update store info</p>
              </div>
            </Link>

            <Link
              to="/grocery-owner/reports"
              className="flex items-center space-x-3 p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all"
            >
              <span className="text-2xl">📊</span>
              <div>
                <p className="font-semibold text-gray-900">View Reports</p>
                <p className="text-sm text-gray-600">Sales and analytics</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Store Information */}
        {store && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Store Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-600">Store Name</p>
                <p className="text-lg text-gray-900 mt-1">{store.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Phone Number</p>
                <p className="text-lg text-gray-900 mt-1">{store.phone_number}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-gray-600">Address</p>
                <p className="text-lg text-gray-900 mt-1">{store.address}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Status</p>
                <p className="mt-1">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      store.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {store.active ? '✅ Active' : '❌ Inactive'}
                  </span>
                </p>
              </div>
              {store.image_url && (
                <div className="md:col-span-2">
                  <p className="text-sm font-medium text-gray-600 mb-2">Store Logo</p>
                  <img
                    src={store.image_url}
                    alt={store.name}
                    className="h-24 w-24 object-cover rounded-lg border-2 border-gray-200"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GroceryOwnerDashboard;
