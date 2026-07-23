import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  sendSms,
  describeError,
  FREE_MOBILE_SEND_URL,
  MAX_SMS_LENGTH,
} from '../src/free-mobile.js';
import { createFakeFetch } from './helpers/fakeFetch.js';

const CREDENTIALS = { username: '12345678', accessToken: 'my-secret-key' };

test('sendSms calls the Free Mobile API with user/pass/msg query params', async () => {
  const { fetch, calls } = createFakeFetch({ status: 200 });
  await sendSms(CREDENTIALS, 'Hello from Gladys!', { fetchImpl: fetch });

  assert.equal(calls.length, 1);
  const url = new URL(calls[0].url);
  assert.equal(`${url.origin}${url.pathname}`, FREE_MOBILE_SEND_URL);
  assert.equal(url.searchParams.get('user'), '12345678');
  assert.equal(url.searchParams.get('pass'), 'my-secret-key');
  assert.equal(url.searchParams.get('msg'), 'Hello from Gladys!');
  assert.equal(calls[0].init.method, 'GET');
});

test('sendSms throws when credentials are missing', async () => {
  const { fetch } = createFakeFetch();
  await assert.rejects(
    () => sendSms({ username: '', accessToken: '' }, 'x', { fetchImpl: fetch }),
    /credentials/i,
  );
});

test('sendSms throws on an empty message', async () => {
  const { fetch } = createFakeFetch();
  await assert.rejects(() => sendSms(CREDENTIALS, '', { fetchImpl: fetch }), /non-empty/i);
});

test('sendSms throws when the message is too long', async () => {
  const { fetch } = createFakeFetch();
  const tooLong = 'a'.repeat(MAX_SMS_LENGTH + 1);
  await assert.rejects(() => sendSms(CREDENTIALS, tooLong, { fetchImpl: fetch }), /too long/i);
});

test('sendSms surfaces a readable reason on HTTP 403 and never leaks the URL', async () => {
  const { fetch } = createFakeFetch({ status: 403 });
  await assert.rejects(
    () => sendSms(CREDENTIALS, 'hi', { fetchImpl: fetch }),
    (err) => {
      assert.match(err.message, /access denied/i);
      assert.doesNotMatch(err.message, /my-secret-key/);
      assert.doesNotMatch(err.message, /smsapi\.free-mobile\.fr/);
      return true;
    },
  );
});

test('sendSms maps a timeout (AbortError) to a clear message', async () => {
  const { fetch } = createFakeFetch({ throwAbort: true });
  await assert.rejects(() => sendSms(CREDENTIALS, 'hi', { fetchImpl: fetch }), /timed out/i);
});

test('describeError covers the documented Free Mobile status codes', () => {
  assert.match(describeError(400), /missing parameter/i);
  assert.match(describeError(402), /too many/i);
  assert.match(describeError(403), /access denied/i);
  assert.match(describeError(500), /server error/i);
  assert.match(describeError(418), /unexpected HTTP status 418/i);
});
