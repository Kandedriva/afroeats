// React import removed as it's not needed in React 17+
import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";

function CustomerProfile() {
  const { user, loading: authLoading, setUser } = useContext(AuthContext);
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    address: ""
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [errors, setErrors] = useState({});
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [supportForm, setSupportForm] = useState({
    subject: "",
    message: "",
    contact_info: ""
  });
  const [submittingSupport, setSubmittingSupport] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
            credentials: "include",
          });
          
          if (res.ok) {
            const userData = await res.json();
            setProfileData({
              name: userData.name || "",
              email: userData.email || "",
              phone: userData.phone || "",
              address: userData.address || ""
            });
          }
        } catch (err) {
          toast.error("Failed to load profile information");
        } finally {
          setLoading(false);
        }
      }
    };

    fetchUserProfile();
  }, [user]);

  const validateForm = () => {
    const newErrors = {};

    if (!profileData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!profileData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(profileData.email)) {
      newErrors.email = "Email is invalid";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ""
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/update-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(profileData),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Profile updated successfully!");
        // Update user context with new data
        if (data.user) {
          setUser(data.user);
        }
      } else {
        toast.error(data.error || "Failed to update profile");
      }
    } catch (err) {
      toast.error("An error occurred while updating your profile");
    } finally {
      setUpdating(false);
    }
  };

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

  if (authLoading || loading) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          <span className="ml-2 text-gray-600">Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6">
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">My Profile</h1>
          <p className="text-gray-600">Update your personal information and preferences</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input
              id="name"
              type="text"
              name="name"
              value={profileData.name}
              onChange={handleInputChange}
              className={`w-full p-3 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your full name"
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={profileData.email}
              onChange={handleInputChange}
              className={`w-full p-3 border rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter your email address"
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          {/* Phone Field */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              name="phone"
              value={profileData.phone}
              onChange={handleInputChange}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter your phone number"
              maxLength={20}
            />
            <p className="text-xs text-gray-500 mt-1">
              Used for delivery contact and order updates
            </p>
          </div>

          {/* Address Field */}
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <textarea
              id="address"
              name="address"
              value={profileData.address}
              onChange={handleInputChange}
              rows="3"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              placeholder="Enter your address (street, city, state, zip code)"
              maxLength={300}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Used as default delivery address for orders</span>
              <span>{profileData.address.length}/300</span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={updating}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-md font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {updating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating Profile...
                </>
              ) : (
                "Update Profile"
              )}
            </button>
          </div>
        </form>

        {/* Additional Actions */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-sm text-gray-600">
              <p className="mb-2">Need to update your password?</p>
              <a 
                href="/user/update-password" 
                className="text-green-600 hover:text-green-700 font-medium"
              >
                Change Password →
              </a>
            </div>
            <div className="text-sm text-gray-600">
              <p className="mb-2">Need help or have a complaint?</p>
              <button 
                onClick={() => setShowSupportForm(true)}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Contact Support →
              </button>
            </div>
          </div>
        </div>
      </div>

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

export default CustomerProfile;