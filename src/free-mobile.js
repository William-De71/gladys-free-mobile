// -----------------------------------------------------------------------------
// Free Mobile SMS API client.
//
// Free Mobile exposes a single outgoing webhook to send an SMS to YOUR OWN
// number (the number of the account the credentials belong to):
//
//   GET https://smsapi.free-mobile.fr/sendmsg?user=<id>&pass=<key>&msg=<text>
//
// It is strictly outbound: there is no inbound channel, no delivery receipt,
// no way to send to an arbitrary number. This module holds ONLY that HTTP call
// (no SDK, no Gladys concept) so it stays trivially unit-testable.
// -----------------------------------------------------------------------------

const FREE_MOBILE_SEND_URL = 'https://smsapi.free-mobile.fr/sendmsg';
const REQUEST_TIMEOUT_MS = 10 * 1000;

// The API caps the message length; keep it explicit so we fail with a clear
// message instead of a raw HTTP 400.
const MAX_SMS_LENGTH = 999;

/**
 * @description Map a Free Mobile HTTP status to a human-readable reason.
 * The API documents these codes on the SMS notifications page.
 * @param {number} status - HTTP status returned by the Free Mobile API.
 * @returns {string} A human-readable reason.
 * @example
 * describeError(403); // -> 'access denied (wrong identifier/key, or service not enabled)'
 */
function describeError(status) {
  switch (status) {
    case 400:
      return 'missing parameter (empty message?)';
    case 402:
      return 'too many SMS sent, please slow down';
    case 403:
      return 'access denied (wrong identifier/key, or service not enabled)';
    case 500:
      return 'Free Mobile server error, please retry later';
    default:
      return `unexpected HTTP status ${status}`;
  }
}

/**
 * @description Send an SMS through the Free Mobile API to the account owner's
 * own phone number.
 * @param {object} credentials - Free Mobile credentials.
 * @param {string} credentials.username - The Free Mobile identifier.
 * @param {string} credentials.accessToken - The Free Mobile API key.
 * @param {string} text - The message body (1..MAX_SMS_LENGTH characters).
 * @param {object} [options] - Options.
 * @param {typeof fetch} [options.fetchImpl] - fetch implementation (for tests).
 * @returns {Promise<void>} Resolves when the SMS was accepted by the API.
 * @example
 * await sendSms({ username: '12345678', accessToken: 'abcd' }, 'Hello from Gladys!');
 */
async function sendSms({ username, accessToken }, text, { fetchImpl = fetch } = {}) {
  if (!username || !accessToken) {
    throw new Error(
      'Free Mobile credentials are missing (username and access_token are both required)',
    );
  }
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('Free Mobile message text must be a non-empty string');
  }
  if (text.length > MAX_SMS_LENGTH) {
    throw new Error(`Free Mobile message text is too long (max ${MAX_SMS_LENGTH} characters)`);
  }

  const url = new URL(FREE_MOBILE_SEND_URL);
  url.searchParams.set('user', username);
  url.searchParams.set('pass', accessToken);
  url.searchParams.set('msg', text);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { method: 'GET', signal: controller.signal });
    if (!response.ok) {
      // Never surface the URL/credentials in the thrown error.
      throw new Error(`Free Mobile API rejected the SMS: ${describeError(response.status)}`);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Free Mobile API timed out', { cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export { sendSms, describeError, FREE_MOBILE_SEND_URL, MAX_SMS_LENGTH };
