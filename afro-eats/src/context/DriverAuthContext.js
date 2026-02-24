import { createContext, useEffect, useState, useContext } from "react";
import PropTypes from 'prop-types';
import { API_BASE_URL } from "../config/api";

export const DriverAuthContext = createContext();

export function DriverAuthProvider({ children }) {
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDriver = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/drivers/me`, {
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          setDriver(data);
        } else {
          // Not logged in or session expired
          if (res.status === 401) {
            setDriver(prevDriver => prevDriver ? null : prevDriver);
          }
        }
      } catch (err) {
        // Network error - keep current state
      } finally {
        setLoading(false);
      }
    };

    fetchDriver();
  }, []);

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/drivers/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      // Logout error - continue anyway
    }

    setDriver(null);
  };

  const refreshAuth = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/drivers/me`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setDriver(data);
      } else {
        setDriver(null);
      }
    } catch (err) {
      // Error refreshing auth
    } finally {
      setLoading(false);
    }
  };

  return (
    <DriverAuthContext.Provider
      value={{
        driver,
        setDriver,
        loading,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </DriverAuthContext.Provider>
  );
}

DriverAuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useDriverAuth = () => {
  const context = useContext(DriverAuthContext);
  if (!context) {
    throw new Error('useDriverAuth must be used within a DriverAuthProvider');
  }
  return context;
};
