import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { API_BASE_URL } from "../config/api";

export const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchCart = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/cart`, {
        credentials: "include",
      });

      if (res.status === 401) {
        setCart([]);
        return;
      }

      if (!res.ok) {
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
      if (!err.message.includes("401")) {
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
    }
  }, [user, fetchCart]);

  const addToCart = async (dish) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dishId: dish.id, quantity: 1 }),
      });

      if (!res.ok) {
        const errorData = await res.json();
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
    } catch (err) {
      console.error('Add to cart error:', err);
      throw err; // Re-throw the error so the component can handle it
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
    }
  };

  const forceRefreshCart = async () => {
    setLoading(true);
    await fetchCart();
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        total,
        fetchCart,
        forceRefreshCart,
        setCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
