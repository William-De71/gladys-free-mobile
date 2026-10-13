# Free Mobile SMS

Cette intégration envoie des notifications **par SMS** vers votre propre numéro de téléphone, en s'appuyant sur l'API SMS gratuite de **Free Mobile**. C'est un canal d'**envoi seul** : Gladys peut vous envoyer un SMS (notification d'une scène, alerte…), mais il n'y a aucun canal de réception — vous ne pouvez pas répondre au SMS pour piloter Gladys.

## Prérequis

- Un abonnement **Free Mobile** (l'offre mobile Free, pas la Freebox).
- L'option **« Notifications par SMS »** activée sur votre compte.
- **Gladys Assistant 5.1.0** ou plus récent. Sur Gladys 4.86 à 5.0, une version 1.2.0 déjà installée continue d'envoyer les SMS mais ne reçoit plus de mise à jour (son badge « Mise à jour disponible » ne peut pas s'appliquer) : mettez d'abord Gladys à jour.

## Activer l'option et récupérer vos identifiants

1. Connectez-vous à votre **Espace abonné Free Mobile** sur [https://mobile.free.fr](https://mobile.free.fr).
2. Ouvrez le menu **« Mes options »**.
3. Repérez la ligne **« Notifications par SMS »** et **activez-la**.
4. Sur cette même page, Free Mobile affiche deux informations dont vous aurez besoin :
   - votre **identifiant abonné** (« Customer ID », un login à 8 chiffres) ;
   - une **clé d'API** (générée pour vous ; vous pouvez la régénérer si besoin).

Gardez ces deux valeurs sous la main : ce sont elles que vous saisirez dans Gladys.

> **Important :** si vous désactivez puis réactivez l'option « Notifications par SMS », une **nouvelle clé d'API** est générée. Pensez alors à la mettre à jour dans la configuration de Gladys.

![Où trouver l'identifiant et la clé d'API, et où les saisir dans Gladys](https://raw.githubusercontent.com/William-De71/gladys-free-mobile/main/docs/assets/setup.svg)

## Configurer l'intégration dans Gladys

1. Dans Gladys, ouvrez la page de **Configuration** de l'intégration Free Mobile SMS.
2. Dans le bloc **« Mon compte »**, renseignez :
   - **Identifiant Free Mobile** → votre login à 8 chiffres ;
   - **Clé d'API Free Mobile** → la clé récupérée à l'étape précédente (elle est stockée chiffrée et n'est plus jamais réaffichée).
3. **Enregistrez.** C'est terminé.

Chaque utilisateur de Gladys saisit **ses propres** identifiants dans son bloc « Mon compte ». Les SMS partiront toujours vers le numéro du compte Free Mobile correspondant.

## Utilisation

Une fois configurée, l'intégration reçoit les messages sortants que Gladys vous adresse (par exemple l'action **« Envoyer un message »** d'une scène, ou une alerte) et les transmet par SMS vers votre téléphone. Aucune action supplémentaire n'est nécessaire.

Par défaut, un message de scène part sur tous les services de messagerie que vous avez configurés. Pour l'envoyer **uniquement par SMS**, choisissez **Free Mobile SMS** dans la liste **« Envoyer via »** de l'action.

## Scènes : quand un SMS n'est pas envoyé

Le déclencheur **« SMS non envoyé »** lance une scène quand Free Mobile refuse ou ne reçoit pas un SMS : clé d'API erronée, option désactivée, trop de SMS, Free Mobile hors service… Servez-vous-en pour être prévenu par un autre canal (Telegram, une notification, une lumière qui passe au rouge).

- Il se déclenche au **premier** échec d'une ligne Free Mobile, puis seulement après qu'un SMS de cette ligne est de nouveau passé. Une scène qui vous prévient par ce même canal ne peut donc pas boucler.
- Le filtre **Causes** limite la scène à certaines causes ; laissez-le vide pour réagir à toutes.
- Les actions de la scène disposent de ces variables :

| Variable                        | Contenu                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `{{triggerEvent.data.reason}}`  | code de la cause : `access_denied`, `rate_limited`, `server_error`, `timeout`, `unreachable`, `invalid_message` ou `unexpected` |
| `{{triggerEvent.data.status}}`  | code HTTP renvoyé par Free Mobile (403, 402…), vide sans réponse                                                                |
| `{{triggerEvent.data.error}}`   | message d'erreur en anglais, comme dans les journaux                                                                            |
| `{{triggerEvent.data.account}}` | identifiant masqué de la ligne, par exemple `12****78`                                                                          |

`timeout` signifie que Free Mobile n'a pas répondu à temps : le SMS peut tout de même arriver.

Exemple : déclencheur **« SMS non envoyé »** avec la cause **« Accès refusé »**, puis une action **« Envoyer un message »** envoyée via **Telegram** : `Free Mobile a refusé un SMS ({{triggerEvent.data.error}}) : vérifiez la clé d'API.`

## Limitations

- **Envoi uniquement vers votre propre numéro** : l'API Free Mobile n'autorise pas l'envoi vers un numéro arbitraire.
- **Pas de réception** : vous ne pouvez pas répondre au SMS pour dialoguer avec Gladys.
- **SMS texte seul** : les éventuelles pièces jointes (images) ne sont pas transmises.
- **Messages longs** : Free Mobile accepte jusqu'à 999 caractères par SMS. Un message plus long part en plusieurs SMS, numérotés « (1/2) », « (2/2) »…
- **Limite de débit** : Free Mobile refuse les messages trop rapprochés. L'intégration envoie les messages d'un même utilisateur l'un après l'autre et, quand Free Mobile demande de ralentir, réessaie deux fois (après 2 puis 5 secondes) avant d'abandonner.

## Dépannage

- **Aucun SMS reçu** : vérifiez que l'option « Notifications par SMS » est bien **activée** et que l'identifiant et la clé d'API sont corrects.
- **Message d'erreur d'accès refusé** : l'identifiant ou la clé sont probablement erronés, ou l'option a été désactivée. Régénérez la clé depuis votre Espace abonné et mettez-la à jour dans Gladys.
- **Erreur « trop de SMS envoyés »** : plusieurs messages sont partis en quelques secondes et Free Mobile les a encore refusés après les nouvelles tentatives. Espacez les actions « Envoyer un message » de vos scènes (une courte attente entre deux suffit).
