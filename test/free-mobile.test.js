import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  sendSms,
  splitMessage,
  describeError,
  createSerializer,
  FREE_MOBILE_SEND_URL,
  MAX_SMS_LENGTH,
} from '../src/free-mobile.js';
import { createFakeFetch } from './helpers/fakeFetch.js';

const CREDENTIALS = { username: '12345678', accessToken: 'my-secret-key' };

/**
 * @description A pause double that records the delays instead of waiting.
 * @returns {{ wait: Function, waits: number[] }} The pause and its log.
 * @example
 * const { wait, waits } = createFakeWait();
 */
function createFakeWait() {
  const waits = [];
  return { wait: async (ms) => waits.push(ms), waits };
}

test('sendSms posts user/pass/msg as JSON and keeps them out of the URL', async () => {
  const { fetch, calls } = createFakeFetch({ status: 200 });
  await sendSms(CREDENTIALS, 'Hello from Gladys! 50% & co', { fetchImpl: fetch });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, FREE_MOBILE_SEND_URL);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
  assert.deepEqual(calls[0].body, {
    user: '12345678',
    pass: 'my-secret-key',
    msg: 'Hello from Gladys! 50% & co',
  });
});

test('sendSms throws when credentials are missing', async () => {
  const { fetch, calls } = createFakeFetch();
  await assert.rejects(
    () => sendSms({ username: '', accessToken: '' }, 'x', { fetchImpl: fetch }),
    /credentials/i,
  );
  assert.equal(calls.length, 0);
});

test('sendSms throws on an empty or blank message', async () => {
  const { fetch } = createFakeFetch();
  await assert.rejects(() => sendSms(CREDENTIALS, '', { fetchImpl: fetch }), /non-empty/i);
  await assert.rejects(() => sendSms(CREDENTIALS, '  \n ', { fetchImpl: fetch }), /non-empty/i);
  await assert.rejects(() => sendSms(CREDENTIALS, undefined, { fetchImpl: fetch }), /non-empty/i);
});

test('sendSms sends a message of exactly MAX_SMS_LENGTH characters in one SMS', async () => {
  const { fetch, calls } = createFakeFetch();
  await sendSms(CREDENTIALS, 'a'.repeat(MAX_SMS_LENGTH), { fetchImpl: fetch });
  assert.equal(calls.length, 1);
});

test('sendSms splits a long message into numbered SMS', async () => {
  const { fetch, calls } = createFakeFetch();
  const { wait } = createFakeWait();
  const longText = 'word '.repeat(400).trim(); // 1999 characters
  await sendSms(CREDENTIALS, longText, { fetchImpl: fetch, wait });

  assert.equal(calls.length, 3);
  calls.forEach((call, index) => {
    assert.ok(call.body.msg.length <= MAX_SMS_LENGTH);
    assert.ok(call.body.msg.endsWith(`(${index + 1}/3)`));
  });
});

test('sendSms retries on 402 and 500, then succeeds', async () => {
  const { fetch, calls } = createFakeFetch({ status: [402, 500, 200] });
  const { wait, waits } = createFakeWait();
  await sendSms(CREDENTIALS, 'hi', { fetchImpl: fetch, wait, retryDelaysMs: [10, 20] });
  assert.equal(calls.length, 3);
  assert.deepEqual(waits, [10, 20]);
});

test('sendSms gives up after the last retry', async () => {
  const { fetch, calls } = createFakeFetch({ status: 402 });
  const { wait } = createFakeWait();
  await assert.rejects(
    () => sendSms(CREDENTIALS, 'hi', { fetchImpl: fetch, wait, retryDelaysMs: [10, 20] }),
    /too many SMS/i,
  );
  assert.equal(calls.length, 3);
});

test('sendSms does not retry a 403 and never leaks the credentials', async () => {
  const { fetch, calls } = createFakeFetch({ status: 403 });
  const { wait } = createFakeWait();
  await assert.rejects(
    () => sendSms(CREDENTIALS, 'hi', { fetchImpl: fetch, wait }),
    (err) => {
      assert.match(err.message, /access denied/i);
      assert.doesNotMatch(err.message, /my-secret-key/);
      return true;
    },
  );
  assert.equal(calls.length, 1);
});

test('sendSms maps a timeout (AbortError) to a clear message, without retrying', async () => {
  const { fetch, calls } = createFakeFetch({ throwAbort: true });
  await assert.rejects(() => sendSms(CREDENTIALS, 'hi', { fetchImpl: fetch }), /timed out/i);
  assert.equal(calls.length, 1);
});

test('sendSms reports a network failure without the request details', async () => {
  const { fetch } = createFakeFetch({ throwError: new Error('getaddrinfo ENOTFOUND') });
  await assert.rejects(
    () => sendSms(CREDENTIALS, 'hi', { fetchImpl: fetch }),
    (err) => {
      assert.match(err.message, /unreachable: getaddrinfo ENOTFOUND/);
      assert.doesNotMatch(err.message, /my-secret-key/);
      return true;
    },
  );
});

test('splitMessage cuts on spaces and line breaks, never above the limit', () => {
  assert.deepEqual(splitMessage('Hello world', 6), ['Hello', 'world']);
  assert.deepEqual(splitMessage('line one\nline two', 10), ['line one', 'line two']);
  assert.deepEqual(splitMessage('short', 10), ['short']);
});

test('splitMessage hard-cuts a word longer than the limit', () => {
  assert.deepEqual(splitMessage('abcdefghij', 4), ['abcd', 'efgh', 'ij']);
});

test('createSerializer runs the tasks of one key in order, and keeps going after a failure', async () => {
  const serialize = createSerializer();
  const order = [];
  const task =
    (name, ms, fail = false) =>
    async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      order.push(name);
      if (fail) {
        throw new Error(name);
      }
    };
  const results = await Promise.allSettled([
    serialize('a', task('a1', 20, true)),
    serialize('a', task('a2', 1)),
    serialize('b', task('b1', 5)),
  ]);
  assert.deepEqual(order, ['b1', 'a1', 'a2']);
  assert.equal(results[0].status, 'rejected');
  assert.equal(results[1].status, 'fulfilled');
});

test('describeError covers the documented Free Mobile status codes', () => {
  assert.match(describeError(400), /missing parameter/i);
  assert.match(describeError(402), /too many/i);
  assert.match(describeError(403), /access denied/i);
  assert.match(describeError(500), /server error/i);
  assert.match(describeError(418), /unexpected HTTP status 418/i);
});
