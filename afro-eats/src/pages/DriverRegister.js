import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { toast } from 'react-toastify';

function DriverRegister() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    secret_word: "",
    vehicle_type: "car",
    vehicle_make: "",
    vehicle_model: "",
    vehicle_year: "",
    vehicle_color: "",
    license_plate: ""
  });
  const [driversLicense, setDriversLicense] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e) => {
    setDriversLicense(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    if (!driversLicense) {
      toast.error("Please upload your driver's license");
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();
      Object.keys(formData).forEach(key => {
        if (key !== 'confirmPassword') {
          formDataToSend.append(key, formData[key]);
        }
      });
      formDataToSend.append('drivers_license', driversLicense);

      const res = await fetch(`${API_BASE_URL}/api/drivers/register`, {
        method: "POST",
        credentials: "include",
        body: formDataToSend,
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Registration successful! Your account is pending approval.");
        navigate("/driver/dashboard");
      } else {
        toast.error(data.error || "Registration failed");
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🚗</div>
          <h1 className="text-3xl font-bold text-green-700 mb-2">Driver Registration</h1>
          <p className="text-gray-600">Join our delivery team</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Information */}
          <div className="border-b pb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  required
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  required
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">Phone *</label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1234567890"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  required
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">Confirm Password *</label>
                <input
                  id="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  required
                />
              </div>
              <div>
                <label htmlFor="secret_word" className="block text-sm font-medium text-gray-700 mb-2">Secret Word (for password recovery)</label>
                <input
                  id="secret_word"
                  type="text"
                  name="secret_word"
                  value={formData.secret_word}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="border-b pb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Vehicle Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="vehicle_type" className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type *</label>
                <select
                  id="vehicle_type"
                  name="vehicle_type"
                  value={formData.vehicle_type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  required
                >
                  <option value="car">Car</option>
                  <option value="bike">Bike</option>
                  <option value="scooter">Scooter</option>
                  <option value="motorcycle">Motorcycle</option>
                </select>
              </div>
              <div>
                <label htmlFor="vehicle_color" className="block text-sm font-medium text-gray-700 mb-2">Vehicle Color *</label>
                <input
                  id="vehicle_color"
                  type="text"
                  name="vehicle_color"
                  value={formData.vehicle_color}
                  onChange={handleChange}
                  placeholder="e.g., Blue"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  required
                />
              </div>
              <div>
                <label htmlFor="license_plate" className="block text-sm font-medium text-gray-700 mb-2">License Plate *</label>
                <input
                  id="license_plate"
                  type="text"
                  name="license_plate"
                  value={formData.license_plate}
                  onChange={handleChange}
                  placeholder="e.g., ABC123"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  required
                />
              </div>
              <div>
                <label htmlFor="vehicle_make" className="block text-sm font-medium text-gray-700 mb-2">Make (Optional)</label>
                <input
                  id="vehicle_make"
                  type="text"
                  name="vehicle_make"
                  value={formData.vehicle_make}
                  onChange={handleChange}
                  placeholder="e.g., Toyota"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="vehicle_model" className="block text-sm font-medium text-gray-700 mb-2">Model (Optional)</label>
                <input
                  id="vehicle_model"
                  type="text"
                  name="vehicle_model"
                  value={formData.vehicle_model}
                  onChange={handleChange}
                  placeholder="e.g., Camry"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label htmlFor="vehicle_year" className="block text-sm font-medium text-gray-700 mb-2">Year (Optional)</label>
                <input
                  id="vehicle_year"
                  type="number"
                  name="vehicle_year"
                  value={formData.vehicle_year}
                  onChange={handleChange}
                  placeholder="e.g., 2020"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Driver's License Upload */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Driver&apos;s License *</h2>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              required
            />
            <p className="text-sm text-gray-500 mt-2">Please upload a clear photo of your driver&apos;s license</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Registering..." : "Register as Driver"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{" "}
            <Link to="/driver/login" className="text-green-600 hover:text-green-700 font-semibold">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default DriverRegister;
