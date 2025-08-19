import { createContext, useEffect, useState, useContext } from "react";
import PropTypes from 'prop-types';
import { API_BASE_URL } from "../config/api";

export const OwnerAuthContext = createContext();

export function OwnerAuthProvider({ children }) {
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if owner is already logged in
  useEffect(() => {
    const fetchOwner = async () => {
      try {
        console.log('OwnerAuth: Checking existing session...');
        const res = await fetch(`${API_BASE_URL}/api/owners/me`, {
          credentials: "include",
        });

        console.log('OwnerAuth: /api/owners/me response status:', res.status);

        if (res.ok) {
          const data = await res.json();
          console.log('OwnerAuth: Owner data received:', data);
          setOwner(data);
        } else {
          console.log('OwnerAuth: No existing session found');
          setOwner(null);
        }
      } catch (err) {
        console.error('OwnerAuth: Error checking owner session:', err);
        setOwner(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOwner();
  }, []);

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/owners/logout`, {
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
      console.log('OwnerAuth: Refreshing authentication...');
      const res = await fetch(`${API_BASE_URL}/api/owners/me`, {
        credentials: "include",
      });

      console.log('OwnerAuth: refreshAuth response status:', res.status);

      if (res.ok) {
        const data = await res.json();
        console.log('OwnerAuth: refreshAuth owner data:', data);
        setOwner(data);
      } else {
        console.log('OwnerAuth: refreshAuth failed, clearing owner');
        setOwner(null);
      }
    } catch (err) {
      console.error('OwnerAuth: Error refreshing owner session:', err);
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

OwnerAuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// Custom hook
export const useOwnerAuth = () => useContext(OwnerAuthContext);
