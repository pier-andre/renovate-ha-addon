# Renovate pour Home Assistant

Add-on Home Assistant qui fait tourner **Renovate** en continu, avec deux choses en plus que
l'application hébergée par Mend ne fait pas : incrémenter le `version:` de vos add-ons et écrire
une ligne dans leur `CHANGELOG.md` à chaque pull request.

[![Ouvrir votre instance Home Assistant et afficher le dialogue d’ajout du dépôt avec l’URL pré-remplie.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fpier-andre%2Frenovate-ha-addon) [![Ouvrir votre instance Home Assistant et afficher la page de l’add-on Renovate.](https://my.home-assistant.io/badges/supervisor_app.svg)](https://my.home-assistant.io/redirect/supervisor_app/?app=e4da9f39_renovate&repository_url=https%3A%2F%2Fgithub.com%2Fpier-andre%2Frenovate-ha-addon)

## Ce que ça donne

Une fois installé et un jeton GitHub fourni, Renovate ouvre des pull requests pour mettre à jour
les dépendances de vos dépôts, la version de Node.js de vos Dockerfile, vos GitHub Actions. Pour
un dépôt d'add-ons, chaque PR fait aussi avancer la version et remplit le journal des
modifications. Vous fusionnez, Home Assistant propose la mise à jour de l'add-on.

## Installation

1. Ajoutez ce dépôt dans Home Assistant : **Paramètres → Modules complémentaires → Boutique**,
   menu ⋮ → **Dépôts**, puis `https://github.com/pier-andre/renovate-ha-addon`. Le dépôt doit rester
   public : la boutique clone sans identifiants.
2. **Renovate** apparaît dans la boutique → **Installer** (quelques minutes : l'image est
   téléchargée).
3. Onglet **Configuration** : collez un jeton GitHub dans `github_token`, avec les droits `repo`
   **et** `workflow`.
4. **Démarrer**. Pour un premier essai sans risque, laissez `dry_run` à `true`.

La suite (options détaillées, préparation de vos dépôts, limites) est dans
[`renovate/README.md`](renovate/README.md) et dans l'onglet Documentation de l'add-on.

## Un panneau dans Home Assistant

L'add-on ajoute une page dans la barre latérale (icône **Renovate**) : les pull requests ouvertes
par Renovate, dépôt par dépôt, et l'heure du dernier passage comme du prochain. Elle est en lecture
seule et réservée aux administrateurs ; le jeton GitHub ne quitte jamais l'add-on.

Ce panneau remplace le « Dependency Dashboard » de GitHub, dont les modèles fournis ne se servent
plus : les mises à jour actionnables arrivent directement en PR, groupées par famille, ce qui évite
un ticket à maintenir dans chaque dépôt.

## Quels dépôts lui confier

Dans l'onglet Configuration, `repositories` accepte une liste `compte/dépôt` :

```yaml
- pier-andre/renovate-ha-addon
- pier-andre/freebuff-ha-addon
- pier-andre/litellm-proxy-ha-addon
- pier-andre/ollaya-ha-addon
```

Chacun de ces dépôts contient un `renovate.json` à sa racine ; l'add-on s'y réfère. Laisser la liste
vide fait travailler Renovate sur **tous** les dépôts auxquels le jeton a accès, ce qui ouvre une PR
« Configure Renovate » dans chacun — à éviter avec un jeton qui voit d'autres projets.

## Préparer vos dépôts

Deux modèles sont fournis, à copier à la racine d'un dépôt sous le nom `renovate.json` :

- [`renovate/repo-renovate.json`](renovate/repo-renovate.json) — pour un dépôt d'add-ons ;
- [`renovate/projet-renovate.json`](renovate/projet-renovate.json) — pour un projet GitHub ordinaire.

## Pourquoi un dépôt séparé

Cet add-on embarque un programme sous AGPL-3.0 (Renovate), donc sa licence est imposée. Un dépôt
par add-on permet aussi de reconstruire et de mettre à jour l'un sans toucher à l'autre, et de
garder des historiques et des journaux lisibles. L'add-on Freebuff vit de son côté.

## Limites

- `amd64` et `aarch64` uniquement (pas de Raspberry Pi 32 bits).
- Jusqu'à ~1 Go de RAM au pic sur un gros dépôt.
- L'add-on tourne en root et se construit à partir de l'image officielle Renovate.
- Emballage communautaire : ni maintenu par Home Assistant, ni par Renovate/Mend.

## Licence

AGPL-3.0, voir [`LICENSE`](LICENSE). L'image de cet add-on contient Renovate, publié sous
AGPL-3.0 par Renovate/Mend : l'emballage se place sous les mêmes termes.
