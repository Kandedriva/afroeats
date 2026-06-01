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

  const { isConnected, newOrderNotification, acknowledgeNotification } = useDriverSocket(
    driver?.id,
    driver?.is_available
  );

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-600"></div>
      </div>
    );
  }

  if (driver.approval_status === 'pending') {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-5 rounded-lg shadow-md">
          <div className="flex items-start gap-3">
            <span className="text-4xl">⏳</span>
            <div>
              <h2 className="text-xl font-bold text-yellow-800 mb-1">Account Pending Approval</h2>
              <p className="text-yellow-700">
                Your driver account is under review. You&apos;ll be notified via email once approved.
              </p>
              <p className="text-yellow-600 text-sm mt-1">This usually takes 1–2 business days.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (driver.approval_status === 'rejected') {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <div className="bg-red-50 border-l-4 border-red-400 p-5 rounded-lg shadow-md">
          <div className="flex items-start gap-3">
            <span className="text-4xl">❌</span>
            <div>
              <h2 className="text-xl font-bold text-red-800 mb-1">Application Not Approved</h2>
              <p className="text-red-700">
                Your driver application was not approved. Please contact support for more information.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 sm:px-6 sm:py-8">

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Driver Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Welcome back, {driver.name}!</p>
        {isConnected && (
          <p className="text-xs text-green-600 mt-1">🟢 Connected to live notifications</p>
        )}
      </div>

      {/* New Order Notification Banner */}
      {newOrderNotification && (
        <div className="mb-5 bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-xl p-4 sm:p-6 text-white animate-pulse">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-4xl">🚗</span>
              <div>
                <h3 className="text-lg sm:text-2xl font-bold leading-tight">New Delivery Available!</h3>
                <p className="text-green-100 text-sm mt-0.5">{newOrderNotification.restaurantName}</p>
                <div className="flex flex-wrap gap-3 text-sm mt-1">
                  <span>📍 {newOrderNotification.distanceMiles} miles</span>
                  <span>💰 ${newOrderNotification.driverPayout.toFixed(2)} payout</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 sm:flex-col">
              <button
                onClick={() => { acknowledgeNotification(); navigate('/driver/available-orders'); }}
                className="flex-1 sm:flex-none bg-white text-green-600 hover:bg-green-50 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-bold shadow transition text-sm sm:text-base"
              >
                View Orders
              </button>
              <button
                onClick={acknowledgeNotification}
                className="flex-1 sm:flex-none bg-green-700 hover:bg-green-800 px-4 py-2 rounded-lg text-sm transition"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Availability Toggle */}
      <div className="mb-5 bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-800">Availability</h3>
            <p className="text-gray-500 text-sm mt-0.5">
              {driver.is_available ? "You're online and accepting orders" : "You're currently offline"}
            </p>
          </div>
          <button
            onClick={toggleAvailability}
            className={`shrink-0 px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-semibold text-sm sm:text-base transition ${
              driver.is_available
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"
            }`}
          >
            {driver.is_available ? "Go Offline" : "Go Online"}
          </button>
        </div>
      </div>

      {/* Stats Grid — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-gray-500 text-xs mb-1">Total Deliveries</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-800">{driver.total_deliveries || 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-gray-500 text-xs mb-1">Completed</p>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">{driver.completed_deliveries || 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-gray-500 text-xs mb-1">Total Earnings</p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">
            ${parseFloat(driver.total_earnings || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-gray-500 text-xs mb-1">Rating</p>
          <p className="text-2xl sm:text-3xl font-bold text-yellow-500">
            {driver.average_rating || '—'} ⭐
          </p>
        </div>
      </div>

      {/* Active Delivery */}
      {activeDelivery ? (
        <div className="bg-green-50 border border-green-300 rounded-xl p-4 sm:p-6 mb-5 shadow-sm">
          <h3 className="text-base sm:text-lg font-bold text-green-800 mb-3">🚗 Active Delivery</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700 mb-4">
            <div className="space-y-1">
              <p><span className="font-medium">Order:</span> #{activeDelivery.order_id}</p>
              <p><span className="font-medium">Status:</span> {activeDelivery.status}</p>
              <p><span className="font-medium">Distance:</span> {activeDelivery.distance_miles} miles</p>
            </div>
            <div className="space-y-1">
              <p><span className="font-medium">Payout:</span> ${activeDelivery.driver_payout}</p>
              <p><span className="font-medium">Pickup:</span> {activeDelivery.pickup_location}</p>
              <p><span className="font-medium">Dropoff:</span> {activeDelivery.delivery_location}</p>
            </div>
          </div>
          <Link
            to="/driver/my-deliveries"
            className="inline-block bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition"
          >
            View Details
          </Link>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mb-5 text-center shadow-sm">
          <p className="text-gray-500 mb-3 text-sm">No active deliveries right now</p>
          <Link
            to="/driver/available-orders"
            className="inline-block bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition"
          >
            Browse Available Orders
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Link
          to="/driver/available-orders"
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 hover:shadow-md transition text-center"
        >
          <span className="text-3xl sm:text-4xl mb-2 block">📦</span>
          <h3 className="text-xs sm:text-base font-semibold text-gray-800 leading-tight">Available Orders</h3>
          <p className="text-gray-500 text-xs mt-1 hidden sm:block">View and claim delivery orders</p>
        </Link>
        <Link
          to="/driver/my-deliveries"
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 hover:shadow-md transition text-center"
        >
          <span className="text-3xl sm:text-4xl mb-2 block">🚗</span>
          <h3 className="text-xs sm:text-base font-semibold text-gray-800 leading-tight">My Deliveries</h3>
          <p className="text-gray-500 text-xs mt-1 hidden sm:block">Track active and past deliveries</p>
        </Link>
        <Link
          to="/driver/earnings"
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 hover:shadow-md transition text-center"
        >
          <span className="text-3xl sm:text-4xl mb-2 block">💰</span>
          <h3 className="text-xs sm:text-base font-semibold text-gray-800 leading-tight">Earnings</h3>
          <p className="text-gray-500 text-xs mt-1 hidden sm:block">View your earnings history</p>
        </Link>
      </div>

    </div>
  );
}

export default DriverDashboard;
