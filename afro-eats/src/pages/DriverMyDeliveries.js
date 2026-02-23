import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api";
import { toast } from 'react-toastify';

function DriverMyDeliveries() {
  const [activeDeliveries, setActiveDeliveries] = useState([]);
  const [completedDeliveries, setCompletedDeliveries] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'completed'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDeliveries();
  }, [activeTab]);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/drivers/my-deliveries?status=${activeTab}`,
        { credentials: "include" }
      );

      if (res.ok) {
        const data = await res.json();
        if (activeTab === 'active') {
          setActiveDeliveries(data.deliveries || []);
        } else {
          setCompletedDeliveries(data.deliveries || []);
        }
      } else {
        toast.error("Failed to load deliveries");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (deliveryId, newStatus, notes = '') => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/drivers/update-delivery-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ deliveryId, status: newStatus, notes })
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || "Status updated");
        fetchDeliveries();
      } else {
        toast.error(data.error || "Failed to update status");
      }
    } catch (err) {
      toast.error("Network error");
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      claimed: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Claimed' },
      picked_up: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Picked Up' },
      in_transit: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'In Transit' },
      delivered: { bg: 'bg-green-100', text: 'text-green-800', label: 'Delivered' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' }
    };

    const badge = badges[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

    return (
      <span className={`${badge.bg} ${badge.text} px-3 py-1 rounded-full text-sm font-semibold`}>
        {badge.label}
      </span>
    );
  };

  const renderDeliveryCard = (delivery) => {
    const isActive = ['claimed', 'picked_up', 'in_transit'].includes(delivery.status);

    return (
      <div key={delivery.delivery_id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Order #{delivery.order_id}</h3>
            <p className="text-sm text-gray-500">
              Claimed {new Date(delivery.claimed_at).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            {getStatusBadge(delivery.status)}
            <div className="text-lg font-bold text-green-600 mt-2">
              ${parseFloat(delivery.driver_payout).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">📍 Pickup</h4>
            <p className="text-sm text-gray-600">{delivery.pickup_location}</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">🏠 Delivery</h4>
            <p className="text-sm text-gray-600">{delivery.delivery_location}</p>
            {delivery.delivery_phone && (
              <p className="text-sm text-gray-600 mt-1">📞 {delivery.delivery_phone}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>{delivery.distance_miles} miles</span>
            <span>•</span>
            <span>Fee: ${parseFloat(delivery.total_delivery_fee).toFixed(2)}</span>
          </div>

          {isActive && (
            <div className="flex space-x-2">
              {delivery.status === 'claimed' && (
                <button
                  onClick={() => updateStatus(delivery.delivery_id, 'picked_up')}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Mark as Picked Up
                </button>
              )}
              {delivery.status === 'picked_up' && (
                <button
                  onClick={() => updateStatus(delivery.delivery_id, 'in_transit')}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  En Route to Customer
                </button>
              )}
              {delivery.status === 'in_transit' && (
                <button
                  onClick={() => updateStatus(delivery.delivery_id, 'delivered')}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Mark as Delivered
                </button>
              )}
            </div>
          )}

          {delivery.status === 'delivered' && delivery.delivered_at && (
            <p className="text-sm text-gray-500">
              Delivered {new Date(delivery.delivered_at).toLocaleString()}
            </p>
          )}
        </div>

        {delivery.driver_notes && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Notes:</span> {delivery.driver_notes}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">My Deliveries</h1>
        <p className="text-gray-600">Track your active and completed deliveries</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('active')}
          className={`pb-3 px-4 font-semibold transition ${
            activeTab === 'active'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Active Deliveries
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`pb-3 px-4 font-semibold transition ${
            activeTab === 'completed'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Completed Deliveries
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === 'active' && activeDeliveries.length === 0 && (
            <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-8 text-center">
              <span className="text-6xl mb-4 block">📦</span>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Active Deliveries</h3>
              <p className="text-gray-600">Claim an order to start delivering!</p>
            </div>
          )}

          {activeTab === 'completed' && completedDeliveries.length === 0 && (
            <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-8 text-center">
              <span className="text-6xl mb-4 block">✅</span>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Completed Deliveries</h3>
              <p className="text-gray-600">Your delivery history will appear here</p>
            </div>
          )}

          {activeTab === 'active' && activeDeliveries.map(renderDeliveryCard)}
          {activeTab === 'completed' && completedDeliveries.map(renderDeliveryCard)}
        </div>
      )}
    </div>
  );
}

export default DriverMyDeliveries;
