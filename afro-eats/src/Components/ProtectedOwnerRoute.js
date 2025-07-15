import { Navigate } from "react-router-dom";

const ProtectedOwnerRoute = ({ owner, children }) => {
  if (!owner) {
    return <Navigate to="/owner/login" replace />;
  }
  return children;
};

export default ProtectedOwnerRoute;
