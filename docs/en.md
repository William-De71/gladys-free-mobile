# Free Mobile SMS

This integration sends **SMS notifications** to your own phone number, using the free **Free Mobile** SMS API. It is a **send-only** channel: Gladys can send you an SMS (a scene notification, an alert…), but there is no inbound channel — you cannot reply to the SMS to control Gladys.

## Requirements

- A **Free Mobile** subscription (the Free mobile plan, not the Freebox).
- The **"SMS notifications"** option enabled on your account.

## Enable the option and get your credentials

1. Sign in to your **Free Mobile subscriber area** at [https://mobile.free.fr](https://mobile.free.fr).
2. Open the **"Mes options"** (My options) menu.
3. Find the **"Notifications par SMS"** (SMS notifications) line and **enable it**.
4. On that same page, Free Mobile shows two values you will need:
   - your **Customer ID** (an 8-digit login);
   - an **API key** (generated for you; you can regenerate it if needed).

Keep both values at hand: these are what you will enter in Gladys.

> **Important:** if you disable and re-enable the "SMS notifications" option, a **new API key** is generated. Remember to update it in your Gladys configuration.

## Configure the integration in Gladys

1. In Gladys, open the **Configuration** screen of the Free Mobile SMS integration.
2. In the **"My account"** block, fill in:
   - **Free Mobile identifier** → your 8-digit login;
   - **Free Mobile API key** → the key from the previous step (it is stored encrypted and never shown again).
3. **Save.** That's it.

Each Gladys user enters **their own** credentials in their "My account" block. SMS messages always go to the phone number of the matching Free Mobile account.

## Usage

Once configured, the integration receives the outgoing messages Gladys sends you (for example the **"Send a message"** action of a scene, or an alert) and forwards them by SMS to your phone. No further action is required.

## Limitations

- **Sends only to your own number**: the Free Mobile API does not allow sending to an arbitrary number.
- **No inbound**: you cannot reply to the SMS to talk to Gladys.
- **Text-only SMS**: any attachments (images) are not forwarded.
- Free Mobile may rate-limit sending; if messages are sent too close together, one may be temporarily rejected.

## Troubleshooting

- **No SMS received**: check that the "SMS notifications" option is **enabled** and that the identifier and API key are correct.
- **Access denied error**: the identifier or key is likely wrong, or the option has been disabled. Regenerate the key from your subscriber area and update it in Gladys.
