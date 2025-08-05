import React, { useState, useEffect, useContext } from "react";
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <input
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <textarea
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
          <div className="text-sm text-gray-600">
            <p className="mb-2">Need to update your password?</p>
            <a 
              href="/user/update-password" 
              className="text-green-600 hover:text-green-700 font-medium"
            >
              Change Password →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomerProfile;