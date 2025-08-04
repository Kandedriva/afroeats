import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
        console.log(`🔄 Attempting to connect to backend (attempt ${retryCount + 1}):`, API_BASE_URL);
        console.log('🌐 Testing basic fetch capabilities...');
        
        // Test basic fetch first
        try {
          // Test with minimal fetch options first
          const testResponse = await fetch(`${API_BASE_URL}/api/health`, {
            method: 'GET'
          });
          console.log('✅ Basic connectivity test passed:', testResponse.status);
        } catch (testError) {
          console.error('❌ Basic connectivity test failed:', testError);
          console.error('testError details:', {
            name: testError.name,
            message: testError.message,
            stack: testError.stack
          });
          throw new Error(`Cannot reach backend server at ${API_BASE_URL}: ${testError.message}`);
        }
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        console.log('🔐 Testing auth endpoint...');
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
            console.log(`Auth check failed (attempt ${retryCount + 1}), retrying...`);
            setTimeout(() => fetchUser(retryCount + 1), 2000);
            return;
          }
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        console.log('✅ Backend connection successful, user authenticated:', data);
        setUser(data);
      } catch (err) {
        console.error('Auth check error:', err);
        
        // Handle specific error types
        if (err.name === 'AbortError') {
          console.error('Auth request timed out');
          setError('Connection timeout - please check your internet connection');
        } else if (err.message.includes('Failed to fetch')) {
          console.error('Network connection failed - backend server may be down');
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

    // Add visibility change listener for mobile browsers
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        // Refresh auth when app becomes visible (mobile browser switching)
        fetchUser();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const logout = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      // Always clear user state, even if server request fails
      setUser(null);
      
      if (res.ok) {
      } else {
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

export const useAuth = () => useContext(AuthContext);
