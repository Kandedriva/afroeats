import { Link } from "react-router-dom";
import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { CartContext } from "../context/CartContext";

function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const { cart } = useContext(CartContext);
  const [notificationCount, setNotificationCount] = useState(0);

  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

  // Fetch notification count for logged-in users
  useEffect(() => {
    if (user) {
      fetchNotificationCount();
      // Refresh notification count every 30 seconds
      const interval = setInterval(fetchNotificationCount, 30000);
      return () => clearInterval(interval);
    } else {
      setNotificationCount(0);
    }
  }, [user]);

  const fetchNotificationCount = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/auth/notifications", {
        credentials: "include",
      });
      
      if (res.ok) {
        const data = await res.json();
        setNotificationCount(data.unreadCount || 0);
      }
    } catch (err) {
      // Silent fail for notification count fetch
    }
  };

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
              <Link to="/my-orders" className="text-gray-700 hover:text-green-600 relative">
                My Orders
                {notificationCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </Link>
              <Link to="/my-profile" className="text-gray-700 hover:text-green-600">
                My Profile
              </Link>
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
              <Link to="/register-owner" className="text-blue-600 underline">Register or Login as Restaurant Owner</Link>

            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
