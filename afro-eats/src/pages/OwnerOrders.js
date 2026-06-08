import { useEffect, useState, useContext } from "react";
import { OwnerAuthContext } from "../context/OwnerAuthContext";
import { Navigate, Link } from "react-router-dom";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";

const STATUS_PIPELINE = ['active', 'preparing', 'ready', 'completed'];

const STATUS_CONFIG = {
  active:    { label: 'New Order',   emoji: '🆕', color: 'orange' },
  preparing: { label: 'Preparing',   emoji: '👨‍🍳', color: 'blue'   },
  ready:     { label: 'Ready',       emoji: '✅', color: 'purple' },
  completed: { label: 'Completed',   emoji: '🎉', color: 'green'  },
  cancelled: { label: 'Cancelled',   emoji: '❌', color: 'red'    },
};

const NEXT_ACTION = {
  active:    { label: 'Start Preparing', nextStatus: 'preparing', bg: 'bg-blue-600 hover:bg-blue-700'   },
  preparing: { label: 'Mark Ready',      nextStatus: 'ready',     bg: 'bg-purple-600 hover:bg-purple-700' },
  ready:     { label: 'Mark Complete',   nextStatus: 'completed', bg: 'bg-green-600 hover:bg-green-700'  },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const colorMap = {
    orange: 'bg-orange-100 text-orange-800',
    blue:   'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    green:  'bg-green-100 text-green-800',
    red:    'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${colorMap[cfg.color]}`}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

function StatusProgress({ status }) {
  const steps = ['active', 'preparing', 'ready', 'completed'];
  const currentIdx = steps.indexOf(status);
  if (status === 'cancelled') { return null; }
  return (
    <div className="flex items-center gap-1 mt-3">
      {steps.map((step, i) => {
        const done = i <= currentIdx;
        const cfg = STATUS_CONFIG[step];
        return (
          <div key={step} className="flex items-center">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
              done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
            }`}>
              {done ? '✓' : i + 1}
            </div>
            <span className={`hidden sm:block text-xs ml-1 ${done ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
              {cfg.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`w-6 sm:w-10 h-0.5 mx-1 ${i < currentIdx ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OwnerOrders() {
  const { owner, loading: authLoading } = useContext(OwnerAuthContext);
  const [orders, setOrders] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [processingId, setProcessingId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { orderId, nextStatus, label }
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [ordersRes, restaurantRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/owners/orders`, { credentials: 'include' }),
          fetch(`${API_BASE_URL}/api/owners/restaurant`, { credentials: 'include' }),
        ]);
        if (ordersRes.ok) {
          const data = await ordersRes.json();
          setOrders(data.orders || []);
        }
        if (restaurantRes.ok) {
          setRestaurant(await restaurantRes.json());
        }
      } catch {
        toast.error('Failed to load orders');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const advanceStatus = async (orderId, nextStatus) => {
    setProcessingId(orderId);
    try {
      let res;
      if (nextStatus === 'completed') {
        res = await fetch(`${API_BASE_URL}/api/owners/orders/${orderId}/complete`, {
          method: 'POST',
          credentials: 'include',
        });
      } else {
        res = await fetch(`${API_BASE_URL}/api/owners/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: nextStatus }),
        });
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update status');
      }
      setOrders(prev => prev.map(o =>
        o.id === orderId
          ? {
              ...o,
              status: nextStatus,
              ...(nextStatus === 'preparing' ? { preparing_at: new Date().toISOString() } : {}),
              ...(nextStatus === 'ready'     ? { ready_at:     new Date().toISOString() } : {}),
              ...(nextStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}),
            }
          : o
      ));
      const labels = { preparing: 'Preparing', ready: 'Ready', completed: 'Completed' };
      toast.success(`Order #${orderId} marked as ${labels[nextStatus] || nextStatus}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessingId(null);
      setConfirmAction(null);
    }
  };

  const removeOrder = async (orderId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/owners/orders/${orderId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to remove order');
      }
      const data = await res.json();
      setOrders(prev => prev.filter(o => o.id !== orderId));
      toast.success(data.message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setShowRemoveConfirm(null);
    }
  };

  const printOrder = (order) => {
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html><html><head>
        <title>Order #${order.id} - ${restaurant?.name || 'Restaurant'}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
          .badge { background: #007bff; color: white; padding: 5px 10px; border-radius: 15px; font-size: 12px; display: inline-block; }
          .box { padding: 15px; border-radius: 5px; margin-bottom: 20px; }
          .blue-box { background: #f5f5f5; }
          .green-box { background: #e8f5e8; border-left: 4px solid #28a745; }
          .yellow-box { background: #fff3cd; border-left: 4px solid #ffc107; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .total { text-align: right; font-weight: bold; font-size: 18px; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head><body>
        <div class="header">
          <div class="badge">🍽️ OrderDabaly</div>
          <h1>${restaurant?.name || 'Restaurant'}</h1>
          <h2>Order #${order.id}</h2>
          <p>${new Date(order.created_at).toLocaleDateString()} at ${new Date(order.created_at).toLocaleTimeString()}</p>
        </div>
        <div class="box blue-box">
          <h3>Customer</h3>
          <p>${order.customer_name} · ${order.customer_email} · ${order.delivery_phone || 'No phone'}</p>
        </div>
        <div class="box ${order.delivery_type === 'pickup' ? 'yellow-box' : 'green-box'}">
          <h3>${order.delivery_type === 'pickup' ? '🏪 Pickup' : '🚚 Delivery'}</h3>
          ${order.delivery_type === 'pickup'
            ? '<p>Customer will pick up at your location.</p>'
            : `<p>${order.delivery_address || 'No address'}</p>`}
        </div>
        <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>${order.items.map(i => `
          <tr>
            <td>${i.name}</td><td>${i.quantity}</td>
            <td>$${Number(i.price || 0).toFixed(2)}</td>
            <td>$${(Number(i.price || 0) * Number(i.quantity || 1)).toFixed(2)}</td>
          </tr>`).join('')}
        </tbody></table>
        <div class="total">
          <p>Total: $${Number(order.total || 0).toFixed(2)}</p>
          <p style="color:green">Your Earnings: $${(Number(order.total || 0) - Number(order.platform_fee || 0)).toFixed(2)}</p>
        </div>
        ${order.order_details ? `<div class="box yellow-box"><h3>Special Instructions</h3><p>${order.order_details}</p></div>` : ''}
        <div class="footer"><p>Powered by OrderDabaly · Printed ${new Date().toLocaleString()}</p></div>
      </body></html>`;
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const isInProgress = (status) => !['completed', 'cancelled', 'removed'].includes(status);

  const getFilteredAndSorted = () => {
    let filtered = orders;
    if (filterStatus === 'active')    { filtered = orders.filter(o => isInProgress(o.status)); }
    else if (filterStatus === 'completed') { filtered = orders.filter(o => o.status === 'completed'); }
    else if (filterStatus !== 'all')  { filtered = orders.filter(o => o.status === filterStatus); }

    if (sortBy === 'newest') { filtered = [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); }
    else if (sortBy === 'oldest') { filtered = [...filtered].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); }
    else if (sortBy === 'amount') { filtered = [...filtered].sort((a, b) => Number(b.total || 0) - Number(a.total || 0)); }
    return filtered;
  };

  const inProgressOrders  = orders.filter(o => isInProgress(o.status));
  const completedOrders   = orders.filter(o => o.status === 'completed');
  const preparingOrders   = orders.filter(o => o.status === 'preparing');
  const readyOrders       = orders.filter(o => o.status === 'ready');
  const totalEarnings = orders.reduce((s, o) => s + (Number(o.total || 0) - Number(o.platform_fee || 0)), 0);

  const filteredOrders = getFilteredAndSorted();

  if (authLoading || loading) {
    return <div className="text-center p-6">Loading orders...</div>;
  }
  if (!owner) {
    return <Navigate to="/owner/login" />;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Order Management</h1>
          <p className="text-gray-500 text-sm">Manage and track your restaurant orders</p>
        </div>
        <Link to="/owner/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm">
          ← Dashboard
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-xs text-gray-500 mb-1">In Progress</p>
          <p className="text-2xl font-bold text-orange-600">{inProgressOrders.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Preparing</p>
          <p className="text-2xl font-bold text-blue-600">{preparingOrders.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Ready</p>
          <p className="text-2xl font-bold text-purple-600">{readyOrders.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Earnings</p>
          <p className="text-xl font-bold text-green-600">${totalEarnings.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              { val: 'all',       label: `All (${orders.length})` },
              { val: 'active',    label: `New (${orders.filter(o => o.status === 'active').length})` },
              { val: 'preparing', label: `Preparing (${preparingOrders.length})` },
              { val: 'ready',     label: `Ready (${readyOrders.length})` },
              { val: 'completed', label: `Done (${completedOrders.length})` },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setFilterStatus(val)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount">Highest amount</option>
          </select>
        </div>
      </div>

      {/* Orders */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No orders here</h3>
          <p className="text-gray-500">Orders will appear as customers place them.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              {/* Order header */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="font-bold text-lg text-blue-800">Order #{order.id}</h4>
                    <StatusBadge status={order.status} />
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      order.delivery_type === 'pickup'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {order.delivery_type === 'pickup' ? '🏪 PICKUP' : '🚚 DELIVERY'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(order.created_at).toLocaleDateString()} at {new Date(order.created_at).toLocaleTimeString()}
                  </p>
                  <StatusProgress status={order.status} />
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl font-bold text-green-600">
                    ${(Number(order.total || 0) - Number(order.platform_fee || 0)).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Total ${Number(order.total || 0).toFixed(2)} · Fee ${Number(order.platform_fee || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Customer info */}
              <div className="bg-blue-50 rounded-lg p-3 mb-3 text-sm">
                <p className="font-medium text-blue-800 mb-2">👤 Customer</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-gray-700">
                  <span><strong>Name:</strong> {order.customer_name}</span>
                  <span><strong>Email:</strong> {order.customer_email}</span>
                  <span><strong>Phone:</strong> {order.delivery_phone || 'Not provided'}</span>
                  {order.delivery_type === 'delivery' && (
                    <span className="sm:col-span-2"><strong>Address:</strong> {order.delivery_address || 'Not provided'}</span>
                  )}
                </div>
              </div>

              {/* Special instructions */}
              {order.order_details && (
                <div className="bg-yellow-50 rounded-lg p-3 mb-3 text-sm">
                  <p className="font-medium text-yellow-800 mb-1">📝 Special Instructions</p>
                  <p className="text-yellow-700 whitespace-pre-wrap">{order.order_details}</p>
                </div>
              )}

              {/* Items */}
              <div className="border-t pt-3 mb-4">
                <p className="font-medium text-sm mb-2">🍽️ Items</p>
                <div className="space-y-1.5">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center text-sm bg-gray-50 px-3 py-2 rounded">
                      <span className="font-medium">{item.name} <span className="text-gray-400">× {item.quantity}</span></span>
                      <span className="font-medium">${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-3 border-t">
                <button
                  onClick={() => printOrder(order)}
                  className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm hover:bg-gray-200 transition-colors flex items-center gap-1"
                >
                  🖨️ Print
                </button>

                {NEXT_ACTION[order.status] && (
                  <button
                    onClick={() => setConfirmAction({
                      orderId: order.id,
                      nextStatus: NEXT_ACTION[order.status].nextStatus,
                      label: NEXT_ACTION[order.status].label,
                    })}
                    disabled={processingId === order.id}
                    className={`text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1 ${NEXT_ACTION[order.status].bg}`}
                  >
                    {processingId === order.id ? 'Processing…' : NEXT_ACTION[order.status].label}
                  </button>
                )}

                {order.status === 'completed' && (
                  <button
                    onClick={() => setShowRemoveConfirm(order.id)}
                    className="bg-gray-500 text-white px-3 py-2 rounded-lg text-sm hover:bg-gray-600 transition-colors flex items-center gap-1"
                    title="Remove from your view"
                  >
                    🗑️ Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Status Advance Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold mb-3">
              {confirmAction.label} — Order #{confirmAction.orderId}
            </h3>
            <p className="text-gray-600 mb-6 text-sm">
              {confirmAction.nextStatus === 'preparing' && 'Confirm that you have started preparing this order. The customer will be notified.'}
              {confirmAction.nextStatus === 'ready'     && 'Confirm that this order is ready for pickup or delivery. The customer will be notified.'}
              {confirmAction.nextStatus === 'completed' && 'Mark this order as fully completed and delivered. The customer will be notified.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => advanceStatus(confirmAction.orderId, confirmAction.nextStatus)}
                disabled={processingId === confirmAction.orderId}
                className={`px-4 py-2 text-white rounded-lg font-medium transition-colors disabled:opacity-50 ${NEXT_ACTION[confirmAction.nextStatus === 'completed' ? 'ready' : confirmAction.nextStatus]?.bg || 'bg-green-600 hover:bg-green-700'}`}
              >
                {processingId === confirmAction.orderId ? 'Processing…' : `Confirm — ${confirmAction.label}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Order Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold mb-3">Remove Order #{showRemoveConfirm}</h3>
            <p className="text-gray-600 mb-6 text-sm">
              This will hide the order from your list. The customer&apos;s record is not affected.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRemoveConfirm(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => removeOrder(showRemoveConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                🗑️ Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OwnerOrders;
