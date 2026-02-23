import { Navigate } from "react-router-dom";
import PropTypes from 'prop-types';
import { useDriverAuth } from "../context/DriverAuthContext";

const ProtectedDriverRoute = ({ children }) => {
  const { driver, loading } = useDriverAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-green-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (!driver) {
    return <Navigate to="/driver/login" replace />;
  }

  return children;
};

ProtectedDriverRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ProtectedDriverRoute;
