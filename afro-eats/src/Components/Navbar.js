import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { CartContext } from "../context/CartContext";

function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const { cart } = useContext(CartContext);

  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <nav className="bg-white shadow">
      <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="text-xl font-bold text-green-600">
          Afro Eats
        </Link>

        <div className="space-x-4 flex items-center">
          <Link to="/cart" className="text-gray-700 hover:text-green-600">
            Cart {cartItemCount > 0 && `(${cartItemCount})`}
          </Link>

          {user ? (
            <>
              <span className="text-gray-700">Welcome, {user.name.split(" ")[0]}</span>
              <button
                onClick={logout}
                className="text-red-600 hover:text-red-800"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-gray-700 hover:text-green-600">Login</Link>
              <Link to="/register" className="text-gray-700 hover:text-green-600">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
