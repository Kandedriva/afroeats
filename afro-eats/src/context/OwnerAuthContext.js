import React, { createContext, useEffect, useState, useContext } from "react";

export const OwnerAuthContext = createContext();

export function OwnerAuthProvider({ children }) {
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if owner is already logged in
  useEffect(() => {
    const fetchOwner = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/owners/me", {
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          setOwner(data);

        } else {
          setOwner(null);
          }
      } catch (err) {
        // Error checking owner session
        setOwner(null);
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

      } else {
        setOwner(null);
      }
    } catch (err) {
      // Error refreshing owner session
      setOwner(null);
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
        refreshAuth,
      }}
    >
      {children}
    </OwnerAuthContext.Provider>
  );
}

// Custom hook
export const useOwnerAuth = () => useContext(OwnerAuthContext);
