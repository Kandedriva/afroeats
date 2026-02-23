import { useEffect, useState } from "react";
import { useDriverAuth } from "../context/DriverAuthContext";
import { API_BASE_URL } from "../config/api";
import { toast } from 'react-toastify';

function DriverProfile() {
  const { driver: _driver, refreshAuth } = useDriverAuth();
  const [profile, setProfile] = useState(null);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchStripeStatus();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/drivers/profile`, {
        credentials: "include"
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data.driver);
        setEditedProfile(data.driver); // Initialize edit form with current data
      } else {
        toast.error("Failed to load profile");
      }
    } catch (err) {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const fetchStripeStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/drivers/stripe/account-status`, {
        credentials: "include"
      });

      if (res.ok) {
        const data = await res.json();
        setStripeStatus(data);
      }
    } catch (err) {
      // Failed to load Stripe status - not critical, can be ignored
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/drivers/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editedProfile.name,
          phone: editedProfile.phone,
          vehicle_type: editedProfile.vehicle_type,
          vehicle_make: editedProfile.vehicle_make,
          vehicle_model: editedProfile.vehicle_model,
          vehicle_year: editedProfile.vehicle_year,
          vehicle_color: editedProfile.vehicle_color,
          license_plate: editedProfile.license_plate
        })
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Profile updated successfully!");
        setProfile(data.driver);
        setEditedProfile(data.driver);
        setIsEditing(false);
        await refreshAuth(); // Refresh auth context
      } else {
        toast.error(data.error || "Failed to update profile");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedProfile(profile); // Reset to original
    setIsEditing(false);
  };

  const handleStripeConnect = async () => {
    setConnectingStripe(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/drivers/stripe/create-account`, {
        method: "POST",
        credentials: "include"
      });

      const data = await res.json();

      if (res.ok && data.onboarding_url) {
        window.location.href = data.onboarding_url;
      } else {
        toast.error(data.error || "Failed to create Stripe account");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setConnectingStripe(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Failed to load profile</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Driver Profile</h1>
        <p className="text-gray-600">Manage your account and payment settings</p>
      </div>

      {/* Personal Information */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">Personal Information</h2>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold text-sm"
            >
              ✏️ Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold text-sm disabled:bg-gray-400"
              >
                {saving ? "Saving..." : "💾 Save"}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold text-sm"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="driverName" className="text-sm font-medium text-gray-600 block mb-1">Full Name</label>
            {isEditing ? (
              <input
                id="driverName"
                type="text"
                value={editedProfile.name || ''}
                onChange={(e) => setEditedProfile({...editedProfile, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-800 font-semibold">{profile.name}</p>
            )}
          </div>
          <div>
            <label htmlFor="driverEmail" className="text-sm font-medium text-gray-600 block mb-1">Email</label>
            <p id="driverEmail" className="text-gray-800 font-semibold">{profile.email}</p>
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label htmlFor="driverPhone" className="text-sm font-medium text-gray-600 block mb-1">Phone</label>
            {isEditing ? (
              <input
                id="driverPhone"
                type="tel"
                value={editedProfile.phone || ''}
                onChange={(e) => setEditedProfile({...editedProfile, phone: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-800 font-semibold">{profile.phone}</p>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Member Since</p>
            <p className="text-gray-800 font-semibold">
              {new Date(profile.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Vehicle Information */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Vehicle Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="vehicleType" className="text-sm font-medium text-gray-600 block mb-1">Vehicle Type</label>
            {isEditing ? (
              <select
                id="vehicleType"
                value={editedProfile.vehicle_type || ''}
                onChange={(e) => setEditedProfile({...editedProfile, vehicle_type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="car">Car</option>
                <option value="bike">Bike</option>
                <option value="scooter">Scooter</option>
                <option value="motorcycle">Motorcycle</option>
              </select>
            ) : (
              <p className="text-gray-800 font-semibold capitalize">{profile.vehicle_type}</p>
            )}
          </div>
          <div>
            <label htmlFor="vehicleColor" className="text-sm font-medium text-gray-600 block mb-1">Color</label>
            {isEditing ? (
              <input
                id="vehicleColor"
                type="text"
                value={editedProfile.vehicle_color || ''}
                onChange={(e) => setEditedProfile({...editedProfile, vehicle_color: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-800 font-semibold">{profile.vehicle_color}</p>
            )}
          </div>
          <div>
            <label htmlFor="licensePlate" className="text-sm font-medium text-gray-600 block mb-1">License Plate</label>
            {isEditing ? (
              <input
                id="licensePlate"
                type="text"
                value={editedProfile.license_plate || ''}
                onChange={(e) => setEditedProfile({...editedProfile, license_plate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-800 font-semibold">{profile.license_plate}</p>
            )}
          </div>
          <div>
            <label htmlFor="vehicleMake" className="text-sm font-medium text-gray-600 block mb-1">Make</label>
            {isEditing ? (
              <input
                id="vehicleMake"
                type="text"
                value={editedProfile.vehicle_make || ''}
                onChange={(e) => setEditedProfile({...editedProfile, vehicle_make: e.target.value})}
                placeholder="e.g., Toyota"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-800 font-semibold">{profile.vehicle_make || 'N/A'}</p>
            )}
          </div>
          <div>
            <label htmlFor="vehicleModel" className="text-sm font-medium text-gray-600 block mb-1">Model</label>
            {isEditing ? (
              <input
                id="vehicleModel"
                type="text"
                value={editedProfile.vehicle_model || ''}
                onChange={(e) => setEditedProfile({...editedProfile, vehicle_model: e.target.value})}
                placeholder="e.g., Camry"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-800 font-semibold">{profile.vehicle_model || 'N/A'}</p>
            )}
          </div>
          <div>
            <label htmlFor="vehicleYear" className="text-sm font-medium text-gray-600 block mb-1">Year</label>
            {isEditing ? (
              <input
                id="vehicleYear"
                type="number"
                value={editedProfile.vehicle_year || ''}
                onChange={(e) => setEditedProfile({...editedProfile, vehicle_year: e.target.value})}
                placeholder="e.g., 2020"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-800 font-semibold">{profile.vehicle_year || 'N/A'}</p>
            )}
          </div>
        </div>

        {profile.drivers_license_url && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-600">Driver&apos;s License</p>
            <div className="mt-2">
              <img
                src={profile.drivers_license_url}
                alt="Driver's License"
                className="max-w-xs rounded border"
              />
              {profile.drivers_license_verified && (
                <span className="ml-2 text-green-600 text-sm">✓ Verified</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Account Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Account Status</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Approval Status</span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              profile.approval_status === 'approved' ? 'bg-green-100 text-green-800' :
              profile.approval_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              profile.approval_status === 'rejected' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {profile.approval_status.charAt(0).toUpperCase() + profile.approval_status.slice(1)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Currently Available</span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              profile.is_available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {profile.is_available ? '🟢 Online' : '⚫ Offline'}
            </span>
          </div>
        </div>

        {profile.rejection_reason && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-800">
              <strong>Reason:</strong> {profile.rejection_reason}
            </p>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">{profile.total_deliveries || 0}</div>
            <div className="text-sm text-gray-600">Total Deliveries</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{profile.completed_deliveries || 0}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              ${parseFloat(profile.total_earnings || 0).toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Total Earnings</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {profile.average_rating || 0} ⭐
            </div>
            <div className="text-sm text-gray-600">Rating</div>
          </div>
        </div>
      </div>

      {/* Stripe Connect */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Payment Setup (Stripe Connect)</h2>

        {stripeStatus?.onboarding_complete ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <span className="text-3xl mr-3">✅</span>
              <div>
                <h3 className="font-semibold text-green-800">Payment Setup Complete!</h3>
                <p className="text-sm text-green-700 mt-1">
                  Your Stripe account is connected and ready to receive payouts.
                </p>
              </div>
            </div>
          </div>
        ) : stripeStatus?.has_account && !stripeStatus?.onboarding_complete ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-3xl mr-3">⚠️</span>
                <div>
                  <h3 className="font-semibold text-yellow-800">Onboarding Incomplete</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Please complete your Stripe onboarding to receive payouts.
                  </p>
                </div>
              </div>
              <button
                onClick={handleStripeConnect}
                disabled={connectingStripe}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-semibold"
              >
                {connectingStripe ? "Loading..." : "Complete Setup"}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-3xl mr-3">💳</span>
                <div>
                  <h3 className="font-semibold text-blue-800">Connect Your Bank Account</h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Set up Stripe Connect to receive your delivery earnings.
                  </p>
                </div>
              </div>
              <button
                onClick={handleStripeConnect}
                disabled={connectingStripe}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold"
              >
                {connectingStripe ? "Loading..." : "Connect Stripe"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverProfile;
