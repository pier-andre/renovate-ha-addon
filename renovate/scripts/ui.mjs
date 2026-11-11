#!/usr/bin/env node
// Panneau latéral (ingress) de l'add-on Renovate — lecture seule.
//
// Pourquoi ce fichier : Renovate n'a pas d'interface, et le tableau de bord
// « Dependency Dashboard » de GitHub était le seul endroit qui listait les
// mises à jour. Ce panneau le remplace : il interroge l'API GitHub avec le
// jeton de l'add-on (jamais envoyé au navigateur) et affiche, par dépôt, les
// pull requests ouvertes par Renovate, plus l'état du dernier passage écrit par
// run.sh dans /data/last-run.json.
//
// Aucune écriture : rien n'est fusionné, fermé ni relancé depuis cette page.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const PORT = Number(process.env.UI_PORT || 8099);
const OPTIONS_FILE = process.env.OPTIONS_FILE || "/data/options.json";
const STATE_FILE = process.env.STATE_FILE || "/data/last-run.json";
const CACHE_MS = 60_000;
const API = "https://api.github.com";
const UA = "renovate-ha-addon";

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function github(path, token) {
  const response = await fetch(API + path, {
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "User-Agent": UA,
    },
  });
  if (!response.ok) {
    const hint =
      response.status === 401
        ? " (jeton invalide ou expiré)"
        : response.status === 404
          ? " (dépôt introuvable, ou hors du périmètre du jeton)"
          : "";
    throw new Error("HTTP " + response.status + hint);
  }
  return response.json();
}

// `repositories` est une liste d'options Home Assistant : on ignore tout ce qui
// n'a pas la forme compte/dépôt plutôt que d'envoyer une URL douteuse à GitHub.
function watchedRepos(options) {
  const list = Array.isArray(options.repositories) ? options.repositories : [];
  return list
    .map((value) => String(value).trim())
    .filter((value) => /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(value));
}

function ageInDays(iso) {
  const stamp = Date.parse(iso || "");
  return Number.isNaN(stamp) ? null : Math.floor((Date.now() - stamp) / 86_400_000);
}

async function collect() {
  const options = (await readJson(OPTIONS_FILE)) || {};
  const token = options.github_token || process.env.RENOVATE_TOKEN || "";
  const payload = {
    generated_at: new Date().toISOString(),
    last_run: await readJson(STATE_FILE),
    repositories: watchedRepos(options),
    repos: [],
    problems: [],
  };

  if (!token) {
    payload.problems.push(
      "Aucun jeton GitHub : renseignez `github_token` dans l'onglet Configuration, puis redémarrez l'add-on.",
    );
    return payload;
  }
  if (!payload.repositories.length) {
    payload.problems.push(
      "Aucun dépôt dans `repositories` : ajoutez vos dépôts (`compte/dépôt`) pour les voir ici.",
    );
    return payload;
  }

  for (const repo of payload.repositories) {
    try {
      const pulls = await github("/repos/" + repo + "/pulls?state=open&per_page=100", token);
      payload.repos.push({
        name: repo,
        total_open: pulls.length,
        // Renovate nomme ses branches `renovate/…` : c'est le seul critère fiable,
        // l'auteur dépendant du compte utilisé par le jeton.
        pulls: pulls
          .filter((pull) => pull.head && String(pull.head.ref).startsWith("renovate/"))
          .map((pull) => ({
            number: pull.number,
            title: pull.title,
            url: pull.html_url,
            draft: Boolean(pull.draft),
            age_days: ageInDays(pull.created_at),
            labels: (pull.labels || []).map((label) => label.name),
          })),
      });
    } catch (error) {
      payload.problems.push(repo + " : " + error.message);
    }
  }
  return payload;
}

let cache = { at: 0, payload: null };

async function status(force) {
  if (!force && cache.payload && Date.now() - cache.at < CACHE_MS) return cache.payload;
  cache = { at: Date.now(), payload: await collect() };
  return cache.payload;
}

