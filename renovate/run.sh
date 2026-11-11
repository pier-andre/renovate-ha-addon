#!/usr/bin/env bash
# Boucle de l'add-on : un passage Renovate au démarrage, puis un toutes les N heures.
# Renovate n'est pas un service (il tourne puis s'arrête) : c'est cette boucle qui
# garde le conteneur vivant, comme Home Assistant l'attend.
set -u

# DATA_DIR est surchargeable uniquement pour les tests ; en production c'est /data.
DATA_DIR="${DATA_DIR:-/data}"
OPTIONS_FILE="${DATA_DIR}/options.json"
CHANGELOG_SCRIPT="/opt/renovate-scripts/changelog.mjs"

log() {
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"
}

# Lit une option de l'onglet Configuration. Node est présent (image Renovate),
# donc pas besoin de jq. Une liste est rendue sous forme séparée par des virgules.
read_option() {
    node -e '
const fs = require("fs");
let opts = {};
try {
  opts = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
} catch (err) {
  process.exit(0);
}
const value = opts[process.argv[1]];
if (value === undefined || value === null) process.exit(0);
const text = Array.isArray(value) ? value.filter(Boolean).join(",") : String(value);
process.stdout.write(text.replace(/[\r\n]+/g, " ").trim());
' "$1" "${OPTIONS_FILE}"
}

TOKEN="$(read_option github_token)"
if [ -z "${TOKEN}" ]; then
    log "ERREUR : jeton GitHub vide."
    log "Ouvrez l'onglet Configuration de l'add-on et collez un jeton dans « github_token », puis redémarrez."
    exit 1
fi

if ! command -v renovate >/dev/null 2>&1; then
    log "ERREUR : la commande renovate est introuvable dans l'image. Reconstruisez l'add-on."
    exit 1
fi

mkdir -p "${DATA_DIR}/renovate" "${DATA_DIR}/cache"

export HOME="${DATA_DIR}"
export RENOVATE_BASE_DIR="${DATA_DIR}/renovate"
export RENOVATE_CACHE_DIR="${DATA_DIR}/cache"
export RENOVATE_PLATFORM="github"
export RENOVATE_TOKEN="${TOKEN}"
export RENOVATE_GIT_AUTHOR="${RENOVATE_GIT_AUTHOR:-Renovate Bot <renovate@localhost>}"
export RENOVATE_ONBOARDING="true"

# Autorisation explicite de la seule commande exécutée après une mise à jour.
# Sans ces deux variables, Renovate ignore postUpgradeTasks en silence.
export RENOVATE_ALLOWED_COMMANDS='["^node /opt/renovate-scripts/changelog[.]mjs .*$"]'
export RENOVATE_ALLOW_COMMAND_TEMPLATING="true"

LOG_LEVEL_VALUE="$(read_option log_level)"
[ -n "${LOG_LEVEL_VALUE}" ] || LOG_LEVEL_VALUE="info"
export LOG_LEVEL="${LOG_LEVEL_VALUE}"

REPOS="$(read_option repositories)"
if [ -n "${REPOS}" ]; then
    export RENOVATE_REPOSITORIES="${REPOS}"
    export RENOVATE_AUTODISCOVER="false"
    log "dépôts visés : ${REPOS}"
else
    export RENOVATE_AUTODISCOVER="true"
    log "aucun dépôt indiqué : Renovate regardera tous ceux auxquels le jeton a accès."
fi

if [ "$(read_option dry_run)" = "true" ]; then
    export RENOVATE_DRY_RUN="full"
    log "mode simulation actif : aucune PR ni commit ne sera créé."
fi

INTERVAL="$(read_option interval_hours)"
case "${INTERVAL}" in
    ''|*[!0-9]*) INTERVAL=168 ;;
esac
[ "${INTERVAL}" -ge 1 ] || INTERVAL=168

if [ -f "${CHANGELOG_SCRIPT}" ]; then
    log "script d'écriture du CHANGELOG : ${CHANGELOG_SCRIPT}"
else
    log "ATTENTION : ${CHANGELOG_SCRIPT} absent, les CHANGELOG ne seront pas mis à jour."
fi

run_once() {
    log "début d'un passage Renovate"
    if renovate; then
        log "passage terminé sans erreur"
    else
        log "passage terminé en erreur (code $?) : voir les lignes ci-dessus"
    fi
}

trap 'log "arrêt demandé"; exit 0' TERM INT

if [ "$(read_option run_on_start)" = "false" ]; then
    log "run_on_start=false : premier passage dans ${INTERVAL} h"
else
    run_once
fi

while true; do
    log "prochain passage dans ${INTERVAL} h"
    sleep $((INTERVAL * 3600)) &
    wait $!
done
