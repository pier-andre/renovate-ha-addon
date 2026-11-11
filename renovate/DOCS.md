# Renovate

Maintient vos dépôts GitHub à jour : dépendances, images Docker, GitHub Actions,
version de vos add-ons Home Assistant, et une ligne dans le `CHANGELOG.md` à chaque PR.

Cet add-on n'a pas d'interface : tout se passe dans l'onglet **Journal**, et le résultat
arrive directement en pull requests sur GitHub.

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
  mises à jour majeures à valider une par une.

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

## 5. Démarrer

Cliquez **Démarrer**. Un premier passage a lieu immédiatement, puis un toutes les
`interval_hours` heures (168 = une semaine). Suivez la progression dans le **Journal** :
Renovate est bavard, c'est normal.

## Options

| Option | Défaut | Rôle |
| --- | --- | --- |
| `github_token` | — | Jeton GitHub (obligatoire). |
| `repositories` | vide | Liste `compte/dépôt`. Vide = tous les dépôts accessibles. |
| `run_on_start` | `true` | Lancer un passage dès le démarrage de l'add-on. |
| `interval_hours` | `168` | Intervalle entre deux passages, en heures. |
| `dry_run` | `false` | Simulation : Renovate analyse et écrit dans le journal, sans créer de PR. |
| `log_level` | `info` | `debug` si quelque chose ne se passe pas comme prévu. |

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
