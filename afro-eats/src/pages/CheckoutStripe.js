// src/pages/CheckoutStripe.jsx
// React import removed as it's not needed in React 17+
import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useCart } from "../context/CartContext";
import { API_BASE_URL } from "../config/api";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

function CheckoutForm() {
  const { cart } = useCart();
  const [clientSecret, setClientSecret] = useState("");

  useEffect(() => {
    const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const ownerId = cart[0]?.restaurantId;
    fetch(`${API_BASE_URL}/api/owners/stripe/create-payment-intent`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ amount: Math.round(total*100), items: cart, restaurantOwnerId: ownerId }),
    })
      .then(r => r.json())
      .then(d => setClientSecret(d.clientSecret));
  }, [cart]);

  if (!clientSecret) {
    return <p>Preparing payment...</p>;
  }

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
    const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/order-success` } });
    if (!result.error) {
      clearCart();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button disabled={!stripe}>Pay</button>
    </form>
  );
}

export default CheckoutForm;
