# Intégrations de communication sortantes-seules — analyse & proposition

> **⚠️ RÉSOLU — document conservé pour mémoire (2026-07-23).** Le mainteneur a corrigé ce trou dans le SDK
> `@gladysassistant/integration-sdk` **0.9.0**. Le design retenu répond au problème décrit ici, **en mieux** :
>
> - Un manifest de communication déclare `"messaging": { "receive": true | false }` — deux familles explicites au
>   lieu du flag `messaging_mode` proposé plus bas.
> - Un canal **send-only** (`receive: false`, cas Free Mobile / CallMeBot) **n'a plus de flux de code du tout** :
>   chaque utilisateur saisit ses propres identifiants dans le bloc « Mon compte » de l'écran de configuration,
>   décrit par un nouveau champ manifest **`contact_schema`** (même format plat que `config_schema`).
> - Gladys résout ces identifiants et les passe à l'intégration comme le `contact` de **chaque** message sortant :
>   `onSendMessage(contact, message)` où `contact` = les valeurs `contact_schema` de l'utilisateur cible. Fini le
>   `contactId` opaque + `linkContact`. `publishMessage` renvoie `403` sur un canal send-only (il ne parle jamais
>   au brain).
>
> C'est **plus propre que la proposition ci-dessous** : identifiants par-utilisateur natifs (pas d'endpoint
> `self-link` à créer, pas de stockage `CONTACT_VARIABLE` détourné), intégration sans état, et aucune cérémonie de
> liaison. Le repo Free Mobile a été adapté à ce modèle (`messaging.receive: false` + `contact_schema`,
> `onSendMessage(contact, …)`). **Aucune action à poster en amont : c'est déjà fait.**
>
> Le reste du document est l'analyse d'origine (SDK 0.6.0), gardée telle quelle comme trace du raisonnement.

---

> **Statut :** brouillon, non soumis. Rédigé pendant le portage de Free Mobile SMS en intégration externe.
> **Auteur :** William Deren.
> **Périmètre :** le type d'intégration `communication` introduit par la RFC #2665 (intégrations externes, phase 1) et
> le SDK compagnon `@gladysassistant/integration-sdk`.
> **Références au code** ci-dessous vérifiées contre `refs/pull/2665/head` (Gladys) et `master` (SDK) au 2026-07-20.

---

## 1. Contexte

Gladys se dote des **intégrations externes** : des programmes tournant dans des conteneurs Docker isolés, supervisés
par Gladys, dialoguant avec lui via une API hôte (REST) + un WebSocket sortant, enveloppés par
`@gladysassistant/integration-sdk`. Deux `type`s de manifest existent aujourd'hui (`manifest.schema.json`, l.16-19) :

- **`device`** — expose des appareils via les écrans Appareils / Découverte / Configuration.
- **`communication`** — canaux de messagerie (bots à la Telegram) : pas d'écran d'appareils, l'utilisateur lie son
  compte depuis l'UI Gladys, et l'intégration échange des messages via l'API hôte.

Je porte le service historique **Free Mobile SMS**, jusqu'ici intégré au cœur de Gladys, vers une intégration
externe. Free Mobile est un canal de communication, donc `type: "communication"` est le choix naturel — mais cela a
révélé un **trou structurel** dans le modèle de communication actuel. Ce document explique ce trou, le prouve contre
le code, et propose un correctif minimal et rétrocompatible.

---

## 2. Comment fonctionne le modèle de communication aujourd'hui

