import React, { useEffect, useState, useContext, useCallback } from "react";
import { OwnerAuthContext } from "../context/OwnerAuthContext";
import { Navigate, Link } from "react-router-dom";
import { toast } from 'react-toastify';

function OwnerNotifications() {
  const { owner, loading: authLoading } = useContext(OwnerAuthContext);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAction, setRefundAction] = useState('');
  const [refundNotes, setRefundNotes] = useState('');
  const [selectedNotificationId, setSelectedNotificationId] = useState(null);
  const [processingRefund, setProcessingRefund] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:5001/api/owners/notifications", {
        credentials: "include",
      });
      
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      // Notifications fetch error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markNotificationRead = async (notificationId) => {
    try {
      const res = await fetch(`http://localhost:5001/api/owners/notifications/${notificationId}/mark-read`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, read: true }
              : notification
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      // Mark notification read error
    }
  };

  const showRefundConfirm = (notificationId, action) => {
    setSelectedNotificationId(notificationId);
    setRefundAction(action);
    setRefundNotes('');
    setShowRefundModal(true);
  };

  const processRefund = async () => {
    if (!selectedNotificationId || !refundAction) return;
    
    try {
      setProcessingRefund(true);
      const res = await fetch(`http://localhost:5001/api/owners/refunds/${selectedNotificationId}/process`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: refundAction,
          notes: refundNotes.trim()
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to process refund");
      }

      const responseData = await res.json();
      
      // Update notification in local state
      setNotifications(prev => 
        prev.map(notification => {
          if (notification.id === selectedNotificationId) {
            const updatedData = {
              ...notification.data,
              refundProcessed: true,
              refundAction: refundAction,
              refundNotes: refundNotes.trim(),
              processedAt: new Date().toISOString()
            };
            return {
              ...notification,
              read: true,
              data: updatedData
            };
          }
          return notification;
        })
      );

      toast.success(responseData.message);
      setShowRefundModal(false);
      setSelectedNotificationId(null);
      setRefundAction('');
      setRefundNotes('');
    } catch (err) {
      // Process refund error
      toast.error("Error processing refund: " + err.message);
    } finally {
      setProcessingRefund(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("http://localhost:5001/api/owners/notifications/mark-all-read", {
        method: "POST",
        credentials: "include",
      });
      setNotifications(prev => prev.map(n => ({...n, read: true})));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error("Failed to mark all notifications as read");
    }
  };

  if (authLoading || loading) {
    return <div className="text-center p-6">Loading notifications...</div>;
  }

  if (!owner) {
    return <Navigate to="/owner/login" />;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Notifications</h1>
          <p className="text-gray-600">Manage your restaurant notifications and refund requests</p>
        </div>
        <Link 
          to="/owner/dashboard"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-800">Total Notifications</h3>
          <p className="text-2xl font-bold text-blue-600">{notifications.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-800">Unread</h3>
          <p className="text-2xl font-bold text-orange-600">{unreadCount}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-800">Pending Refunds</h3>
          <p className="text-2xl font-bold text-red-600">
            {notifications.filter(n => n.type === 'refund_request' && !n.data?.refundProcessed).length}
          </p>
        </div>
      </div>

      {/* Actions Bar */}
      {notifications.length > 0 && (
        <div className="flex justify-between items-center mb-6">
          <div className="flex space-x-4">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Mark All Read ({unreadCount})
              </button>
            )}
          </div>
          <div className="text-sm text-gray-500">
            Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">🔔</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No Notifications</h3>
          <p className="text-gray-500">You're all caught up! New notifications will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => {
            const data = notification.data || {};
            const isRefundRequest = notification.type === 'refund_request';
            const isProcessed = data.refundProcessed;
            
            return (
              <div 
                key={notification.id} 
                className={`border rounded-lg p-6 transition-all hover:shadow-md ${
                  !notification.read ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white'
                }`}
                onClick={() => !notification.read && markNotificationRead(notification.id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${!notification.read ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                    <h4 className={`font-semibold text-lg ${isRefundRequest ? 'text-orange-700' : 'text-gray-800'}`}>
                      {notification.title}
                    </h4>
                    {isRefundRequest && !isProcessed && (
                      <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                        Needs Action
                      </span>
                    )}
                    {isProcessed && (
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        data.refundAction === 'approve' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {data.refundAction === 'approve' ? 'Approved' : 'Denied'}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(notification.created_at).toLocaleDateString()} at{' '}
                    {new Date(notification.created_at).toLocaleTimeString()}
                  </span>
                </div>
                
                <p className="text-gray-600 mb-4 leading-relaxed">{notification.message}</p>
                
                {/* Show restaurant-specific refund amount for refund requests */}
                {isRefundRequest && data.restaurantTotal !== undefined && (
                  <div className="bg-orange-50 p-4 rounded-lg mb-4 border border-orange-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-orange-800">Your Refund Amount:</span>
                      <span className="text-xl font-bold text-orange-700">${Number(data.restaurantTotal || 0).toFixed(2)}</span>
                    </div>
                    {data.itemCount && (
                      <div className="text-sm text-orange-600">
                        For {data.itemCount} item{data.itemCount !== 1 ? 's' : ''} from your restaurant
                      </div>
                    )}
                    {data.orderTotal && data.restaurantTotal !== data.orderTotal && (
                      <div className="text-xs text-orange-500 mt-1">
                        (Total order value: ${Number(data.orderTotal || 0).toFixed(2)})
                      </div>
                    )}
                  </div>
                )}

                {data.reason && (
                  <div className="bg-gray-50 p-3 rounded-lg text-sm mb-4">
                    <strong>Reason:</strong> {data.reason}
                  </div>
                )}
                
                {isRefundRequest && !isProcessed && (
                  <div className="flex space-x-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showRefundConfirm(notification.id, 'approve');
                      }}
                      className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600 transition-colors flex items-center space-x-2"
                    >
                      <span>✅</span>
                      <span>Approve Refund</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showRefundConfirm(notification.id, 'deny');
                      }}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition-colors flex items-center space-x-2"
                    >
                      <span>❌</span>
                      <span>Deny Refund</span>
                    </button>
                  </div>
                )}
                
                {isProcessed && (
                  <div className={`text-sm p-3 rounded-lg ${data.refundAction === 'approve' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    <strong>Refund {data.refundAction}d</strong>
                    {data.refundNotes && <div className="mt-1">Notes: {data.refundNotes}</div>}
                    <div className="text-xs opacity-75 mt-1">
                      Processed on {new Date(data.processedAt).toLocaleDateString()}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Refund Processing Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className={`text-lg font-semibold mb-4 ${refundAction === 'approve' ? 'text-green-800' : 'text-red-800'}`}>
              {refundAction === 'approve' ? '✅ Approve Refund Request' : '❌ Deny Refund Request'}
            </h3>
            <p className="text-gray-600 mb-4">
              {refundAction === 'approve' 
                ? 'Are you sure you want to approve this refund request? The customer will be notified of your decision.'
                : 'Are you sure you want to deny this refund request? The customer will be notified of your decision.'
              }
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes for customer (optional):
              </label>
              <textarea
                value={refundNotes}
                onChange={(e) => {
                  if (e.target.value.length <= 500) {
                    setRefundNotes(e.target.value);
                  }
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows="4"
                placeholder={refundAction === 'approve' 
                  ? "Add any additional information about the refund process..."
                  : "Explain why the refund request is being denied..."
                }
                autoFocus
              />
              <div className="text-xs text-gray-500 mt-1">
                {refundNotes.length}/500 characters
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setSelectedNotificationId(null);
                  setRefundAction('');
                  setRefundNotes('');
                }}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                disabled={processingRefund}
              >
                Cancel
              </button>
              <button
                onClick={processRefund}
                disabled={processingRefund}
                className={`px-4 py-2 text-white rounded-lg transition-colors ${
                  refundAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700 disabled:bg-green-400'
                    : 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                }`}
              >
                {processingRefund ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  refundAction === 'approve' ? '✅ Approve Refund' : '❌ Deny Refund'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OwnerNotifications;