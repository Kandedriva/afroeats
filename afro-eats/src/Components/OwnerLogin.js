import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useOwnerAuth } from "../context/OwnerAuthContext";

function OwnerLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { refreshAuth } = useOwnerAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://localhost:5001/api/auth/owners/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }

      // Refresh auth context and redirect to dashboard
      await refreshAuth();
      navigate("/owner/dashboard");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubscribe = () => {
    navigate("/owner/subscribe");
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded">
      <h1 className="text-2xl font-bold mb-4">Owner Login</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            className="w-full border px-3 py-2 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium">Password</label>
          <input
            type="password"
            className="w-full border px-3 py-2 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded w-full mb-4">
          Login
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link
          to="/owner/password-update"
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Forgot your password? Update it here
        </Link>
      </div>

      <hr className="my-4" />

      <button
        onClick={handleSubscribe}
        className="bg-green-600 text-white px-4 py-2 rounded w-full"
      >
        Subscribe to Access Dashboard
      </button>
    </div>
  );
}

export default OwnerLogin;