Une intégration de communication ne parle à Gladys que de **contacts liés**. Gladys ne dit jamais « envoie à
William » ; il dit « envoie au contact `X` », où `X` est un identifiant que **l'intégration elle-même** a créé
pendant la liaison. Trois briques (README `integration-sdk` + contrôleur de l'API hôte) :

- **Liaison** (consentement) — l'utilisateur clique « Lier mon compte » dans l'UI Gladys, ce qui génère un **code**
  court (usage unique, TTL 15 min). L'utilisateur **envoie ce code au bot dans le canal externe** ; l'intégration le
  reçoit et appelle `linkContact(code, contactId)` → `POST /api/integration/v1/contact/link`.
- **Entrant** — `publishMessage(contactId, text)` → `POST /api/integration/v1/message`. Un contact inconnu (non
  lié) déclenche un 404.
- **Sortant** — `onSendMessage(contactId, message)` : réponses du brain et notifications transférées, délivrées par
  l'intégration dans le canal externe.

### Le code existe pour prouver un trajet _entrant_

Toute la raison d'être du code est qu'il **transite par le canal externe** : en le renvoyant au bot, la personne
dans Telegram/Signal prouve qu'elle est bien l'utilisateur Gladys qui l'a généré. C'est confirmé par le code
lui-même :

- `externalIntegration.createLinkCode.js` — commentaire : _"The user then sends it to the bot in the external
  channel, and the integration calls POST /contact/link with it."_ Alphabet choisi pour être _"typed in a chat"_.
- `externalIntegration.linkContact.js` — le code **doit** être présent dans le cache (créé par l'UI) et non expiré,
  sinon `NotFoundError('INVALID_LINK_CODE')`. **Il n'existe aucun autre moyen de créer un contact. Aucun chemin
  d'auto-liaison n'existe.**

Le modèle **présuppose donc un canal bidirectionnel**.

---

## 3. Le trou : les canaux sortants-seuls

Toute une classe d'intégrations de communication n'a **aucun canal entrant** — elles ne peuvent que _pousser_ une
notification :

- **Free Mobile SMS** (envoi d'un SMS vers son propre numéro via un webhook),
- Pushover, ntfy, Gotify,
- webhooks **entrants** Discord / Slack,
- e-mail SMTP.

Pour toutes, deux choses sont vraies simultanément :

1. **Le code ne peut pas transiter.** Il n'y a nulle part où l'envoyer — pas de bot, pas d'endpoint entrant. L'étape
   centrale du flux de liaison du cœur est physiquement impossible.
2. **Il n'y a aucune identité à prouver par aller-retour.** L'utilisateur saisit sa propre destination — sa clé
   API, son URL de webhook, son adresse e-mail — dans **sa propre** page de config Gladys, alors qu'il est **déjà
   authentifié dans Gladys**. Le consentement _est_ l'acte de remplir et d'enregistrer ce champ. Un code prouvant
   « c'est bien vous dans le canal externe » répond à une question que personne ne pose.

### Ce que l'utilisateur vit réellement aujourd'hui (Free Mobile)

La page de config `communication` (PR #2665, `config-page/ConfigTab.jsx` l.95) affiche `LinkAccountCard` sans
condition pour toute intégration de communication. L'utilisateur Free Mobile voit donc :

1. **La carte native « Lier mon compte »** avec un bouton _« Générer un code »_ → affiche par ex. `ABCD2345`, et
   (son texte i18n) demande d'_« envoyer ce code au bot dans le canal externe »_ — **factuellement faux** : Free
   Mobile n'a pas de tel canal.
2. Le seul contournement compatible avec le cœur actuel est une **action de manifest** (« Lier mon compte ») avec un
   champ code : l'utilisateur copie `ABCD2345` depuis la carte n°1 et le colle dans l'action quelques centimètres
   plus bas, ce qui appelle `linkContact(code, username)`.

C'est une **cérémonie vide** : l'utilisateur copie un code depuis une carte et le recolle dans une autre, pour
prouver un trajet qui n'existe pas. C'est déroutant et ça a l'air cassé. **C'est le problème à corriger.**

---

## 4. Proposition : un champ de manifest optionnel `messaging_mode`

Ajouter un champ de manifest de premier niveau **optionnel**, n'ayant de sens que lorsque `type: "communication"` :

```jsonc
{
  "type": "communication",
  "messaging_mode": "outbound", // "bidirectional" (défaut) | "outbound"
}
```

- **`"bidirectional"` (défaut)** — le comportement actuel, **inchangé**. Les bots Telegram / Signal / Matrix ne
  déclarent rien et continuent de fonctionner exactement comme avant. Pleinement rétrocompatible.
- **`"outbound"`** — l'intégration ne fait que _délivrer_ des messages, elle n'en reçoit jamais. Le cœur alors :
  1. **masque la `LinkAccountCard` native** — le flux de code n'a pas de sens ici ;
  2. expose un endpoint de l'API hôte pour **lier le propriétaire de la config sans code**
     (`POST /api/integration/v1/contact/self-link { contact_id }`) : il lie l'**utilisateur authentifié de la
     config** à `contact_id`. Consentement = l'utilisateur a rempli et enregistré sa propre destination dans sa
     propre page de config ;
  3. tout le reste en aval est inchangé — `onSendMessage(contactId, message)` se déclenche normalement ;
     `publishMessage` / le routage entrant n'ont simplement jamais lieu.

### Pourquoi c'est le bon découpage

- **Minimal & rétrocompatible.** Un seul champ enum optionnel. Le contrat bidirectionnel (B.15) est intact ; les
  fichiers du flux de code (`createLinkCode.js`, `linkContact.js`) ne sont pas modifiés — le sortant est un **chemin
  parallèle**, pas une réécriture.
- **Résout toute la famille**, pas seulement Free Mobile (Pushover, ntfy, webhooks, SMTP…).
- **UX honnête.** Pas d'instruction trompeuse « envoyez ce code au bot », pas de cérémonie de copier-coller. L'UX de
  Free Mobile se réduit à _remplir identifiant + clé API → enregistrer → fini_, soit le comportement historique
  intégré au cœur.
- **La sécurité n'est pas affaiblie.** `self-link` ne lie jamais que l'utilisateur **déjà authentifié** de la page
  de config à une destination **qu'il a saisie lui-même**. Pas de liaison inter-utilisateurs, pas d'escalade de
  privilèges. C'est exactement le consentement que fournit le flux de code (« cet utilisateur Gladys est
  d'accord »), moins l'aller-retour qui n'a de sens que pour un canal bidirectionnel. (Une intégration sortante ne
  peut pas non plus usurper un autre utilisateur : `self-link` est scopé au propriétaire de la config `req`, et il
  n'y a aucun chemin entrant pour recevoir des réponses avec l'autorité de quelqu'un d'autre.)

---

## 5. Changements concrets (points d'ancrage dans la PR #2665)

| #   | Couche          | Fichier (PR #2665)                                                                     | Changement                                                                                                                                                                                     |
| --- | --------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Schéma manifest | `server/lib/external-integration/manifest.schema.json`                                 | ajouter un enum `messaging_mode` optionnel `["bidirectional","outbound"]`, défaut `"bidirectional"`. Le même fichier sert à l'indexeur du store, donc les manifests outbound valident partout. |
| 2   | Cœur — lib link | `server/lib/external-integration/externalIntegration.selfLinkContact.js` _(nouveau)_   | lier l'utilisateur propriétaire de la config à `contact_id` **sans code** ; réutiliser le stockage `CONTACT_VARIABLE` existant (même forme que `linkContact`, sans le lookup de code).         |
| 3   | Cœur — API hôte | `server/api/controllers/integrationHost.controller.js` + `server/api/routes.js`        | nouvelle route `post /api/integration/v1/contact/self-link` + méthode de contrôleur, à côté du `contact/link` existant (`routes.js` groupe les routes `integration/v1/*` ensemble).            |
| 4   | Cœur — UI       | `front/.../config-page/ConfigTab.jsx` (l.95)                                           | n'afficher `LinkAccountCard` que lorsque `messaging_mode !== 'outbound'` (lu depuis `integration.manifest`).                                                                                   |
| 5   | SDK             | `@gladysassistant/integration-sdk` (`lib/gladys-integration.js`, `index.d.ts`, README) | ajouter `selfLinkContact(contactId)` (POST `/contact/self-link`) à côté de `linkContact` ; documenter `messaging_mode`.                                                                        |

Rien d'autre ne change. `onSendMessage`, `getContacts`, `unlinkContact`, la machine à états du conteneur, le
protocole WebSocket — tous intacts.

### Ébauche du nouveau lib du cœur (calquée sur `linkContact.js`)

```js
// externalIntegration.selfLinkContact.js
const { CONTACT_VARIABLE } = require('./constants');
const { BadParameters } = require('../../utils/coreErrors');

/**
 * @description Link the config-owner user to an external contact WITHOUT a code
 * (outbound-only communication integrations): consent is the user filling their
 * own destination in their own config page. Stored like linkContact.
 * @param {object} service - The external integration service.
 * @param {string} userId - Id of the authenticated config-owner user.
 * @param {object} body - { contact_id, contact_name? }.
 * @returns {Promise<object>} { user: { selector, first_name, language } }.
 */
async function selfLinkContact(
  service,
  userId,
  { contact_id: contactId, contact_name: contactName } = {},
) {
  if (typeof contactId !== 'string' || contactId.length === 0) {
    throw new BadParameters('contact_id: must be a non-empty string');
  }
  // (guarded by the host API: service.manifest.messaging_mode must be 'outbound')
  await this.variable.setValue(
    CONTACT_VARIABLE,
    JSON.stringify({
      contact_id: contactId,
      contact_name: contactName || null,
      linked_at: new Date().toISOString(),
    }),
    service.id,
    userId,
  );
  // return the user, like linkContact
}
```

---

## 6. Impact sur l'intégration Free Mobile

Une fois que `messaging_mode: "outbound"` et `selfLinkContact` existent :

- **supprimer** entièrement l'action de manifest `link_account` (le copier-coller du code) ;
- au `connected` / à l'enregistrement de la config, appeler `await gladys.selfLinkContact(config.username)` — une
  ligne, aucun geste utilisateur (l'identifiant Free Mobile est un `contact_id` stable et unique) ;
- garder `onSendMessage` et l'action `send_test_sms` inchangés.

UX résultante : **remplir identifiant + clé API → enregistrer → fini.**

En attendant, l'intégration livrée conserve le contournement `link_account` documenté afin de fonctionner sur la
première version du cœur qui supporte les intégrations de communication, et bascule vers `selfLinkContact` derrière
un contrôle de capacité/version dès que disponible.

---

## 7. Questions ouvertes pour le mainteneur

1. **Forme de l'endpoint** — `POST /contact/self-link { contact_id }` gardé par `messaging_mode === 'outbound'`, vs.
   auto-liaison au premier enregistrement de config (pas d'appel SDK explicite). L'appel explicite est plus
   prévisible et laisse l'intégration choisir le `contact_id` ; l'implicite demande encore moins de code à
   l'intégration. Préférence ?
2. **Un contact par utilisateur** — les canaux sortants ont par nature 1 destination par utilisateur. `self-link`
   doit-il imposer un seul contact par (service, utilisateur), remplaçant tout précédent ? (Free Mobile : oui.)
3. **Nommage** — `messaging_mode: "outbound"` vs. un booléen `inbound: false` vs. une liste de capacités.
   `messaging_mode` se lit le mieux si un futur troisième mode (entrant-seul ?) apparaît un jour.
