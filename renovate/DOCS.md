# Renovate

Maintient vos dépôts GitHub à jour : dépendances, images Docker, GitHub Actions,
version de vos add-ons Home Assistant, et une ligne dans le `CHANGELOG.md` à chaque PR.

Renovate lui-même n'a pas d'interface : le résultat arrive en pull requests sur GitHub. Un
**panneau latéral** ajouté par cet add-on (icône **Renovate** dans la barre latérale de Home
Assistant) les liste sans quitter Home Assistant ; l'onglet **Journal** reste la source de vérité
quand quelque chose se passe mal.

## 1. Renseigner le jeton

Onglet **Configuration** → champ `github_token`.

Créez le jeton sur GitHub : **Settings → Developer settings → Personal access tokens**.
Un jeton « classic » avec les droits `repo` **et** `workflow` (le second est indispensable
pour que Renovate puisse modifier les fichiers de `.github/workflows`).

## 2. Choisir les dépôts

- `repositories` vide → Renovate travaille sur **tous** les dépôts auxquels le jeton a accès.
  Chaque dépôt reçoit d'abord une PR « Configure Renovate » : fermez-la pour l'ignorer.
- Sinon, ajoutez les dépôts un par un, au format `compte/dépôt`.

## 3. Préparer chaque dépôt

Un seul fichier par dépôt, à sa racine. Deux modèles sont fournis :

- `repo-renovate.json` → pour le dépôt qui contient vos add-ons (celui qui a `repository.yaml`).
  Il gère **tous** les dossiers d'add-on d'un coup, version et changelog compris.
- `projet-renovate.json` → pour un projet GitHub ordinaire : PR groupées, changelog à la racine,
  majeures étiquetées et relues une par une (sans tableau de bord GitHub).

Renommez le modèle choisi en `renovate.json`. Vous pouvez aussi laisser Renovate ouvrir sa PR
« Configure Renovate » et y coller le contenu du modèle à la place.

## 4. Ce qui se passe quand une mise à jour est trouvée

Pour un dépôt d'add-ons, la PR de Renovate fait trois choses : elle met la dépendance à jour,
elle incrémente le `version:` de chaque dossier d'add-on, et elle ajoute une ligne datée dans le
`CHANGELOG.md` de chaque dossier d'add-on.

C'est ce trio qui fait le lien avec Home Assistant : la boutique lit le `version:` du
`config.yaml` de chaque dossier pour savoir qu'une mise à jour existe, puis lit le `CHANGELOG.md`
**du même dossier** pour l'afficher dans l'onglet Journal des modifications. Un `CHANGELOG.md`
placé à la racine du dépôt ne serait jamais affiché.

Après fusion, si la mise à jour n'apparaît pas tout de suite : **Paramètres → Modules
complémentaires**, menu ⋮ → **Vérifier les mises à jour**.

## 5. Choisir quand Renovate agit

La planification se règle **dans l'add-on**, dans l'onglet Configuration :

- `schedule_days` : `all` (tous les jours), `weekdays` (lundi → vendredi), `weekends`, ou un seul
  jour (`mon` … `sun`) ;
- `schedule_time` : l'heure du passage, au format `HH:MM` ;
- `timezone` : le fuseau dans lequel cette heure est lue (`Europe/Paris` par défaut).

L'add-on calcule l'échéance suivante, dort jusque-là, lance un passage, puis recommence. Un
passage hebdomadaire le lundi à 4 h s'obtient donc avec `schedule_days: mon` et
`schedule_time: "04:00"`. C'est la différence avec l'ancien réglage en heures : une heure fixe est
vraiment respectée, au lieu d'être le résultat d'un compte à rebours lancé au démarrage.

Un point à connaître : si le `renovate.json` d'un dépôt contient encore un `"schedule"`, c'est
**lui** qui gagne et l'option de l'add-on est ignorée pour ce dépôt. Les modèles fournis n'en
contiennent plus ; supprimez cette ligne des dépôts préparés avec la version précédente.

## 6. Démarrer

Cliquez **Démarrer**. Un premier passage a lieu immédiatement si `run_on_start` vaut `true`, puis
un à chaque échéance planifiée. Suivez la progression dans le **Journal** : Renovate est bavard,
c'est normal.

## 7. Le panneau latéral

Une fois l'add-on démarré, l'icône **Renovate** apparaît dans la barre latérale de Home Assistant
(réservée aux administrateurs). La page répond à deux questions :

- **Où en sont mes dépôts ?** pour chaque dépôt de `repositories`, les pull requests ouvertes par
  Renovate (numéro, titre, âge, brouillon, étiquettes), avec un lien vers GitHub ;
