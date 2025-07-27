// src/pages/CheckoutStripe.jsx
import React, { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useCart } from "../context/CartContext";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUB_KEY);

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const { cart, clearCart } = useCart();
  const [clientSecret, setClientSecret] = useState("");

  useEffect(() => {
    const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const ownerId = cart[0]?.restaurantId;
    fetch("/api/owners/stripe/create-payment-intent", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ amount: Math.round(total*100), items: cart, restaurantOwnerId: ownerId }),
    })
      .then(r => r.json())
      .then(d => setClientSecret(d.clientSecret));
  }, [cart]);

  if (!clientSecret) return <p>Preparing payment...</p>;

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <FormInner />
    </Elements>
  );
}

function FormInner() {
  const stripe = useStripe(), elements = useElements();
  const { clearCart } = useCart();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: process.env.REACT_APP_CLIENT_URL + "/order-success" } });
    if (!result.error) clearCart();
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button disabled={!stripe}>Pay</button>
    </form>
  );
}

export default CheckoutForm;
