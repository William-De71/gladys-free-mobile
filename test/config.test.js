import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig, isConfigured } from '../src/config.js';

test('normalizeConfig maps the manifest keys and trims whitespace', () => {
  const config = normalizeConfig({ username: '  12345678 ', access_token: ' abcd ' });
  assert.deepEqual(config, { username: '12345678', accessToken: 'abcd' });
});

test('normalizeConfig returns empty strings when nothing is set', () => {
  assert.deepEqual(normalizeConfig(), { username: '', accessToken: '' });
  assert.deepEqual(normalizeConfig({}), { username: '', accessToken: '' });
});

test('normalizeConfig ignores non-string values', () => {
  const config = normalizeConfig({ username: 12345678, access_token: null });
  assert.deepEqual(config, { username: '', accessToken: '' });
});

test('isConfigured requires both the username and the access token', () => {
  assert.equal(isConfigured({ username: '12345678', accessToken: 'abcd' }), true);
  assert.equal(isConfigured({ username: '12345678', accessToken: '' }), false);
  assert.equal(isConfigured({ username: '', accessToken: 'abcd' }), false);
  assert.equal(isConfigured({ username: '', accessToken: '' }), false);
});
