import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

export default function useOwnerAuth() {
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/owners/dashboard`, {
          method: "GET",
          credentials: "include",
        });

        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          navigate("/owner/dashboard");
        }
      } catch (err) {
        navigate("/owner/login");
      } finally {
        setChecking(false);
      }
    };

    checkAuth();
  }, [navigate]);

  return { checking, isAuthenticated };
}
