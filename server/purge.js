"use strict";
/* Battle Order : supprime les pages publiées depuis plus de 30 jours.
   Usage : node purge.js [--dry-run]   (lancé chaque jour par un minuteur systemd) */
const fs = require("fs");
const path = require("path");

const ROOT = process.env.BO_ROOT || "/var/www/battle-order";
const OUT = path.join(ROOT, "o");
const RETENTION_MS = 30 * 86400000;
const ID_RE = /^[a-z0-9]{12}$/;
const dry = process.argv.includes("--dry-run");
const now = Date.now();

if (!fs.existsSync(OUT)) { console.log("purge : dossier " + OUT + " absent, rien à faire."); process.exit(0); }

let removed = 0, kept = 0, tmpRemoved = 0, ignored = 0;
for (const name of fs.readdirSync(OUT)) {
  const dir = path.join(OUT, name);
  let st;
  try { st = fs.lstatSync(dir); } catch (e) { continue; }
  if (st.isSymbolicLink() || !st.isDirectory()) { ignored++; continue; }
  if (name.startsWith(".tmp-")) { // écriture interrompue
    if (now - st.mtimeMs > 3600000) { if (!dry) fs.rmSync(dir, { recursive: true, force: true }); tmpRemoved++; }
    continue;
  }
  if (!ID_RE.test(name)) { ignored++; continue; } // on ne touche qu'aux dossiers créés par le serveur
  let expires = NaN;
  try { expires = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")).expires; } catch (e) { /* meta absent ou illisible */ }
  if (!Number.isFinite(expires)) expires = st.mtimeMs + RETENTION_MS;   // sans date : 30 jours après la dernière modification du dossier
  if (now > expires) {
    if (!dry) fs.rmSync(dir, { recursive: true, force: true });
    removed++;
    console.log((dry ? "[essai] à supprimer : " : "supprimée : ") + name);
  } else kept++;
}
console.log("purge" + (dry ? " (essai)" : "") + " : " + removed + " page(s) " + (dry ? "à supprimer" : "supprimée(s)") + ", " + kept + " conservée(s)" + (tmpRemoved ? ", " + tmpRemoved + " reste(s) d'écriture nettoyé(s)" : "") + (ignored ? ", " + ignored + " élément(s) ignoré(s)" : "") + ".");
