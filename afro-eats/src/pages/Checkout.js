import React, { useState } from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';

export default function Checkout({ user }) {
  const { cart, clearCart } = useCart();
  const navigate = useNavigate();
  const [orderDetails, setOrderDetails] = useState("");

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!user) {
      toast.warning("Please login to place an order.");
      return;
    }

    try {
      const res = await fetch("http://localhost:5001/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // to include cookie/session
        body: JSON.stringify({
          userId: user.id,
          items: cart,
          orderDetails: orderDetails.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        clearCart();
        toast.success("Order placed successfully!");
        navigate("/"); // or a confirmation page
      } else {
        toast.error("Order failed: " + data.error);
      }
    } catch (err) {
      console.error("Place Order Error:", err);
      toast.error("Something went wrong.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white shadow rounded">
      <h2 className="text-2xl font-semibold mb-4">Order Summary</h2>
      {cart.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          <ul className="divide-y">
            {cart.map((item) => (
              <li key={item.id} className="py-3 flex justify-between">
                <span>{item.name} x {item.quantity}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Special Instructions (Optional)
            </label>
            <textarea
              value={orderDetails}
              onChange={(e) => setOrderDetails(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              rows="3"
              placeholder="Add any special instructions for your order (e.g., no onions, extra spicy, delivery notes, etc.)"
              maxLength={500}
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {orderDetails.length}/500 characters
            </div>
          </div>

          <div className="mt-6 flex justify-between font-bold text-lg">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <button
            onClick={handlePlaceOrder}
            className="mt-6 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 w-full"
          >
            Place Order
          </button>
        </>
      )}
    </div>
  );
}
