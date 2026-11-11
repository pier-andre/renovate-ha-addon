#!/usr/bin/env node
// Ajoute une ligne au CHANGELOG.md, appelé par Renovate via postUpgradeTasks.
// Usage, depuis la racine du clone du dépôt :
//   node changelog.mjs <depName> <ancienneVersion> <nouvelleVersion> <typeDeMiseAJour> [cible]
//
// [cible] décide où écrire :
//   (absent)             -> CHANGELOG.md à la racine du dépôt
//   dossier/             -> dossier/CHANGELOG.md
//   dossier/FICHIER.md   -> ce fichier, si son dossier existe
//   addons               -> un CHANGELOG.md dans CHAQUE dossier d'add-on
//                           (dossier/config.yaml contenant une ligne version:)
//
// Aucune dépendance : uniquement Node, présent dans l'image Renovate.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const [depName, currentVersion, newVersion, updateType] = args;
const target = args[4] ?? "";

if (!depName || !newVersion) {
  console.error("changelog.mjs : arguments manquants (depName, nouvelleVersion)");
  process.exit(1);
}

const TYPE_LABELS = {
  major: "majeure",
  minor: "mineure",
  patch: "correctif",
  pin: "épinglage",
  digest: "digest",
};
const label = TYPE_LABELS[updateType] ?? updateType ?? "mise à jour";
const today = new Date().toISOString().slice(0, 10);
const entry = `- ${today} — \`${depName}\` ${currentVersion || "?"} → ${newVersion} (mise à jour ${label})`;

const H1 = "# Journal des modifications";
const HEADING = "## Non publié";

// Écrit l'entrée dans un fichier. Renvoie true si le fichier a changé.
function addEntry(file) {
  let content = existsSync(file)
    ? readFileSync(file, "utf8")
    : `${H1}\n\nCe fichier est complété automatiquement par Renovate.\n\n${HEADING}\n`;

  // Idempotent : si la ligne est déjà là, on ne fait rien.
  if (content.includes(entry)) {
    return false;
  }

  const lines = content.split("\n");
  const headingIndex = lines.findIndex((line) => line.trim() === HEADING);

  if (headingIndex !== -1) {
    // Insère juste sous le titre "## Non publié", en absorbant les lignes vides
    // laissées par une insertion précédente pour garder une liste compacte.
    let insertAt = headingIndex + 1;
    while (insertAt < lines.length && lines[insertAt].trim() === "") {
      insertAt++;
    }
    lines.splice(headingIndex + 1, insertAt - headingIndex - 1, "", entry);
    content = lines.join("\n");
  } else if (content.includes(H1)) {
    // Titre principal présent, section absente : on la crée juste après.
    content = content.replace(H1, `${H1}\n\n${HEADING}\n\n${entry}`);
  } else {
    // Fichier quelconque : on ajoute un en-tête propre au début.
    content = `${H1}\n\n${HEADING}\n\n${entry}\n\n${content}`;
  }

  writeFileSync(file, content.endsWith("\n") ? content : `${content}\n`);
  return true;
}

// Dossiers d'add-on : un sous-dossier contenant un config.yaml avec une ligne version:.
function addonDirs(root) {
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
    .map((e) => e.name)
    .filter((name) => {
      const config = join(root, name, "config.yaml");
      if (!existsSync(config)) {
        return false;
      }
      return /^[ \t]*version:/m.test(readFileSync(config, "utf8"));
    })
    .sort();
}

let files;

if (target === "addons") {
  const dirs = addonDirs(process.cwd());
  if (dirs.length === 0) {
    console.error(
      "changelog.mjs : aucun dossier d'add-on trouvé ici (dossier/config.yaml avec une ligne version:).",
    );
    process.exit(1);
  }
  files = dirs.map((dir) => join(dir, "CHANGELOG.md"));
} else if (!target) {
  files = ["CHANGELOG.md"];
} else {
  const isDir = target.endsWith("/") || (existsSync(target) && statSync(target).isDirectory());
  const isFile = target.endsWith(".md") || target.endsWith(".markdown");

  if (!isDir && !isFile) {
    console.error(
      `changelog.mjs : cible « ${target} » incomprise (attendu : dossier/, un chemin terminant par .md, ou « addons »).`,
    );
    process.exit(1);
  }

  const file = isDir ? join(target, "CHANGELOG.md") : target;
  const parent = dirname(file);
  if (parent && parent !== "." && !existsSync(parent)) {
    console.error(`changelog.mjs : le dossier de « ${file} » n'existe pas.`);
    process.exit(1);
  }
  files = [file];
}

let changed = 0;
for (const file of files) {
  if (addEntry(file)) {
    console.log(`${file} : ajouté « ${entry} »`);
    changed++;
  } else {
    console.log(`${file} : entrée déjà présente, rien à faire.`);
  }
}

console.log(`changelog.mjs : ${changed} fichier(s) mis à jour sur ${files.length}.`);
