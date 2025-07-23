import React, { createContext, useEffect, useState, useContext } from "react";

export const OwnerAuthContext = createContext();

export function OwnerAuthProvider({ children }) {
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionActive, setSubscriptionActive] = useState(false);

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

          // Fetch subscription status
          try {
            const subRes = await fetch("http://localhost:5001/api/subscription/status", {
              credentials: "include",
            });

            if (subRes.ok) {
              const subData = await subRes.json();
              setSubscriptionActive(subData?.active || false);
            } else {
              setSubscriptionActive(false);
            }
          } catch (err) {
            console.error("Subscription status fetch error:", err);
            setSubscriptionActive(false);
          }
        } else {
          setOwner(null);
          setSubscriptionActive(false);
        }
      } catch (err) {
        console.error("Error checking owner session", err);
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
      console.error("Logout failed", err);
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

        // Fetch subscription status
        try {
          const subRes = await fetch("http://localhost:5001/api/subscription/status", {
            credentials: "include",
          });

          if (subRes.ok) {
            const subData = await subRes.json();
            setSubscriptionActive(subData?.active || false);
          } else {
            setSubscriptionActive(false);
          }
        } catch (err) {
          console.error("Subscription status fetch error:", err);
          setSubscriptionActive(false);
        }
      } else {
        setOwner(null);
        setSubscriptionActive(false);
      }
    } catch (err) {
      console.error("Error refreshing owner session", err);
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
      }}
    >
      {children}
    </OwnerAuthContext.Provider>
  );
}

// Custom hook
export const useOwnerAuth = () => useContext(OwnerAuthContext);
