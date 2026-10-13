<!--
The TITLE of this pull request becomes the squash commit, then the line users
read in CHANGELOG.md and in the GitHub Release. Write it in English, as a
Conventional Commit describing the change for the user:

  feat(scenes): start a scene when an SMS cannot be sent
  fix: keep the numbering of a split message in order
  perf: wait less between the parts of a long message
  docs: explain how to enable SMS notifications in the Free Mobile area

feat -> minor version, fix / perf -> patch, `!` or a "BREAKING CHANGE:" footer
-> breaking (a minor while the version is below 1.0.0). docs, chore, ci, test,
style, refactor and build alone publish no release. Never edit CHANGELOG.md.
-->

## What changes for the user

## How it was tested

- [ ] `npm run format:check`, `npm run lint` and `npm test` pass
- [ ] Tried with a real Free Mobile line (SMS received, error cases):
- [ ] The four docs (`docs/en.md`, `fr`, `de`, `es`) and READMEs are up to date
