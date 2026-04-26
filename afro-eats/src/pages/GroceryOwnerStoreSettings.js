import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { toast } from 'react-toastify';

function GroceryOwnerStoreSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone_number: '',
    active: true,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  // Stripe Connect state
  const [stripeStatus, setStripeStatus] = useState({
    hasAccount: false,
    onboardingComplete: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    accountId: null
  });
  const [stripeLoading, setStripeLoading] = useState(false);

  useEffect(() => {
    const initializePage = async () => {
      try {
        // Handle Stripe redirect first
        const params = new URLSearchParams(location.search);
        const stripeSuccess = params.get('stripe_success');
        const stripeRefresh = params.get('stripe_refresh');

        if (stripeSuccess) {
          toast.success('Stripe account connected successfully!');
          // Clear the params by navigating without them
          navigate('/grocery-owner/store', { replace: true });
        } else if (stripeRefresh) {
          toast.info('You can complete your Stripe setup anytime from the Store Settings page');
          // Clear the params by navigating without them
          navigate('/grocery-owner/store', { replace: true });
        }

        // Fetch data
        await Promise.all([
          fetchStoreData(),
          fetchStripeStatus()
        ]);

        // If we had a success redirect, refresh status after a delay
        if (stripeSuccess) {
          setTimeout(() => {
            fetchStripeStatus().catch(err => {
              // eslint-disable-next-line no-console
              console.error('Failed to refresh Stripe status:', err);
            });
          }, 1500);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Page initialization error:', error);
        toast.error('Failed to load page data');
      }
    };

    initializePage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchStoreData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/grocery-owners/store`, {
        credentials: 'include',
      });

      if (response.ok) {
        const storeData = await response.json();
        setStore(storeData);
        setFormData({
          name: storeData.name || '',
          address: storeData.address || '',
          phone_number: storeData.phone_number || '',
          active: storeData.active !== false,
        });
        if (storeData.image_url) {
          setLogoPreview(storeData.image_url);
        }
      } else {
        toast.error('Failed to load store information');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Store data fetch error:', error);
      toast.error('Failed to load store information');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }

      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.address || !formData.phone_number) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('address', formData.address);
      formDataToSend.append('phone_number', formData.phone_number);
      formDataToSend.append('active', formData.active);

      if (logoFile) {
        formDataToSend.append('logo', logoFile);
      }

      const response = await fetch(`${API_BASE_URL}/api/grocery-owners/store`, {
        method: 'PATCH',
        credentials: 'include',
        body: formDataToSend,
      });

      if (response.ok) {
        const updatedStore = await response.json();
        setStore(updatedStore);
        setLogoFile(null);
        toast.success('Store information updated successfully');

        // Refresh the store data to get the latest info
        fetchStoreData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update store information');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Store update error:', error);
      toast.error('Failed to update store information');
    } finally {
      setSaving(false);
    }
  };

  const fetchStripeStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/grocery-owners/stripe/account-status`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setStripeStatus(data);
      } else {
        // Set default status if fetch fails
        setStripeStatus({
          hasAccount: false,
          onboardingComplete: false,
          chargesEnabled: false,
          payoutsEnabled: false,
          accountId: null
        });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Stripe status fetch error:', error);
      // Set default status on error
      setStripeStatus({
        hasAccount: false,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        accountId: null
      });
    }
  };

  const handleCreateStripeAccount = async () => {
    setStripeLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/grocery-owners/stripe/create-account`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        toast.success('Stripe account created! Redirecting to onboarding...');
        // Refresh status first
        await fetchStripeStatus();
        // Now create onboarding link
        await handleStartOnboarding();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(errorData.error || 'Failed to create Stripe account');
        setStripeLoading(false);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Create Stripe account error:', error);
      toast.error('Failed to create Stripe account. Please try again.');
      setStripeLoading(false);
    }
  };

  const handleStartOnboarding = async () => {
    setStripeLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/grocery-owners/stripe/create-onboarding-link`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Redirect to Stripe onboarding
        window.location.href = data.url;
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(errorData.error || 'Failed to start onboarding');
        setStripeLoading(false);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Start onboarding error:', error);
      toast.error('Failed to start onboarding. Please try again.');
      setStripeLoading(false);
    }
  };

  const handleOpenStripeDashboard = async () => {
    setStripeLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/grocery-owners/stripe/create-login-link`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Open Stripe dashboard in new tab
        window.open(data.url, '_blank');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(errorData.error || 'Failed to open dashboard');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Open dashboard error:', error);
      toast.error('Failed to open dashboard. Please try again.');
    } finally {
      setStripeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Store Settings</h1>
          <p className="text-gray-600 mt-2">Update your store information and preferences</p>
        </div>

        {/* Store Settings Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Store Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Store Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter your store name"
                required
              />
            </div>

            {/* Address */}
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Store Address <span className="text-red-500">*</span>
              </label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter your store address"
                required
              />
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="phone_number"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="+1 (555) 123-4567"
                required
              />
            </div>

            {/* Store Logo */}
            <div>
              <label htmlFor="logo" className="block text-sm font-medium text-gray-700 mb-1">
                Store Logo
              </label>
              <div className="flex items-start space-x-4">
                {logoPreview && (
                  <div className="flex-shrink-0">
                    <img
                      src={logoPreview}
                      alt="Store logo preview"
                      className="h-24 w-24 object-cover rounded-lg border-2 border-gray-200"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    id="logo"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Upload a new logo (JPG, PNG, max 5MB)
                  </p>
                </div>
              </div>
            </div>

            {/* Store Status */}
            <div>
              <label htmlFor="active" className="flex items-center space-x-3 cursor-pointer" aria-label="Store Active Status">
                <input
                  type="checkbox"
                  id="active"
                  name="active"
                  checked={formData.active}
                  onChange={handleChange}
                  className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700">Store Active</span>
                  <p className="text-sm text-gray-500">
                    When active, your store is visible to customers and can receive orders
                  </p>
                </div>
              </label>
            </div>

            {/* Store Information (Read-only) */}
            {store && (
              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Store Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Store ID</p>
                    <p className="text-sm text-gray-900 mt-1">#{store.id}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Created</p>
                    <p className="text-sm text-gray-900 mt-1">
                      {new Date(store.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {store.latitude && store.longitude && (
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-gray-600">Location Coordinates</p>
                      <p className="text-sm text-gray-900 mt-1">
                        Lat: {store.latitude}, Long: {store.longitude}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stripe Connect Section */}
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
                <span className="mr-2">💳</span> Payment Settings
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Connect your Stripe account to receive payments directly from orders
              </p>

              {!stripeStatus.hasAccount ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">Connect with Stripe</h4>
                      <p className="text-gray-700 mb-4">
                        Set up your Stripe account to receive payments directly from customers. Stripe handles all payment processing securely.
                      </p>
                      <button
                        type="button"
                        onClick={handleCreateStripeAccount}
                        disabled={stripeLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                      >
                        {stripeLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            Creating Account...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Connect Stripe Account
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`border rounded-lg p-6 ${
                  stripeStatus.onboardingComplete ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`flex-shrink-0 rounded-full p-3 ${
                        stripeStatus.onboardingComplete ? 'bg-green-100' : 'bg-yellow-100'
                      }`}>
                        {stripeStatus.onboardingComplete ? (
                          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <h4 className={`text-lg font-semibold mb-2 ${
                          stripeStatus.onboardingComplete ? 'text-green-900' : 'text-yellow-900'
                        }`}>
                          {stripeStatus.onboardingComplete ? 'Stripe Account Connected ✓' : 'Complete Your Setup'}
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${
                              stripeStatus.chargesEnabled ? 'bg-green-500' : 'bg-gray-300'
                            }`}></span>
                            <span className="text-gray-700">
                              Accept Payments: {stripeStatus.chargesEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${
                              stripeStatus.payoutsEnabled ? 'bg-green-500' : 'bg-gray-300'
                            }`}></span>
                            <span className="text-gray-700">
                              Receive Payouts: {stripeStatus.payoutsEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          {stripeStatus.accountId && (
                            <div className="text-xs text-gray-600 mt-2">
                              Account ID: {stripeStatus.accountId}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {!stripeStatus.onboardingComplete && (
                      <button
                        type="button"
                        onClick={handleStartOnboarding}
                        disabled={stripeLoading}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                      >
                        {stripeLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Loading...
                          </>
                        ) : (
                          'Complete Onboarding'
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenStripeDashboard}
                      disabled={stripeLoading}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open Stripe Dashboard
                    </button>
                    <button
                      type="button"
                      onClick={fetchStripeStatus}
                      disabled={stripeLoading}
                      className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh Status
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={fetchStoreData}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`px-6 py-2 rounded-lg font-medium text-white transition-colors ${
                  saving
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default GroceryOwnerStoreSettings;
