# Renovate pour Home Assistant

Un add-on qui fait tourner **Renovate** — l'outil qui maintient les dépendances à jour —
directement dans Home Assistant, avec en plus l'incrément de version de vos add-ons et une
ligne dans le `CHANGELOG.md` à chaque pull request.

## Pourquoi cet add-on existe

Renovate a besoin d'exécuter **vos** commandes pour écrire dans un fichier qui n'est pas un
fichier de dépendances (votre `CHANGELOG.md`). L'application hébergée par Mend refuse par
principe d'exécuter des commandes arbitraires : les commandes libres sont réservées aux offres
payantes. Il faut donc un Renovate auto-hébergé, et Home Assistant est l'endroit le plus pratique
pour l'héberger : la machine est déjà allumée en permanence, elle a déjà la surveillance, les
journaux et les sauvegardes.

## Comment ça marche

L'image Docker officielle `ghcr.io/renovatebot/renovate` est réutilisée telle quelle. Deux ajouts :

- `run.sh` : Renovate est un outil qui tourne puis s'arrête, alors qu'un add-on doit rester
  vivant. Ce script lance un passage au démarrage, puis recommence toutes les `interval_hours`
  heures, et répond proprement à un arrêt demandé par Home Assistant ;
- `scripts/changelog.mjs` : le script embarqué dans l'add-on, qui ajoute la ligne au
  `CHANGELOG.md`. Comme il est **dans l'image**, vos dépôts n'ont pas besoin de le contenir.

Les options de l'onglet Configuration sont lues dans `/data/options.json` et transformées en
variables d'environnement Renovate. Les deux variables qui autorisent la commande de mise à jour
du CHANGELOG (`RENOVATE_ALLOWED_COMMANDS` et `RENOVATE_ALLOW_COMMAND_TEMPLATING`) sont posées par
l'add-on : sans elles, Renovate ignorerait `postUpgradeTasks` **en silence**.

## Installation

1. Ce dépôt est un dépôt d'applications Home Assistant : `repository.yaml` et `renovate.json` à la
   racine, l'add-on dans `renovate/` — le nom du dossier est son slug — avec son `CHANGELOG.md` et
   son `DOCS.md` à côté de `config.yaml`. Il est publié sur
   <https://github.com/pier-andre/renovate-ha-addon>.
2. Dans Home Assistant : **Paramètres → Modules complémentaires → Boutique** → menu ⋮ →
   **Dépôts** → `https://github.com/pier-andre/renovate-ha-addon`, puis **Ajouter**. Le dépôt doit
   rester public : la boutique clone sans identifiants.
