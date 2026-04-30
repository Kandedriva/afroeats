import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { toast } from 'react-toastify';
import { validatePassword, PASSWORD_HINT } from '../utils/authValidation';

function RegisterGroceryOwner() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    secret_word: '',
    store_name: '',
    location: '',
    phone_number: '',
    acceptedTerms: false,
  });
  const [logo, setLogo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, logo: 'Logo must be less than 5MB' }));
        return;
      }
      setLogo(file);
      setErrors(prev => ({ ...prev, logo: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const pwCheck = validatePassword(formData.password);
      if (!pwCheck.valid) newErrors.password = pwCheck.error;
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData.secret_word.trim()) {
      newErrors.secret_word = 'Secret word is required for password recovery';
    }
    if (!formData.store_name.trim()) {
      newErrors.store_name = 'Store name is required';
    }
    if (!formData.location.trim()) {
      newErrors.location = 'Store location is required';
    }
    if (!formData.phone_number.trim()) {
      newErrors.phone_number = 'Phone number is required';
    }
    if (!formData.acceptedTerms) {
      newErrors.acceptedTerms = 'You must accept the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('email', formData.email);
      formDataToSend.append('password', formData.password);
      formDataToSend.append('secret_word', formData.secret_word);
      formDataToSend.append('store_name', formData.store_name);
      formDataToSend.append('location', formData.location);
      formDataToSend.append('phone_number', formData.phone_number);

      if (logo) {
        formDataToSend.append('logo', logo);
      }

      const response = await fetch(`${API_BASE_URL}/api/grocery-owners/register`, {
        method: 'POST',
        credentials: 'include',
        body: formDataToSend,
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Registration successful! Welcome to Order Dabaly!');
        navigate('/grocery-owner/dashboard');
      } else {
        toast.error(data.error || 'Registration failed. Please try again.');
        if (data.error) {
          setErrors({ submit: data.error });
        }
      }
    } catch (error) {
      toast.error('An error occurred during registration. Please try again.');
      setErrors({ submit: 'Network error. Please check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🛒 Register Your Grocery Store</h1>
          <p className="text-gray-600">Join Order Dabaly and reach more customers</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Owner Information */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Owner Information</h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                      errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="John Doe"
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="john@example.com"
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    id="password"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                      errors.password ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Password"
                  />
                  {errors.password
                    ? <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                    : <p className="text-gray-500 text-xs mt-1">{PASSWORD_HINT}</p>
                  }
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password *
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                      errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Re-enter your password"
                  />
                  {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
                </div>

                <div>
                  <label htmlFor="secret_word" className="block text-sm font-medium text-gray-700 mb-1">
                    Secret Word * (for password recovery)
                  </label>
                  <input
                    id="secret_word"
                    type="text"
                    name="secret_word"
                    value={formData.secret_word}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                      errors.secret_word ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="A memorable word only you know"
                  />
                  {errors.secret_word && <p className="text-red-500 text-sm mt-1">{errors.secret_word}</p>}
                  <p className="text-xs text-gray-500 mt-1">Keep this safe - you&apos;ll need it to recover your password</p>
                </div>
              </div>
            </div>

            {/* Store Information */}
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Store Information</h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="store_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Store Name *
                  </label>
                  <input
                    id="store_name"
                    type="text"
                    name="store_name"
                    value={formData.store_name}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                      errors.store_name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Fresh Market Groceries"
                  />
                  {errors.store_name && <p className="text-red-500 text-sm mt-1">{errors.store_name}</p>}
                </div>

                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                    Store Address *
                  </label>
                  <input
                    id="location"
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                      errors.location ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="123 Main St, City, State ZIP"
                  />
                  {errors.location && <p className="text-red-500 text-sm mt-1">{errors.location}</p>}
                </div>

                <div>
                  <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    id="phone_number"
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 ${
                      errors.phone_number ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="(555) 123-4567"
                  />
                  {errors.phone_number && <p className="text-red-500 text-sm mt-1">{errors.phone_number}</p>}
                </div>

                <div>
                  <label htmlFor="logo" className="block text-sm font-medium text-gray-700 mb-1">
                    Store Logo (Optional)
                  </label>
                  <input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                  {errors.logo && <p className="text-red-500 text-sm mt-1">{errors.logo}</p>}
                  <p className="text-xs text-gray-500 mt-1">Max 5MB - JPG, PNG, or GIF</p>
                </div>
              </div>
            </div>

            {/* Terms and Conditions */}
            <div>
              <label className="flex items-start">
                <input
                  type="checkbox"
                  name="acceptedTerms"
                  checked={formData.acceptedTerms}
                  onChange={handleChange}
                  className="mt-1 mr-2"
                />
                <span className="text-sm text-gray-700">
                  I accept the{' '}
                  <Link to="/terms" className="text-green-600 hover:text-green-700 underline" target="_blank">
                    Terms and Conditions
                  </Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-green-600 hover:text-green-700 underline" target="_blank">
                    Privacy Policy
                  </Link>
                </span>
              </label>
              {errors.acceptedTerms && <p className="text-red-500 text-sm mt-1">{errors.acceptedTerms}</p>}
            </div>

            {errors.submit && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {errors.submit}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {loading ? 'Registering...' : 'Register Grocery Store'}
            </button>

            <p className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/grocery-owner/login" className="text-green-600 hover:text-green-700 font-semibold">
                Login here
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default RegisterGroceryOwner;
