import React, { useContext } from "react";
import { CartContext } from "../context/CartContext";
import { Link } from "react-router-dom";

function CartPage() {
  const {
    cart,
    removeFromCart,
    increaseQuantity,
    decreaseQuantity,
    total,
  } = useContext(CartContext);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Your Cart</h2>

      {cart.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <>
          <ul className="space-y-4">
            {cart.map((item, idx) => (
              <li
                key={idx}
                className="flex justify-between items-center bg-white p-4 rounded shadow"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p>${Number(item.price).toFixed(2)} x {item.quantity}</p>
                  <div className="flex items-center mt-2 space-x-2">
                    <button
                      onClick={() => decreaseQuantity(item.id)}
                      disabled={item.quantity <= 1}
                      className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                    >
                      –
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      onClick={() => increaseQuantity(item.id)}
                      className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  className="text-red-500 hover:text-red-700"
                  onClick={() => removeFromCart(item.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex justify-between items-center">
          <p className="text-lg font-bold">Total: ${Number(total).toFixed(2)}</p>
            <Link
              to="/checkout"
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Proceed to Checkout
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default CartPage;
