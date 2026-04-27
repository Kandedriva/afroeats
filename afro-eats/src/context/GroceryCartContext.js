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
   * Sync guest cart to database when user logs in
   */
  const syncGuestCartToDatabase = useCallback(async (guestCart) => {
    if (guestCart.length === 0) {
      return;
    }

    try {
      // Add each item from guest cart to database
      for (const item of guestCart) {
        await fetch(`${API_BASE_URL}/api/grocery-cart`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            productId: item.id,
            quantity: item.quantity
          }),
        });
      }

      // Clear localStorage after sync
      localStorage.removeItem(GUEST_CART_KEY);

      // Fetch the updated cart from database
      await fetchCart();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error syncing guest cart:', err);
    }
  }, [fetchCart]);

  /**
   * Load cart based on authentication status
   */
  useEffect(() => {
    if (user) {
      // User logged in - check if there's a guest cart to sync
      const guestCartData = localStorage.getItem(GUEST_CART_KEY);
      if (guestCartData) {
        try {
          const guestCart = JSON.parse(guestCartData);
          syncGuestCartToDatabase(guestCart);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Error parsing guest cart:', err);
          fetchCart();
        }
      } else {
        fetchCart();
      }
    } else {
      // Guest user - load from localStorage
      loadGuestCart();
    }
  }, [user, fetchCart, loadGuestCart, syncGuestCartToDatabase]);

  /**
   * Add product to cart (works for both guest and authenticated users)
   */
  const addToGroceryCart = async (product, quantity = 1) => {
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

        // Update local state optimistically
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
          setGroceryCart((prev) => [
            ...prev,
            {
              id: product.id,
              name: product.name,
              price: parseFloat(product.price),
              unit: product.unit,
              quantity,
              image_url: product.image_url,
              stock_quantity: product.stock_quantity,
              category: product.category,
              store_id: product.store_id
            },
          ]);
        }

        return true;
      } catch (error) {
        await fetchCart(); // Re-fetch to sync state
        throw error;
      }
    } else {
      // Guest user - add to localStorage
      const existingIndex = groceryCart.findIndex((item) => item.id === product.id);
      let newCart;

      if (existingIndex >= 0) {
        newCart = groceryCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        newCart = [
          ...groceryCart,
          {
            id: product.id,
            name: product.name,
            price: parseFloat(product.price),
            unit: product.unit,
            quantity,
            image_url: product.image_url,
            stock_quantity: product.stock_quantity,
            category: product.category,
            store_id: product.store_id
          },
        ];
      }

      setGroceryCart(newCart);
      saveGuestCart(newCart);
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
   * Calculate platform fee (5% of subtotal, min $1.50, max $10)
   */
  const getGroceryPlatformFee = () => {
    const subtotal = getGrocerySubtotal();
    const feePercent = 0.05; // 5%
    const calculatedFee = subtotal * feePercent;

    const minFee = 1.50;
    const maxFee = 10.00;

    if (calculatedFee < minFee) {
      return minFee;
    }
    if (calculatedFee > maxFee) {
      return maxFee;
    }

    return calculatedFee;
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
