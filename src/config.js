// -----------------------------------------------------------------------------
// Credentials of the Free Mobile integration.
//
// This is a send-only communication channel, so credentials are PER USER: each
// user fills the `contact_schema` declared in the manifest, in the "My account"
// block of the Configuration screen:
//   - username     (Free Mobile identifier)
//   - access_token (Free Mobile API key, stored as a secret)
//
// Gladys resolves them and passes them as the `contact` of every outgoing
// message. This module turns that raw object into a small validated shape used
// by the rest of the integration.
// -----------------------------------------------------------------------------

/**
 * @description Normalize a raw contact/credentials object into the shape used
 * internally.
 * @param {object} [rawConfig] - The raw contact_schema values from the host API.
 * @returns {{ username: string, accessToken: string }} The normalized credentials.
 * @example
 * normalizeConfig({ username: '12345678', access_token: 'abcd' });
 * // -> { username: '12345678', accessToken: 'abcd' }
 */
function normalizeConfig(rawConfig = {}) {
  return {
    username: typeof rawConfig.username === 'string' ? rawConfig.username.trim() : '',
    accessToken: typeof rawConfig.access_token === 'string' ? rawConfig.access_token.trim() : '',
  };
}

/**
 * @description Whether the credentials hold a complete pair.
 * @param {{ username: string, accessToken: string }} config - Normalized credentials.
 * @returns {boolean} True if both the username and the access token are set.
 * @example
 * isConfigured({ username: '12345678', accessToken: 'abcd' }); // -> true
 */
function isConfigured(config) {
  return Boolean(config.username && config.accessToken);
}

export { normalizeConfig, isConfigured };
