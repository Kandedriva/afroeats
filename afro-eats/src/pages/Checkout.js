import React from "react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";

export default function Checkout({ user }) {
  const { cart, clearCart } = useCart();
  const navigate = useNavigate();

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handlePlaceOrder = async () => {
    if (!user) {
      alert("Please login to place an order.");
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
        }),
      });

      const data = await res.json();
      if (res.ok) {
        clearCart();
        alert("Order placed successfully!");
        navigate("/"); // or a confirmation page
      } else {
        alert("Order failed: " + data.error);
      }
    } catch (err) {
      console.error("Place Order Error:", err);
      alert("Something went wrong.");
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
          <div className="mt-6 flex justify-between font-bold text-lg">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <button
            onClick={handlePlaceOrder}
            className="mt-6 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Place Order
          </button>
        </>
      )}
    </div>
  );
}
