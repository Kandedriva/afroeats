// React import removed as it's not needed in React 17+
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from 'react-toastify';
import { API_BASE_URL } from "../config/api";
import { validatePassword, PASSWORD_HINT } from "../utils/authValidation";

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    address: "",
    phone: ""
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Ensure terms and conditions links are visible immediately
  useEffect(() => {
    // Force visibility of terms and privacy links
    const timer = setTimeout(() => {
      const termsLinks = document.querySelectorAll('a[href="/terms"], a[href="/privacy"]');
      termsLinks.forEach(link => {
        link.style.display = 'inline';
        link.style.visibility = 'visible';
        link.style.opacity = '1';
      });
    }, 0);
    
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!acceptedTerms) {
      toast.error("Please accept the Terms and Conditions and Privacy Policy to continue.");
      return;
    }

    const pwCheck = validatePassword(form.password);
    if (!pwCheck.valid) {
      toast.error(pwCheck.error);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Include cookies for session
        body: JSON.stringify(form),
      });
  
      const data = await res.json();
      if (res.ok) {
        toast.success("Registration successful! Please check your email for the verification code.");
        // Redirect to verification page with email
        setTimeout(() => {
          navigate("/verify-email", { state: { email: form.email } });
        }, 1000);
      } else {
        toast.error(data.error || "Registration failed.");
      }
    } catch (err) {
      toast.error("An error occurred.");
    }
  };
  

  return (
    <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded shadow">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors duration-200 group"
      >
        <svg
          className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform duration-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span className="font-medium text-sm">Back to Home</span>
      </button>
      <h2 className="text-2xl font-bold mb-4">Create Account</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          name="name"
          placeholder="Full Name"
          value={form.name}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded"
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email Address"
          value={form.email}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded"
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded"
          required
        />
        <p className="text-xs text-gray-500 -mt-2">{PASSWORD_HINT}</p>
        <input
          type="text"
          name="address"
          placeholder="Delivery Address"
          value={form.address}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded"
          required
        />
        <input
          type="tel"
          name="phone"
          placeholder="Phone Number"
          value={form.phone}
          onChange={handleChange}
          className="w-full px-4 py-2 border rounded"
          required
        />
        
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="terms"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            required
          />
          <label htmlFor="terms" className="text-sm text-gray-700">
            I agree to the{" "}
            <Link 
              to="/terms" 
              className="text-green-600 hover:text-green-800 underline inline-block"
              target="_blank"
              rel="noopener noreferrer"
              style={{ 
                color: '#059669', 
                textDecoration: 'underline', 
                display: 'inline',
                visibility: 'visible',
                opacity: 1
              }}
            >
              Terms and Conditions
            </Link>{" "}
            and{" "}
            <Link 
              to="/privacy" 
              className="text-green-600 hover:text-green-800 underline inline-block"
              target="_blank"
              rel="noopener noreferrer"
              style={{ 
                color: '#059669', 
                textDecoration: 'underline', 
                display: 'inline',
                visibility: 'visible',
                opacity: 1
              }}
            >
              Privacy Policy
            </Link>
          </label>
        </div>
        
        <button 
          type="submit" 
          disabled={!acceptedTerms}
          className={`w-full py-2 rounded transition-colors ${
            acceptedTerms
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          Register
        </button>
      </form>
    </div>
  );
}
