# Renovate en add-on Home Assistant.
# L'image officielle Renovate est réutilisée telle quelle : on n'ajoute qu'un
# script de démarrage (boucle périodique) et le script d'écriture du CHANGELOG.
# Version épinglée volontairement : la construction est reproductible, et Renovate
# met cette ligne à jour lui-même (customManager dans repo-renovate.json).
ARG BUILD_FROM=ghcr.io/renovatebot/renovate:44.232.0
FROM ${BUILD_FROM}

# Renovate installe ses outils à la demande (binarySource=install) dans /usr/local,
# et /data appartient à root : on reste donc en root, comme la plupart des add-ons.
USER root

# tzdata : sans lui, `date` ignorerait l'option `timezone` en silence et
# l'heure planifiée serait décalée.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY run.sh /run.sh
COPY scripts/changelog.mjs /opt/renovate-scripts/changelog.mjs
# Panneau latéral (ingress) : page de lecture seule listant les PR de Renovate.
COPY scripts/ui.mjs /opt/renovate-scripts/ui.mjs
RUN chmod 0755 /run.sh

EXPOSE 8099

# On remplace l'entrée de l'image officielle (qui lance Renovate puis rend la main)
# par notre boucle : Home Assistant attend un processus qui reste vivant.
ENTRYPOINT ["/run.sh"]
CMD []
