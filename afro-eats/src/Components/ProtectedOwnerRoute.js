import { Navigate } from "react-router-dom";
import { useOwnerAuth } from "../context/OwnerAuthContext";

const ProtectedOwnerRoute = ({ children }) => {
  const { owner, loading } = useOwnerAuth();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!owner) {
    return <Navigate to="/owner/login" replace />;
  }

  return children;
};

export default ProtectedOwnerRoute;
