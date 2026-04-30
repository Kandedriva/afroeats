import crypto from 'crypto';

const RECOVERY_TOKEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret() {
  const s = process.env.RECOVERY_TOKEN_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error('RECOVERY_TOKEN_SECRET or SESSION_SECRET env var is required');
  // Namespace the secret so a SESSION_SECRET fallback can't be cross-used
  return `recovery:${s}`;
}

/**
 * Generate a signed recovery token for a given account.
 * @param {'user'|'owner'|'grocery'} type
 * @param {number} id
 * @returns {string}
 */
export function generateRecoveryToken(type, id) {
  const payload = Buffer.from(JSON.stringify({ t: type, id, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Verify and decode a recovery token.
 * Returns the payload if valid, or null if invalid/expired/tampered.
 * @param {string} token
 * @returns {{ t: string, id: number, iat: number } | null}
 */
export function verifyRecoveryToken(token) {
  try {
    const dot = token.lastIndexOf('.');
    if (dot < 1) return null;

    const payloadB64 = token.slice(0, dot);
    const sigB64 = token.slice(dot + 1);

    const expectedSig = crypto.createHmac('sha256', getSecret()).update(payloadB64).digest('base64url');

    const expectedBuf = Buffer.from(expectedSig);
    const actualBuf = Buffer.from(sigB64);
    if (expectedBuf.length !== actualBuf.length) return null;
    if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.t || !payload.id || !payload.iat) return null;
    if (Date.now() - payload.iat > RECOVERY_TOKEN_TTL) return null;

    return payload;
  } catch {
    return null;
  }
}
