import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

let client = null;
if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

/**
 * Send an SMS message. Silently skips if Twilio is not configured or the
 * phone number is missing/invalid.
 */
export async function sendSMS(to, body) {
  if (!client) {
    console.warn('[SMS] Twilio not configured — skipping SMS');
    return;
  }
  if (!to) {
    console.warn('[SMS] No phone number provided — skipping SMS');
    return;
  }

  // Normalize: strip non-digit chars, then prepend +1 if no country code
  const digits = to.replace(/\D/g, '');
  const normalized = digits.startsWith('1') && digits.length === 11
    ? `+${digits}`
    : digits.length === 10
      ? `+1${digits}`
      : `+${digits}`;

  try {
    const msg = await client.messages.create({ body, from: fromNumber, to: normalized });
    console.log(`✅ [SMS] Sent to ${normalized} — SID: ${msg.sid}`);
  } catch (err) {
    console.error(`[SMS] Failed to send to ${normalized}:`, err.message);
  }
}
