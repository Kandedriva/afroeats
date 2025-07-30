// frontend/components/StripeConnectButton.js
import React, { useState } from "react";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";

function StripeConnectButton() {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/stripe/create-stripe-account`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });

      if (!res.ok) {
        throw new Error("Stripe Connect request failed");
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No redirect URL received");
      }
    } catch (error) {
      toast.error("Failed to connect with Stripe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleConnect}
      className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
      disabled={loading}
    >
      {loading ? "Redirecting..." : "Connect with Stripe"}
    </button>
  );
}

export default StripeConnectButton;
