import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { OwnerAuthContext } from "../context/OwnerAuthContext";

const OwnerNavbar = () => {
  const navigate = useNavigate();
  const { owner, setOwner } = useContext(OwnerAuthContext);

  const handleLogout = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/owners/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Logout failed");

      setOwner(null); // Clear owner from context
      navigate("/owner/login");
    } catch (err) {
      console.error("Logout error:", err.message);
    }
  };

  return (
    <nav className="bg-gray-800 text-white p-4 flex justify-between items-center">
      <div>
        <Link to="/owner/dashboard" className="text-xl font-bold mr-6">
          Owner Dashboard
        </Link>
        {owner && (
          <Link to="/owner/add-dish" className="hover:underline">
            Add Dish
          </Link>
        )}
      </div>
      {owner && (
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded"
        >
          Logout
        </button>
      )}
    </nav>
  );
};

export default OwnerNavbar;
