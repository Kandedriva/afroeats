import { Link, useNavigate } from "react-router-dom";
import { useDriverAuth } from "../context/DriverAuthContext";
import { useState } from "react";

function DriverNavbar() {
  const { driver, logout } = useDriverAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/driver/login");
  };

  return (
    <nav className="bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and main nav */}
          <div className="flex items-center space-x-8">
            <Link to="/driver/dashboard" className="text-2xl font-bold flex items-center space-x-2">
              <span>🚗</span>
              <span className="hidden sm:inline">Driver Portal</span>
            </Link>

            {/* Desktop navigation */}
            <div className="hidden md:flex space-x-6">
              <Link
                to="/driver/dashboard"
                className="hover:bg-green-500 px-3 py-2 rounded transition"
              >
                Dashboard
              </Link>
              <Link
                to="/driver/available-orders"
                className="hover:bg-green-500 px-3 py-2 rounded transition"
              >
                Available Orders
              </Link>
              <Link
                to="/driver/my-deliveries"
                className="hover:bg-green-500 px-3 py-2 rounded transition"
              >
                My Deliveries
              </Link>
              <Link
                to="/driver/earnings"
                className="hover:bg-green-500 px-3 py-2 rounded transition"
              >
                Earnings
              </Link>
              <Link
                to="/driver/profile"
                className="hover:bg-green-500 px-3 py-2 rounded transition"
              >
                Profile
              </Link>
            </div>
          </div>

          {/* Right side - user info and logout */}
          <div className="hidden md:flex items-center space-x-4">
            {driver && (
              <>
                <div className="text-right">
                  <p className="text-sm font-medium">Welcome, {driver.name}</p>
                  {driver.approval_status === 'pending' && (
                    <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded">
                      Pending Approval
                    </span>
                  )}
                  {driver.approval_status === 'approved' && driver.is_available && (
                    <span className="text-xs bg-green-400 text-white px-2 py-0.5 rounded">
                      🟢 Online
                    </span>
                  )}
                  {driver.approval_status === 'approved' && !driver.is_available && (
                    <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded">
                      ⚫ Offline
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-green-800 hover:bg-green-900 px-4 py-2 rounded transition font-medium"
                >
                  Logout
                </button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-white focus:outline-none hover:bg-green-500 p-2 rounded"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {driver && (
              <div className="px-2 py-2 border-b border-green-500 mb-2">
                <p className="text-sm font-medium">Welcome, {driver.name}</p>
                {driver.approval_status === 'pending' && (
                  <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded">
                    Pending Approval
                  </span>
                )}
                {driver.approval_status === 'approved' && driver.is_available && (
                  <span className="text-xs bg-green-400 text-white px-2 py-0.5 rounded">
                    🟢 Online
                  </span>
                )}
              </div>
            )}
            <Link
              to="/driver/dashboard"
              className="block py-2 hover:bg-green-500 px-2 rounded"
              onClick={() => setMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              to="/driver/available-orders"
              className="block py-2 hover:bg-green-500 px-2 rounded"
              onClick={() => setMenuOpen(false)}
            >
              Available Orders
            </Link>
            <Link
              to="/driver/my-deliveries"
              className="block py-2 hover:bg-green-500 px-2 rounded"
              onClick={() => setMenuOpen(false)}
            >
              My Deliveries
            </Link>
            <Link
              to="/driver/earnings"
              className="block py-2 hover:bg-green-500 px-2 rounded"
              onClick={() => setMenuOpen(false)}
            >
              Earnings
            </Link>
            <Link
              to="/driver/profile"
              className="block py-2 hover:bg-green-500 px-2 rounded"
              onClick={() => setMenuOpen(false)}
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="block w-full text-left py-2 hover:bg-green-500 px-2 rounded"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

export default DriverNavbar;
