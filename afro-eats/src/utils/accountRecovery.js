import { API_BASE_URL } from '../config/api';

const KEYS = {
  user: 'ord_rt_user',
  owner: 'ord_rt_owner',
  grocery: 'ord_rt_grocery',
};

export function storeRecoveryToken(type, token) {
  try {
    localStorage.setItem(KEYS[type], token);
  } catch {
    // localStorage unavailable (private browsing etc.) — silently skip
  }
}

export function clearRecoveryToken(type) {
  try {
    localStorage.removeItem(KEYS[type]);
  } catch {
    // ignore
  }
}

/**
 * Attempt to restore a lost session using a stored recovery token.
 * Returns the server response body on success, or null on failure.
 */
export async function attemptSessionRecovery(type) {
  const key = KEYS[type];
  if (!key) { return null; }

  let token;
  try {
    token = localStorage.getItem(key);
  } catch {
    return null;
  }

  if (!token) { return null; }

  try {
    const res = await fetch(`${API_BASE_URL}/api/session-recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      clearRecoveryToken(type);
      return null;
    }

    const data = await res.json();

    // Rotate stored token with the fresh one returned by the server
    if (data.recoveryToken) {
      storeRecoveryToken(type, data.recoveryToken);
    }

    return data;
  } catch {
    return null;
  }
}
