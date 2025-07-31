// src/pages/OwnerOnboard.jsx
import React from "react";
import { API_BASE_URL } from "../config/api";

export default function OwnerOnboard() {
  const handleOnboard = async () => {
    const res = await fetch(`${API_BASE_URL}/api/owners/stripe/connect`, { method: "POST", credentials: "include" });
    const { url } = await res.json();
    window.location = url;
  };

  return <button onClick={handleOnboard}>Connect with Stripe</button>;
}
