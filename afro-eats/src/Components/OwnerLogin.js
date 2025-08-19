import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useOwnerAuth } from "../context/OwnerAuthContext";
import { API_BASE_URL } from "../config/api";

function OwnerLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { setOwner } = useOwnerAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      console.log('OwnerLogin: Attempting login...');
      const res = await fetch(`${API_BASE_URL}/api/owners/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      console.log('OwnerLogin: Login response status:', res.status);

      if (!res.ok) {
        const data = await res.json();
        console.error('OwnerLogin: Login failed:', data);
        throw new Error(data.error || "Login failed");
      }

      const loginData = await res.json();
      console.log('OwnerLogin: Login successful, data:', loginData);
      
      // Set owner data directly from login response
      if (loginData.owner) {
        console.log('OwnerLogin: Setting owner data and navigating...');
        // Update the owner state immediately
        setOwner(loginData.owner);
        
        // Navigate to dashboard
        navigate("/owner/dashboard");
      } else {
        throw new Error("Login response missing owner data");
      }
    } catch (err) {
      console.error('OwnerLogin: Error:', err);
      setError(err.message);
    }
  };


  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded">
      <h1 className="text-2xl font-bold mb-4">Owner Login</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            className="w-full border px-3 py-2 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="mb-6">
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input
            id="password"
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

    </div>
  );
}

export default OwnerLogin;
