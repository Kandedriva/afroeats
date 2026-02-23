import { useEffect, useState } from "react";
import { useDriverAuth } from "../context/DriverAuthContext";
import { useDriverSocket } from "../hooks/useDriverSocket";
import { API_BASE_URL } from "../config/api";
import { Link, useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';

function DriverDashboard() {
  const { driver, refreshAuth } = useDriverAuth();
  const navigate = useNavigate();
  const [_stats, setStats] = useState(null);
  const [activeDelivery, setActiveDelivery] = useState(null);
  const [loading, setLoading] = useState(true);

  // Connect to socket for real-time notifications
  const { isConnected, newOrderNotification, acknowledgeNotification } = useDriverSocket(
    driver?.id,
    driver?.is_available
  );

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Get active delivery
      const deliveriesRes = await fetch(
        `${API_BASE_URL}/api/drivers/my-deliveries?status=active`,
        { credentials: "include" }
      );
      if (deliveriesRes.ok) {
        const deliveriesData = await deliveriesRes.json();
        if (deliveriesData.deliveries && deliveriesData.deliveries.length > 0) {
          setActiveDelivery(deliveriesData.deliveries[0]);
        }
      }

      // Get earnings stats
      const earningsRes = await fetch(
        `${API_BASE_URL}/api/drivers/earnings?period=all`,
        { credentials: "include" }
      );
      if (earningsRes.ok) {
        const earningsData = await earningsRes.json();
        setStats(earningsData.summary);
      }
    } catch (err) {
      // Failed to load dashboard data
    } finally {
      setLoading(false);
    }
  };

  const toggleAvailability = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/drivers/toggle-availability`, {
        method: "POST",
        credentials: "include"
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || (data.is_available ? "You're now online!" : "You're now offline"));
        // Refresh driver data to update status
        await refreshAuth();
      } else {
        toast.error("Failed to update availability");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600"></div>
      </div>
    );
  }

  // Pending approval state
  if (driver.approval_status === 'pending') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <span className="text-5xl mr-4">⏳</span>
            <div>
              <h2 className="text-2xl font-bold text-yellow-800 mb-2">Account Pending Approval</h2>
              <p className="text-yellow-700 text-lg">
                Your driver account is currently under review by our admin team. You&apos;ll be notified via email once approved.
              </p>
              <p className="text-yellow-600 mt-2">This usually takes 1-2 business days.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Rejected state
  if (driver.approval_status === 'rejected') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <span className="text-5xl mr-4">❌</span>
            <div>
              <h2 className="text-2xl font-bold text-red-800 mb-2">Application Not Approved</h2>
              <p className="text-red-700 text-lg">
                Unfortunately, your driver application was not approved. Please contact support for more information.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Driver Dashboard</h1>
        <p className="text-gray-600">Welcome back, {driver.name}!</p>
        {isConnected && (
          <p className="text-xs text-green-600 mt-1">🟢 Connected to live notifications</p>
        )}
      </div>

      {/* New Order Notification Banner */}
      {newOrderNotification && (
        <div className="mb-6 bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-xl p-6 text-white animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-5xl">🚗</div>
              <div>
                <h3 className="text-2xl font-bold mb-1">New Delivery Order Available!</h3>
                <p className="text-green-100 mb-2">{newOrderNotification.restaurantName}</p>
                <div className="flex gap-4 text-sm">
                  <span>📍 {newOrderNotification.distanceMiles} miles</span>
                  <span>💰 ${newOrderNotification.driverPayout.toFixed(2)} payout</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  acknowledgeNotification();
                  navigate('/driver/available-orders');
                }}
                className="bg-white text-green-600 hover:bg-green-50 px-6 py-3 rounded-lg font-bold shadow-lg transition"
              >
                View Orders
              </button>
              <button
                onClick={acknowledgeNotification}
                className="bg-green-700 hover:bg-green-800 px-6 py-2 rounded-lg text-sm transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Availability Toggle */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Availability Status</h3>
            <p className="text-gray-600 text-sm">
              {driver.is_available ? "You're online and can accept orders" : "You're offline"}
            </p>
          </div>
          <button
            onClick={toggleAvailability}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              driver.is_available
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"
            }`}
          >
            {driver.is_available ? "Go Offline" : "Go Online"}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-gray-500 text-sm mb-2">Total Deliveries</div>
          <div className="text-3xl font-bold text-gray-800">{driver.total_deliveries || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-gray-500 text-sm mb-2">Completed</div>
          <div className="text-3xl font-bold text-green-600">{driver.completed_deliveries || 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-gray-500 text-sm mb-2">Total Earnings</div>
          <div className="text-3xl font-bold text-blue-600">
            ${parseFloat(driver.total_earnings || 0).toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-gray-500 text-sm mb-2">Rating</div>
          <div className="text-3xl font-bold text-yellow-600">
            {driver.average_rating || 0} ⭐
          </div>
        </div>
      </div>

      {/* Active Delivery */}
      {activeDelivery ? (
        <div className="bg-green-50 border-2 border-green-400 rounded-lg p-6 mb-8 shadow-md">
          <h3 className="text-xl font-bold text-green-800 mb-4">🚗 Active Delivery</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Order #{activeDelivery.order_id}</p>
              <p className="text-sm text-gray-600">Status: <span className="font-semibold">{activeDelivery.status}</span></p>
              <p className="text-sm text-gray-600">Distance: {activeDelivery.distance_miles} miles</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Payout: ${activeDelivery.driver_payout}</p>
              <p className="text-sm text-gray-600">Pickup: {activeDelivery.pickup_location}</p>
              <p className="text-sm text-gray-600">Delivery: {activeDelivery.delivery_location}</p>
            </div>
          </div>
          <Link
            to="/driver/my-deliveries"
            className="mt-4 inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
          >
            View Details
          </Link>
        </div>
      ) : (
        <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-6 mb-8 text-center shadow-md">
          <p className="text-gray-600 mb-4">No active deliveries</p>
          <Link
            to="/driver/available-orders"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Browse Available Orders
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/driver/available-orders"
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition text-center"
        >
          <span className="text-4xl mb-3 block">📦</span>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Available Orders</h3>
          <p className="text-gray-600 text-sm">View and claim delivery orders</p>
        </Link>

        <Link
          to="/driver/my-deliveries"
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition text-center"
        >
          <span className="text-4xl mb-3 block">🚗</span>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">My Deliveries</h3>
          <p className="text-gray-600 text-sm">Track active and past deliveries</p>
        </Link>

        <Link
          to="/driver/earnings"
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition text-center"
        >
          <span className="text-4xl mb-3 block">💰</span>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Earnings</h3>
          <p className="text-gray-600 text-sm">View your earnings history</p>
        </Link>
      </div>
    </div>
  );
}

export default DriverDashboard;
