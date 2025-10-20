// React import removed as it's not needed in React 17+
import { useEffect, useState } from "react";
import RestaurantCard from "../Components/RestaurantCard";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";

export default function RestaurantList() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [supportForm, setSupportForm] = useState({
    subject: "",
    message: "",
    contact_info: ""
  });
  const [submittingSupport, setSubmittingSupport] = useState(false);

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        // Debug logging
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.log('🔄 Fetching restaurants from:', `${API_BASE_URL}/api/restaurants`);
        }
        
        const res = await fetch(`${API_BASE_URL}/api/restaurants`);
        
        // Debug response
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.log('📡 Restaurant API response:', {
            status: res.status,
            ok: res.ok,
            url: res.url
          });
        }
        
        if (!res.ok) {
          throw new Error(`Failed to fetch restaurants (${res.status}): ${res.statusText}`);
        }
        
        const data = await res.json();
        
        // Debug data
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.log('📊 Restaurant data received:', data);
        }
        
        // Validate data is array
        if (!Array.isArray(data)) {
          throw new Error('Invalid data format: expected array of restaurants');
        }
        
        setRestaurants(data);
        setError(null); // Clear any previous errors
      } catch (err) {
        // Enhanced error handling
        const errorMessage = err.message || 'Failed to load restaurants. Please try again later.';
        setError(errorMessage);
        
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('❌ Error fetching restaurants:', {
            error: err,
            message: err.message,
            stack: err.stack,
            apiUrl: `${API_BASE_URL}/api/restaurants`
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []); // Empty dependency array is intentional for initial load

  const handleSupportInputChange = (e) => {
    const { name, value } = e.target;
    setSupportForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    
    if (!supportForm.subject.trim() || !supportForm.message.trim() || !supportForm.contact_info.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setSubmittingSupport(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(supportForm),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Support request submitted successfully! We will respond within 24 hours.");
        setSupportForm({ subject: "", message: "", contact_info: "" });
        setShowSupportForm(false);
      } else {
        toast.error(data.error || "Failed to submit support request");
      }
    } catch (err) {
      toast.error("An error occurred while submitting your support request");
    } finally {
      setSubmittingSupport(false);
    }
  };

  if (loading) {
    return <p className="text-center mt-10">Loading restaurants...</p>;
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-center">
          <span className="text-red-600 text-4xl mb-4 block">⚠️</span>
          <h2 className="text-lg font-semibold text-red-800 mb-2">Unable to Load Restaurants</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (restaurants.length === 0) {
    return <p className="text-center mt-10">No restaurants found.</p>;
  }

  return (
    <div className="max-w-6xl mx-auto mt-4 p-4">
      {/* Contact Support Button */}
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => setShowSupportForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
        >
          <span>📞</span>
          Contact Support
        </button>
      </div>

      {/* Restaurant Grid */}
      <main className="grid gap-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        {restaurants.map((restaurant) => (
          <RestaurantCard key={restaurant.id} restaurant={restaurant} />
        ))}
      </main>

      {/* Support Form Modal */}
      {showSupportForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Contact Support</h2>
                <button
                  onClick={() => setShowSupportForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Privacy Notice:</strong> Please do not include any sensitive information 
                  like passwords or payment details. Only provide your phone number or email for contact purposes.
                </p>
              </div>

              <form onSubmit={handleSupportSubmit} className="space-y-4">
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                    Subject *
                  </label>
                  <input
                    id="subject"
                    type="text"
                    name="subject"
                    value={supportForm.subject}
                    onChange={handleSupportInputChange}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brief description of your issue"
                    maxLength={255}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="contact_info" className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Information (Email or Phone) *
                  </label>
                  <input
                    id="contact_info"
                    type="text"
                    name="contact_info"
                    value={supportForm.contact_info}
                    onChange={handleSupportInputChange}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your email address or phone number"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={supportForm.message}
                    onChange={handleSupportInputChange}
                    rows="6"
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Describe your issue or inquiry in detail..."
                    maxLength={2000}
                    required
                  />
                  <div className="text-xs text-gray-500 mt-1 text-right">
                    {supportForm.message.length}/2000
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowSupportForm(false)}
                    className="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-md font-medium hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingSupport}
                    className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {submittingSupport ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Submitting...
                      </>
                    ) : (
                      "Submit Request"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
