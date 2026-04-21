import { createContext, useState, useEffect, useContext } from 'react';
import { API_BASE_URL } from '../config/api';

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
      } else {
        setGroceryOwner(null);
      }
    } catch (error) {
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
      setGroceryOwner(null);
    } catch (error) {
      // Even if logout fails on server, clear local state
      setGroceryOwner(null);
    }
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
