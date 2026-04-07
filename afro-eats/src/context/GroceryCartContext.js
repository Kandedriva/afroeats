import { createContext, useContext, useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useAuth } from "./AuthContext";

export const GroceryCartContext = createContext();

export const GroceryCartProvider = ({ children }) => {
  const [groceryCart, setGroceryCart] = useState([]);
  const { user } = useAuth();

  // Load cart from localStorage on mount
  useEffect(() => {
    const storageKey = user ? `groceryCart_${user.id}` : "groceryCart_guest";
    const savedCart = localStorage.getItem(storageKey);
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        setGroceryCart(parsed);
      } catch (err) {
        console.error("Failed to parse grocery cart:", err);
        localStorage.removeItem(storageKey);
      }
    }
  }, [user]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    const storageKey = user ? `groceryCart_${user.id}` : "groceryCart_guest";
    localStorage.setItem(storageKey, JSON.stringify(groceryCart));
  }, [groceryCart, user]);

  /**
   * Add product to grocery cart
   * @param {Object} product - Product to add
   * @param {number} quantity - Quantity to add
   */
  const addToGroceryCart = (product, quantity = 1) => {
    setGroceryCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === product.id);

      if (existingIndex >= 0) {
        // Update quantity if product already in cart
        const updated = [...prev];
        const newQuantity = updated[existingIndex].quantity + quantity;

        // Check stock limit
        if (newQuantity > product.stock_quantity) {
          throw new Error(`Only ${product.stock_quantity} ${product.unit} available in stock`);
        }

        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQuantity,
        };
        return updated;
      } else {
        // Add new product to cart
        if (quantity > product.stock_quantity) {
          throw new Error(`Only ${product.stock_quantity} ${product.unit} available in stock`);
        }

        return [
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
          },
        ];
      }
    });
  };

  /**
   * Update quantity of item in cart
   * @param {number} productId
   * @param {number} newQuantity
   */
  const updateGroceryQuantity = (productId, newQuantity) => {
    setGroceryCart((prev) => {
      const item = prev.find((item) => item.id === productId);

      if (!item) {
        return prev;
      }

      // Check stock limit
      if (newQuantity > item.stock_quantity) {
        throw new Error(`Only ${item.stock_quantity} ${item.unit} available in stock`);
      }

      // Remove if quantity is 0 or less
      if (newQuantity <= 0) {
        return prev.filter((item) => item.id !== productId);
      }

      return prev.map((item) =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      );
    });
  };

  /**
   * Remove item from grocery cart
   * @param {number} productId
   */
  const removeFromGroceryCart = (productId) => {
    setGroceryCart((prev) => prev.filter((item) => item.id !== productId));
  };

  /**
   * Clear entire grocery cart
   */
  const clearGroceryCart = () => {
    setGroceryCart([]);
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
   * Note: Delivery fee will be added at checkout based on address
   */
  const getGroceryTotal = () => {
    return getGrocerySubtotal() + getGroceryPlatformFee();
  };

  /**
   * Check if product is in cart
   * @param {number} productId
   * @returns {Object|null} Cart item or null
   */
  const getCartItem = (productId) => {
    return groceryCart.find((item) => item.id === productId) || null;
  };

  /**
   * Validate cart items against current stock
   * Returns array of items that are out of stock or have insufficient quantity
   */
  const validateCartStock = async () => {
    // This will be implemented when we integrate with the backend
    // For now, we trust the stock_quantity stored in cart items
    return [];
  };

  const value = {
    groceryCart,
    addToGroceryCart,
    updateGroceryQuantity,
    removeFromGroceryCart,
    clearGroceryCart,
    getGroceryItemCount,
    getGrocerySubtotal,
    getGroceryPlatformFee,
    getGroceryTotal,
    getCartItem,
    validateCartStock,
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

export default GroceryCartContext;
