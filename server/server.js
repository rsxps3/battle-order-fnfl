"use strict";
/* Battle Order : petit serveur de publication (aucune dépendance).
   Reçoit un battle order en JSON, le vérifie, fabrique une page HTML statique
   dans <racine>/o/<identifiant>/ et renvoie son adresse. Nginx sert ensuite la page.
   La purge à 30 jours est faite par purge.js (minuteur systemd). */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.env.BO_ROOT || "/var/www/battle-order";
const OUT = path.join(ROOT, "o");
const PORT = parseInt(process.env.BO_PORT || "3101", 10);
const HOST = process.env.BO_HOST || "127.0.0.1";
const BASE_URL = (process.env.BO_BASE_URL || "https://battle-order.fnfl.app").replace(/\/+$/, "");
const CODE = process.env.BO_PUBLISH_CODE || "";
const RETENTION_DAYS = 30;
const MAX_BODY = 256 * 1024;
const MAX_PAGES = parseInt(process.env.BO_MAX_PAGES || "3000", 10);
const PER_HOUR = parseInt(process.env.BO_PER_HOUR || "10", 10);
const PER_DAY = parseInt(process.env.BO_PER_DAY || "30", 10);
const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // sans caractères ambigus (i, l, o, 0, 1)
const ID_RE = /^[a-z0-9]{12}$/;

const BO = require(fs.existsSync(path.join(ROOT, "bo-render.js")) ? path.join(ROOT, "bo-render.js") : path.join(__dirname, "bo-render.js"));

// ---- listes (kits, armes, secondaires), relues si le fichier change
const listCache = {};
function loadList(file, key) {
  const p = path.join(ROOT, file);
  const st = fs.statSync(p);
  const c = listCache[file];
  if (c && c.mtime === st.mtimeMs) return c.map;
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  const arr = Array.isArray(j) ? j : (Array.isArray(j[key]) ? j[key] : (Object.values(j).find(Array.isArray) || []));
  const map = {};
  arr.forEach((x) => { if (x && Number.isInteger(x.id) && typeof x.nom === "string") map[x.id] = x.nom; });
  listCache[file] = { mtime: st.mtimeMs, map };
  return map;
}
function lookup() {
  return { kits: loadList("kits.json", "kits"), weapons: loadList("weapons.json", "weapons"), secondaries: loadList("secondaries.json", "secondaries") };
}

// ---- dates dans la langue de la page (fuseau de Paris) : même fonction que l'aperçu de l'éditeur
const dateText = BO.dateText;
const reqLang = req => (String(req.headers["x-lang"] || "").toLowerCase() === "en" ? "en" : "fr");   // langue des messages : celle de l'interface

// ---- limitation du débit, en mémoire uniquement (aucune adresse IP n'est écrite sur le disque)
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 86400000);
  const lastHour = arr.filter((t) => now - t < 3600000).length;
  if (lastHour >= PER_HOUR || arr.length >= PER_DAY) { hits.set(ip, arr); return true; }
  arr.push(now); hits.set(ip, arr);
  return false;
}
setInterval(() => { const now = Date.now(); for (const [ip, arr] of hits) { if (!arr.some((t) => now - t < 86400000)) hits.delete(ip); } }, 3600000).unref();

function newId() {
  for (let n = 0; n < 20; n++) {
    const b = crypto.randomBytes(12);
    let id = "";
    for (let i = 0; i < 12; i++) id += ID_ALPHABET[b[i] % ID_ALPHABET.length];
    if (!fs.existsSync(path.join(OUT, id))) return id;
  }
  throw new Error("impossible de générer un identifiant");
}
function countPages() { return fs.readdirSync(OUT).filter((n) => ID_RE.test(n)).length; }
function sameCode(a) {
  const h = (s) => crypto.createHash("sha256").update(String(s)).digest();
  return crypto.timingSafeEqual(h(a), h(CODE));
}

function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}
function readBody(req, cb) {
  let size = 0; const chunks = []; let done = false;
  req.on("data", (c) => {
    if (done) return;
    size += c.length;
    if (size > MAX_BODY) { done = true; cb(new Error("trop volumineux")); return; }
    chunks.push(c);
  });
  req.on("end", () => { if (!done) { done = true; cb(null, Buffer.concat(chunks).toString("utf8")); } });
  req.on("error", () => { if (!done) { done = true; cb(new Error("lecture interrompue")); } });
}

