# Journal des modifications

## Non publié

## 1.2.0

- Nouveau panneau latéral (ingress) : une page **Renovate** dans la barre latérale de Home Assistant liste, dépôt par dépôt, les pull requests ouvertes par Renovate (numéro, titre, âge, étiquettes) avec un lien vers GitHub, ainsi que l'heure du dernier passage et celle du prochain. Elle est en lecture seule : le jeton GitHub n'est jamais envoyé au navigateur et rien ne peut être fusionné ni relancé depuis la page.
- `run.sh` écrit l'état de chaque passage dans `/data/last-run.json` (début, fin, code de sortie, prochaine échéance). Le panneau peut donc répondre à « est-ce que ça a tourné, et est-ce que ça a échoué ? » sans remonter tout le journal, et l'information survit à un redémarrage.
- Le panneau n'écoute qu'en ingress (port 8099, `panel_admin: true`) : aucune ouverture de port sur le réseau local, aucune option supplémentaire à configurer.
- Les modèles `repo-renovate.json` / `projet-renovate.json` et le `renovate.json` de ce dépôt abandonnent le tableau de bord GitHub (« Dependency Dashboard ») au profit d'une configuration sans entretien : correctifs et mineures regroupés, majeur(e)s étiquetées, fusion automatique des seuls correctifs après trois jours.

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
