// Shared password validation — must match the rule in backend/middleware/security.js
// Rule: min 8 chars, at least one uppercase, one lowercase, one digit.

export function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  return { valid: true, error: null };
}

export const PASSWORD_HINT = 'Min 8 characters, with uppercase, lowercase, and a number.';
