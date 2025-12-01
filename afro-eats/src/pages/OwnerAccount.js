import { useState, useEffect } from 'react';
import { useOwnerAuth } from '../context/OwnerAuthContext';
import { API_BASE_URL } from '../config/api';
import { useNavigate } from 'react-router-dom';

const OwnerAccount = () => {
  const { owner, logout } = useOwnerAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [_restaurant, setRestaurant] = useState(null);
  
  // Form states
  const [email, setEmail] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [closePassword, setClosePassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  
  // Success/error messages
  const [emailMessage, setEmailMessage] = useState('');
  const [nameMessage, setNameMessage] = useState('');
  const [addressMessage, setAddressMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [closeMessage, setCloseMessage] = useState('');
  
  // Loading states for individual forms
  const [emailLoading, setEmailLoading] = useState(false);
  const [nameLoading, setNameLoading] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);

  useEffect(() => {
    if (owner) {
      setEmail(owner.email || '');
      fetchRestaurantDetails();
    }
  }, [owner]);

  const fetchRestaurantDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/owners/restaurant`, {
        credentials: 'include'
      });
      
      if (res.ok) {
        const restaurantData = await res.json();
        setRestaurant(restaurantData);
        setRestaurantName(restaurantData.name || '');
        setRestaurantAddress(restaurantData.address || '');
      }
    } catch (error) {
      // Failed to fetch restaurant details
    } finally {
      setLoading(false);
    }
  };

  const handleEmailUpdate = async (e) => {
    e.preventDefault();
    setEmailLoading(true);
    setEmailMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/owners/profile/email`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email })
      });

      const data = await res.json();
      
      if (res.ok) {
        setEmailMessage('Email updated successfully!');
        setTimeout(() => setEmailMessage(''), 3000);
      } else {
        setEmailMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setEmailMessage('Failed to update email. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleRestaurantNameUpdate = async (e) => {
    e.preventDefault();
    setNameLoading(true);
    setNameMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/owners/restaurant/name`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ name: restaurantName })
      });

      const data = await res.json();
      
      if (res.ok) {
        setNameMessage('Restaurant name updated successfully!');
        setRestaurant(prev => ({ ...prev, name: restaurantName }));
        setTimeout(() => setNameMessage(''), 3000);
      } else {
        setNameMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setNameMessage('Failed to update restaurant name. Please try again.');
    } finally {
      setNameLoading(false);
    }
  };

  const handleRestaurantAddressUpdate = async (e) => {
    e.preventDefault();
    setAddressLoading(true);
    setAddressMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/owners/restaurant/address`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ address: restaurantAddress })
      });

      const data = await res.json();
      
      if (res.ok) {
        setAddressMessage('Restaurant address updated successfully!');
        setRestaurant(prev => ({ ...prev, address: restaurantAddress }));
        setTimeout(() => setAddressMessage(''), 3000);
      } else {
        setAddressMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setAddressMessage('Failed to update restaurant address. Please try again.');
    } finally {
      setAddressLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage('');

    if (newPassword !== confirmPassword) {
      setPasswordMessage('New passwords do not match');
      setPasswordLoading(false);
      return;
    }

    if (newPassword.length < 12) {
      setPasswordMessage('New password must be at least 12 characters long');
      setPasswordLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/owners/profile/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ 
          currentPassword, 
          newPassword 
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        setPasswordMessage('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordMessage(''), 3000);
      } else {
        setPasswordMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setPasswordMessage('Failed to change password. Please try again.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAccountClosure = async (e) => {
    e.preventDefault();
    setCloseLoading(true);
    setCloseMessage('');

    if (confirmText !== 'CLOSE MY ACCOUNT') {
      setCloseMessage('Please type "CLOSE MY ACCOUNT" exactly to confirm');
      setCloseLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/owners/profile/close`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ 
          password: closePassword, 
          confirmText 
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        setCloseMessage('Account closed successfully. You will be redirected...');
        setTimeout(async () => {
          await logout();
          navigate('/owner/login');
        }, 2000);
      } else {
        setCloseMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setCloseMessage('Failed to close account. Please try again.');
    } finally {
      setCloseLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading account details...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">Account Management</h1>
        
        {/* Main Account Settings */}
        <div className="space-y-8 mb-12">
          {/* Email Section */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Update Email</h2>
            <form onSubmit={handleEmailUpdate} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={emailLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {emailLoading ? 'Updating...' : 'Update Email'}
              </button>
              {emailMessage && (
                <p className={`text-sm mt-2 ${emailMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                  {emailMessage}
                </p>
              )}
            </form>
          </div>

          {/* Restaurant Information */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Restaurant Information</h2>
            
            {/* Restaurant Name */}
            <form onSubmit={handleRestaurantNameUpdate} className="space-y-4 mb-6">
              <div>
                <label htmlFor="restaurant-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Restaurant Name
                </label>
                <input
                  id="restaurant-name"
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={nameLoading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {nameLoading ? 'Updating...' : 'Update Name'}
              </button>
              {nameMessage && (
                <p className={`text-sm mt-2 ${nameMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                  {nameMessage}
                </p>
              )}
            </form>

            {/* Restaurant Address */}
            <form onSubmit={handleRestaurantAddressUpdate} className="space-y-4">
              <div>
                <label htmlFor="restaurant-address" className="block text-sm font-medium text-gray-700 mb-2">
                  Restaurant Address
                </label>
                <textarea
                  id="restaurant-address"
                  value={restaurantAddress}
                  onChange={(e) => setRestaurantAddress(e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={addressLoading}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {addressLoading ? 'Updating...' : 'Update Address'}
              </button>
              {addressMessage && (
                <p className={`text-sm mt-2 ${addressMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                  {addressMessage}
                </p>
              )}
            </form>
          </div>

          {/* Password Change */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Change Password</h2>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password (min 12 characters)
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {passwordLoading ? 'Changing...' : 'Change Password'}
              </button>
              {passwordMessage && (
                <p className={`text-sm mt-2 ${passwordMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                  {passwordMessage}
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="border-t-4 border-red-500 pt-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-red-800 mb-2">⚠️ Danger Zone</h2>
            <p className="text-gray-600">
              The actions below are irreversible and will permanently affect your account.
            </p>
          </div>
          
          <div className="bg-red-50 border-2 border-red-200 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold text-red-800 mb-4">Close Account Permanently</h3>
            <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-red-800">Warning: This action cannot be undone</h4>
                  <p className="text-sm text-red-700 mt-1">
                    Closing your account will permanently delete:
                  </p>
                  <ul className="text-sm text-red-700 mt-2 list-disc list-inside space-y-1">
                    <li>Your restaurant profile and all information</li>
                    <li>All dishes and menu items</li>
                    <li>Order history and analytics</li>
                    <li>All account data and settings</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleAccountClosure} className="space-y-4">
              <div>
                <label htmlFor="close-password" className="block text-sm font-medium text-red-700 mb-2">
                  Enter your password to confirm
                </label>
                <input
                  id="close-password"
                  type="password"
                  value={closePassword}
                  onChange={(e) => setClosePassword(e.target.value)}
                  className="w-full p-3 border border-red-300 rounded-lg focus:ring-red-500 focus:border-red-500 bg-white"
                  required
                />
              </div>
              <div>
                <label htmlFor="confirm-text" className="block text-sm font-medium text-red-700 mb-2">
                  Type &quot;CLOSE MY ACCOUNT&quot; to confirm
                </label>
                <input
                  id="confirm-text"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full p-3 border border-red-300 rounded-lg focus:ring-red-500 focus:border-red-500 bg-white"
                  placeholder="CLOSE MY ACCOUNT"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={closeLoading}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-bold transition-colors border-2 border-red-700 shadow-lg"
              >
                {closeLoading ? 'Closing Account...' : '🗑️ Close Account Permanently'}
              </button>
              {closeMessage && (
                <p className={`text-sm mt-2 ${closeMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                  {closeMessage}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerAccount;