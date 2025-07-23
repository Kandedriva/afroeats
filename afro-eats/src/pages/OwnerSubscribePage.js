import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOwnerAuth } from "../context/OwnerAuthContext";

function OwnerSubscribePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { owner, loading: authLoading } = useOwnerAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const createSession = async () => {
      // Wait for auth context to load
      if (authLoading) {
        return;
      }

      // Check if user is authenticated via context first
      if (!owner) {
        setError("Please log in first to subscribe");
        setLoading(false);
        return;
      }

      try {
        console.log("Creating subscription session for owner:", owner.id);
        
        const res = await fetch("http://localhost:5001/api/subscription/create-session", {
          method: "POST",
          credentials: "include",
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.log("Subscription API response status:", res.status);

        if (!res.ok) {
          const errorData = await res.json();
          console.log("Subscription API error:", errorData);
          if (res.status === 401) {
            throw new Error("Session expired. Please log in again.");
          }
          throw new Error(errorData.error || "Failed to create subscription session");
        }

        const data = await res.json();
        console.log("Subscription API response data:", data);
        
        if (data.url) {
          console.log("Redirecting to:", data.url);
          window.location.href = data.url;
        } else {
          throw new Error("No checkout URL received");
        }
      } catch (err) {
        console.error("Subscription error:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    createSession();
  }, [owner, authLoading]);

  if (error) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded text-center">
        <h2 className="text-xl font-bold text-red-600 mb-4">Subscription Error</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button 
          onClick={() => navigate("/owner/dashboard")}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mr-2"
        >
          Back to Dashboard
        </button>
        <button 
          onClick={() => navigate("/owner/login")}
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Login
        </button>
      </div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="max-w-md mx-auto mt-10 p-6 bg-white shadow rounded text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">
          {authLoading ? "Checking authentication..." : "Redirecting to subscription..."}
        </p>
      </div>
    );
  }

  return null; // This should not be reached since we either show error or redirect
}

export default OwnerSubscribePage;
