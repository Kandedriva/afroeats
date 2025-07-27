import React, { createContext, useEffect, useState, useContext } from "react";

export const OwnerAuthContext = createContext();

export function OwnerAuthProvider({ children }) {
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionActive, setSubscriptionActive] = useState(false);

  // Function to fetch subscription status separately
  const fetchSubscriptionStatus = async () => {
    try {
      const subRes = await fetch("http://localhost:5001/api/subscription/status", {
        credentials: "include",
      });

      if (subRes.ok) {
        const subData = await subRes.json();
        setSubscriptionActive(subData?.active || false);
      } else {
        // Subscription status check failed - owner may not be logged in yet
        setSubscriptionActive(false);
      }
    } catch (err) {
      // Subscription status fetch error
      setSubscriptionActive(false);
    }
  };

  // Check if owner is already logged in and subscription status
  useEffect(() => {
    const fetchOwner = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/owners/me", {
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          setOwner(data);

          // Fetch subscription status separately - don't block auth if this fails
          fetchSubscriptionStatus();
        } else {
          setOwner(null);
          setSubscriptionActive(false);
        }
      } catch (err) {
        // Error checking owner session
        setOwner(null);
        setSubscriptionActive(false);
      } finally {
        setLoading(false);
      }
    };

    fetchOwner();
  }, []);

  const logout = async () => {
    try {
      await fetch("http://localhost:5001/api/owners/logout", {
        method: "POST",
        credentials: "include",
      });
      setOwner(null);
      setSubscriptionActive(false);
    } catch (err) {
      // Logout failed
    }
  };

  const refreshAuth = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5001/api/owners/me", {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setOwner(data);

        // Fetch subscription status separately - don't block refresh if this fails
        fetchSubscriptionStatus();
      } else {
        setOwner(null);
        setSubscriptionActive(false);
      }
    } catch (err) {
      // Error refreshing owner session
      setOwner(null);
      setSubscriptionActive(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <OwnerAuthContext.Provider
      value={{
        owner,
        setOwner,
        loading,
        logout,
        subscriptionActive,
        refreshAuth,
        fetchSubscriptionStatus,
      }}
    >
      {children}
    </OwnerAuthContext.Provider>
  );
}

// Custom hook
export const useOwnerAuth = () => useContext(OwnerAuthContext);
