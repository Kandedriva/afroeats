import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';
import { toast } from 'react-toastify';
import ConfirmDialog from '../Components/ConfirmDialog';

const OwnerGroceryOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [printOrder, setPrintOrder] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmColor: 'red',
    icon: '⚠️',
  });

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/grocery-owners/orders`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      } else {
        toast.error('Failed to load orders');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Load orders error:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const STATUS_NEXT = {
    paid:             { next: 'preparing',        label: 'Mark as Preparing',       icon: '🥬', color: 'blue' },
    preparing:        { next: 'out_for_delivery',  label: 'Mark as Out for Delivery', icon: '🚚', color: 'orange' },
    out_for_delivery: { next: 'delivered',         label: 'Mark as Delivered',        icon: '✓',  color: 'green' },
  };

  const STATUS_LABELS = {
    preparing:        'Preparing',
    out_for_delivery: 'Out for Delivery',
    delivered:        'Delivered',
    cancelled:        'Cancelled',
  };

  const handleUpdateStatus = (orderId, currentStatus) => {
    const transition = STATUS_NEXT[currentStatus];
    if (!transition) return;
    setConfirmDialog({
      isOpen: true,
      title: `${transition.label}?`,
      message: `This will update the order status to "${STATUS_LABELS[transition.next] || transition.next}". The customer will be notified.`,
      confirmColor: transition.color,
      icon: transition.icon,
      onConfirm: () => executeUpdateStatus(orderId, transition.next),
    });
  };

  const executeUpdateStatus = async (orderId, newStatus) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/grocery-owners/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast.success(`Order updated: ${STATUS_LABELS[newStatus] || newStatus}`);
        setSelectedOrder(null);
        loadOrders();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to update order status');
      }
    } catch (error) {
      toast.error('An error occurred while updating order status');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteOrder = (orderId) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Order?',
      message: 'Are you sure you want to delete this order? This action cannot be undone and the order will be permanently removed from your records.',
      confirmColor: 'red',
      icon: '🗑️',
      onConfirm: () => executeDeleteOrder(orderId),
    });
  };

  const executeDeleteOrder = async (orderId) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/grocery-owners/orders/${orderId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success('Order deleted successfully');
        setSelectedOrder(null);
        loadOrders();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete order');
      }
    } catch (error) {
      toast.error('An error occurred while deleting order');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = (order) => {
    setPrintOrder(order);
    setTimeout(() => {
      window.print();
      setPrintOrder(null);
    }, 100);
  };

  const filteredOrders = orders.filter((order) => {
    if (filterStatus === 'all') {
      return true;
    }
    return order.status === filterStatus;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      paid: { bg: 'bg-green-100', text: 'text-green-800', label: 'Paid' },
      preparing: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Preparing' },
      ready: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Ready' },
      out_for_delivery: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Out for Delivery' },
      delivered: { bg: 'bg-green-100', text: 'text-green-800', label: 'Delivered' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
    };

    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading orders...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Print View */}
        {printOrder && (
          <div className="print-only fixed inset-0 bg-white p-8 z-50">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold">Order Dabaly</h1>
                <p className="text-gray-600">Grocery Order Receipt</p>
              </div>

              <div className="mb-6">
                <h2 className="text-xl font-bold mb-4">Order #{printOrder.id}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="font-semibold">Customer Information:</p>
                    <p>{printOrder.customer_name}</p>
                    <p>{printOrder.customer_email}</p>
                    <p>Phone: {printOrder.delivery_phone || printOrder.customer_phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="font-semibold">Order Date:</p>
                    <p>{new Date(printOrder.created_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })} {new Date(printOrder.created_at).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="font-semibold mt-2">Status:</p>
                    <p>{printOrder.status}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <p className="font-semibold mb-2">Delivery Address:</p>
                <p>{printOrder.delivery_name}</p>
                <p>{printOrder.delivery_address}</p>
                <p>{printOrder.delivery_city}, {printOrder.delivery_state} {printOrder.delivery_zip}</p>
              </div>

              <table className="w-full mb-6 border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">Product</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">Qty</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">Price</th>
                    <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {printOrder.items && printOrder.items.map((item, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 px-4 py-2">{item.product_name}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">{item.quantity} {item.unit}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">${Number(item.unit_price).toFixed(2)}</td>
                      <td className="border border-gray-300 px-4 py-2 text-right">${Number(item.total_price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="text-right">
                <p>Subtotal: ${Number(printOrder.subtotal).toFixed(2)}</p>
                <p>Delivery Fee: ${Number(printOrder.delivery_fee).toFixed(2)}</p>
                <p>Platform Fee: ${Number(printOrder.platform_fee).toFixed(2)}</p>
                <p className="text-xl font-bold mt-2">Total: ${Number(printOrder.total).toFixed(2)}</p>
              </div>

              {printOrder.special_instructions && (
                <div className="mt-6">
                  <p className="font-semibold">Special Instructions:</p>
                  <p className="text-gray-700">{printOrder.special_instructions}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🛒 Grocery Orders</h1>
          <p className="text-gray-600">Manage your grocery store orders</p>
        </div>

        {/* Filter Buttons */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'all'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({orders.length})
            </button>
            <button
              onClick={() => setFilterStatus('paid')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'paid'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Paid ({orders.filter(o => o.status === 'paid').length})
            </button>
            <button
              onClick={() => setFilterStatus('preparing')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'preparing'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Preparing ({orders.filter(o => o.status === 'preparing').length})
            </button>
            <button
              onClick={() => setFilterStatus('delivered')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterStatus === 'delivered'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Delivered ({orders.filter(o => o.status === 'delivered').length})
            </button>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">#{order.id}</div>
                        <div className="text-sm text-gray-500">{order.total_items} items</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{order.customer_name}</div>
                        <div className="text-sm text-gray-500">📞 {order.delivery_phone || order.customer_phone || 'N/A'}</div>
                        {order.guest_email && (
                          <div className="text-xs text-purple-600 mt-1">Guest Order</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                        className="text-green-600 hover:text-green-900 text-sm font-medium"
                      >
                        View Items
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">${Number(order.total).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{new Date(order.created_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</div>
                      <div className="text-xs text-gray-500">{new Date(order.created_at).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePrint(order)}
                          className="text-blue-600 hover:text-blue-900 text-sm"
                          title="Print Order"
                        >
                          🖨️
                        </button>
                        {STATUS_NEXT[order.status] ? (
                          <button
                            onClick={() => handleUpdateStatus(order.id, order.status)}
                            disabled={isProcessing}
                            className="text-blue-600 hover:text-blue-900 text-sm disabled:opacity-50"
                            title={STATUS_NEXT[order.status].label}
                          >
                            {STATUS_NEXT[order.status].icon} {STATUS_NEXT[order.status].label}
                          </button>
                        ) : order.status === 'delivered' ? (
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            disabled={isProcessing}
                            className="text-red-600 hover:text-red-900 text-sm disabled:opacity-50"
                            title="Delete Order"
                          >
                            🗑️ Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <span className="text-5xl mb-2 block">🛒</span>
              <p className="text-lg">No grocery orders found</p>
              {filterStatus !== 'all' && (
                <button
                  onClick={() => setFilterStatus('all')}
                  className="mt-4 text-green-600 hover:text-green-700 font-medium"
                >
                  View all orders
                </button>
              )}
            </div>
          )}
        </div>

        {/* Order Details Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">Order #{selectedOrder.id}</h2>
                    <p className="text-gray-600">Placed on {new Date(selectedOrder.created_at).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-gray-500 hover:text-gray-700 text-2xl"
                  >
                    ✕
                  </button>
                </div>

                {/* Customer Info */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-medium">{selectedOrder.customer_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{selectedOrder.delivery_phone || selectedOrder.customer_phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">{selectedOrder.customer_email}</p>
                    </div>
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Delivery Address</h3>
                  <p>{selectedOrder.delivery_name}</p>
                  <p>{selectedOrder.delivery_address}</p>
                  <p>{selectedOrder.delivery_city}, {selectedOrder.delivery_state} {selectedOrder.delivery_zip}</p>
                </div>

                {/* Order Items */}
                <div className="mb-6">
                  <h3 className="font-semibold mb-4">Order Items</h3>
                  <div className="space-y-3">
                    {selectedOrder.items && selectedOrder.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-start p-3 bg-gray-50 rounded">
                        <div className="flex-1">
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-sm text-gray-600">
                            {item.quantity} {item.unit} × ${Number(item.unit_price).toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${Number(item.total_price).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="border-t pt-4 mb-6">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>${Number(selectedOrder.subtotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery Fee:</span>
                      <span>${Number(selectedOrder.delivery_fee).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform Fee:</span>
                      <span>${Number(selectedOrder.platform_fee).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t">
                      <span>Total:</span>
                      <span className="text-green-600">${Number(selectedOrder.total).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Special Instructions */}
                {selectedOrder.special_instructions && (
                  <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h3 className="font-semibold mb-2">Special Instructions</h3>
                    <p className="text-gray-700">{selectedOrder.special_instructions}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => handlePrint(selectedOrder)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    🖨️ Print Order
                  </button>
                  {STATUS_NEXT[selectedOrder.status] ? (
                    <button
                      onClick={() => handleUpdateStatus(selectedOrder.id, selectedOrder.status)}
                      disabled={isProcessing}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {STATUS_NEXT[selectedOrder.status].icon} {STATUS_NEXT[selectedOrder.status].label}
                    </button>
                  ) : selectedOrder.status === 'delivered' ? (
                    <button
                      onClick={() => handleDeleteOrder(selectedOrder.id)}
                      disabled={isProcessing}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      🗑️ Delete Order
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Dialog */}
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmColor={confirmDialog.confirmColor}
          icon={confirmDialog.icon}
        />

        {/* Print Styles */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-only, .print-only * {
              visibility: visible;
            }
            .print-only {
              position: fixed;
              left: 0;
              top: 0;
              width: 100%;
            }
          }
          .print-only {
            display: none;
          }
          @media print {
            .print-only {
              display: block;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

export default OwnerGroceryOrders;
