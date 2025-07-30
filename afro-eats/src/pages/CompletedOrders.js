import React, { useEffect, useState, useContext } from "react";
import { OwnerAuthContext } from "../context/OwnerAuthContext";
import { Navigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";

function CompletedOrders() {
  const { owner, loading: authLoading } = useContext(OwnerAuthContext);
  const [orders, setOrders] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
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
        // Handle data fetch error silently
      } finally {
        setLoading(false);
      }
    };

    if (owner) {
      fetchData();
    }
  }, [owner]);

  const showDeleteConfirmation = (orderId) => {
    setOrderToDelete(orderId);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!orderToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/owners/orders/${orderToDelete}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete order");
      }

      // Remove the order from the list
      setOrders(prev => prev.filter(order => order.id !== orderToDelete));
      toast.success("Order deleted successfully!");
      
      // Close modal and reset state
      setShowDeleteModal(false);
      setOrderToDelete(null);
    } catch (err) {
      toast.error("Error deleting order: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setOrderToDelete(null);
  };

  const printOrder = (order) => {
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order #${order.id} - ${restaurant?.name || 'Restaurant'}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              color: #333; 
              line-height: 1.6;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #333; 
              padding-bottom: 15px; 
              margin-bottom: 25px; 
            }
            .header h1 { 
              margin: 0 0 10px 0; 
              color: #2d3748; 
              font-size: 28px;
            }
            .header h2 { 
              margin: 0 0 10px 0; 
              color: #4a5568; 
              font-size: 22px;
            }
            .order-info { 
              margin-bottom: 25px; 
            }
            .customer-info { 
              background: #f7fafc; 
              padding: 20px; 
              border-radius: 8px; 
              border: 1px solid #e2e8f0;
              margin-bottom: 25px; 
            }
            .customer-info h3 {
              margin: 0 0 15px 0;
              color: #2d3748;
              font-size: 18px;
            }
            .customer-info p { 
              margin: 8px 0; 
              font-size: 14px;
            }
            .items-table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 25px; 
              border: 1px solid #e2e8f0;
            }
            .items-table th, .items-table td { 
              border: 1px solid #e2e8f0; 
              padding: 12px 8px; 
              text-align: left; 
            }
            .items-table th { 
              background-color: #edf2f7; 
              font-weight: bold;
              color: #2d3748;
            }
            .items-table tbody tr:nth-child(even) {
              background-color: #f7fafc;
            }
            .total-section { 
              text-align: right; 
              font-size: 16px;
              border-top: 2px solid #e2e8f0;
              padding-top: 15px;
              margin-top: 20px;
            }
            .total-section p {
              margin: 8px 0;
            }
            .total-amount {
              font-weight: bold; 
              font-size: 20px;
              color: #2d3748;
            }
            .restaurant-earnings {
              color: #38a169; 
              font-weight: bold;
            }
            .print-footer { 
              margin-top: 40px; 
              text-align: center; 
              font-size: 12px; 
              color: #718096; 
              border-top: 1px solid #e2e8f0;
              padding-top: 20px;
            }
            .status-badge {
              background-color: #38a169;
              color: white;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 14px;
              font-weight: bold;
            }
            .special-instructions {
              background: #fefcbf;
              border: 1px solid #f6e05e;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .special-instructions h4 {
              margin: 0 0 10px 0;
              color: #744210;
            }
            @media print {
              body { margin: 0; }
              .header { page-break-after: avoid; }
              .customer-info { page-break-inside: avoid; }
              .items-table { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${restaurant?.name || 'Restaurant'}</h1>
            <h2>Completed Order Receipt #${order.id}</h2>
            <p>Order Date: ${new Date(order.created_at).toLocaleDateString()} at ${new Date(order.created_at).toLocaleTimeString()}</p>
            <span class="status-badge">✅ COMPLETED</span>
          </div>
          
          <div class="customer-info">
            <h3>Customer Information</h3>
            <p><strong>Name:</strong> ${order.customer_name}</p>
            <p><strong>Email:</strong> ${order.customer_email}</p>
            <p><strong>Delivery Phone:</strong> ${order.delivery_phone || order.customer_phone || 'Not provided'}</p>
            <p><strong>Delivery Address:</strong> ${order.delivery_address || order.customer_address || 'Not provided'}</p>
          </div>
          
          ${order.order_details ? `
          <div class="special-instructions">
            <h4>📝 Special Instructions</h4>
            <p>${order.order_details}</p>
          </div>
          ` : ''}
          
          <div class="order-info">
            <h3>Order Details</h3>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${order.items?.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.quantity}</td>
                    <td>$${Number(item.price || 0).toFixed(2)}</td>
                    <td>$${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</td>
                  </tr>
                `).join('') || '<tr><td colspan="4">No items found</td></tr>'}
              </tbody>
            </table>
          </div>
          
          <div class="total-section">
            <p>Subtotal: $${(Number(order.total || 0) - Number(order.platform_fee || 0)).toFixed(2)}</p>
            <p>Platform Fee: $${Number(order.platform_fee || 0).toFixed(2)}</p>
            <p class="total-amount">Total Paid by Customer: $${Number(order.total || 0).toFixed(2)}</p>
            <p class="restaurant-earnings">Your Earnings: $${(Number(order.total || 0) - Number(order.platform_fee || 0)).toFixed(2)}</p>
          </div>
          
          <div class="print-footer">
            <p><strong>Thank you for using our platform!</strong></p>
            <p>Order completed and printed on: ${new Date().toLocaleString()}</p>
            <p>This is a completed order receipt for your records.</p>
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

  const handleSelectOrder = (orderId) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const selectAllOrders = () => {
    const completedOrders = orders.filter(order => order.status === 'completed');
    const allOrderIds = new Set(completedOrders.map(order => order.id));
    setSelectedOrders(allOrderIds);
  };

  const deselectAllOrders = () => {
    setSelectedOrders(new Set());
  };

  const printSelectedOrders = () => {
    const completedOrders = orders.filter(order => order.status === 'completed');
    const ordersToPrint = completedOrders.filter(order => selectedOrders.has(order.id));
    
    if (ordersToPrint.length === 0) {
      toast.warning("Please select at least one order to print.");
      return;
    }

    // Print each order with a slight delay to avoid overwhelming the printer
    ordersToPrint.forEach((order, index) => {
      setTimeout(() => {
        printOrder(order);
      }, index * 300);
    });

    toast.success(`Printing ${ordersToPrint.length} order receipt${ordersToPrint.length !== 1 ? 's' : ''}...`);
    setSelectedOrders(new Set()); // Clear selection after printing
  };

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!owner) {
    return <Navigate to="/owner/login" replace />;
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto mt-10 p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Completed Orders</h2>
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-500">Loading completed orders...</div>
        </div>
      </div>
    );
  }

  const completedOrders = orders.filter(order => order.status === 'completed');

  return (
    <div className="max-w-6xl mx-auto mt-10 p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Completed Orders</h2>
        <p className="text-gray-600">Manage your completed order history • Print receipts for your records</p>
      </div>

      {completedOrders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-gray-500">
            <p className="text-lg mb-2">No completed orders yet</p>
            <p className="text-sm">Completed orders will appear here after you mark them as complete from your dashboard</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-6">
            <div className="text-sm text-gray-600">
              Showing {completedOrders.length} completed order{completedOrders.length !== 1 ? 's' : ''}
              {selectedOrders.size > 0 && (
                <span className="ml-2 text-blue-600 font-medium">
                  • {selectedOrders.size} selected
                </span>
              )}
            </div>
            
            {completedOrders.length > 0 && (
              <div className="flex items-center space-x-3">
                {selectedOrders.size === 0 ? (
                  <button
                    onClick={selectAllOrders}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Select All
                  </button>
                ) : (
                  <>
                    <button
                      onClick={deselectAllOrders}
                      className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                    >
                      Deselect All
                    </button>
                    <button
                      onClick={printSelectedOrders}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
                    >
                      🖨️ Print Selected ({selectedOrders.size})
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          
          {completedOrders.map((order) => (
            <div key={order.id} className={`border rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-all ${selectedOrders.has(order.id) ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-start space-x-4 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedOrders.has(order.id)}
                    onChange={() => handleSelectOrder(order.id)}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-800">Order #{order.id}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Completed on {new Date(order.created_at).toLocaleDateString()} at{' '}
                      {new Date(order.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    ✅ Completed
                  </span>
                  <div className="mt-2">
                    <span className="text-xl font-bold text-green-600">
                      ${(Number(order.total || 0) - Number(order.platform_fee || 0)).toFixed(2)}
                    </span>
                    <p className="text-xs text-gray-500">
                      (Total: ${Number(order.total || 0).toFixed(2)} - Platform fee: ${Number(order.platform_fee || 0).toFixed(2)})
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="font-medium text-gray-800 mb-3">Customer Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Name:</span>
                    <span className="ml-2 text-gray-800">{order.customer_name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Email:</span>
                    <span className="ml-2 text-gray-800">{order.customer_email}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Delivery Phone:</span>
                    <span className="ml-2 text-gray-800">{order.delivery_phone || order.customer_phone || 'Not provided'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Delivery Address:</span>
                    <span className="ml-2 text-gray-800">{order.delivery_address || order.customer_address || 'Not provided'}</span>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="mb-4">
                <h4 className="font-medium text-gray-800 mb-3">Items Ordered</h4>
                <div className="bg-white border rounded-lg">
                  {order.items?.map((item, index) => (
                    <div key={index} className={`flex justify-between items-center p-3 ${index !== order.items.length - 1 ? 'border-b' : ''}`}>
                      <div className="flex-1">
                        <span className="font-medium text-gray-800">{item.name}</span>
                        <span className="text-gray-500 ml-2">x{item.quantity}</span>
                      </div>
                      <span className="font-medium text-gray-800">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Instructions */}
              {order.order_details && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
                  <h4 className="font-medium text-yellow-800 mb-2">📝 Special Instructions</h4>
                  <p className="text-sm text-yellow-700 whitespace-pre-wrap">{order.order_details}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-gray-500">
                  Order completed • Ready for printing or deletion
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => printOrder(order)}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
                    title="Print order receipt"
                  >
                    🖨️ Print Receipt
                  </button>
                  <button
                    onClick={() => showDeleteConfirmation(order.id)}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors flex items-center gap-2"
                    title="Delete order permanently"
                  >
                    🗑️ Delete Order
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 text-xl">⚠️</span>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Delete Order
                  </h3>
                  <p className="text-sm text-gray-500">
                    Order #{orderToDelete}
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="mb-6">
                <p className="text-gray-700 mb-3">
                  Are you sure you want to permanently delete this order? This action cannot be undone.
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <span className="text-red-400 text-sm">🚨</span>
                    </div>
                    <div className="ml-2">
                      <p className="text-sm text-red-700">
                        <strong>Warning:</strong> This will permanently remove all order data, including customer information and order history.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleDeleteCancel}
                  disabled={isDeleting}
                  className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      🗑️ Delete Order
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompletedOrders;