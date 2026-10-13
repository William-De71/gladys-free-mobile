// -----------------------------------------------------------------------------
// Free Mobile SMS API client.
//
// Free Mobile exposes a single outgoing webhook to send an SMS to YOUR OWN
// number (the number of the account the credentials belong to):
//
//   POST https://smsapi.free-mobile.fr/sendmsg   {"user", "pass", "msg"}
//
// The same parameters are also accepted in the query string of a GET, but a
// URL ends up in proxy and access logs: posting them as a JSON body keeps the
// API key out of every URL.
//
// It is strictly outbound: there is no inbound channel, no delivery receipt,
// no way to send to an arbitrary number. This module holds ONLY that HTTP call
// (no SDK, no Gladys concept) so it stays trivially unit-testable.
// -----------------------------------------------------------------------------

const FREE_MOBILE_SEND_URL = 'https://smsapi.free-mobile.fr/sendmsg';
const REQUEST_TIMEOUT_MS = 10 * 1000;

// Longest text accepted in ONE call. Longer messages are split into several
// SMS rather than rejected with a raw HTTP 400.
const MAX_SMS_LENGTH = 999;

// Pauses before retrying a call Free Mobile answered 402 (too many SMS in a
// short time) or 500 (server error). Both answers mean the SMS was NOT sent, so
// retrying cannot deliver it twice. A timeout is not retried: the SMS may have
// gone through before the answer was lost.
const RETRY_DELAYS_MS = [2 * 1000, 5 * 1000];
const RETRYABLE_STATUSES = new Set([402, 500]);

// Gap between two parts of a split message, so the second one does not trip
// the 402 rate limit.
const PART_GAP_MS = 1000;

// Why an SMS was not sent, as the `reason` of a FreeMobileError and of the
// `sms_not_sent` scene trigger. These values are stored in the scenes that
// filter on them: never rename one.
const FAILURE_REASONS = Object.freeze({
  INVALID_MESSAGE: 'invalid_message',
  RATE_LIMITED: 'rate_limited',
  ACCESS_DENIED: 'access_denied',
  SERVER_ERROR: 'server_error',
  TIMEOUT: 'timeout',
  UNREACHABLE: 'unreachable',
  UNEXPECTED: 'unexpected',
});

/**
 * @description An SMS Free Mobile did not accept, with the reason of the failure.
 */
