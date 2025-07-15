import React, { createContext, useEffect, useState } from "react";

export const OwnerAuthContext = createContext();

export function OwnerAuthProvider({ children }) {
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if owner is already logged in
  useEffect(() => {
    const fetchOwner = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/owners/me", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setOwner(data);
        }
      } catch (err) {
        console.error("Error checking owner session", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOwner();
  }, []);

  return (
    <OwnerAuthContext.Provider value={{ owner, setOwner, loading }}>
      {children}
    </OwnerAuthContext.Provider>
  );
}
