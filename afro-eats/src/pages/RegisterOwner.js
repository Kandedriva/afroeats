// src/pages/RegisterOwner.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { useOwnerAuth } from "../context/OwnerAuthContext";

const RegisterOwner = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    secret_word: "",
    restaurant_name: "",
    location: "",
    phone_number: "",
  });
  const [logo, setLogo] = useState(null);
  const [error, setError] = useState("");
  const { refreshAuth } = useOwnerAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    if (e.target.name === "logo") {
      setLogo(e.target.files[0]);
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = new FormData();
    for (const key in formData) {
      data.append(key, formData[key]);
    }
    if (logo) {
      data.append("logo", logo);
    }

    try {
      const res = await fetch("http://localhost:5001/api/owners/register", {
        method: "POST",
        body: data,
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        setError(errorData.error || "Failed to register owner");
        return;
      }

      // Refresh auth context and redirect
      await refreshAuth();
      navigate("/owner/dashboard");

    } catch (err) {
      setError("Server error");
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white p-6 shadow rounded">
      <h2 className="text-2xl font-bold mb-4">Register as Restaurant Owner</h2>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <form onSubmit={handleSubmit} encType="multipart/form-data">
        <input
          type="text"
          name="name"
          placeholder="Owner Name"
          value={formData.name}
          onChange={handleChange}
          className="block w-full mb-3 border p-2 rounded"
          required
        />

        <input
          type="email"
          name="email"
          placeholder="Owner Email"
          value={formData.email}
          onChange={handleChange}
          className="block w-full mb-3 border p-2 rounded"
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          className="block w-full mb-3 border p-2 rounded"
          required
        />

        <input
          type="text"
          name="secret_word"
          placeholder="Secret Word (for password recovery)"
          value={formData.secret_word}
          onChange={handleChange}
          className="block w-full mb-3 border p-2 rounded"
          required
        />
        <p className="text-sm text-gray-600 mb-3 -mt-2">
          💡 Remember this word - you'll need it to update your password later
        </p>

        <input
          type="text"
          name="restaurant_name"
          placeholder="Restaurant Name"
          value={formData.restaurant_name}
          onChange={handleChange}
          className="block w-full mb-3 border p-2 rounded"
          required
        />

        <input
          type="text"
          name="location"
          placeholder="Restaurant Address"
          value={formData.location}
          onChange={handleChange}
          className="block w-full mb-3 border p-2 rounded"
          required
        />

        <input
          type="number"
          name="phone_number"
          placeholder="Restaurant contact"
          value={formData.phone_number}
          onChange={handleChange}
          className="block w-full mb-3 border p-2 rounded"
          required
        />

        <input
          type="file"
          name="logo"
          accept="image/*"
          onChange={handleChange}
          className="block mb-3"
        />

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Register
        </button><br></br>
        Or
      </form>
      <Link to="/owner/login" className="text-blue-600 underline">Login</Link>


    </div>
  );
};

export default RegisterOwner;
