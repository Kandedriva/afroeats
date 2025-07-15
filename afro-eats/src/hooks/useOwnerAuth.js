import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function useOwnerAuth() {
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/owners/dashboard", {
          method: "GET",
          credentials: "include",
        });

        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          navigate("/owner/login");
        }
      } catch (err) {
        console.error("Auth check error:", err);
        navigate("/owner/login");
      } finally {
        setChecking(false);
      }
    };

    checkAuth();
  }, [navigate]);

  return { checking, isAuthenticated };
}
