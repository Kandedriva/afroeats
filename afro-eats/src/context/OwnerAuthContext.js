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
        const res = await fetch(`${API_BASE_URL}/api/owners/me`, {
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          setOwner(data);
        } else {
          if (res.status === 401) {
            // Only clear owner data if we don't already have owner data
            // This prevents clearing the owner state right after login while session is being established
            setOwner(prevOwner => {
              if (prevOwner) {
                return prevOwner;
              }
              return null;
            });
          } else {
            // Network or server error - keep current state
          }
        }
      } catch (err) {
        // Network error - don't clear owner data immediately
        // Let user try to continue if they were logged in
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
    } catch (err) {
      // Logout request failed, but we'll still clear the owner state
    }
    
    // Clear owner state regardless of response
    setOwner(null);
  };

  const refreshAuth = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/owners/me`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setOwner(data);
      } else {
        if (res.status === 401) {
          // Only clear if explicitly requested (like from logout)
          // Don't automatically clear on 401 to prevent logout loops
        }
      }
    } catch (err) {
      // Don't clear owner data on network errors, let user retry
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