class FreeMobileError extends Error {
  /**
   * @param {string} message - Readable message, without any credential.
   * @param {object} details - Failure details.
   * @param {string} details.reason - One of FAILURE_REASONS.
   * @param {number|null} [details.status] - HTTP status, when Free Mobile answered.
   * @param {Error} [details.cause] - Underlying error.
   */
  constructor(message, { reason, status = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'FreeMobileError';
    this.reason = reason;
    this.status = status;
  }
}

/**
 * @description The failure reason of a Free Mobile HTTP status.
 * @param {number} status - HTTP status returned by the Free Mobile API.
 * @returns {string} One of FAILURE_REASONS.
 * @example
 * reasonOf(403); // -> 'access_denied'
 */
function reasonOf(status) {
  switch (status) {
    case 400:
      return FAILURE_REASONS.INVALID_MESSAGE;
    case 402:
      return FAILURE_REASONS.RATE_LIMITED;
    case 403:
      return FAILURE_REASONS.ACCESS_DENIED;
    case 500:
      return FAILURE_REASONS.SERVER_ERROR;
    default:
      return FAILURE_REASONS.UNEXPECTED;
  }
}

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
 * @description Split a text into parts of at most `maxLength` characters,
 * cutting on the last line break or space of each part when there is one, so
 * words are not broken in the middle.
 * @param {string} text - The full message.
 * @param {number} [maxLength] - Maximum length of a part.
 * @returns {string[]} The parts, in order (a single part for a short text).
 * @example
 * splitMessage('Hello world', 6); // -> ['Hello', 'world']
 */
function splitMessage(text, maxLength = MAX_SMS_LENGTH) {
  const parts = [];
  let rest = text;
  while (rest.length > maxLength) {
    const window = rest.slice(0, maxLength + 1);
    const cut = Math.max(window.lastIndexOf('\n'), window.lastIndexOf(' '));
    // No separator in the window (one huge word, a URL): hard cut.
    const end = cut > 0 ? cut : maxLength;
    parts.push(rest.slice(0, end).trimEnd());
    rest = rest.slice(end).trimStart();
  }
  if (rest.length > 0) {
    parts.push(rest);
  }
  return parts;
}

/**
 * @description Wait for a given time.
 * @param {number} ms - Milliseconds to wait.
 * @returns {Promise<void>} Resolves after `ms` milliseconds.
 * @example
 * await sleep(1000);
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * @description Make ONE call to the Free Mobile API.
 * @param {{ username: string, accessToken: string }} credentials - Free Mobile credentials.
 * @param {string} text - The message body (at most MAX_SMS_LENGTH characters).
 * @param {typeof fetch} fetchImpl - fetch implementation.
 * @returns {Promise<number>} The HTTP status of the answer.
 * @example
 * const status = await postOnce(credentials, 'Hello', fetch);
 */
async function postOnce({ username, accessToken }, text, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(FREE_MOBILE_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: username, pass: accessToken, msg: text }),
      signal: controller.signal,
    });
    return response.status;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new FreeMobileError('Free Mobile API timed out', {
        reason: FAILURE_REASONS.TIMEOUT,
        cause: err,
      });
    }
    // Never surface the request (it carries the credentials): the message of a
    // network error is enough to diagnose it.
    throw new FreeMobileError(`Free Mobile API unreachable: ${err.message}`, {
      reason: FAILURE_REASONS.UNREACHABLE,
      cause: err,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * @description Send ONE part, retrying when Free Mobile says it did not send it.
 * @param {{ username: string, accessToken: string }} credentials - Free Mobile credentials.
 * @param {string} text - The part to send.
 * @param {{ fetchImpl: typeof fetch, wait: Function, retryDelaysMs: number[] }} options - Injected helpers.
 * @returns {Promise<void>} Resolves when the part was accepted.
 * @example
 * await sendPart(credentials, 'Hello', { fetchImpl: fetch, wait: sleep, retryDelaysMs: [] });
 */
async function sendPart(credentials, text, { fetchImpl, wait, retryDelaysMs }) {
  for (let attempt = 0; ; attempt += 1) {
    const status = await postOnce(credentials, text, fetchImpl);
    if (status >= 200 && status < 300) {
      return;
    }
    if (!RETRYABLE_STATUSES.has(status) || attempt >= retryDelaysMs.length) {
      throw new FreeMobileError(`Free Mobile API rejected the SMS: ${describeError(status)}`, {
        reason: reasonOf(status),
        status,
      });
    }
    await wait(retryDelaysMs[attempt]);
  }
}

/**
 * @description Send an SMS through the Free Mobile API to the account owner's
 * own phone number. A text longer than MAX_SMS_LENGTH is sent as several SMS,
 * numbered "(1/2)", "(2/2)"…
 * @param {object} credentials - Free Mobile credentials.
 * @param {string} credentials.username - The Free Mobile identifier.
 * @param {string} credentials.accessToken - The Free Mobile API key.
 * @param {string} text - The message body (non-empty).
 * @param {object} [options] - Options (injected by the tests).
 * @param {typeof fetch} [options.fetchImpl] - fetch implementation.
 * @param {Function} [options.wait] - Pause implementation, `(ms) => Promise`.
 * @param {number[]} [options.retryDelaysMs] - Pauses before each retry.
 * @returns {Promise<void>} Resolves when every SMS was accepted by the API.
 * @example
 * await sendSms({ username: '12345678', accessToken: 'abcd' }, 'Hello from Gladys!');
 */
async function sendSms(
  { username, accessToken },
  text,
  { fetchImpl = fetch, wait = sleep, retryDelaysMs = RETRY_DELAYS_MS } = {},
) {
  if (!username || !accessToken) {
    throw new Error(
      'Free Mobile credentials are missing (username and access_token are both required)',
    );
  }
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Free Mobile message text must be a non-empty string');
  }

  // Keep room for the " (12/12)" counter when the text has to be split.
  const parts = text.length > MAX_SMS_LENGTH ? splitMessage(text, MAX_SMS_LENGTH - 10) : [text];
  const credentials = { username, accessToken };
  for (let index = 0; index < parts.length; index += 1) {
    if (index > 0) {
      await wait(PART_GAP_MS);
    }
    const body = parts.length > 1 ? `${parts[index]} (${index + 1}/${parts.length})` : parts[index];
    await sendPart(credentials, body, { fetchImpl, wait, retryDelaysMs });
  }
}

/**
 * @description Run tasks one after the other per key. Gladys may hand several
 * messages for the same user at once (a scene sending two notifications): sent
 * in parallel they would trip the 402 rate limit of the shared account.
 * @returns {(key: string, task: () => Promise<any>) => Promise<any>} The serializer.
 * @example
 * const serialize = createSerializer();
 * await serialize('12345678', () => sendSms(credentials, 'Hello'));
 */
function createSerializer() {
  const tails = new Map();
  return (key, task) => {
    const previous = tails.get(key) || Promise.resolve();
    // A failed task must not block the ones queued after it.
    const run = previous.catch(() => {}).then(task);
    const tail = run.catch(() => {});
    tails.set(key, tail);
    tail.then(() => {
      if (tails.get(key) === tail) {
        tails.delete(key);
      }
    });
    return run;
  };
}

export {
  sendSms,
  splitMessage,
  describeError,
  reasonOf,
  FreeMobileError,
  FAILURE_REASONS,
  createSerializer,
  FREE_MOBILE_SEND_URL,
  MAX_SMS_LENGTH,
};
