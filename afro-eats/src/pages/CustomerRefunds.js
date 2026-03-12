import { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";

function CustomerRefunds() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const { user, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();

  const fetchRefunds = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/refunds/my-refunds`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch refunds");
      }

      const data = await res.json();
      setRefunds(data.refunds || []);
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchRefunds();
    }
  }, [user, fetchRefunds]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'succeeded': return 'bg-green-100 text-green-800 border-green-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'processing': return 'Processing';
      case 'succeeded': return 'Refunded';
      case 'failed': return 'Failed';
      case 'cancelled': return 'Cancelled';
      default: return status || 'Unknown';
    }
  };

  const getReasonText = (reason) => {
    const reasons = {
      'quality_issue': 'Quality Issue',
      'wrong_item': 'Wrong Item',
      'late_delivery': 'Late Delivery',
      'item_unavailable': 'Item Unavailable',
      'customer_request': 'Customer Request',
      'order_cancelled': 'Order Cancelled',
      'other': 'Other'
    };
    return reasons[reason] || reason;
  };

  const handleCancelRefund = async (refundId) => {
    try {
      setCancelling(true);
      const res = await fetch(`${API_BASE_URL}/api/refunds/${refundId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to cancel refund");
      }

      toast.success("Refund request cancelled successfully");
      setShowCancelModal(null);
      fetchRefunds();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelling(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? "Checking authentication..." : "Loading refunds..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Refunds</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate("/my-orders")}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">My Refunds</h1>
          <p className="text-gray-600 mt-1">
            Track the status of your refund requests
          </p>
        </div>
        <button
          onClick={() => navigate("/my-orders")}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
        >
          ← Back to Orders
        </button>
      </div>

      {/* Refunds List */}
      {refunds.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-purple-100 mb-4">
            <span className="text-4xl">💰</span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-2">No Refund Requests</h2>
          <p className="text-gray-600 mb-6">
            You haven&apos;t requested any refunds yet.
          </p>
          <button
            onClick={() => navigate("/my-orders")}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            View My Orders
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {refunds.map((refund) => (
            <div key={refund.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="p-6">
                {/* Header Row */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Refund #{refund.id}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(refund.status)}`}>
                        {getStatusText(refund.status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Order #{refund.order_id} • Requested on {new Date(refund.requested_at).toLocaleDateString()} at {new Date(refund.requested_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-purple-600">
                      ${Number(refund.amount).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Reason</p>
                    <p className="font-medium text-gray-800">
                      {getReasonText(refund.reason)}
                    </p>
                  </div>
                  {refund.processed_at && (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Processed Date</p>
                      <p className="font-medium text-gray-800">
                        {new Date(refund.processed_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Description */}
                {refund.description && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-1">Description</p>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-gray-700 text-sm">{refund.description}</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => navigate(`/order-details/${refund.order_id}`)}
                    className="text-purple-600 hover:text-purple-700 font-medium text-sm flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    View Order
                  </button>

                  {refund.status === 'pending' && (
                    <button
                      onClick={() => setShowCancelModal(refund.id)}
                      className="text-red-600 hover:text-red-700 font-medium text-sm flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel Request
                    </button>
                  )}

                  {refund.status === 'succeeded' && (
                    <div className="text-green-600 font-medium text-sm flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Refund Completed
                    </div>
                  )}

                  {refund.status === 'failed' && (
                    <div className="text-red-600 font-medium text-sm flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      Refund Failed - Contact Support
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Cancel Refund Request?
              </h3>
              <p className="text-sm text-gray-600">
                Are you sure you want to cancel this refund request? This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowCancelModal(null)}
                disabled={cancelling}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50"
              >
                No, Keep It
              </button>
              <button
                onClick={() => handleCancelRefund(showCancelModal)}
                disabled={cancelling}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {cancelling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Cancelling...
                  </>
                ) : (
                  "Yes, Cancel Request"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerRefunds;
