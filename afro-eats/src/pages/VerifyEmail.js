import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';
import { toast } from 'react-toastify';

function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Get email from location state (passed from registration page)
  const email = location.state?.email || '';

  useEffect(() => {
    if (!email) {
      toast.error('No email provided. Please register first.');
      navigate('/register');
    }
  }, [email, navigate]);

  useEffect(() => {
    if (timer > 0 && !canResend) {
      const countdown = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(countdown);
    }

    if (timer === 0) {
      setCanResend(true);
    }

    return undefined;
  }, [timer, canResend]);

  const handleVerify = async (e) => {
    e.preventDefault();

    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          code: verificationCode
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Email verified successfully! Welcome to Order Dabaly!');
        navigate('/');
      } else {
        setError(data.error || 'Verification failed. Please try again.');
        toast.error(data.error || 'Verification failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Verification code resent! Please check your email.');
        setCanResend(false);
        setTimer(60);
        setVerificationCode('');
      } else {
        toast.error(data.error || 'Failed to resend code');
      }
    } catch (error) {
      toast.error('An error occurred. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(value);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">📧 Verify Your Email</h1>
          <p className="text-gray-600">We sent a verification code to</p>
          <p className="text-green-600 font-semibold">{email}</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                Verification Code
              </label>
              <input
                type="text"
                id="code"
                value={verificationCode}
                onChange={handleCodeChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-2xl font-mono tracking-widest"
                placeholder="000000"
                maxLength={6}
                required
                autoComplete="off"
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Enter the 6-digit code from your email
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

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
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 mb-2">
              Did not receive the code?
            </p>
            {canResend ? (
              <button
                onClick={handleResendCode}
                disabled={resendLoading}
                className="text-green-600 hover:text-green-700 font-semibold text-sm disabled:opacity-50"
              >
                {resendLoading ? 'Sending...' : 'Resend Code'}
              </button>
            ) : (
              <p className="text-sm text-gray-500">
                Resend available in {timer}s
              </p>
            )}
          </div>

          <div className="mt-6 text-center border-t pt-4">
            <Link
              to="/register"
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ← Back to registration
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail;
