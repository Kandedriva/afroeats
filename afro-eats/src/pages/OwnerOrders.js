// React import removed as it's not needed in React 17+
import { useEffect, useState, useContext } from "react";
import { OwnerAuthContext } from "../context/OwnerAuthContext";
import { Navigate, Link } from "react-router-dom";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";

function OwnerOrders() {
  const { owner, loading: authLoading } = useContext(OwnerAuthContext);
  const [orders, setOrders] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, completed
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, amount

  useEffect(() => {
    const fetchOrdersAndRestaurant = async () => {
      try {
        // Fetch orders
        const ordersRes = await fetch(`${API_BASE_URL}/api/owners/orders`, {
          credentials: "include",
        });
        
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setOrders(ordersData.orders || []);
        }

        // Fetch restaurant info
        const restaurantRes = await fetch(`${API_BASE_URL}/api/owners/restaurant`, {
          credentials: "include",
        });
        
        if (restaurantRes.ok) {
          const restaurantData = await restaurantRes.json();
          setRestaurant(restaurantData);
        }
      } catch (err) {
        toast.error("Failed to load orders");
      } finally {
        setLoading(false);
      }
    };

    fetchOrdersAndRestaurant();
  }, []);

  const showCompleteModal = (orderId) => {
    setShowCompleteConfirm(orderId);
  };

  const completeOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/owners/orders/${orderId}/complete`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to complete order");
      }

      // Update the order status to completed and add completion timestamp
      setOrders(prev => prev.map(order => 
        order.id === orderId 
          ? { ...order, status: 'completed', completed_at: new Date().toISOString() }
          : order
      ));
      toast.success("Order marked as completed!");
      setShowCompleteConfirm(null);
    } catch (err) {
      toast.error(`Error completing order: ${err.message}`);
    }
  };

  const confirmRemoveOrder = (orderId) => {
    setShowRemoveConfirm(orderId);
  };

  const removeOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/owners/orders/${orderId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to remove order");
      }

      const responseData = await res.json();

      // Remove the order from local state
      setOrders(prev => prev.filter(order => order.id !== orderId));

      toast.success(responseData.message);
      setShowRemoveConfirm(null);
    } catch (err) {
      toast.error(`Error removing order: ${err.message}`);
    }
  };

  const printOrder = (order) => {
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order #${order.id} - ${restaurant?.name || 'Restaurant'}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .platform-badge { background: #007bff; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; margin-bottom: 10px; display: inline-block; }
            .order-info { margin-bottom: 20px; }
            .customer-info { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
            .delivery-info { background: #e8f5e8; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #28a745; }
            .pickup-info { background: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .items-table th { background-color: #f2f2f2; }
            .total-section { text-align: right; font-weight: bold; font-size: 18px; }
            .print-footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="platform-badge">🍽️ A Food Zone Platform</div>
            <h1>${restaurant?.name || 'Restaurant'}</h1>
            <h2>Order Receipt #${order.id}</h2>
            <p>Order Date: ${new Date(order.created_at).toLocaleDateString()} at ${new Date(order.created_at).toLocaleTimeString()}</p>
          </div>
          
          <div class="customer-info">
            <h3>Customer Information</h3>
            <p><strong>Name:</strong> ${order.customer_name}</p>
            <p><strong>Email:</strong> ${order.customer_email}</p>
            <p><strong>Contact Phone:</strong> ${order.delivery_phone || order.customer_phone || 'Not provided'}</p>
          </div>

          <div class="${order.delivery_type === 'pickup' ? 'pickup-info' : 'delivery-info'}">
            <h3>${order.delivery_type === 'pickup' ? '🏪 Pickup Order' : '🚚 Delivery Order'}</h3>
            ${order.delivery_type === 'pickup' ? 
              '<p><strong>Customer will pick up this order at your restaurant location.</strong></p>' :
              `<p><strong>Delivery Address:</strong> ${order.delivery_address || order.customer_address || 'Not provided'}</p>`
            }
          </div>
          
          <div class="order-info">
            <h3>Order Details</h3>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${order.items.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>$${Number(item.price || 0).toFixed(2)}</td>
                    <td>$${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div class="total-section">
            <p>Platform Fee: $${Number(order.platform_fee || 0).toFixed(2)}</p>
            <p>Total Amount: $${Number(order.total || 0).toFixed(2)}</p>
            <p style="color: green;">Restaurant Earnings: $${(Number(order.total || 0) - Number(order.platform_fee || 0)).toFixed(2)}</p>
          </div>
          
          ${order.order_details ? `
            <div class="order-info">
              <h3>Special Instructions</h3>
              <p style="background: #fff3cd; padding: 10px; border-radius: 5px;">${order.order_details}</p>
            </div>
          ` : ''}
          
          <div class="print-footer">
            <p><strong>🍽️ Powered by A Food Zone Platform</strong></p>
            <p>Thank you for partnering with us!</p>
            <p>Printed on: ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // Filter and sort orders
  const getFilteredAndSortedOrders = () => {
    let filteredOrders = orders;

    // Apply status filter
    if (filterStatus === 'active') {
      filteredOrders = orders.filter(order => 
        order.status !== 'completed' && 
        order.status !== 'cancelled' && 
        order.status !== 'removed'
      );
    } else if (filterStatus === 'completed') {
      filteredOrders = orders.filter(order => order.status === 'completed');
    }

    // Apply sorting
    if (sortBy === 'newest') {
      filteredOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortBy === 'oldest') {
      filteredOrders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sortBy === 'amount') {
      filteredOrders.sort((a, b) => Number(b.total || 0) - Number(a.total || 0));
    }

    return filteredOrders;
  };

  const canRemoveOrder = (status) => {
    return status === 'completed';
  };

  const filteredOrders = getFilteredAndSortedOrders();
  const activeOrders = orders.filter(order => 
    order.status !== 'completed' && 
    order.status !== 'cancelled' && 
    order.status !== 'removed'
  );
  const completedOrders = orders.filter(order => order.status === 'completed');
  const totalEarnings = orders.reduce((sum, order) => sum + (Number(order.total || 0) - Number(order.platform_fee || 0)), 0);

  if (authLoading || loading) {
    return <div className="text-center p-6">Loading orders...</div>;
  }

  if (!owner) {
    return <Navigate to="/owner/login" />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Order Management</h1>
          <p className="text-gray-600">Manage your restaurant orders and track earnings</p>
        </div>
        <Link 
          to="/owner/dashboard"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Total Orders</h3>
          <p className="text-3xl font-bold text-blue-600">{orders.length}</p>
          <p className="text-sm text-gray-500 mt-1">All time</p>
        </div>
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Active Orders</h3>
          <p className="text-3xl font-bold text-orange-600">{activeOrders.length}</p>
          <p className="text-sm text-gray-500 mt-1">Needs attention</p>
        </div>
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Completed</h3>
          <p className="text-3xl font-bold text-green-600">{completedOrders.length}</p>
          <p className="text-sm text-gray-500 mt-1">Successfully delivered</p>
        </div>
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Total Earnings</h3>
          <p className="text-3xl font-bold text-purple-600">${totalEarnings.toFixed(2)}</p>
          <p className="text-sm text-gray-500 mt-1">After platform fees</p>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white p-4 rounded-lg border mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
          <div className="flex flex-wrap gap-4">
            {/* Status Filter */}
            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
              <select
                id="status-filter"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Orders ({orders.length})</option>
                <option value="active">Active Orders ({activeOrders.length})</option>
                <option value="completed">Completed Orders ({completedOrders.length})</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="amount">Highest Amount</option>
              </select>
            </div>
          </div>

          <div className="text-sm text-gray-500">
            Showing {filteredOrders.length} of {orders.length} orders
          </div>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            {filterStatus === 'all' ? 'No Orders Yet' : 
             filterStatus === 'active' ? 'No Active Orders' : 'No Completed Orders'}
          </h3>
          <p className="text-gray-500">
            {filterStatus === 'all' ? 'Orders will appear here when customers place them.' :
             filterStatus === 'active' ? 'All orders have been completed.' : 'No orders have been completed yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-4 mb-2">
                    <h4 className="font-bold text-xl text-blue-800">Order #{order.id}</h4>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      order.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : order.status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {order.status === 'completed' ? '✅ Completed' : 
                       order.status === 'cancelled' ? '❌ Cancelled' : '🔄 Active'}
                    </span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                      order.delivery_type === 'pickup' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {order.delivery_type === 'pickup' ? '🏪 PICKUP' : '🚚 DELIVERY'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Ordered on {new Date(order.created_at).toLocaleDateString()} at{' '}
                    {new Date(order.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="mb-1">
                    <span className="text-2xl font-bold text-green-600">
                      ${(Number(order.total || 0) - Number(order.platform_fee || 0)).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Total: ${Number(order.total || 0).toFixed(2)} | Fee: ${Number(order.platform_fee || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Customer Information */}
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <h5 className="font-medium text-blue-800 mb-3">👤 Customer Information</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Name:</span>
                    <span className="ml-2">{order.customer_name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Email:</span>
                    <span className="ml-2">{order.customer_email}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Phone:</span>
                    <span className="ml-2">{order.delivery_phone || order.customer_phone || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Delivery Preference:</span>
                    <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                      order.delivery_type === 'pickup' 
                        ? 'bg-orange-100 text-orange-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {order.delivery_type === 'pickup' ? '🏪 Pickup' : '🚚 Delivery'}
                    </span>
                  </div>
                  {order.delivery_type === 'delivery' && (
                    <div className="md:col-span-2">
                      <span className="font-medium text-gray-700">Delivery Address:</span>
                      <span className="ml-2">{order.delivery_address || order.customer_address || 'Not provided'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Special Instructions */}
              {order.order_details && (
                <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                  <h5 className="font-medium text-yellow-800 mb-2">📝 Special Instructions</h5>
                  <p className="text-sm text-yellow-700 whitespace-pre-wrap">{order.order_details}</p>
                </div>
              )}
              
              {/* Order Items */}
              <div className="border-t pt-4 mb-4">
                <h5 className="font-medium mb-3">🍽️ Order Items</h5>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-sm bg-gray-50 p-3 rounded">
                      <div className="flex-1">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-gray-500 ml-2">x {item.quantity}</span>
                      </div>
                      <span className="font-medium">${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="flex space-x-3">
                  <button
                    onClick={() => printOrder(order)}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors flex items-center space-x-2"
                  >
                    <span>🖨️</span>
                    <span>Print Order</span>
                  </button>
                  
                  {order.status === 'active' && (
                    <button
                      onClick={() => showCompleteModal(order.id)}
                      className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600 transition-colors flex items-center space-x-2"
                    >
                      <span>✅</span>
                      <span>Mark Complete</span>
                    </button>
                  )}
                  
                  {canRemoveOrder(order.status) && (
                    <button
                      onClick={() => confirmRemoveOrder(order.id)}
                      className="bg-gray-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600 transition-colors flex items-center space-x-2"
                      title="Remove completed order from your view"
                    >
                      <span>🗑️</span>
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                
                <div className="text-xs text-gray-500">
                  {order.status === 'completed' ? 'Your portion completed' : 
                   order.status === 'cancelled' ? 'Customer cancelled' : 'Ready to prepare'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Complete Order Confirmation Modal */}
      {showCompleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Complete Order #{showCompleteConfirm}
            </h3>
            <p className="text-gray-600 mb-6">
              Mark this order as completed? This will update the order status and notify the customer that their order is ready.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCompleteConfirm(null)}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => completeOrder(showCompleteConfirm)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                ✅ Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Order Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Remove Order #{showRemoveConfirm}
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove this completed order from your view? This will hide it from your orders list but won&apos;t affect the customer&apos;s record.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRemoveConfirm(null)}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => removeOrder(showRemoveConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                🗑️ Remove Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OwnerOrders;