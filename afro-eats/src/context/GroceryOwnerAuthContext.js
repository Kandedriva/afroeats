import { createContext, useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import { API_BASE_URL } from '../config/api';
import { clearRecoveryToken, attemptSessionRecovery } from '../utils/accountRecovery';

export const GroceryOwnerAuthContext = createContext();

export const useGroceryOwnerAuth = () => {
  const context = useContext(GroceryOwnerAuthContext);
  if (!context) {
    throw new Error('useGroceryOwnerAuth must be used within GroceryOwnerAuthProvider');
  }
  return context;
};

export function GroceryOwnerAuthProvider({ children }) {
  const [groceryOwner, setGroceryOwner] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchGroceryOwner = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/grocery-owners/me`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setGroceryOwner(data);
      } else if (response.status === 401) {
        const recovered = await attemptSessionRecovery('grocery');
        if (recovered?.groceryOwner) {
          setGroceryOwner(recovered.groceryOwner);
        } else {
          setGroceryOwner(null);
        }
      } else {
        setGroceryOwner(null);
      }
    } catch {
      setGroceryOwner(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/grocery-owners/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }
    clearRecoveryToken('grocery');
    setGroceryOwner(null);
  };

  const refreshAuth = async () => {
    setLoading(true);
    await fetchGroceryOwner();
  };

  useEffect(() => {
    fetchGroceryOwner();
  }, []);

  return (
    <GroceryOwnerAuthContext.Provider
      value={{
        groceryOwner,
        setGroceryOwner,
        logout,
        refreshAuth,
        loading,
      }}
    >
      {children}
    </GroceryOwnerAuthContext.Provider>
  );
}

GroceryOwnerAuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