function publish(order, res, lang) {
  const l = lookup();
  const r = BO.normalize(order, l, lang);
  if (r.errors.length) return send(res, 400, { error: "invalid", details: r.errors.slice(0, 10) });
  if (countPages() >= MAX_PAGES) return send(res, 503, { error: "full", message: BO.M(lang, "Le serveur a atteint sa limite de pages publiées. Réessaie dans quelques jours.") });
  const now = Date.now();
  const expires = now + RETENTION_DAYS * 86400000;
  const id = newId();
  const meta = { id, created: now, expires };
  // une page dans chaque langue : fr.html et en.html (le bouton FR / EN de la page y renvoie, sans aucun script) ; index.html = la langue choisie
  const logo = fs.existsSync(path.join(ROOT, "fnfl_flag_logo_roundel.png"));
  const pageIn = (lg) => BO.renderPage(r.order, l, { lang: lg, id, createdText: dateText(now, lg), expiresText: dateText(expires, lg), retentionDays: RETENTION_DAYS, logo, otherHref: lg === "fr" ? "en.html" : "fr.html" });
  const pages = { fr: pageIn("fr"), en: pageIn("en") };
  const tmp = path.join(OUT, ".tmp-" + id);
  fs.mkdirSync(tmp, { mode: 0o755 });
  try {
    fs.writeFileSync(path.join(tmp, "fr.html"), pages.fr, { mode: 0o644 });
    fs.writeFileSync(path.join(tmp, "en.html"), pages.en, { mode: 0o644 });
    fs.writeFileSync(path.join(tmp, "index.html"), pages[lang], { mode: 0o644 });
    fs.writeFileSync(path.join(tmp, "data.json"), JSON.stringify(r.order), { mode: 0o644 });
    fs.writeFileSync(path.join(tmp, "meta.json"), JSON.stringify(meta), { mode: 0o644 });
    fs.renameSync(tmp, path.join(OUT, id));
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
  console.log("publié : " + id + " (" + r.order.sections.length + " sections)");
  const base = BASE_URL + "/o/" + id + "/";
  return send(res, 200, { id, url: base, urls: { fr: base + "fr.html", en: base + "en.html" }, lang, created: now, expires, expiresText: dateText(expires, lang) });
}

const server = http.createServer((req, res) => {
  const url = (req.url || "").split("?")[0];
  try {
    if (req.method === "GET" && url === "/api/health") return send(res, 200, { ok: true });
    if (req.method === "GET" && url === "/api/config") return send(res, 200, { codeRequired: !!CODE, retentionDays: RETENTION_DAYS });
    if (req.method === "POST" && url === "/api/publish") {
      const ip = String(req.headers["x-real-ip"] || req.socket.remoteAddress || "?");
      const hl = reqLang(req);
      if (limited(ip)) return send(res, 429, { error: "rate", message: BO.M(hl, "Trop de publications récentes : réessaie un peu plus tard.") });
      if (!/^application\/json/i.test(req.headers["content-type"] || "")) return send(res, 415, { error: "type" });
      return readBody(req, (err, text) => {
        if (err) { res.setHeader("Connection", "close"); return send(res, 413, { error: "size", message: BO.M(hl, "Battle order trop volumineux.") }); }
        let body;
        try { body = JSON.parse(text); } catch (e) { return send(res, 400, { error: "json" }); }
        if (!body || typeof body !== "object") return send(res, 400, { error: "json" });
        if (CODE && !(typeof body.code === "string" && sameCode(body.code))) return send(res, 403, { error: "code", message: BO.M(hl, "Code de publication incorrect.") });
        const lang = body.lang === "en" || body.lang === "fr" ? body.lang : hl;     // langue de la page publiée par défaut
        try { publish(body.order, res, lang); } catch (e) { console.error("erreur de publication :", e.message); send(res, 500, { error: "server" }); }
      });
    }
    return send(res, 404, { error: "not found" });
  } catch (e) {
    console.error("erreur :", e.message);
    return send(res, 500, { error: "server" });
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;

// démarrage : dossier de sortie, nettoyage des restes d'écritures interrompues
fs.mkdirSync(OUT, { recursive: true });
for (const n of fs.readdirSync(OUT)) {
  if (n.startsWith(".tmp-")) { try { if (Date.now() - fs.statSync(path.join(OUT, n)).mtimeMs > 3600000) fs.rmSync(path.join(OUT, n), { recursive: true, force: true }); } catch (e) { /* ignoré */ } }
}
try {
  lookup(); // on vérifie tout de suite que les trois fichiers JSON existent et sont lisibles
} catch (e) {
  console.error("battle-order : impossible de lire kits.json, weapons.json ou secondaries.json dans " + ROOT + " (" + e.message + ")");
  process.exit(1);
}
server.listen(PORT, HOST, () => console.log("battle-order : " + HOST + ":" + PORT + ", racine " + ROOT + (CODE ? ", code de publication exigé" : "")));
