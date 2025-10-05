import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from 'prop-types';
import { API_BASE_URL } from "../config/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Check if user is already logged in (simplified like OwnerAuthContext)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          if (res.status === 401) {
            // Only clear user data if we don't already have user data
            // This prevents clearing the user state right after login while session is being established
            setUser(prevUser => {
              if (prevUser) {
                return prevUser;
              }
              return null;
            });
          } else {
            // Network or server error - keep current state
          }
        }
      } catch (err) {
        // Network error - don't clear user data immediately
        // Let user try to continue if they were logged in
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      // Logout request failed, but we'll still clear the user state
    }
    
    // Clear user state regardless of response
    setUser(null);
    
    // Navigate to login page
    navigate("/login");
  };

  const refreshAuth = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        if (res.status === 401) {
          // Only clear if explicitly requested (like from logout)
          // Don't automatically clear on 401 to prevent logout loops
        }
      }
    } catch (err) {
      // Don't clear user data on network errors, let user retry
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, loading, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAuth = () => useContext(AuthContext);
