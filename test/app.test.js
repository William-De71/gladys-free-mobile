// -----------------------------------------------------------------------------
// The handlers of src/app.js, driven by the fake Gladys of the SDK: the real
// GladysIntegration with an in-memory Gladys, so the payloads are checked the
// way the core checks them. Free Mobile is a fake fetch; nothing touches the
// network.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createApp } from '../src/app.js';
import { createFakeFetch } from './helpers/fakeFetch.js';

const manifest = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const CONTACT = { username: '12345678', access_token: 'my-secret-key' };
const MESSAGE = { text: 'The front door is open', file: null };

/**
 * @description A connected fake Gladys running the integration against a fake
 * Free Mobile answering `status` (one per call, the last one repeats).
 * @param {number|number[]} status - Free Mobile HTTP statuses.
 * @returns {Promise<{ gladys: object, calls: Array }>} The client and the calls.
 */
async function start(status = 200) {
  const { fetch, calls } = createFakeFetch({ status });
  const gladys = createFakeGladys();
  createApp(gladys, { fetchImpl: fetch, wait: async () => {}, retryDelaysMs: [0, 0] });
  await gladys.connect();
  return { gladys, calls };
}

test('the integration reports itself connected', async () => {
  const { gladys } = await start();
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
});

test('a message is posted to Free Mobile with the credentials of the target user', async () => {
  const { gladys, calls } = await start(200);
  const ack = await gladys.fake.sendMessage(CONTACT, MESSAGE);
  assert.equal(ack.success, true);
  assert.deepEqual(calls[0].body, {
    user: '12345678',
    pass: 'my-secret-key',
    msg: 'The front door is open',
  });
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('missing credentials fail the message, without calling Free Mobile nor firing a scene', async () => {
  const { gladys, calls } = await start();
  const ack = await gladys.fake.sendMessage({ username: '12345678' }, MESSAGE);
  assert.equal(ack.success, false);
  assert.equal(calls.length, 0);
  assert.deepEqual(gladys.fake.sceneEvents, []);
});

test('a refused SMS fails the message and fires sms_not_sent once, with flat declared data', async () => {
  const { gladys } = await start(403);
  const ack = await gladys.fake.sendMessage(CONTACT, MESSAGE);
  assert.equal(ack.success, false);
  assert.match(ack.error.message ?? String(ack.error), /access denied/);

  assert.equal(gladys.fake.sceneEvents.length, 1);
  const [event] = gladys.fake.sceneEvents;
  assert.equal(event.key, 'sms_not_sent');
  assert.deepEqual(event.data, {
    reason: 'access_denied',
    status: 403,
    error:
      'Free Mobile API rejected the SMS: access denied (wrong identifier/key, or service not enabled)',
    account: '12****78',
  });
  // Only declared variables, scalars, within the core limits.
  const declared = manifest.scene_triggers[0].variables.map((variable) => variable.key);
  assert.deepEqual(Object.keys(event.data).sort(), [...declared].sort());
  for (const value of Object.values(event.data)) {
    assert.ok(value === null || ['string', 'number', 'boolean'].includes(typeof value));
    assert.ok(typeof value !== 'string' || value.length <= 1000);
  }
  assert.ok(!JSON.stringify(event).includes('my-secret-key'), 'the API key never leaves');
});

test('a failing line fires once: a scene answering through this channel cannot loop', async () => {
  const { gladys } = await start(500);
  await gladys.fake.sendMessage(CONTACT, MESSAGE);
  await gladys.fake.sendMessage(CONTACT, { text: 'SMS failed, check the API key', file: null });
  await gladys.fake.sendMessage(CONTACT, MESSAGE);
  assert.equal(gladys.fake.sceneEvents.length, 1);
  assert.equal(gladys.fake.sceneEvents[0].data.reason, 'server_error');
});

test('after an SMS goes through, the next failure fires again', async () => {
  const { gladys } = await start([403, 200, 402, 402, 402]);
  await gladys.fake.sendMessage(CONTACT, MESSAGE); // 403
  await gladys.fake.sendMessage(CONTACT, MESSAGE); // 200
  await gladys.fake.sendMessage(CONTACT, MESSAGE); // 402, retried twice
  assert.deepEqual(
    gladys.fake.sceneEvents.map((event) => event.data.reason),
    ['access_denied', 'rate_limited'],
  );
});

test('each Free Mobile line has its own state', async () => {
  const { gladys } = await start(403);
  await gladys.fake.sendMessage(CONTACT, MESSAGE);
  await gladys.fake.sendMessage({ username: '87654321', access_token: 'other' }, MESSAGE);
  assert.deepEqual(
    gladys.fake.sceneEvents.map((event) => event.data.account),
    ['12****78', '87****21'],
  );
});

test('a network error fires the trigger with a null status', async () => {
  const { fetch } = createFakeFetch({ throwError: new Error('getaddrinfo ENOTFOUND') });
  const gladys = createFakeGladys();
  createApp(gladys, { fetchImpl: fetch, wait: async () => {}, retryDelaysMs: [] });
  await gladys.connect();
  await gladys.fake.sendMessage(CONTACT, MESSAGE);
  assert.equal(gladys.fake.sceneEvents[0].data.reason, 'unreachable');
  assert.equal(gladys.fake.sceneEvents[0].data.status, null);
});

test('a scene event Gladys refuses never hides the failure of the SMS', async (t) => {
  const { gladys } = await start(403);
  t.mock.method(gladys, 'publishSceneEvent', async () => {
    throw new Error('429 TOO_MANY_REQUESTS');
  });
  const ack = await gladys.fake.sendMessage(CONTACT, MESSAGE);
  assert.equal(ack.success, false);
  assert.match(ack.error.message ?? String(ack.error), /access denied/);
});
