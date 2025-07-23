import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useContext } from "react";

export default function Login() {
  const { setUser } = useContext(AuthContext);

  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("http://localhost:5001/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // include session cookies
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      setUser(data.user)

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      // ✅ Redirect to restaurant list on success
      navigate("/");
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message);
    }
  };

  return (
   <>
     <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded">
      <h2 className="text-2xl font-bold mb-4">Login</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          className="w-full border p-2 rounded"
          required
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Login
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link
          to="/password-update"
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          Forgot your password? Update it here
        </Link>
      </div>

      {error && <p className="text-red-600 mt-2">{error}</p>}
    </div>
   </>
  );
}