3. **Renovate** apparaît dans la boutique → **Installer**. La construction prend quelques minutes
   (l'image Renovate est téléchargée).
4. Onglet **Configuration** : collez un jeton GitHub dans `github_token`
   (droits `repo` **et** `workflow`), ajustez `repositories` si vous ne voulez pas que Renovate
   regarde tous vos dépôts, puis **Démarrer**.

Pour un premier essai sans risque : `dry_run` à `true`. Renovate analyse tout, écrit dans le
journal, mais ne crée aucune PR.

## Configurer vos dépôts

Un fichier `renovate.json` à la racine de chaque dépôt, deux modèles selon le type de dépôt :

| Type de dépôt | Modèle à copier | Ce qu'il fait |
| --- | --- | --- |
| Dépôt d'add-ons (avec `repository.yaml`) | `repo-renovate.json` | version + changelog de **tous** les dossiers d'add-on |
| Projet GitHub ordinaire | `projet-renovate.json` | PR groupées, changelog à la racine, majeures à valider |

### Dépôt d'add-ons

`repo-renovate.json` contient :

- `bumpVersions` avec `filePatterns: ["*/config.yaml"]` : incrémente le patch de **chaque**
  dossier d'add-on du dépôt, quel que soit son nom. Ajouter un troisième add-on ne demande
  aucune modification ;
- `postUpgradeTasks` avec la cible `addons` : le script embarqué repère lui-même les dossiers
  d'add-on et écrit dans le `CHANGELOG.md` de chacun ;
- `prBodyNotes` : un rappel de ce que la PR a changé, et un avertissement pour les majeures ;
- deux `packageRules` de regroupement, et une règle qui suit la version de Node.js des Dockerfile.

### Projet ordinaire

`projet-renovate.json` ajoute le tableau de bord des dépendances (`:dependencyDashboard`), écrit
le changelog à la racine (`CHANGELOG.md`) et exige une validation manuelle depuis le tableau de
bord pour chaque mise à jour majeure.

Si le projet a un fichier de version à lui (`.release-version`, `VERSION`, une version dans un
`package.json`…), collez-y le bloc `bumpVersions` du modèle add-on en adaptant `filePatterns`.

### Pourquoi un `CHANGELOG.md` par dossier d'add-on

Home Assistant affiche l'onglet « Journal des modifications » d'un add-on en lisant le
`CHANGELOG.md` **du dossier de cet add-on**. C'est aussi le `version:` de ce dossier qui décide
si une mise à jour est proposée. D'où la règle : un dossier d'add-on = un `config.yaml` +
un `CHANGELOG.md`. Un changelog unique à la racine du dépôt ne serait jamais montré.

Rappel utile : la liste d'autorisation des commandes (`allowedCommands`) **ne peut pas** être
mise dans `renovate.json` — elle vit dans l'add-on, c'est voulu par Renovate (sécurité).

## Comment l'add-on se met-il à jour lui-même

Le `Dockerfile` ne dit pas `latest` mais une version précise : `ghcr.io/renovatebot/renovate:44.232.0`.
Trois raisons à cela. Une reconstruction donne toujours la même image, ce qui évite qu'un add-on
change de comportement sans que rien ne le signale. Une montée de version devient un événement
visible, avec sa PR et sa ligne de journal. Et surtout, c'est Renovate qui s'en occupe : le
fichier `repo-renovate.json` contient une règle qui lit cette ligne du `Dockerfile` et propose la
version suivante.

La boucle complète, une fois ce dépôt suivi par Renovate : une nouvelle version de Renovate
paraît → une PR arrive ici, qui modifie le `Dockerfile`, incrémente le `version:` de
`renovate/config.yaml` et ajoute la ligne dans `renovate/CHANGELOG.md` → vous fusionnez →
Home Assistant propose la mise à jour de l'add-on, avec le journal à jour.

Pour monter de version à la main, il suffit de changer le numéro dans cette ligne du
`Dockerfile`. Pour revenir à un comportement « toujours la dernière », remplacez le numéro par
`latest` — mais vous perdez alors la traçabilité et la reproductibilité.

## Limites connues et points non vérifiés

- Architectures : `amd64` et `aarch64` seulement. L'image Renovate n'existe pas en 32 bits :
  un Raspberry Pi sous HA 32 bits ne pourra pas l'installer.
- L'add-on tourne en **root**, ce qui est le cas courant pour les add-ons et permet à Renovate
  d'installer ses outils à la demande. Il remplace le script d'entrée de l'image officielle :
  si un passage échoue bêtement au démarrage, la parade est de lancer
  `docker-entrypoint.sh renovate` à la place de `renovate` dans `run.sh`.
- L'image de base est épinglée (`ARG BUILD_FROM=...:44.232.0`) : c'est Renovate lui-même qui
  propose la mise à jour de cette ligne. Une reconstruction manuelle ne changera donc rien
  tant que vous n'avez pas fusionné sa PR.
- La date inscrite dans le `CHANGELOG.md` est en UTC.
- `bumpVersions` est encore marqué « expérimental » chez Renovate : son comportement peut changer.
- Cet add-on n'est maintenu ni par Home Assistant, ni par Renovate/Mend : c'est un emballage
  communautaire.

## Ce qui a été vérifié

- syntaxe de `run.sh` (bash) et du script `changelog.mjs` (Node) ;
- `config.yaml` relu comme du YAML, avec `slug == nom du dossier` et `init: false` ;
- `repo-renovate.json` validé par le validateur officiel de Renovate ;
- extraction réelle par Renovate (`--dry-run=extract`) : la dépendance
  `ghcr.io/renovatebot/renovate` est bien trouvée dans le `Dockerfile`, à la version épinglée ;
- `run.sh` exécuté pour de vrai avec un faux `renovate` et un faux `/data` : lecture des options,
  jeton manquant, mode simulation, liste de dépôts, intervalle invalide, arrêt propre sur signal ;
- `changelog.mjs` testé sur cinq cas (fichier absent, fichier existant, plusieurs PR successives,
  relance identique, arguments manquants).

## Licence

AGPL-3.0 (voir `LICENSE` à la racine du dépôt). L'image de cet add-on contient Renovate, publié
sous AGPL-3.0 par Renovate/Mend ; l'add-on se place donc sous la même licence, comme la plupart
des emballages d'outils sous AGPL. Rien à faire de particulier pour un usage personnel.
