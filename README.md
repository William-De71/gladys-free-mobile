# Free Mobile SMS — Gladys external integration

Send SMS notifications from [Gladys Assistant](https://gladysassistant.com) to your own phone number through the
**Free Mobile SMS API**, as an [external integration](https://gladysassistant.com/docs) running in an isolated
Docker container.

This is the external-integration port of the historical in-core `free-mobile` service. It runs outside the Gladys
core, is installed from the store in one click, and updates independently of Gladys releases.

## What it does

Free Mobile offers a simple, outbound-only webhook: it sends an SMS **to the phone number of the account the
credentials belong to** — you cannot send to an arbitrary number, and there is no inbound channel.

This integration is therefore a **send-only communication integration** (`type: "communication"` with
`messaging: { receive: false }`) with a single job:

- **Outgoing** — when Gladys asks to deliver a message to a user (a scene "send a message" action, an alert…), the
  integration forwards its text to that user's phone via the Free Mobile API (`onSendMessage`).

There is **no inbound** (Free Mobile cannot receive replies), so there is no linking code, no `publishMessage` and
no chat-back flow: a send-only channel never talks to the brain.

Credentials are **per user**, not global: each user enters their own Free Mobile identifier and API key, and Gladys
hands them to the integration with every outgoing message. The integration itself stores nothing.

## Requirements

- A **Free Mobile** subscription with the **SMS notifications** option enabled
  (`https://mobile.free.fr` → account → "Mes options" → "Notifications par SMS").
- A Gladys version that supports external **communication** integrations (see `gladys_version` in the manifest).

## Configuration

Each user fills in **their own** credentials, in the **"My account"** block of the integration's Configuration
screen (the manifest `contact_schema`):

| Field                  | Where to find it                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Free Mobile identifier | The 8-digit login on the "Notifications par SMS" page of your Free Mobile account. |
| Free Mobile API key    | The API key generated on that same page (stored encrypted, never shown again).     |

That is the whole setup: **fill the two fields, save, done.** There is no linking code to generate or paste —
Free Mobile has no channel to send one through, and a send-only channel carries no user authority to protect.

From then on, Gladys routes that user's outgoing notifications to the integration, and they are delivered by SMS.
Users who have not filled in their credentials are simply skipped by Gladys.

## Development

```bash
npm install
npm test            # node:test unit tests (no network)
npm run lint        # ESLint 10, flat config
npm run format:check
```

The integration logic is split for testability:

- `src/free-mobile.js` — the Free Mobile HTTP call only (no SDK, no Gladys concept).
- `src/config.js` — per-user credentials normalization/validation.
- `index.js` — wires the SDK handlers (`onSendMessage`, connection lifecycle).

## Publishing

1. Push this repository to GitHub.
2. Build and push the multi-arch image (handled by `.github/workflows/build.yml`).
3. Add the `gladys-assistant-integration` topic to the repository.
4. Run the **Release** workflow to bump the version, update `docker_image`, and tag `vX.Y.Z`.
5. The Gladys store indexer discovers the repo hourly and publishes it to the catalog.

Validate the manifest locally before publishing:

```bash
npx github:GladysAssistant/integration-store .
```

## License

[Apache-2.0](LICENSE)
