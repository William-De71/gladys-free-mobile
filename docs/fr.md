# Free Mobile SMS

Cette intégration envoie des notifications **par SMS** vers votre propre numéro de téléphone, en s'appuyant sur l'API SMS gratuite de **Free Mobile**. C'est un canal d'**envoi seul** : Gladys peut vous envoyer un SMS (notification d'une scène, alerte…), mais il n'y a aucun canal de réception — vous ne pouvez pas répondre au SMS pour piloter Gladys.

## Prérequis

- Un abonnement **Free Mobile** (l'offre mobile Free, pas la Freebox).
- L'option **« Notifications par SMS »** activée sur votre compte.

## Activer l'option et récupérer vos identifiants

1. Connectez-vous à votre **Espace abonné Free Mobile** sur [https://mobile.free.fr](https://mobile.free.fr).
2. Ouvrez le menu **« Mes options »**.
3. Repérez la ligne **« Notifications par SMS »** et **activez-la**.
4. Sur cette même page, Free Mobile affiche deux informations dont vous aurez besoin :
   - votre **identifiant abonné** (« Customer ID », un login à 8 chiffres) ;
   - une **clé d'API** (générée pour vous ; vous pouvez la régénérer si besoin).

Gardez ces deux valeurs sous la main : ce sont elles que vous saisirez dans Gladys.

> **Important :** si vous désactivez puis réactivez l'option « Notifications par SMS », une **nouvelle clé d'API** est générée. Pensez alors à la mettre à jour dans la configuration de Gladys.

## Configurer l'intégration dans Gladys

1. Dans Gladys, ouvrez la page de **Configuration** de l'intégration Free Mobile SMS.
2. Dans le bloc **« Mon compte »**, renseignez :
   - **Identifiant Free Mobile** → votre login à 8 chiffres ;
   - **Clé d'API Free Mobile** → la clé récupérée à l'étape précédente (elle est stockée chiffrée et n'est plus jamais réaffichée).
3. **Enregistrez.** C'est terminé.

Chaque utilisateur de Gladys saisit **ses propres** identifiants dans son bloc « Mon compte ». Les SMS partiront toujours vers le numéro du compte Free Mobile correspondant.

## Utilisation

Une fois configurée, l'intégration reçoit les messages sortants que Gladys vous adresse (par exemple l'action **« Envoyer un message »** d'une scène, ou une alerte) et les transmet par SMS vers votre téléphone. Aucune action supplémentaire n'est nécessaire.

## Limitations

- **Envoi uniquement vers votre propre numéro** : l'API Free Mobile n'autorise pas l'envoi vers un numéro arbitraire.
- **Pas de réception** : vous ne pouvez pas répondre au SMS pour dialoguer avec Gladys.
- **SMS texte seul** : les éventuelles pièces jointes (images) ne sont pas transmises.
- Free Mobile peut limiter le débit d'envoi ; en cas d'envois trop rapprochés, un message peut être temporairement refusé.

## Dépannage

- **Aucun SMS reçu** : vérifiez que l'option « Notifications par SMS » est bien **activée** et que l'identifiant et la clé d'API sont corrects.
- **Message d'erreur d'accès refusé** : l'identifiant ou la clé sont probablement erronés, ou l'option a été désactivée. Régénérez la clé depuis votre Espace abonné et mettez-la à jour dans Gladys.