function sendJson(response, code, data) {
  const body = JSON.stringify(data);
  response.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

const PAGE = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Renovate</title>
<style>
:root { color-scheme: light dark; }
body { font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 16px 18px 32px; }
header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; }
h1 { font-size: 1.25rem; margin: 0; }
h2 { font-size: 1rem; margin: 22px 0 4px; display: flex; align-items: baseline; gap: 8px; }
p { margin: 4px 0; }
.muted { color: #6b7280; font-size: .85rem; }
.alert { background: rgba(220, 38, 38, .12); border-left: 3px solid #dc2626; padding: 6px 10px; margin: 8px 0; }
.count { color: #6b7280; font-size: .8rem; font-weight: 400; }
ul { list-style: none; margin: 0; padding: 0; }
li { padding: 8px 0; border-top: 1px solid rgba(127, 127, 127, .25); }
a { color: #2563eb; text-decoration: none; }
a:hover { text-decoration: underline; }
button { font: inherit; padding: 3px 12px; border-radius: 6px; border: 1px solid rgba(127, 127, 127, .5); background: transparent; cursor: pointer; }
footer { margin-top: 28px; color: #6b7280; font-size: .8rem; }
</style>
</head>
<body>
<header>
<h1>Renovate</h1>
<button id="refresh" type="button">Rafraîchir</button>
</header>
<p class="muted" id="meta">Chargement…</p>
<div id="alerts"></div>
<main id="repos"></main>
<footer>Lecture seule : rien n'est fusionné ni relancé depuis cette page. Le jeton GitHub reste dans l'add-on.</footer>
<script>
(function () {
  var base = location.pathname.endsWith("/") ? location.pathname : location.pathname + "/";
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function when(iso) {
    if (!iso) return "—";
    var date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  }
  function load(force) {
    var meta = document.getElementById("meta");
    var alerts = document.getElementById("alerts");
    var main = document.getElementById("repos");
    meta.textContent = "Chargement…";
    alerts.textContent = "";
    main.textContent = "";
    fetch(base + "api/status" + (force ? "?refresh=1" : ""), { cache: "no-store" })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        var run = data.last_run || {};
        var parts = [];
        if (run.finished) {
          parts.push("Dernier passage : " + when(run.finished) + (run.exit_code === 0 ? " (réussi)" : " (code " + run.exit_code + ")"));
        } else if (run.started) {
          parts.push("Passage en cours depuis " + when(run.started));
        } else {
          parts.push("Aucun passage enregistré depuis le démarrage.");
        }
        if (run.next_run) parts.push("Prochain passage : " + when(run.next_run));
        parts.push("Actualisé à " + when(data.generated_at));
        meta.textContent = parts.join(" · ");
        (data.problems || []).forEach(function (problem) {
          alerts.appendChild(el("p", "alert", problem));
        });
        if (!(data.repos || []).length) {
          main.appendChild(el("p", "muted", "Aucun dépôt surveillé pour le moment."));
        }
        (data.repos || []).forEach(function (repo) {
          var section = el("section");
          var title = el("h2", null, repo.name);
          title.appendChild(el("span", "count", repo.pulls.length + (repo.pulls.length > 1 ? " mises à jour" : " mise à jour")));
          section.appendChild(title);
          if (!repo.pulls.length) {
            section.appendChild(el("p", "muted", "Aucune pull request ouverte."));
          } else {
            var list = el("ul");
            repo.pulls.forEach(function (pull) {
              var item = el("li");
              var link = el("a", null, "#" + pull.number + " " + pull.title);
              link.href = pull.url;
              link.target = "_blank";
              link.rel = "noreferrer";
              item.appendChild(link);
              var details = [];
              if (pull.age_days !== null && pull.age_days !== undefined) details.push("ouverte depuis " + pull.age_days + " j");
              if (pull.draft) details.push("brouillon");
              if (pull.labels && pull.labels.length) details.push(pull.labels.join(", "));
              item.appendChild(el("div", "muted", details.join(" · ")));
              list.appendChild(item);
            });
            section.appendChild(list);
          }
          main.appendChild(section);
        });
      })
      .catch(function (error) {
        meta.textContent = "Erreur de chargement : " + error;
      });
  }
  document.getElementById("refresh").addEventListener("click", function () { load(true); });
  load(false);
  setInterval(function () { load(false); }, 120000);
})();
</script>
</body>
</html>
`;

const server = createServer(async (request, response) => {
  // Ingress ne retire pas son préfixe (/api/hassio_ingress/<jeton>/) : on route
  // donc sur la fin du chemin, et la page construit ses URL en relatif.
  const url = new URL(request.url || "/", "http://panel");
  try {
    if (url.pathname.endsWith("/api/status")) {
      return sendJson(response, 200, await status(url.searchParams.has("refresh")));
    }
    if (url.pathname.endsWith("/health")) {
      return sendJson(response, 200, { ok: true });
    }
    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(PAGE);
  } catch (error) {
    sendJson(response, 500, { error: String(error && error.message ? error.message : error) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("[panel] écoute sur 0.0.0.0:" + PORT);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
