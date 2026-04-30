import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from 'prop-types';
import { API_BASE_URL } from "../config/api";
import { clearRecoveryToken, attemptSessionRecovery } from "../utils/accountRecovery";

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
        } else if (res.status === 401) {
          // Session missing — try recovery token before giving up
          const recovered = await attemptSessionRecovery('user');
          if (recovered?.user) {
            setUser(recovered.user);
          } else {
            setUser(null);
          }
        }
        // Network/server errors: keep current state
      } catch {
        // Network error — don't clear state, let user retry
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
    
    clearRecoveryToken('user');
    setUser(null);
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