- **Est-ce que ça a tourné ?** l'heure du dernier passage, son code de sortie, et l'heure du
  prochain. Ces informations viennent de `/data/last-run.json`, écrit à chaque passage : elles
  survivent à un redémarrage, contrairement au journal.

La page est en **lecture seule**. Le jeton GitHub reste dans l'add-on : il n'est jamais envoyé au
navigateur, et rien ne peut être fusionné, fermé ou relancé depuis cette page. Les appels à GitHub
sont mis en cache une minute ; le bouton **Rafraîchir** force la mise à jour.

Rien à ouvrir sur le réseau : le panneau passe par l'ingress de Home Assistant, donc aucun port
n'est exposé et il fonctionne aussi à distance via l'accès à distance de Home Assistant. Si la page
affiche « HTTP 401 », le jeton est expiré ; « HTTP 404 », le dépôt est absent du périmètre du jeton
(ou mal orthographié dans `repositories`).

## 8. Pourquoi il n'y a plus de tableau de bord GitHub

Les modèles fournis n'activent plus le « Dependency Dashboard » de Renovate, ce ticket créé dans
chaque dépôt pour lister les mises à jour en attente. Ce ticket n'existe que pour les mises à jour
que Renovate n'ose pas proposer seul : celles qu'on lui demande de faire valider. Sans cette
demande de validation, tout ce qui est actionnable devient une pull request, et le panneau les
liste — un ticket de moins par dépôt, sans rien perdre.

Trois réglages font le travail à votre place :

- **regroupement** : correctifs d'un côté, mineures de l'autre, une seule PR par famille ;
- **fusion automatique des correctifs** uniquement, et seulement une fois la version publiée
  depuis `minimumReleaseAge` (trois jours) : le temps qu'une version cassée se fasse remarquer ;
- **majeures étiquetées `major`**, jamais fusionnées automatiquement : les seules à relire.

Les mises à jour de sécurité échappent au délai de trois jours et sont fusionnées automatiquement
(`osvVulnerabilityAlerts`), et `prConcurrentLimit` plafonne le nombre de PR ouvertes en même temps.

Si vous préférez l'ancien fonctionnement : remettez `"dependencyDashboard": true` dans le
`renovate.json` du dépôt et retirez `"automerge": true` de la règle des correctifs.

## Options

| Option | Défaut | Rôle |
| --- | --- | --- |
| `github_token` | — | Jeton GitHub (obligatoire). |
| `repositories` | vide | Liste `compte/dépôt`. Vide = tous les dépôts accessibles. |
| `run_on_start` | `true` | Lancer un passage dès le démarrage de l'add-on. |
| `schedule_days` | `all` | `all`, `weekdays`, `weekends`, ou un jour : `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`. |
| `schedule_time` | `04:00` | Heure du passage, `HH:MM`, lue dans `timezone`. |
| `timezone` | `Europe/Paris` | Fuseau utilisé pour `schedule_time`. |
| `dry_run` | `false` | Simulation : Renovate analyse et écrit dans le journal, sans créer de PR. |
| `log_level` | `info` | `debug` si quelque chose ne se passe pas comme prévu. |

L'option `interval_hours` des versions 1.0.x n'existe plus : la planification la remplace. Si le
journal du Supervisor affiche `Option 'interval_hours' does not exist in the schema`, c'est un
simple avertissement, sans effet sur le démarrage. Pour le faire disparaître : onglet
**Configuration**, menu ⋮ → **Modifier en YAML**, supprimez la ligne, enregistrez.

## Vérifier que ça marche

1. `dry_run` à `true`, redémarrer, lire le journal : vous devez voir les dépendances détectées.
2. Repasser `dry_run` à `false`, redémarrer : les PR arrivent sur GitHub.
3. Après fusion d'une PR, vérifiez que `version:` a bougé et que `CHANGELOG.md` a une ligne.

## Limites

- Architecture : `amd64` et `aarch64` uniquement (pas de Raspberry Pi 32 bits).
- Comptez jusqu'à 1 Go de RAM au pic sur un gros dépôt.
- Dans un dépôt qui contient plusieurs add-ons, la même PR incrémente **toutes** les versions :
  fusionner une mise à jour reconstruit donc chaque add-on du dépôt. Sans danger, juste un peu de
  temps de construction en plus.
- Le `CHANGELOG.md` n'est écrit que si le dépôt contient les réglages `postUpgradeTasks` /
  `bumpVersions` du modèle fourni.
- Home Assistant redémarre l'add-on à chaque démarrage : un passage supplémentaire a lieu
  si `run_on_start` est à `true` (sans conséquence, Renovate rafraîchit simplement ses PR).
