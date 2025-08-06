import { useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import PropTypes from 'prop-types';
import { AuthContext } from "../context/AuthContext";
import { toast } from 'react-toastify';

function ProtectedRoute({ children }) {
  const { user, loading } = useContext(AuthContext);
  const location = useLocation();
  const [showUnauthorizedError, setShowUnauthorizedError] = useState(false);

  useEffect(() => {
    // Handle unauthorized access with mobile-friendly messaging
    if (!loading && !user) {
      setShowUnauthorizedError(true);
      const timer = setTimeout(() => {
        toast.error("Please log in to access this page");
      }, 100);
      
      return () => clearTimeout(timer);
    } else {
      setShowUnauthorizedError(false);
      return undefined;
    }
  }, [user, loading, location.pathname]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm sm:text-base">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show error message before redirect for better UX
  if (showUnauthorizedError && !user) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 sm:p-6 text-center">
          <div className="text-red-600 text-4xl sm:text-6xl mb-4">🔒</div>
          <h2 className="text-lg sm:text-xl font-semibold text-red-800 mb-2">Access Restricted</h2>
          <p className="text-red-600 text-sm sm:text-base mb-4">You need to be logged in to access this page.</p>
          <Navigate to="/login" state={{ from: location }} replace />
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Render the protected component
  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ProtectedRoute;