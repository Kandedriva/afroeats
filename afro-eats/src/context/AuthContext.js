import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from 'prop-types';
import { API_BASE_URL } from "../config/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Check user session on load with mobile-friendly retry logic
  useEffect(() => {
    const fetchUser = async (retryCount = 0) => {
      try {
        setLoading(true);
        setError(null);
        
        // First, test basic connectivity
        
        // Test basic fetch first
        try {
          // Test with minimal fetch options first
          const _testResponse = await fetch(`${API_BASE_URL}/api/health`, {
            method: 'GET'
          });
        } catch (testError) {
          throw new Error(`Cannot reach backend server at ${API_BASE_URL}: ${testError.message}`);
        }
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          credentials: "include",
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Content-Type': 'application/json'
          }
        });

        clearTimeout(timeoutId);

        if (res.status === 401) {
          setUser(null);
          return;
        }

        if (!res.ok) {
          // Retry once for mobile network issues
          if (retryCount < 2) {
            setTimeout(() => fetchUser(retryCount + 1), 2000);
            return;
          }
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        setUser(data);
      } catch (err) {
        
        // Handle specific error types
        if (err.name === 'AbortError') {
          setError('Connection timeout - please check your internet connection');
        } else if (err.message.includes('Failed to fetch')) {
          setError('Unable to connect to server - please try again later');
          // Try one more time after a longer delay for network issues
          if (retryCount < 1) {
            setTimeout(() => fetchUser(retryCount + 1), 5000);
            return;
          }
        } else {
          setError('Authentication check failed');
        }
        
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // Separate effect for visibility change listener to avoid infinite loops
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        // Refresh auth when app becomes visible (mobile browser switching)
        // Use a flag to prevent setting loading to true again if already authenticated
        fetch(`${API_BASE_URL}/api/auth/me`, {
          credentials: "include",
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Content-Type': 'application/json'
          }
        }).then(res => {
          if (res.ok) {
            return res.json();
          } else if (res.status === 401) {
            setUser(null);
            return null;
          }
          return null;
        }).then(data => {
          if (data) {
            setUser(data);
          }
        }).catch(err => {
          // Log auth refresh errors for debugging but don't disrupt user experience
          if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-console
            console.warn('Auth refresh failed during visibility change:', err.message);
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  const logout = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      // Always clear user state, even if server request fails
      setUser(null);
      
      if (res.ok) {
        // Logout successful
      } else {
        // Logout failed but we still clear local state
      }
      
      // Navigate to login page
      navigate("/login");
    } catch (err) {
      // Still clear user state and redirect even if request fails
      setUser(null);
      navigate("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAuth = () => useContext(AuthContext);
