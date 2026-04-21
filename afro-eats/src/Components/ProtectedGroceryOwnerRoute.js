import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { GroceryOwnerAuthContext } from '../context/GroceryOwnerAuthContext';

function ProtectedGroceryOwnerRoute({ children }) {
  const { groceryOwner, loading } = useContext(GroceryOwnerAuthContext);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!groceryOwner) {
    return <Navigate to="/grocery-owner/login" replace />;
  }

  return children;
}

ProtectedGroceryOwnerRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ProtectedGroceryOwnerRoute;
