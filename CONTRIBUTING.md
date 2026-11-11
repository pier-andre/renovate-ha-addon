# Contribuer

Merci de votre intérêt. Ce dépôt est petit et volontairement simple : un manifeste Home
Assistant, un `Dockerfile`, un lanceur, un script d'écriture de journal. Les contributions les
plus utiles sont les corrections de documentation et les améliorations de ces quatre fichiers.

## Avant d'ouvrir une issue

- Un problème de fonctionnement (l'add-on ne démarre pas, Renovate échoue) : utilisez le modèle
  **Signaler un problème** et joignez l'extrait du journal de l'add-on.
- Une faille de sécurité : **n'ouvrez pas d'issue**, suivez [SECURITY.md](.github/SECURITY.md).
- Un défaut dans Renovate lui-même (une mise à jour mal détectée, un parseur qui échoue) se
  signale plutôt en amont : https://github.com/renovatebot/renovate/issues

## Proposer un changement

1. Ouvrez d'abord une issue pour décrire ce que vous voulez changer, sauf pour une faute de
   frappe ou une correction évidente de documentation.
2. Une idée par proposition. Les petits changements se relisent et se fusionnent beaucoup plus
   vite.
3. Décrivez ce que vous avez testé, et comment.

## Ce qu'il ne faut pas mettre dans une contribution

- Un jeton GitHub, même expiré, même partiel, y compris dans un extrait de journal ou une
  capture d'écran.
- Un identifiant de dépôt privé.
- Un changement de licence. Le code de ce dépôt est sous AGPL-3.0, parce que l'image contient
  Renovate, publié sous AGPL-3.0 : ce n'est pas négociable sans réécrire l'emballage.
- Le script de journal copié dans chaque dépôt suivi : il est embarqué dans l'image, c'est
  justement l'intérêt.

## Tester localement

La construction complète passe par Home Assistant, mais l'essentiel se vérifie avec Docker :

```bash
cd renovate
docker build -t renovate-addon-test .
```

Pour vérifier la syntaxe sans construire l'image :

```bash
bash -n renovate/run.sh
node --check renovate/scripts/changelog.mjs
python3 -c "import yaml; yaml.safe_load(open('renovate/config.yaml'))"
npx --yes --package renovate renovate-config-validator renovate/repo-renovate.json
```

Le script de journal s'essaie sans réseau, dans un dossier jetable :

```bash
mkdir -p /tmp/essai/addon-a && printf 'version: "1.0.0"\n' > /tmp/essai/addon-a/config.yaml
cd /tmp/essai && node /chemin/vers/scripts/changelog.mjs nodejs/node 20.0.0 20.1.0 patch addons
cat addon-a/CHANGELOG.md
```

## Style

- Commentaires et documentation en français, comme le reste du dépôt.
- Scripts en `bash` sans dépendance externe, et sans outil qui n'existe pas dans l'image.
- Les options d'add-on vivent dans `renovate/config.yaml` (schema compris) et sont lues par
  `run.sh` : une nouvelle option demande les deux, plus une ligne dans le tableau
  `renovate/DOCS.md`.
- Les titres de PR et de commit décrivent le pourquoi autant que le quoi.

## Journal des modifications

Pour une contribution manuelle, ajoutez une ligne dans la section « Non publié » de
`renovate/CHANGELOG.md`, au format des lignes existantes. Les PR ouvertes par Renovate le font
déjà toutes seules. L'incrément du `version:` dans `renovate/config.yaml` est en revanche réservé
aux PR de mise à jour : ne le touchez pas dans une contribution classique.
