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

# ---- Planification -------------------------------------------------------
# Jour + heure remplacent l'ancien intervalle en heures : l'add-on se réveille à
# l'échéance choisie au lieu de compter des heures depuis son démarrage, ce qui
# est la seule façon de respecter une heure fixe. C'est donc ici, et non dans les
# dépôts surveillés, que la planification vit.
SCHEDULE_TIME="$(read_option schedule_time)"
if ! printf '%s' "${SCHEDULE_TIME}" | grep -Eq '^([01][0-9]|2[0-3]):[0-5][0-9]$'; then
    [ -n "${SCHEDULE_TIME}" ] && log "schedule_time « ${SCHEDULE_TIME} » invalide (HH:MM attendu) : 04:00 utilisé."
    SCHEDULE_TIME="04:00"
fi

TZ_VALUE="$(read_option timezone)"
if [ -z "${TZ_VALUE}" ] \
    || ! printf '%s' "${TZ_VALUE}" | grep -Eq '^[A-Za-z0-9_+/-]+$' \
    || [ ! -f "/usr/share/zoneinfo/${TZ_VALUE}" ]; then
    [ -n "${TZ_VALUE}" ] && log "timezone « ${TZ_VALUE} » inconnu : Europe/Paris utilisé."
    TZ_VALUE="Europe/Paris"
fi
export TZ="${TZ_VALUE}"
# Utile si un dépôt surveillé définit malgré tout son propre `schedule`.
export RENOVATE_TIMEZONE="${TZ_VALUE}"

SCHEDULE_DAYS="$(read_option schedule_days)"
[ -n "${SCHEDULE_DAYS}" ] || SCHEDULE_DAYS="all"
case "${SCHEDULE_DAYS}" in
    mon) DAY_INDEXES="1" ;;
    tue) DAY_INDEXES="2" ;;
    wed) DAY_INDEXES="3" ;;
    thu) DAY_INDEXES="4" ;;
    fri) DAY_INDEXES="5" ;;
    sat) DAY_INDEXES="6" ;;
    sun) DAY_INDEXES="0" ;;
    weekdays) DAY_INDEXES="1 2 3 4 5" ;;
    weekends) DAY_INDEXES="0 6" ;;
    *) DAY_INDEXES="0 1 2 3 4 5 6" ;;
esac

# GNU date attend des noms de jours, pas des numéros.
day_name() {
    case "$1" in
        0) echo sunday ;;
        1) echo monday ;;
        2) echo tuesday ;;
        3) echo wednesday ;;
        4) echo thursday ;;
        5) echo friday ;;
        6) echo saturday ;;
    esac
}

# Prochaine échéance en secondes epoch : pour chaque jour autorisé on demande à
# `date` la prochaine occurrence de l'heure voulue, on décale d'une semaine
# celles déjà passées, et on garde la plus proche. « Tous les jours » se traite
# comme sept candidats, sans cas particulier.
next_slot() {
    local now best target index name
    now="$(date +%s)"
    best=""
    for index in ${DAY_INDEXES}; do
        name="$(day_name "${index}")"
        target="$(date -d "${name} ${SCHEDULE_TIME}" +%s 2>/dev/null)" || continue
        # 604800 = 7 jours. On ajoute au timestamp plutôt que de réécrire la
        # chaîne : `date -d "... 04:00 +7 days"` lit « +7 » comme un fuseau.
        if [ "${target}" -le "${now}" ]; then
            target=$((target + 604800))
        fi
        if [ -z "${best}" ] || [ "${target}" -lt "${best}" ]; then
            best="${target}"
        fi
    done
    [ -n "${best}" ] || best=$((now + 3600))
    printf '%s' "${best}"
}

log "planification : ${SCHEDULE_DAYS} à ${SCHEDULE_TIME} (${TZ_VALUE})"

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
    log "run_on_start=false : premier passage à la prochaine échéance planifiée."
else
    run_once
fi

while true; do
    SLOT="$(next_slot)"
    WAIT=$(( SLOT - $(date +%s) ))
    [ "${WAIT}" -ge 30 ] || WAIT=30
    log "prochaine exécution : $(date -d "@${SLOT}" '+%A %d/%m/%Y à %H:%M') (${TZ_VALUE}), dans $((WAIT / 60)) min"
    sleep "${WAIT}" &
    wait $!
    run_once
done
