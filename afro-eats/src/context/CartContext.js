import { createContext, useContext, useEffect, useState, useCallback } from "react";
import PropTypes from 'prop-types';
import { useAuth } from "./AuthContext";
import { useGuest } from "./GuestContext";
import { API_BASE_URL } from "../config/api";

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { guestCart, guestTotal, isGuestMode, addToGuestCart, updateGuestQuantity, removeFromGuestCart, clearGuestCart } = useGuest();

  const fetchCart = useCallback(async (retryCount = 0) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/cart`, {
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (res.status === 401) {
        setCart([]);
        return;
      }

      if (!res.ok) {
        // Retry once for mobile network issues
        if (retryCount < 1 && res.status >= 500) {
          setTimeout(() => fetchCart(retryCount + 1), 1000);
          return;
        }
        const errorText = await res.text();
        throw new Error(errorText || "Failed to fetch cart");
      }

      const data = await res.json();

      const formatted = data.map((item) => ({
        id: item.dish_id,
        name: item.name,
        price: parseFloat(item.price),
        quantity: item.quantity,
        restaurantId: item.restaurant_id,
        restaurantName: item.restaurant_name,
      }));

      setCart(formatted);
    } catch (err) {
      // console.error('Fetch cart error:', err);
      if (!err.message.includes("401")) {
        // Only show error for non-auth issues
        // console.error('Cart fetch failed:', err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchCart();
    } else {
      setCart([]);
      setLoading(false); // Set loading to false for guest users
    }
  }, [user, fetchCart]);

  const addToCart = async (dish, asGuest = false) => {
    // If user is not authenticated or explicitly wants to add as guest
    if (!user || asGuest) {
      addToGuestCart(dish);
      return;
    }

    // Authenticated user - add to server cart
    const res = await fetch(`${API_BASE_URL}/api/cart`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        'Cache-Control': 'no-cache'
      },
      credentials: "include",
      body: JSON.stringify({ dishId: dish.id, quantity: 1 }),
    });

    if (res.status === 401) {
      throw new Error("Unauthorized - Please log in to add items to cart");
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Network error" }));
      throw new Error(errorData.error || "Failed to add to cart");
    }

    const existing = cart.find((item) => item.id === dish.id);
    if (existing) {
      setCart((prev) =>
        prev.map((item) =>
          item.id === dish.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setCart((prev) => [
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

  const updateQuantity = async (id, quantity) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dishId: id, quantity }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update quantity");
      }

      setCart((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, quantity: Math.max(quantity, 1) } : item
        )
      );
    } catch (err) {
      // console.error('Update quantity error:', err);
    }
  };

  const removeFromCart = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/cart/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to remove item");
      }

      setCart((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      // console.error('Remove from cart error:', err);
    }
  };

  const clearCart = async () => {
    try {
      setCart([]);
      
      const res = await fetch(`${API_BASE_URL}/api/cart`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json();
        // Re-fetch cart if backend clear failed
        await fetchCart();
        throw new Error(errorData.error || "Failed to clear cart");
      }

    } catch (err) {
      // console.error('Clear cart error:', err);
    }
  };

  const forceRefreshCart = async () => {
    setLoading(true);
    await fetchCart();
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Combined cart for display - use guest cart if in guest mode or no user
  const displayCart = isGuestMode || !user ? guestCart : cart;
  const displayTotal = isGuestMode || !user ? guestTotal : total;
  const displayLoading = isGuestMode || !user ? false : loading; // Never show loading for guest cart

  return (
    <CartContext.Provider
      value={{
        cart: displayCart,
        loading: displayLoading,
        addToCart,
        updateQuantity: isGuestMode || !user ? updateGuestQuantity : updateQuantity,
        removeFromCart: isGuestMode || !user ? removeFromGuestCart : removeFromCart,
        clearCart: isGuestMode || !user ? clearGuestCart : clearCart,
        total: displayTotal,
        fetchCart,
        forceRefreshCart,
        setCart,
        // Guest-specific functions
        isGuestMode,
        guestCart,
        guestTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

CartProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useCart = () => useContext(CartContext);
