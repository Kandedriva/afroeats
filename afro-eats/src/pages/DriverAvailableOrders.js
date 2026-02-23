import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config/api";
import { toast } from 'react-toastify';
import { useNavigate } from "react-router-dom";
import { useDriverAuth } from "../context/DriverAuthContext";
import { useDriverSocket } from "../hooks/useDriverSocket";

function DriverAvailableOrders() {
  const { driver } = useDriverAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Connect to socket for real-time notifications
  const { newOrderNotification, acknowledgeNotification } = useDriverSocket(
    driver?.id,
    driver?.is_available
  );

  useEffect(() => {
    fetchAvailableOrders();
  }, []);

  // Auto-refresh orders when new order notification arrives
  useEffect(() => {
    if (newOrderNotification) {
      fetchAvailableOrders();
      acknowledgeNotification(); // Auto-dismiss since user is already on orders page
    }
  }, [newOrderNotification]);

  const fetchAvailableOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/drivers/available-orders`, {
        credentials: "include"
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      } else {
        const errorData = await res.json();
        if (res.status === 403) {
          toast.error(errorData.message || "Your account is not approved yet");
        } else {
          toast.error("Failed to load orders");
        }
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  const claimOrder = async (orderId) => {
    if (!window.confirm("Are you sure you want to claim this order?")) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/drivers/claim-order/${orderId}`, {
        method: "POST",
        credentials: "include"
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Order claimed successfully!");
        navigate("/driver/my-deliveries");
      } else {
        toast.error(data.error || "Failed to claim order");
        fetchAvailableOrders(); // Refresh list
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

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Available Orders</h1>
        <p className="text-gray-600">Claim orders to start earning</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-8 text-center">
          <span className="text-6xl mb-4 block">📦</span>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Available Orders</h3>
          <p className="text-gray-600">Check back soon for new delivery opportunities!</p>
          <button
            onClick={fetchAvailableOrders}
            className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
          >
            Refresh
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {orders.map((order) => {
            const restaurants = typeof order.restaurants === 'string'
              ? JSON.parse(order.restaurants)
              : order.restaurants;

            return (
              <div key={order.order_id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Order #{order.order_id}</h3>
                    <p className="text-sm text-gray-500">
                      Placed {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      ${parseFloat(order.driver_payout).toFixed(2)}
                    </div>
                    <p className="text-sm text-gray-500">Your Payout</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">📍 Pickup Location</h4>
                    <p className="text-sm text-gray-600">{order.pickup_location}</p>
                    {restaurants && restaurants.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-gray-700">Restaurants:</p>
                        {restaurants.map((r, idx) => (
                          <p key={idx} className="text-sm text-gray-600">• {r.restaurant_name}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">🏠 Delivery Location</h4>
                    <p className="text-sm text-gray-600">{order.delivery_location}</p>
                    {order.delivery_phone && (
                      <p className="text-sm text-gray-600 mt-2">
                        📞 {order.delivery_phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center space-x-4">
                    <div className="text-sm">
                      <span className="text-gray-500">Distance:</span>
                      <span className="font-semibold text-gray-800 ml-1">
                        {order.distance_miles} miles
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Delivery Fee:</span>
                      <span className="font-semibold text-gray-800 ml-1">
                        ${parseFloat(order.total_delivery_fee).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Order Total:</span>
                      <span className="font-semibold text-gray-800 ml-1">
                        ${parseFloat(order.total).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => claimOrder(order.order_id)}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold transition"
                  >
                    Claim Order
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DriverAvailableOrders;
