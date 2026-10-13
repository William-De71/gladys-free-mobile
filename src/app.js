// -----------------------------------------------------------------------------
// Every handler of the Free Mobile integration, registered on the Gladys client
// it receives: index.js passes the real one, the tests the fake Gladys of the
// SDK (`@gladysassistant/integration-sdk/testing`).
//
// Free Mobile is a COMMUNICATION integration (manifest `type: "communication"`)
// of the SEND-ONLY family (`messaging: { receive: false }`): the Free Mobile SMS
// API only lets you send an SMS to your own number, and there is no inbound
// channel at all.
//
// Consequence on the SDK communication model:
//   - Each user enters their own credentials in the "My account" block of the
//     Configuration screen, described by the manifest `contact_schema`. Gladys
//     resolves them and hands them to us with EVERY outgoing message, so this
//     integration is stateless: it holds no credentials of its own.
//   - onSendMessage(contact, message): `contact` is the target user's
//     contact_schema values ({ username, access_token }); we forward the text
//     to that user's own phone via the Free Mobile API.
//   - No linking code: there is no channel to send it through, and no user
//     authority to protect (a send-only channel never talks to the brain).
//   - publishMessage / onScanRequest / onSetValue: N/A (no inbound, no device).
//   - Scene trigger `sms_not_sent` (src/events.js): the first failure of a line.
// -----------------------------------------------------------------------------

import { logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, isConfigured, maskIdentifier } from './config.js';
import { sendSms, createSerializer, FreeMobileError } from './free-mobile.js';
import { createFailureEvents } from './events.js';

/**
 * @description Register the handlers of the integration on a Gladys client.
 * @param {object} gladys - The GladysIntegration client (real or fake).
 * @param {object} [options] - Options (injected by the tests).
 * @param {typeof fetch} [options.fetchImpl] - fetch implementation.
 * @param {Function} [options.wait] - Pause implementation, `(ms) => Promise`.
 * @param {number[]} [options.retryDelaysMs] - Pauses before each retry.
 * @returns {object} The same Gladys client.
 * @example
 * createApp(new GladysIntegration()).connect();
 */
function createApp(gladys, { fetchImpl, wait, retryDelaysMs } = {}) {
  // One queue per Free Mobile account: messages for the same user leave one
  // after the other instead of racing into the API's rate limit.
  const serialize = createSerializer();
  const events = createFailureEvents(gladys);

  // --- Outgoing message: Gladys asks us to deliver an SMS --------------------
  // A scene "send a message", an alert or a notification routed to a user ends
  // up here. Gladys only calls us for users who filled in their credentials, so
  // `contact` always carries them. `message` is `{ text, file }`; Free Mobile
  // SMS carries text only, so the optional `file` attachment is ignored. A text
  // longer than one call allows is sent as several numbered SMS.
  gladys.onSendMessage(async (contact, message) => {
    const credentials = normalizeConfig(contact);
    if (!isConfigured(credentials)) {
      throw new Error('Free Mobile credentials are missing (identifier and API key are required)');
    }
    const account = maskIdentifier(credentials.username);
    logger.info(`onSendMessage -> delivering an SMS to Free Mobile ${account}`);
    await serialize(credentials.username, async () => {
      try {
        await sendSms(credentials, message.text, { fetchImpl, wait, retryDelaysMs });
      } catch (err) {
        // Only what Free Mobile refused or could not receive is a "not sent"
        // event; a malformed request from Gladys (empty text) is not.
        if (err instanceof FreeMobileError) {
          logger.warn(`SMS to Free Mobile ${account} not sent (${err.reason}): ${err.message}`);
          await events.failed(credentials.username, err);
        }
        throw err;
      }
      events.sent(credentials.username);
    });
  });

  // --- Connection lifecycle --------------------------------------------------
  // There is no persistent connection to Free Mobile (it is a fire-and-forget
  // HTTP webhook) and no integration-wide configuration to validate:
  // credentials live per user and are checked when a message is actually sent.
  // So the integration is simply "connected" as soon as it is up.
  gladys.on('connected', async () => {
    try {
      await gladys.setConnectionStatus(true);
    } catch (err) {
      logger.error('Post-connection initialization failed', err);
    }
  });

  return gladys;
}

export { createApp };
