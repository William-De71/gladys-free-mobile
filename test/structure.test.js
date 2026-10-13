// -----------------------------------------------------------------------------
// Structure non-regression: what users of 1.2.0 already stored must keep its
// meaning. Free Mobile publishes no device, so what is forever here is the
// manifest contract Gladys stored for every user (type, messaging family,
// contact_schema keys and types) and the call made to Free Mobile.
//
// test/fixtures/manifest.baseline.json was generated from the v1.2.0 tag,
// before any change of this version. A difference is a breaking change: it
// needs an entry in ALLOWED_CHANGES with its migration, in the changelog, the
// docs and the forum message.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sendSms, FREE_MOBILE_SEND_URL, FAILURE_REASONS } from '../src/free-mobile.js';
import { createFakeFetch } from './helpers/fakeFetch.js';

const read = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const baseline = read('test/fixtures/manifest.baseline.json');
const manifest = read('gladys-assistant-integration.json');

// No allowed change in this version.
const ALLOWED_CHANGES = [];

test('the manifest keeps the type, the messaging family and the transport of 1.2.0', () => {
  assert.equal(manifest.type, baseline.type);
  assert.deepEqual(manifest.messaging, baseline.messaging);
  assert.deepEqual(manifest.transports, baseline.transports);
  assert.deepEqual(ALLOWED_CHANGES, []);
});

test('every contact_schema key of 1.2.0 is still there, with the same type and requirement', () => {
  const current = new Map(manifest.contact_schema.map((field) => [field.key, field]));
  for (const field of baseline.contact_schema) {
    const now = current.get(field.key);
    assert.ok(now, `contact_schema.${field.key} was removed`);
    assert.equal(now.type, field.type, `contact_schema.${field.key}.type`);
    assert.equal(now.required ?? false, field.required, `contact_schema.${field.key}.required`);
  }
  // A new required field without a default would block every existing user.
  for (const field of manifest.contact_schema) {
    if (!baseline.contact_schema.some((old) => old.key === field.key)) {
      assert.ok(!field.required || field.default !== undefined, `new required ${field.key}`);
    }
  }
});

test('the configuration and action keys of 1.2.0 are kept', () => {
  const keys = (list) => (list || []).map((item) => item.key);
  for (const key of baseline.actions) {
    assert.ok(keys(manifest.actions).includes(key), `action ${key}`);
  }
  for (const field of baseline.config_schema) {
    assert.ok(keys(manifest.config_schema).includes(field.key), `config_schema.${field.key}`);
  }
});

test('the call to Free Mobile is the one 1.2.0 made', async () => {
  const { fetch, calls } = createFakeFetch();
  await sendSms({ username: '12345678', accessToken: 'key' }, 'Hello', { fetchImpl: fetch });
  assert.equal(FREE_MOBILE_SEND_URL, 'https://smsapi.free-mobile.fr/sendmsg');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(Object.keys(calls[0].body).sort(), ['msg', 'pass', 'user']);
});

test('scene trigger keys and the reason values match the code (they are stored by the scenes)', () => {
  const [trigger] = manifest.scene_triggers;
  assert.equal(trigger.key, 'sms_not_sent');
  const reasonField = trigger.fields.find((field) => field.key === 'reason');
  assert.deepEqual(
    reasonField.options.map((option) => option.value).sort(),
    Object.values(FAILURE_REASONS).sort(),
  );
  assert.deepEqual(
    trigger.variables.map((variable) => variable.key),
    ['reason', 'status', 'error', 'account'],
  );
});
