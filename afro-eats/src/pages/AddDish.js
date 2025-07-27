import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function AddDish() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [available, setAvailable] = useState("true");
  const [image, setImage] = useState(null);
  const [error, setError] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/subscription/status", {
          credentials: "include",
        });
        
        if (res.ok) {
          const data = await res.json();
          setSubscriptionStatus(data);
        } else {
          setSubscriptionStatus({ active: false });
        }
      } catch (err) {
        setSubscriptionStatus({ active: false });
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("price", price);
    formData.append("available", available);
    if (image) formData.append("image", image);

    try {
      const res = await fetch("http://localhost:5001/api/owners/dishes", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add dish");
      }

      navigate("/owner/dashboard");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubscribe = () => {
    navigate("/owner/subscribe");
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Checking subscription status...</p>
      </div>
    );
  }

  if (subscriptionStatus && !subscriptionStatus.active) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded text-center">
        <h1 className="text-2xl font-bold mb-4">Subscription Required</h1>
        <p className="text-gray-600 mb-6">
          You need an active subscription to add dishes to your restaurant. 
          Please subscribe to continue.
        </p>
        <button
          onClick={handleSubscribe}
          className="bg-green-600 text-white px-6 py-3 rounded-lg w-full mb-4 hover:bg-green-700"
        >
          Subscribe Now
        </button>
        <button
          onClick={() => navigate("/owner/dashboard")}
          className="text-gray-600 hover:text-gray-800"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded">
      <h1 className="text-2xl font-bold mb-4">Add New Dish</h1>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        <div className="mb-4">
          <label className="block text-sm font-medium">Dish Name</label>
          <input
            type="text"
            className="w-full border px-3 py-2 rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium">Description</label>
          <textarea
            className="w-full border px-3 py-2 rounded"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows="3"
          ></textarea>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium">Price</label>
          <input
            type="number"
            className="w-full border px-3 py-2 rounded"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            min="0"
            step="0.01"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium">Available</label>
          <select
            className="w-full border px-3 py-2 rounded"
            value={available}
            onChange={(e) => setAvailable(e.target.value)}
          >
            <option value="true">Available</option>
            <option value="false">Not Available</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium">Dish Image (optional)</label>
          <input
            type="file"
            accept="image/*"
            className="w-full"
            onChange={(e) => setImage(e.target.files[0])}
          />
        </div>

        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded w-full">
          Add Dish
        </button>
      </form>
    </div>
  );
}

export default AddDish;
