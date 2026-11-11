# Journal des modifications

## Non publié

## 1.1.0

- Planification réglable depuis l'onglet Configuration : `schedule_days` (tous les jours, un jour précis, la semaine ou le week-end), `schedule_time` (`HH:MM`) et `timezone`. L'add-on se réveille à l'échéance choisie au lieu de compter des heures depuis son démarrage : une heure fixe est enfin respectée.
- L'option `interval_hours` disparaît, remplacée par cette planification. Si la valeur reste enregistrée, le Supervisor se contente d'un avertissement au démarrage (voir `DOCS.md`).
- La ligne `"schedule"` est retirée des modèles `repo-renovate.json` / `projet-renovate.json` et du `renovate.json` de ce dépôt : la planification ne vit plus qu'à un seul endroit, et le réglage de l'add-on n'est plus écrasé par les dépôts.
- `tzdata` ajouté à l'image : sans lui, l'option `timezone` aurait été ignorée en silence et les passages décalés.

## 1.0.1

- URL du dépôt corrigée dans `config.yaml` : elle contenait encore le nom de compte d'exemple du modèle.
- Ajout de `renovate.json` à la racine du dépôt : l'add-on se met à jour lui-même, l'image Renovate épinglée, le `version:` et ce journal arrivant dans la même PR.
- Installation documentée avec l'URL réelle du dépôt et la règle « nom du dossier = slug de l'add-on ».

## 1.0.0

- Version initiale : Renovate en boucle dans Home Assistant, incrément de version des add-ons et écriture du `CHANGELOG.md` à chaque PR.
