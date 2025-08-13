import { createContext, useContext, useState, useEffect } from "react";
import PropTypes from 'prop-types';

export const GuestContext = createContext();

export const GuestProvider = ({ children }) => {
  const [guestCart, setGuestCart] = useState([]);
  const [isGuestMode, setIsGuestMode] = useState(false);
  
  // Load guest cart from localStorage on mount
  useEffect(() => {
    const savedGuestCart = localStorage.getItem('afro-guest-cart');
    if (savedGuestCart) {
      try {
        const parsedCart = JSON.parse(savedGuestCart);
        setGuestCart(parsedCart);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('Failed to parse guest cart from localStorage:', err);
        localStorage.removeItem('afro-guest-cart');
      }
    }
  }, []);

  // Save guest cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('afro-guest-cart', JSON.stringify(guestCart));
  }, [guestCart]);

  const startGuestSession = () => {
    setIsGuestMode(true);
  };

  const endGuestSession = () => {
    setIsGuestMode(false);
    setGuestCart([]);
    localStorage.removeItem('afro-guest-cart');
  };

  const addToGuestCart = (dish) => {
    const existing = guestCart.find((item) => item.id === dish.id);
    if (existing) {
      setGuestCart((prev) =>
        prev.map((item) =>
          item.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setGuestCart((prev) => [
        ...prev,
        {
          ...dish,
          quantity: 1,
          restaurantId: dish.restaurant_id,
          restaurantName: dish.restaurant_name,
        },
      ]);
    }
  };

  const updateGuestQuantity = (id, quantity) => {
    if (quantity <= 0) {
      removeFromGuestCart(id);
      return;
    }
    
    setGuestCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(quantity, 1) } : item
      )
    );
  };

  const removeFromGuestCart = (id) => {
    setGuestCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearGuestCart = () => {
    setGuestCart([]);
    localStorage.removeItem('afro-guest-cart');
  };

  const guestTotal = guestCart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <GuestContext.Provider
      value={{
        guestCart,
        guestTotal,
        isGuestMode,
        startGuestSession,
        endGuestSession,
        addToGuestCart,
        updateGuestQuantity,
        removeFromGuestCart,
        clearGuestCart,
      }}
    >
      {children}
    </GuestContext.Provider>
  );
};

GuestProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useGuest = () => useContext(GuestContext);