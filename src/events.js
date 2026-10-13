// -----------------------------------------------------------------------------
// Scene trigger `sms_not_sent`: Free Mobile did not send an SMS.
//
// One event per TRANSITION of an account, never one per failed message: the
// first failure of a Free Mobile line fires the trigger, the following ones
// stay silent until an SMS of that line goes through again. This is what
// keeps a scene bound to the trigger from looping: a scene that answers the
// failure with "send a message" to the same user (through this very channel)
// fails again, and that second failure fires nothing.
//
// The state lives in memory: after a restart, the first failure of a line
// fires the trigger again, which is what a user who restarted Gladys expects.
// -----------------------------------------------------------------------------

import { logger } from '@gladysassistant/integration-sdk';
import { FAILURE_REASONS } from './free-mobile.js';
import { maskIdentifier } from './config.js';

const SMS_NOT_SENT = 'sms_not_sent';

/**
 * @description Track the failing Free Mobile lines and fire `sms_not_sent` on
 * the first failure of each one.
 * @param {object} gladys - The GladysIntegration client.
 * @returns {{ failed: Function, sent: Function }} The tracker.
 * @example
 * const events = createFailureEvents(gladys);
 * await events.failed('12345678', err);
 * events.sent('12345678');
 */
function createFailureEvents(gladys) {
  const failing = new Set();

  return {
    /**
     * @description An SMS of this line was not sent: fire the trigger if the
     * line was not already failing. Never throws: the failure of the SMS is
     * what Gladys must hear about, not the failure of the event.
     * @param {string} username - The Free Mobile identifier.
     * @param {Error} err - Why the SMS was not sent.
     * @returns {Promise<void>} Resolves once the event is published (or skipped).
     */
    async failed(username, err) {
      if (failing.has(username)) {
        return;
      }
      failing.add(username);
      try {
        await gladys.publishSceneEvent(SMS_NOT_SENT, {
          reason: err.reason || FAILURE_REASONS.UNEXPECTED,
          status: typeof err.status === 'number' ? err.status : null,
          error: String(err.message).slice(0, 1000),
          account: maskIdentifier(username),
        });
      } catch (eventErr) {
        logger.warn(`Could not fire the ${SMS_NOT_SENT} scene trigger: ${eventErr.message}`);
      }
    },

    /**
     * @description An SMS of this line went through: the next failure fires
     * the trigger again.
     * @param {string} username - The Free Mobile identifier.
     */
    sent(username) {
      failing.delete(username);
    },
  };
}

export { createFailureEvents, SMS_NOT_SENT };
