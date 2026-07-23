// -----------------------------------------------------------------------------
// Entry point of the Free Mobile external integration.
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
//   - onSendMessage(contact, message): the ONLY hook we implement. `contact` is
//     the target user's contact_schema values ({ username, access_token }); we
//     forward the text to that user's own phone via the Free Mobile API.
//   - No linking code: there is no channel to send it through, and no user
//     authority to protect (a send-only channel never talks to the brain).
//   - publishMessage / onScanRequest / onSetValue: N/A (no inbound, no device).
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, isConfigured } from './src/config.js';
import { sendSms } from './src/free-mobile.js';

const gladys = new GladysIntegration();

// --- Outgoing message: Gladys asks us to deliver an SMS ----------------------
// This is the whole point of the integration: a scene "send a message", an alert
// or a notification routed to a user ends up here. Gladys only calls us for users
// who filled in their credentials, so `contact` always carries them.
// `message` is `{ text, file }`; Free Mobile SMS carries text only, so the
// optional `file` attachment is ignored.
gladys.onSendMessage(async (contact, message) => {
  const credentials = normalizeConfig(contact);
  if (!isConfigured(credentials)) {
    throw new Error('Free Mobile credentials are missing (identifier and API key are required)');
  }
  logger.info(`onSendMessage -> delivering an SMS to Free Mobile ${credentials.username}`);
  await sendSms(credentials, message.text);
});

// --- Connection lifecycle ----------------------------------------------------
// There is no persistent connection to Free Mobile (it is a fire-and-forget HTTP
// webhook) and no integration-wide configuration to validate: credentials live
// per user and are checked when a message is actually sent. So the integration
// is simply "connected" as soon as it is up.
gladys.on('connected', async () => {
  try {
    await gladys.setConnectionStatus(true);
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
  }
});

// --- Graceful shutdown -------------------------------------------------------
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the Free Mobile integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
