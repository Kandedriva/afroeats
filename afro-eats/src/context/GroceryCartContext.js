/**
 * Grocery Cart Context - Hybrid Version
 * Supports both guest users (localStorage) and authenticated users (database)
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { useAuth } from "./AuthContext";
import { API_BASE_URL } from "../config/api";

export const GroceryCartContext = createContext();

const GUEST_CART_KEY = 'groceryCart_guest';

export const GroceryCartProvider = ({ children }) => {
  const [groceryCart, setGroceryCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  /**
   * Load cart from localStorage (for guest users)
   */
  const loadGuestCart = useCallback(() => {
    try {
      const savedCart = localStorage.getItem(GUEST_CART_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        setGroceryCart(parsed);
      } else {
        setGroceryCart([]);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error loading guest cart:', err);
      setGroceryCart([]);
    }
    setLoading(false);
  }, []);

  /**
   * Save cart to localStorage (for guest users)
   */
  const saveGuestCart = useCallback((cart) => {
    try {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error saving guest cart:', err);
    }
  }, []);

  /**
   * Fetch cart from database (for authenticated users)
   */
  const fetchCart = useCallback(async (retryCount = 0) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/grocery-cart`, {
        credentials: "include",
        method: "GET",
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (res.status === 401) {
        // User not authenticated - this shouldn't happen if user is logged in
        setGroceryCart([]);
        return;
      }

      if (!res.ok) {
        // Retry once for network issues
        if (retryCount < 1 && res.status >= 500) {
          setTimeout(() => fetchCart(retryCount + 1), 1000);
          return;
        }
        throw new Error("Failed to fetch grocery cart");
      }

      const data = await res.json();
      setGroceryCart(data);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Fetch grocery cart error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load cart based on authentication status.
   * The two carts are fully independent — logging in never touches the guest localStorage cart.
   */
  useEffect(() => {
    if (user) {
      fetchCart();
    } else {
      loadGuestCart();
    }
  }, [user, fetchCart, loadGuestCart]);

  /**
   * Add product to cart (works for both guest and authenticated users).
   * Throws a STORE_CONFLICT error if the product belongs to a different store
   * than the items already in the cart.
   */
  const addToGroceryCart = async (product, quantity = 1, skipConflictCheck = false) => {
    // Detect store conflict before doing anything
    if (!skipConflictCheck && product.store_id && groceryCart.length > 0) {
      const existingItem = groceryCart.find(i => i.store_id && i.store_id !== product.store_id);
      if (existingItem) {
        const err = new Error('STORE_CONFLICT');
        err.type = 'STORE_CONFLICT';
        err.existingStoreName = existingItem.store_name || 'your current store';
        err.newStoreName = product.store_name || 'the new store';
        throw err;
      }
    }

    // Shared cart item shape
    const cartItem = {
      id: product.id,
      name: product.name,
      price: parseFloat(product.price),
      unit: product.unit,
      quantity,
      image_url: product.image_url,
      stock_quantity: product.stock_quantity,
      category: product.category,
      store_id: product.store_id,
      store_name: product.store_name || '',
    };

    if (user) {
      // Authenticated user - add to database
      try {
        const res = await fetch(`${API_BASE_URL}/api/grocery-cart`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            'Cache-Control': 'no-cache'
          },
          credentials: "include",
          body: JSON.stringify({
            productId: product.id,
            quantity
          }),
        });

        if (res.status === 401) {
          throw new Error("Please log in to add items to cart");
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Network error" }));
          throw new Error(errorData.error || "Failed to add to cart");
        }

        const existingIndex = groceryCart.findIndex((item) => item.id === product.id);
        if (existingIndex >= 0) {
          setGroceryCart((prev) =>
            prev.map((item) =>
              item.id === product.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            )
          );
        } else {
          setGroceryCart((prev) => [...prev, cartItem]);
        }

        return true;
      } catch (error) {
        if (error.type !== 'STORE_CONFLICT') { await fetchCart(); }
        throw error;
      }
    } else {
      // Guest user - add to localStorage
      setGroceryCart(prev => {
        const existingIndex = prev.findIndex((item) => item.id === product.id);
        const newCart = existingIndex >= 0
          ? prev.map((item) =>
              item.id === product.id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            )
          : [...prev, cartItem];
        saveGuestCart(newCart);
        return newCart;
      });
      return true;
    }
  };

  /**
   * Update item quantity in cart
   */
  const updateGroceryQuantity = async (productId, newQuantity) => {
    if (newQuantity < 1) {
      return await removeFromGroceryCart(productId);
    }

    if (user) {
      // Authenticated user - update in database
      try {
        const res = await fetch(`${API_BASE_URL}/api/grocery-cart/${productId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ quantity: newQuantity }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to update quantity");
        }

        setGroceryCart((prev) =>
          prev.map((item) =>
            item.id === productId ? { ...item, quantity: newQuantity } : item
          )
        );

        return true;
      } catch (error) {
        await fetchCart();
        throw error;
      }
    } else {
      // Guest user - update in localStorage
      const newCart = groceryCart.map((item) =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      );
      setGroceryCart(newCart);
      saveGuestCart(newCart);
      return true;
    }
  };

  /**
   * Remove item from cart
   */
  const removeFromGroceryCart = async (productId) => {
    if (user) {
      // Authenticated user - remove from database
      try {
        await fetch(`${API_BASE_URL}/api/grocery-cart/${productId}`, {
          method: "DELETE",
          credentials: "include",
        });

        setGroceryCart((prev) => prev.filter((item) => item.id !== productId));
      } catch (error) {
        await fetchCart();
        throw error;
      }
    } else {
      // Guest user - remove from localStorage
      const newCart = groceryCart.filter((item) => item.id !== productId);
      setGroceryCart(newCart);
      saveGuestCart(newCart);
    }
  };

  /**
   * Clear entire cart
   */
  const clearGroceryCart = async () => {
    if (user) {
      // Authenticated user - clear database cart
      try {
        await fetch(`${API_BASE_URL}/api/grocery-cart`, {
          method: "DELETE",
          credentials: "include",
        });

        setGroceryCart([]);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Clear cart error:', error);
        await fetchCart();
      }
    } else {
      // Guest user - clear localStorage
      setGroceryCart([]);
      localStorage.removeItem(GUEST_CART_KEY);
    }
  };

  /**
   * Force refresh cart from server (authenticated users only)
   */
  const forceRefreshCart = async () => {
    if (user) {
      await fetchCart();
    }
  };

  /**
   * Get cart item count
   */
  const getGroceryItemCount = () => {
    return groceryCart.reduce((sum, item) => sum + item.quantity, 0);
  };

  /**
   * Calculate subtotal
   */
  const getGrocerySubtotal = () => {
    return groceryCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  /**
   * Calculate platform fee: 10% of subtotal, minimum $2.00
   * Must match the server-side formula in groceryRoutes.js
   */
  const getGroceryPlatformFee = () => {
    const subtotal = getGrocerySubtotal();
    return parseFloat(Math.max(subtotal * 0.10, 2.00).toFixed(2));
  };

  /**
   * Calculate total (subtotal + platform fee)
   * Note: Delivery fee added at checkout
   */
  const getGroceryTotal = () => {
    return getGrocerySubtotal() + getGroceryPlatformFee();
  };

  /**
   * Check if product is in cart
   */
  const getCartItem = (productId) => {
    return groceryCart.find((item) => item.id === productId) || null;
  };

  const value = {
    groceryCart,
    loading,
    addToGroceryCart,
    updateGroceryQuantity,
    removeFromGroceryCart,
    clearGroceryCart,
    forceRefreshCart,
    getGroceryItemCount,
    getGrocerySubtotal,
    getGroceryPlatformFee,
    getGroceryTotal,
    getCartItem,
  };

  return (
    <GroceryCartContext.Provider value={value}>
      {children}
    </GroceryCartContext.Provider>
  );
};

GroceryCartProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useGroceryCart = () => {
  const context = useContext(GroceryCartContext);
  if (!context) {
    throw new Error("useGroceryCart must be used within GroceryCartProvider");
  }
  return context;
};
