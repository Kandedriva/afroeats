import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

function UserPasswordUpdate() {
  const [form, setForm] = useState({
    email: "",
    secret_word: "",
    new_password: "",
    confirm_password: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.new_password !== form.confirm_password) {
      setError("Passwords do not match");
      return;
    }

    if (form.new_password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:5001/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          secret_word: form.secret_word,
          new_password: form.new_password
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Password updated successfully! You can now login with your new password.");
        setForm({
          email: "",
          secret_word: "",
          new_password: "",
          confirm_password: ""
        });
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        setError(data.error || "Password update failed");
      }
    } catch (err) {
      console.error("Password update error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded">
      <h1 className="text-2xl font-bold mb-4">Update Your Password</h1>
      
      <div className="mb-4 p-3 bg-blue-50 rounded">
        <p className="text-sm text-blue-700">
          💡 Enter your email address and the secret word you provided during registration to update your password.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
          <p className="text-green-700 text-sm">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Secret Word
          </label>
          <input
            type="text"
            name="secret_word"
            value={form.secret_word}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your secret word"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            The secret word you provided during registration
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            type="password"
            name="new_password"
            value={form.new_password}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter new password"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm New Password
          </label>
          <input
            type="password"
            name="confirm_password"
            value={form.confirm_password}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Confirm new password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 px-4 rounded text-white font-medium ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          }`}
        >
          {loading ? "Updating Password..." : "Update Password"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          to="/login"
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          ← Back to Login
        </Link>
      </div>
    </div>
  );
}

export default UserPasswordUpdate;