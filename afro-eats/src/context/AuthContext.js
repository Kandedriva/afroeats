import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Check user session on load
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/auth/me", {
          credentials: "include",
        });

        if (res.status === 401) {
          setUser(null);
          return;
        }

        if (!res.ok) throw new Error("Failed to fetch user");

        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err.message);
      }
    };

    fetchUser();
  }, []);

  const logout = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        setUser(null);
        navigate("/login");
      } else {
        console.error("Logout failed");
      }
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
