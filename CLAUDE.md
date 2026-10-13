# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** that sends Gladys notifications by
SMS through the Free Mobile SMS API: a Node.js service (Node 22+, ESM, no
build step) running in its own sandboxed Docker container, talking to Gladys
through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. A send-only communication integration
(`type: "communication"`, `messaging: { receive: false }`): per-user
credentials in the `contact_schema`, no device, no inbound path. Cloud only.

## Commands

```bash
npm install
npm test                                  # node --test, never touches the network
node --test test/app.test.js              # one file
node --test --test-name-pattern "scene"   # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check
```

## Architecture

```
index.js                      SDK wiring only: createApp(new GladysIntegration()) + connect
src/app.js                    every handler, registered before connect(); the tests drive
                              it with the fake Gladys of the SDK (test/app.test.js)
src/free-mobile.js            the Free Mobile call: POST JSON, split, retry, FreeMobileError
src/events.js                 scene trigger sms_not_sent, once per failing line
src/config.js                 per-user credentials: normalization, validation, masking
.github/scripts/release.mjs   version, changelog, version files, PR title checks
```

## Rules

- **Keys are forever**: `contact_schema` keys (`username`, `access_token`)
  and types, the scene trigger key `sms_not_sent`, its field `reason`, its
  variables (`reason`, `status`, `error`, `account`) and the reason values
  (`FAILURE_REASONS` in `src/free-mobile.js`). `test/structure.test.js` checks
  them against `test/fixtures/manifest.baseline.json` (v1.2.0). A change needs
  an entry in its `ALLOWED_CHANGES` with the migration, in the changelog, the
  docs and the forum message.
- **The Free Mobile call**: `POST https://smsapi.free-mobile.fr/sendmsg` with
  the JSON body `{ user, pass, msg }`. The API key never goes in a URL, an
  error message, a log line or a scene event; the identifier is masked
  (`maskIdentifier`).
- **Retries**: only 402 and 500 (the SMS was not sent). Never a timeout: the
  SMS may have left, and a duplicate alert is worse than a reported failure.
- **Scene events** on transitions only: the first failure of a line, then
  nothing until an SMS of that line goes through. This is what keeps a scene
  that answers through this same channel from looping. Flat scalar data,
  declared keys only.
- **Language**: Gladys does not send it with a message. Error messages and
  the `error` variable are in English (they also go to the logs); every text
  Gladys shows comes from the manifest, in four languages.
- **The container rootfs is read-only** and the integration stores nothing:
  credentials come with every message.
- **User-facing text** exists in en, fr, de and es: manifest, `docs/*.md`,
  `README*.md`. `test/i18n.test.js` checks it. Images in `docs/*.md` use
  `raw.githubusercontent.com` URLs (the store re-hosts the docs), relative
  paths in the READMEs.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, `package-lock.json` or the manifest, nor the `docker_image`
  tag.
- **Changelog**: Ne jamais éditer CHANGELOG.md à la main, il est généré à la
  release. Écris le titre de PR comme la ligne que l'utilisateur lira.
- **Style**: Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.
