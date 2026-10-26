/* Battle Order : validation et rendu partagés (navigateur et Node).
   Le serveur utilise ce fichier pour fabriquer la page publiée : tout le texte saisi y est échappé. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else { root.BO = factory(); }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TYPES = ["Infantry", "Tank", "Artillery", "Support"];
  var ROLES = ["Assault", "Defense", "Flank", "Commando", "Support"];

  // Palette : couleur d'en-tête de section (les cinq premières sont celles du tableur d'origine).
  var PALETTE = [
    { key: "red", name: "Rouge", en: "Red", header: "#ff0000" },
    { key: "orange", name: "Orange", en: "Orange", header: "#ff9900" },
    { key: "yellow", name: "Jaune", en: "Yellow", header: "#ffff00" },
    { key: "green", name: "Vert", en: "Green", header: "#00ff00" },
    { key: "cyan", name: "Cyan", en: "Cyan", header: "#00ffff" },
    { key: "blue", name: "Bleu", en: "Blue", header: "#0000ff" },
    { key: "purple", name: "Violet", en: "Purple", header: "#9900ff" },
    { key: "pink", name: "Rose", en: "Pink", header: "#ff66cc" },
    { key: "brown", name: "Marron", en: "Brown", header: "#8b5a2b" },
    { key: "grey", name: "Gris", en: "Grey", header: "#999999" },
    { key: "navy", name: "Marine", en: "Navy", header: "#1c3a6b" },
    { key: "black", name: "Noir", en: "Black", header: "#222222" }
  ];

  var LIMITS = {
    title: 80, subtitle: 80, cmdLabel: 24, cmdName: 60, maxCommand: 10,
    maxSections: 40, maxPlayers: 20, maxTotalPlayers: 400,
    name: 60, type: 30, role: 30, callsign: 30, team: 30, vehicles: 120, text: 40
  };

  function hexToRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function toHex(n) { var s = Math.round(n).toString(16); return s.length < 2 ? "0" + s : s; }
  function colorInfo(key, index) {
    var c = null, i;
    for (i = 0; i < PALETTE.length; i++) { if (PALETTE[i].key === key) { c = PALETTE[i]; break; } }
    if (!c) c = PALETTE[(index || 0) % PALETTE.length];
    var rgb = hexToRgb(c.header);
    var tint = "#" + toHex(255 - (255 - rgb[0]) * 0.2) + toHex(255 - (255 - rgb[1]) * 0.2) + toHex(255 - (255 - rgb[2]) * 0.2);
    var lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    return { key: c.key, name: c.name, header: c.header, tint: tint, text: lum < 140 ? "#ffffff" : "#000000" };
  }

  var MOIS = ["janvier", "f\u00e9vrier", "mars", "avril", "mai", "juin", "juillet", "ao\u00fbt", "septembre", "octobre", "novembre", "d\u00e9cembre"];
  function dateFr(ms) {
    var parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", day: "numeric", month: "numeric", year: "numeric" }).formatToParts(new Date(ms));
    function g(t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parseInt(parts[i].value, 10); return 0; }
    return g("day") + (g("day") === 1 ? "er " : " ") + MOIS[g("month") - 1] + " " + g("year");
  }

  var MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  /** Date longue (fuseau de Paris) dans la langue demandée : « 1er novembre 2026 » / « 1 November 2026 ». */
  function dateText(ms, lang) {
    if (lang !== "en") return dateFr(ms);
    var parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", day: "numeric", month: "numeric", year: "numeric" }).formatToParts(new Date(ms));
    function g(t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parseInt(parts[i].value, 10); return 0; }
    return g("day") + " " + MONTHS_EN[g("month") - 1] + " " + g("year");
  }

  /* Textes des pages publiées et messages de validation : français (clé) -> anglais. Le français est la langue par défaut. */
  var LABELS = {
    fr: {
      player: "joueur", players: "joueurs", vehicles: "Véhicules : ", reportsTo: "\u21b3 sous les ordres de ", other: "Autre", or: " ou ",
      expiry: "Attention : cette page sera supprimée automatiquement le <strong>{d}</strong> ({n} jours après sa création).",
      created: "Créée le {d}. ", duplicate: "Dupliquer ce battle order dans l\u2019éditeur",
      logoAlt: "Logo Forces Navales Françaises Libres", otherLang: "EN", otherLangTitle: "Read this page in English",
      footer: "3ème Régiment de Fusiliers Marins \u00b7 Forces Navales Françaises Libres \u00b7 « Vaincre ou sombrer » \u00b7 \u00a9 Copyright \u00b7 Made by Remzer \u00b7 ",
      privacy: "Confidentialité", privacyHref: "/confidentialite.html"
    },
    en: {
      player: "player", players: "players", vehicles: "Vehicles: ", reportsTo: "\u21b3 reports to ", other: "Other", or: " or ",
      expiry: "Warning: this page will be deleted automatically on <strong>{d}</strong> ({n} days after it was created).",
      created: "Created on {d}. ", duplicate: "Duplicate this battle order in the editor",
      logoAlt: "Free French Naval Forces logo", otherLang: "FR", otherLangTitle: "Lire cette page en français",
      footer: "3rd Marine Fusiliers Regiment \u00b7 Free French Naval Forces \u00b7 « Vaincre ou sombrer » \u00b7 \u00a9 Copyright \u00b7 Made by Remzer \u00b7 ",
      privacy: "Privacy", privacyHref: "/privacy.html"
    }
  };
  function L(lang) { return LABELS[lang === "en" ? "en" : "fr"]; }
  function fill(s, vars) { return s.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] !== undefined ? String(vars[k]) : m; }); }

  var MSG_EN = {
    "Le contenu du battle order est illisible.": "The battle order content is unreadable.",
    "Trop de lignes de commandement (maximum {n}).": "Too many command lines (maximum {n}).",
    "Ajoute au moins une section.": "Add at least one section.",
    "Trop de sections (maximum {n}).": "Too many sections (maximum {n}).",
    "Section {i}": "Section {i}", "Section {i}, joueur {j}": "Section {i}, player {j}",
    "{where} : ajoute au moins un joueur.": "{where}: add at least one player.",
    "{where} : trop de joueurs (maximum {n}).": "{where}: too many players (maximum {n}).",
    "Trop de joueurs au total (maximum {n}).": "Too many players in total (maximum {n}).",
    "Section {i} : la section dont elle dépend n'existe pas.": "Section {i}: the section it depends on does not exist.",
    "Section {i} : dépendance circulaire.": "Section {i}: circular dependency.",
    "{where} : {what} inconnu.": "{where}: unknown {what}.",
    "kit": "kit", "arme principale": "primary weapon", "arme principale alternative": "alternative primary weapon", "arme secondaire": "secondary weapon",
    "Le serveur a atteint sa limite de pages publiées. Réessaie dans quelques jours.": "The server has reached its limit of published pages. Try again in a few days.",
    "Trop de publications récentes : réessaie un peu plus tard.": "Too many recent publications: try again a little later.",
    "Battle order trop volumineux.": "Battle order too large.",
    "Code de publication incorrect.": "Incorrect publishing code."
  };
  /** Message dans la langue demandée (français par défaut) ; {nom} est remplacé par la valeur de vars. */
  function M(lang, fr, vars) { return fill(lang === "en" && Object.prototype.hasOwnProperty.call(MSG_EN, fr) ? MSG_EN[fr] : fr, vars); }
  function colorName(c, lang) { return lang === "en" && c.en ? c.en : c.name; }

  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  };

  // Nettoie un texte saisi : caractères de contrôle et de renversement du sens d'écriture retirés, espaces réduits.
  function clean(v, max) {
    if (v === null || v === undefined) return "";
    var s = String(v)
      .replace(/[\u0000-\u001f\u007f\u2028\u2029\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, " ")
      .replace(/\s+/g, " ").trim();
    return s.length > max ? s.slice(0, max).trim() : s;
  }

  function toId(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = Number(v);
    return Number.isInteger(n) ? n : NaN;
  }

  function has(map, id) { return Object.prototype.hasOwnProperty.call(map, id); }
  function isOther(map, id) { return id === -1 || (has(map, id) && /^(autre|other)$/i.test(String(map[id]))); }

  // Titre d'une section : le nom choisi par l'utilisateur s'il existe, sinon « ÉQUIPE (CALLSIGN) - Rôle » comme dans le tableur d'origine.
  function sectionTitle(s, index) {
    if (s.name && String(s.name).trim()) return String(s.name).trim();
    var base = s.team || "";
    if (s.callsign) base = base ? base + " (" + s.callsign + ")" : s.callsign;
    if (s.role) base = base ? base + " - " + s.role : s.role;
    return base || "Section " + ((index || 0) + 1);
  }

  // Ordre d'affichage : chaque section est suivie de celles qui dépendent d'elle.
  function ordered(sections) {
    var byId = {}, byParent = {}, out = [], placed = {};
    sections.forEach(function (s) { byId[s.id] = s; });
    sections.forEach(function (s) {
      var p = s.parent && byId[s.parent] && s.parent !== s.id ? s.parent : "__root";
      (byParent[p] = byParent[p] || []).push(s);
    });
    function walk(list, depth) {
      list.forEach(function (s) {
        if (placed[s.id]) return;
        placed[s.id] = true;
        out.push({ section: s, depth: depth, parent: s.parent && byId[s.parent] ? byId[s.parent] : null, index: sections.indexOf(s) });
        walk(byParent[s.id] || [], depth + 1);
      });
    }
    walk(byParent.__root || [], 0);
    sections.forEach(function (s) { // sections prises dans une boucle de dépendance : affichées à la fin
      if (!placed[s.id]) { placed[s.id] = true; out.push({ section: s, depth: 0, parent: null, index: sections.indexOf(s) }); }
    });
    return out;
  }

  function normPlayer(p, lookup, where, errors, lang) {
    p = p && typeof p === "object" ? p : {};
    function pick(v, map, what, allowMinusOne) {
      var id = toId(v);
      if (id === null) return null;
      if (allowMinusOne && id === -1) return -1;
      if (isNaN(id) || !has(map, id)) { errors.push(M(lang, "{where} : {what} inconnu.", { where: where, what: M(lang, what) })); return null; }
      return id;
    }
    var o = {
      kit: pick(p.kit, lookup.kits, "kit", true),
      primary: pick(p.primary, lookup.weapons, "arme principale", false),
      alt: pick(p.alt, lookup.weapons, "arme principale alternative", false),
      secondary: pick(p.secondary, lookup.secondaries, "arme secondaire", false),
      team: clean(p.team, LIMITS.team)
    };
    o.kitText = o.kit !== null && isOther(lookup.kits, o.kit) ? clean(p.kitText, LIMITS.text) : "";
    o.primaryText = o.primary !== null && isOther(lookup.weapons, o.primary) ? clean(p.primaryText, LIMITS.text) : "";
    o.altText = o.alt !== null && isOther(lookup.weapons, o.alt) ? clean(p.altText, LIMITS.text) : "";
    o.secondaryText = o.secondary !== null && isOther(lookup.secondaries, o.secondary) ? clean(p.secondaryText, LIMITS.text) : "";
    return o;
  }

  // Vérifie et nettoie un battle order. Renvoie toujours un ordre utilisable ({order}) et la liste des problèmes à corriger ({errors}).
  function normalize(raw, lookup, lang) {
    var errors = [];
    lookup = { kits: (lookup && lookup.kits) || {}, weapons: (lookup && lookup.weapons) || {}, secondaries: (lookup && lookup.secondaries) || {} };
    var r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
    if (!r) { errors.push(M(lang, "Le contenu du battle order est illisible.")); r = {}; }
    var order = {
      v: 1,
      title: clean(r.title, LIMITS.title) || "Battle order",
      subtitle: clean(r.subtitle, LIMITS.subtitle),
      showSecondary: r.showSecondary === true,
      command: [],
      sections: []
    };

    var cmd = Array.isArray(r.command) ? r.command : [];
    if (cmd.length > LIMITS.maxCommand) errors.push(M(lang, "Trop de lignes de commandement (maximum {n}).", { n: LIMITS.maxCommand }));
    cmd.slice(0, LIMITS.maxCommand).forEach(function (c) {
      c = c && typeof c === "object" ? c : {};
      var label = clean(c.label, LIMITS.cmdLabel), name = clean(c.name, LIMITS.cmdName);
      if (label || name) order.command.push({ label: label || "CMD", name: name });
    });

    var secs = Array.isArray(r.sections) ? r.sections : [];
    if (!secs.length) errors.push(M(lang, "Ajoute au moins une section."));
    if (secs.length > LIMITS.maxSections) errors.push(M(lang, "Trop de sections (maximum {n}).", { n: LIMITS.maxSections }));
    var seen = {}, total = 0;
    secs.slice(0, LIMITS.maxSections).forEach(function (s, i) {
      s = s && typeof s === "object" ? s : {};
      var id = typeof s.id === "string" && /^[A-Za-z0-9_-]{1,16}$/.test(s.id) && !seen[s.id] ? s.id : null;
      if (!id) { id = "s" + (i + 1); while (seen[id]) id += "x"; }
      seen[id] = true;
      var sec = {
        id: id,
        name: clean(s.name, LIMITS.name),
        type: clean(s.type, LIMITS.type),
        role: clean(s.role, LIMITS.role),
        callsign: clean(s.callsign, LIMITS.callsign),
        team: clean(s.team, LIMITS.team),
        color: colorInfo(s.color, i).key,
        vehicles: clean(s.vehicles, LIMITS.vehicles),
        parent: typeof s.parent === "string" && s.parent ? s.parent : null,
        players: []
      };
      var where = M(lang, "Section {i}", { i: i + 1 });
      var pl = Array.isArray(s.players) ? s.players : [];
      if (!pl.length) errors.push(M(lang, "{where} : ajoute au moins un joueur.", { where: where }));
      if (pl.length > LIMITS.maxPlayers) errors.push(M(lang, "{where} : trop de joueurs (maximum {n}).", { where: where, n: LIMITS.maxPlayers }));
      pl.slice(0, LIMITS.maxPlayers).forEach(function (p, j) {
        sec.players.push(normPlayer(p, lookup, M(lang, "Section {i}, joueur {j}", { i: i + 1, j: j + 1 }), errors, lang));
      });
      total += sec.players.length;
      order.sections.push(sec);
    });
    if (total > LIMITS.maxTotalPlayers) errors.push(M(lang, "Trop de joueurs au total (maximum {n}).", { n: LIMITS.maxTotalPlayers }));

    // hiérarchie : le parent doit exister, et aucune boucle n'est possible
    var byId = {};
    order.sections.forEach(function (s) { byId[s.id] = s; });
    order.sections.forEach(function (s, i) {
      if (!s.parent) return;
      if (s.parent === s.id || !byId[s.parent]) {
        errors.push(M(lang, "Section {i} : la section dont elle dépend n'existe pas.", { i: i + 1 }));
        s.parent = null;
      }
    });
    order.sections.forEach(function (s, i) {
      var cur = s, steps = 0;
      while (cur && cur.parent && steps <= order.sections.length) { cur = byId[cur.parent]; steps++; if (cur === s) break; }
      if (cur === s && s.parent) {
        errors.push(M(lang, "Section {i} : dépendance circulaire.", { i: i + 1 }));
        s.parent = null;
      }
    });
    return { order: order, errors: errors };
  }

  function kitLabel(p, lookup, lang) {
    if (p.kit === null) return "\u2014";
    if (p.kit === -1 || isOther(lookup.kits, p.kit)) return p.kitText || L(lang).other;
    return lookup.kits[p.kit] || "\u2014";
  }
  function weaponLabel(id, text, map, lang) {
    if (id === null) return "";
    if (isOther(map, id)) return text || L(lang).other;
    return has(map, id) ? map[id] : "";
  }
  function weaponsLine(p, lookup, showSecondary, lang) {
    var parts = [], a = weaponLabel(p.primary, p.primaryText, lookup.weapons, lang), b = weaponLabel(p.alt, p.altText, lookup.weapons, lang);
    if (a && b) parts.push(a + L(lang).or + b); else if (a || b) parts.push(a || b);
    if (showSecondary) {
      var c = weaponLabel(p.secondary, p.secondaryText, lookup.secondaries, lang);
      if (c) parts.push("+ " + c);
    }
    return parts;
  }

  var CSS = [
    ".bo{font-family:'IBM Plex Mono','Courier New',ui-monospace,Menlo,Consolas,monospace;color:#000;background:transparent;padding:24px;line-height:1.25}",
    ".bo *{box-sizing:border-box}",
    ".bo-title{background:#fff;border:1px solid #000;text-align:center;padding:14px 10px;max-width:720px;margin:0 auto 22px}",
    ".bo-title h1{margin:0;font-size:1.5rem;letter-spacing:.5px;overflow-wrap:anywhere}",
    ".bo-title p{margin:4px 0 0;font-size:.8rem;overflow-wrap:anywhere}",
    ".bo-command{border-collapse:collapse;margin:0 auto 28px;width:min(420px,100%);background:#fff}",
    ".bo-command th{background:#ffd966;border:1px solid #000;font-size:.7rem;padding:2px 6px}",
    ".bo-command td{border:1px solid #000;font-size:.72rem;padding:3px 6px}",
    ".bo-command td.l{background:#d9d9d9;font-weight:700;text-align:center;width:34%}",
    ".bo-command td.n{font-style:italic;text-align:center;overflow-wrap:anywhere}",
    ".bo-sections{display:flex;flex-wrap:wrap;gap:26px;align-items:flex-start;justify-content:center}",
    ".bo-sec{background:#fff;border:1px solid #000;width:300px;max-width:100%}",
    ".bo-sec header{background:var(--hd);color:var(--hdt);border-bottom:1px solid #000;text-align:center;font-weight:700;font-size:.78rem;padding:10px 6px;overflow-wrap:anywhere}",
    ".bo-info{background:#f3f3f3;border-bottom:1px solid #000;font-size:.68rem;padding:5px 8px;text-align:center;min-height:28px;overflow-wrap:anywhere}",
    ".bo-info span{display:block}",
    ".bo-rows{border-collapse:collapse;width:100%}",
    ".bo-rows tr+tr th,.bo-rows tr+tr td{border-top:1px solid #000}",
    ".bo-rows th{background:var(--tint);width:55%;text-align:center;font-size:.76rem;padding:9px 6px;border-right:1px solid #000;font-weight:700;overflow-wrap:anywhere}",
    ".bo-rows th small{display:block;font-weight:400;font-size:.66rem;margin-top:2px}",
    ".bo-rows td{text-align:center;font-style:italic;font-size:.72rem;padding:9px 6px;overflow-wrap:anywhere}"
  ].join("\n");

  var PAGE_CSS = [
    "body{margin:0;min-height:100vh}",
    ".bo-expiry{background:#fff3cd;border-bottom:2px solid #c9a227;padding:9px 14px;font:.88rem/1.4 system-ui,Arial,sans-serif;text-align:center;color:#3b2f00}",
    ".fn-head img{width:44px;height:44px;object-fit:contain}",
    ".fn-head .fn-lang{margin-left:14px;font-size:.8rem;padding:3px 10px;border:1px solid currentColor;border-radius:4px;opacity:.85;letter-spacing:.05em}",
    ".fn-head .fn-lang:hover{opacity:1}",
    ".bo-foot{padding:6px 14px 4px;text-align:center;font:.8rem/1.5 system-ui,Arial,sans-serif;color:var(--bo-fg,#222)}",
    ".bo-foot a,.fn-foot a{color:inherit}",
    ".fn-foot{padding:4px 14px 26px;text-align:center;font-size:.72rem;opacity:.8;color:var(--bo-fg,#222)}",
    "@media print{.bo-expiry,.bo-foot,.fn-head,.fn-foot{display:none}.bo{padding:8px}.bo-sec{break-inside:avoid}body{background:#fff!important}}"
  ].join("\n");

  function renderBoard(order, lookup, lang) {
    var T = L(lang);
    lookup = { kits: (lookup && lookup.kits) || {}, weapons: (lookup && lookup.weapons) || {}, secondaries: (lookup && lookup.secondaries) || {} };
    var h = ['<div class="bo">'];
    h.push('<div class="bo-title"><h1>' + esc(order.title) + "</h1>" + (order.subtitle ? "<p>" + esc(order.subtitle) + "</p>" : "") + "</div>");
    if (order.command.length) {
      h.push('<table class="bo-command"><tr><th colspan="2">COMMAND</th></tr>');
      order.command.forEach(function (c) { h.push('<tr><td class="l">' + esc(c.label) + '</td><td class="n">' + esc(c.name) + "</td></tr>"); });
      h.push("</table>");
    }
    h.push('<div class="bo-sections">');
    ordered(order.sections).forEach(function (o) {
      var s = o.section, col = colorInfo(s.color, o.index);
      h.push('<section class="bo-sec" data-depth="' + o.depth + '" style="--hd:' + col.header + ";--hdt:" + col.text + ";--tint:" + col.tint + '">');
      h.push("<header>" + esc(sectionTitle(s, o.index)) + "</header>");
      var info = ["<span>" + (s.type ? esc(s.type) + " \u00b7 " : "") + s.players.length + " " + (s.players.length > 1 ? T.players : T.player) + "</span>"];
      if (s.vehicles) info.push("<span>" + T.vehicles + esc(s.vehicles) + "</span>");
      if (o.parent) info.push("<span>" + T.reportsTo + esc(o.parent.name || o.parent.callsign || o.parent.team || o.parent.type) + "</span>");
      h.push('<div class="bo-info">' + info.join("") + "</div>");
      h.push('<table class="bo-rows">');
      s.players.forEach(function (p) {
        var lines = weaponsLine(p, lookup, order.showSecondary, lang);
        h.push("<tr><th>" + esc(kitLabel(p, lookup, lang)) + lines.map(function (l) { return "<small>" + esc(l) + "</small>"; }).join("") + "</th><td>" + esc(p.team || s.team) + "</td></tr>");
      });
      h.push("</table></section>");
    });
    h.push("</div></div>");
    return h.join("");
  }

  var THEME_LINKS = '<link rel="stylesheet" href="/fonts.css"><link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/theme-fnfl.css">';
  // otherHref : lien relatif vers la même page dans l'autre langue (rien si absent : aperçu de l'éditeur)
  function headerHtml(logo, lang, otherHref) {
    var T = L(lang), other = lang === "en" ? "fr" : "en";
    return '<header class="fn-head"><a href="https://fnfl.app/" target="_blank" rel="noopener noreferrer">' +
      (logo ? '<img src="/fnfl_flag_logo_roundel.png" width="44" height="44" alt="' + esc(T.logoAlt) + '"> ' : "") +
      '<span>3e RFM \u00b7 FNFL</span></a><span class="fn-sep">Battle order</span>' +
      (otherHref ? '<a class="fn-lang" href="' + esc(otherHref) + '" hreflang="' + other + '" lang="' + other + '" title="' + esc(T.otherLangTitle) + '">' + T.otherLang + "</a>" : "") + "</header>";
  }
  function footerHtml(lang) {
    var T = L(lang);
    return '<footer class="fn-foot">' + T.footer + '<a href="' + T.privacyHref + '" target="_blank" rel="noopener noreferrer">' + T.privacy + "</a></footer>";
  }

  // Page compl\u00e8te envoy\u00e9e par le serveur : aucun script, aucune ressource externe (feuilles de style, polices et logo sont servis par le site).
  function renderPage(order, lookup, meta) {
    meta = meta || {};
    var t = order.subtitle ? order.title + " \u2013 " + order.subtitle : order.title;
    var lang = meta.lang === "en" ? "en" : "fr", T = L(lang);
    var h = ['<!DOCTYPE html>\n<html lang="' + lang + '"><head><meta charset="utf-8">'];
    h.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
    h.push('<meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer">');
    h.push("<title>" + esc(t) + "</title>" + THEME_LINKS + "<style>" + CSS + "\n" + PAGE_CSS + "</style></head><body>");
    h.push(headerHtml(!!meta.logo, lang, meta.otherHref));
    if (meta.expiresText) {
      h.push('<div class="bo-expiry">' + fill(T.expiry, { d: esc(meta.expiresText), n: esc(String(meta.retentionDays || 30)) }) + "</div>");
    }
    h.push(renderBoard(order, lookup, lang));
    h.push('<div class="bo-foot">' + (meta.createdText ? fill(T.created, { d: esc(meta.createdText) }) : "") +
      (meta.id ? '<a href="/?from=' + esc(meta.id) + '">' + T.duplicate + "</a>" : "") + "</div>");
    h.push(footerHtml(lang));
    h.push("</body></html>\n");
    return h.join("");
  }

  return {
    TYPES: TYPES, ROLES: ROLES, PALETTE: PALETTE, LIMITS: LIMITS, CSS: CSS,
    colorInfo: colorInfo, clean: clean, esc: esc, ordered: ordered, sectionTitle: sectionTitle,
    normalize: normalize, renderBoard: renderBoard, renderPage: renderPage, dateFr: dateFr, dateText: dateText, headerHtml: headerHtml, footerHtml: footerHtml, LABELS: LABELS, M: M, colorName: colorName,
    kitLabel: kitLabel, weaponLabel: weaponLabel, isOther: isOther
  };
});
