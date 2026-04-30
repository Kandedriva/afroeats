// React import removed as it's not needed in React 17+
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import { toast } from "react-toastify";
import { validatePassword } from "../utils/authValidation";

function UserPasswordUpdate() {
  const [step, setStep] = useState(1); // 1 = request code, 2 = reset password
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (step === 2 && timer > 0 && !canResend) {
      const countdown = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(countdown);
    }

    if (timer === 0) {
      setCanResend(true);
    }

    return undefined;
  }, [timer, canResend, step]);

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Reset code sent! Please check your email.");
        setStep(2);
        setTimer(60);
        setCanResend(false);
      } else {
        toast.error(data.error || "Failed to send reset code");
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Reset code resent! Please check your email.");
        setTimer(60);
        setCanResend(false);
        setVerificationCode("");
      } else {
        toast.error(data.error || "Failed to resend code");
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      toast.error(pwCheck.error);
      return;
    }

    if (verificationCode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code: verificationCode,
          new_password: newPassword
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Password reset successfully! You can now login.");
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        toast.error(data.error || "Password reset failed");
      }
    } catch (err) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {step === 1 ? (
          // Step 1: Request Reset Code
          <>
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">🔑 Reset Password</h1>
              <p className="text-gray-600">Enter your email to receive a reset code</p>
            </div>

            <div className="bg-white rounded-lg shadow-xl p-8">
              <form onSubmit={handleRequestCode} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your@email.com"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded">
                  <p className="text-sm">
                    <strong>💡 Note:</strong> A 6-digit code will be sent to your email
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
                    loading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? 'Sending Code...' : 'Send Reset Code'}
                </button>
              </form>

              <div className="mt-6 text-center border-t pt-4">
                <Link
                  to="/login"
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  ← Back to Login
                </Link>
              </div>
            </div>
          </>
        ) : (
          // Step 2: Reset Password with Code
          <>
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">🔐 Enter Reset Code</h1>
              <p className="text-gray-600">Check your email for the code</p>
              <p className="text-blue-600 font-semibold">{email}</p>
            </div>

            <div className="bg-white rounded-lg shadow-xl p-8">
              <form onSubmit={handleResetPassword} className="space-y-6">
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    id="code"
                    value={verificationCode}
                    onChange={handleCodeChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl font-mono tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                    required
                    autoComplete="off"
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Enter the 6-digit code from your email
                  </p>
                </div>

                <div>
                  <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    id="new_password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter new password"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirm_password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm new password"
                    required
                    autoComplete="new-password"
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
                  <p className="text-sm">
                    <strong>⏰ Note:</strong> The code expires in 10 minutes
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || verificationCode.length !== 6}
                  className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
                    loading || verificationCode.length !== 6
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? 'Resetting Password...' : 'Reset Password'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 mb-2">
                  Did not receive the code?
                </p>
                {canResend ? (
                  <button
                    onClick={handleResendCode}
                    disabled={loading}
                    className="text-blue-600 hover:text-blue-700 font-semibold text-sm disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Resend Code'}
                  </button>
                ) : (
                  <p className="text-sm text-gray-500">
                    Resend available in {timer}s
                  </p>
                )}
              </div>

              <div className="mt-6 text-center border-t pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  ← Use different email
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default UserPasswordUpdate;
