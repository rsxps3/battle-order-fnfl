/* Battle Order : éditeur. Aucune dépendance : tout le texte saisi est inséré avec textContent. */
(function () {
  "use strict";

  var BO = window.BO;
  var LS_KEY = "bo-draft-v1";
  var COUNTS = []; for (var n = 1; n <= BO.LIMITS.maxPlayers; n++) COUNTS.push(n);

  var lookup = { kits: {}, weapons: {}, secondaries: {} };
  var lists = { kits: [], weapons: [], secondaries: [] };
  var config = { codeRequired: false, retentionDays: 30 };
  var state = null;
  var collapsed = {};      // identifiant de section -> carte repliée
  var otherMode = {};      // "identifiant:type" / "identifiant:role" -> texte libre choisi
  var previewTimer = null, saveTimer = null, toastTimer = null;
  var publishCode = "";
  var altOpen = new WeakSet();   // joueurs dont la liste « arme alternative » est affichée
  var hasLogo = false;           // le logo de l'unité est-il présent sur le serveur ?

  function $(sel) { return document.querySelector(sel); }
  function el(tag, props, kids) {
    var e = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === undefined || v === null || v === false) return;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, "");
      else e.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }

  // ---------- état ----------
  function uid() { return "s" + Math.random().toString(36).slice(2, 9); }
  function newPlayer() { return { kit: null, kitText: "", primary: null, primaryText: "", alt: null, altText: "", secondary: null, secondaryText: "", team: "" }; }
  function newSection() {
    var used = ((state && state.sections) || []).map(function (s) { return s.color; });
    var free = BO.PALETTE.filter(function (c) { return used.indexOf(c.key) < 0; });
    var color = (free.length ? free[0] : BO.PALETTE[used.length % BO.PALETTE.length]).key;
    var players = []; for (var i = 0; i < 6; i++) players.push(newPlayer());
    return { id: uid(), name: "", type: "Infantry", role: "Assault", callsign: "", team: "", color: color, vehicles: "", parent: null, players: players };
  }
  function defaultState() {
    state = { v: 1, title: "Battle order", subtitle: "", showSecondary: false, command: [{ label: "CMD", name: "" }], sections: [] };
    state.sections.push(newSection());
    return state;
  }
  function descendants(id) {
    var out = {}, queue = [id];
    while (queue.length) {
      var cur = queue.shift();
      state.sections.forEach(function (s) { if (s.parent === cur && !out[s.id]) { out[s.id] = true; queue.push(s.id); } });
    }
    return out;
  }
  function find(id) { for (var i = 0; i < state.sections.length; i++) if (state.sections[i].id === id) return state.sections[i]; return null; }
  function playerHasData(p) { return p.kit !== null || p.primary !== null || p.alt !== null || p.secondary !== null || p.team !== ""; }

  function setState(raw) {
    var r = BO.normalize(raw, lookup);
    if (!r.order.sections.length) r.order.sections.push(newSection());
    if (!r.order.command.length) r.order.command.push({ label: "CMD", name: "" });
    state = r.order;
    collapsed = {}; otherMode = {};
    syncGeneral(); renderCommand(); renderSections(); changed(); renderPreview();
  }

  // ---------- enregistrement local, aperçu ----------
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* stockage indisponible : ignoré */ } }, 400);
  }
  // L'aperçu est la page publiée elle-même, affichée dans un cadre (même charte, même arrière-plan).
  function renderPreview() {
    var r = BO.normalize(state, lookup), now = Date.now(), frame = $("#preview"), y = 0;
    try { y = frame.contentWindow.scrollY || 0; } catch (e) { y = 0; }
    frame.onload = function () { try { frame.contentWindow.scrollTo(0, y); } catch (e) { /* ignoré */ } };
    frame.srcdoc = BO.renderPage(r.order, lookup, {
      logo: hasLogo, createdText: BO.dateFr(now), retentionDays: config.retentionDays,
      expiresText: BO.dateFr(now + config.retentionDays * 86400000)
    });
  }
  function updateTitles() {
    BO.ordered(state.sections).forEach(function (o) {
      var card = document.querySelector('details[data-id="' + o.section.id + '"]');
      if (!card) return;
      card.querySelector(".stitle").textContent = BO.sectionTitle(o.section, o.index);
      var ni = card.querySelector("input[data-name]");
      if (ni) ni.placeholder = BO.sectionTitle(Object.assign({}, o.section, { name: "" }), o.index);
      card.querySelector(".dot").style.background = BO.colorInfo(o.section.color, o.index).header;
    });
  }
  function updateTeams() {
    var seen = {}, dl = $("#teams");
    state.sections.forEach(function (s) { if (s.team) seen[s.team] = true; s.players.forEach(function (p) { if (p.team) seen[p.team] = true; }); });
    dl.textContent = "";
    Object.keys(seen).sort().forEach(function (t) { dl.appendChild(el("option", { value: t })); });
  }
  function changed() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 120);
    updateTitles(); updateTeams(); scheduleSave();
  }
  function rebuild() { renderSections(); changed(); }

  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3500);
  }

  // ---------- champs généraux et commandement ----------
  function syncGeneral() {
    $("#f-title").value = state.title; $("#f-subtitle").value = state.subtitle; $("#f-secondary").checked = !!state.showSecondary;
  }
  function renderCommand() {
    var box = $("#command"); box.textContent = "";
    state.command.forEach(function (c, i) {
      box.appendChild(el("div", { class: "cmdrow" }, [
        el("input", { value: null, maxlength: BO.LIMITS.cmdLabel, placeholder: "CMD", "aria-label": "Fonction", "data-k": "label", "data-i": String(i) }),
        el("input", { maxlength: BO.LIMITS.cmdName, placeholder: "[FNFL] CV. Remzer", "aria-label": "Nom", "data-k": "name", "data-i": String(i) }),
        el("button", { type: "button", class: "small danger", "aria-label": "Supprimer cette ligne", text: "✕", onclick: function () { state.command.splice(i, 1); renderCommand(); changed(); } })
      ]));
    });
    Array.prototype.forEach.call(box.querySelectorAll("input"), function (inp) {
      var c = state.command[parseInt(inp.getAttribute("data-i"), 10)];
      inp.value = c[inp.getAttribute("data-k")];
      inp.addEventListener("input", function () { c[inp.getAttribute("data-k")] = inp.value; changed(); });
    });
  }

  // ---------- éléments de formulaire ----------
  function selectEl(options, value, onchange, label) {
    var s = el("select", { "aria-label": label || null });
    options.forEach(function (o) { s.appendChild(el("option", { value: o.value, text: o.label })); });
    s.value = value;
    if (s.value !== value) s.value = options[0].value;
    s.addEventListener("change", function () { onchange(s.value); });
    return s;
  }
  function listOptions(list, first, extra) {
    var o = [{ value: "", label: first }];
    list.forEach(function (x) { o.push({ value: String(x.id), label: x.nom }); });
    return extra ? o.concat(extra) : o;
  }
  function idOf(v) { return v === "" ? null : parseInt(v, 10); }

  // liste déroulante + zone de texte libre qui n'apparaît que pour « Autre »
  function withOther(map, getId, setId, getText, setText, options, label) {
    var input = el("input", { maxlength: BO.LIMITS.text, placeholder: "Préciser…", "aria-label": label + " (texte libre)" });
    input.value = getText();
    function show() { var id = getId(); input.hidden = !(id !== null && BO.isOther(map, id)); }
    var sel = selectEl(options, getId() === null ? "" : String(getId()), function (v) {
      setId(idOf(v));
      if (!(getId() !== null && BO.isOther(map, getId()))) setText("");
      input.value = getText(); show(); changed();
      if (!input.hidden) input.focus();
    }, label);
    input.addEventListener("input", function () { setText(input.value); changed(); });
    show();
    return [sel, input];
  }

  function field(label, control) { return el("label", {}, [label, control]); }
  function textField(label, value, max, placeholder, onchange) {
    var inp = el("input", { maxlength: max, placeholder: placeholder || null, autocomplete: "off" });
    inp.value = value;
    inp.addEventListener("input", function () { onchange(inp.value); changed(); });
    return field(label, inp);
  }
  // type / rôle : liste + texte libre au choix
  function choiceField(label, s, key, choices) {
    var mode = key + ":" + s.id;
    if (otherMode[mode] === undefined) otherMode[mode] = s[key] !== "" && choices.indexOf(s[key]) < 0;
    var options = choices.map(function (c) { return { value: c, label: c }; }).concat([{ value: "__other", label: "Autre…" }]);
    var input = el("input", { maxlength: BO.LIMITS[key], placeholder: "Texte au choix", "aria-label": label + " (texte libre)" });
    input.value = otherMode[mode] ? s[key] : "";
    input.hidden = !otherMode[mode];
    var sel = selectEl(options, otherMode[mode] ? "__other" : (choices.indexOf(s[key]) >= 0 ? s[key] : "__other"), function (v) {
      if (v === "__other") { otherMode[mode] = true; s[key] = input.value; input.hidden = false; input.focus(); }
      else { otherMode[mode] = false; s[key] = v; input.hidden = true; }
      changed();
    }, label);
    input.addEventListener("input", function () { s[key] = input.value; changed(); });
    return el("label", {}, [label, el("div", { class: "pair" }, [sel, input])]);
  }

  // ---------- sections ----------
  function renderSections() {
    var box = $("#sections"); box.textContent = "";
    BO.ordered(state.sections).forEach(function (o) { box.appendChild(buildSection(o)); });
  }

  function move(s, dir) {
    var sibs = state.sections.filter(function (x) { return (x.parent || null) === (s.parent || null); });
    var j = sibs.indexOf(s) + dir;
    if (j < 0 || j >= sibs.length) return;
    var a = state.sections.indexOf(s), b = state.sections.indexOf(sibs[j]);
    state.sections[a] = sibs[j]; state.sections[b] = s;
    rebuild();
  }
  function duplicate(s) {
    var copy = JSON.parse(JSON.stringify(s));
    copy.id = uid();
    state.sections.splice(state.sections.indexOf(s) + 1, 0, copy);
    rebuild();
  }
  function remove(s, i) {
    if (!confirm("Supprimer la section « " + BO.sectionTitle(s, i) + " » ?")) return;
    state.sections.forEach(function (x) { if (x.parent === s.id) x.parent = s.parent; }); // ses sections dépendantes remontent d'un niveau
    state.sections.splice(state.sections.indexOf(s), 1);
    if (!state.sections.length) state.sections.push(newSection());
    rebuild();
  }
  function setPlayerCount(s, n) {
    if (n < s.players.length) {
      var lost = s.players.slice(n).filter(playerHasData).length;
      if (lost && !confirm(lost + " joueur(s) déjà renseigné(s) seront retirés de cette section. Continuer ?")) return false;
      s.players.length = n;
    } else {
      while (s.players.length < n) s.players.push(newPlayer());
    }
    return true;
  }

  function buildSection(o) {
    var s = o.section, idx = o.index;
    var col = BO.colorInfo(s.color, idx);
    var details = el("details", { class: "card sec", "data-id": s.id, open: !collapsed[s.id] });
    details.style.marginLeft = Math.min(o.depth, 5) * 18 + "px";
    details.addEventListener("toggle", function () { collapsed[s.id] = !details.open; });
    details.appendChild(el("summary", {}, [
      el("span", { class: "dot", style: "background:" + col.header }),
      el("span", { class: "stitle", text: BO.sectionTitle(s, idx) })
    ]));

    var grid = el("div", { class: "grid" });
    var nameInput = el("input", { maxlength: BO.LIMITS.name, autocomplete: "off", "data-name": s.id, placeholder: BO.sectionTitle(Object.assign({}, s, { name: "" }), idx) });
    nameInput.value = s.name || "";
    nameInput.addEventListener("input", function () { s.name = nameInput.value; changed(); });
    grid.appendChild(el("label", { class: "wide" }, ["Nom de la section (facultatif)", nameInput]));
    grid.appendChild(choiceField("Type", s, "type", BO.TYPES));
    grid.appendChild(choiceField("Rôle", s, "role", BO.ROLES));
    grid.appendChild(textField("Callsign", s.callsign, BO.LIMITS.callsign, "ex. RED", function (v) { s.callsign = v; }));
    grid.appendChild(textField("Équipe associée", s.team, BO.LIMITS.team, "ex. 1ID ou [FNFL]", function (v) { s.team = v; }));
    grid.appendChild(field("Nombre de joueurs", selectEl(COUNTS.map(function (n) { return { value: String(n), label: String(n) }; }), String(s.players.length), function (v) {
      if (setPlayerCount(s, parseInt(v, 10))) rebuild(); else renderSections();
    }, "Nombre de joueurs")));
    grid.appendChild(textField("Véhicules associés", s.vehicles, BO.LIMITS.vehicles, "ex. 2x Halftrack", function (v) { s.vehicles = v; }));
    var banned = descendants(s.id); banned[s.id] = true;
    var parents = [{ value: "", label: "— aucune (section de premier niveau)" }];
    state.sections.forEach(function (x, i) { if (!banned[x.id]) parents.push({ value: x.id, label: BO.sectionTitle(x, i) }); });
    grid.appendChild(field("Dépend de", selectEl(parents, s.parent || "", function (v) { s.parent = v || null; rebuild(); }, "Section dont celle-ci dépend")));
    details.appendChild(grid);

    var sw = el("div", { class: "swatches", role: "group", "aria-label": "Couleur" });
    BO.PALETTE.forEach(function (c) {
      sw.appendChild(el("button", {
        type: "button", class: "sw", title: c.name, "aria-label": c.name, "aria-pressed": String(s.color === c.key), style: "background:" + c.header,
        onclick: function () { s.color = c.key; rebuild(); }
      }));
    });
    details.appendChild(el("div", {}, [el("span", { class: "note", text: "Couleur" }), sw]));

    var acts = el("div", { class: "secactions" }, [
      el("button", { type: "button", class: "small", text: "▲ Monter", onclick: function () { move(s, -1); } }),
      el("button", { type: "button", class: "small", text: "▼ Descendre", onclick: function () { move(s, 1); } }),
      el("button", { type: "button", class: "small", text: "Dupliquer", onclick: function () { duplicate(s); } }),
      el("button", { type: "button", class: "small danger", text: "Supprimer", onclick: function () { remove(s, idx); } })
    ]);
    details.appendChild(acts);

    var head = el("tr", {}, [el("th", { text: "#" }), el("th", { text: "Kit" }), el("th", { text: "Arme principale" })]);
    if (state.showSecondary) head.appendChild(el("th", { text: "Arme secondaire" }));
    head.appendChild(el("th", { text: "Équipe" }));
    var table = el("table", { class: "players" }, [el("thead", {}, [head])]);
    var body = el("tbody");
    s.players.forEach(function (p, i) { body.appendChild(playerRow(s, p, i)); });
    table.appendChild(body);
    details.appendChild(table);
    return details;
  }

  function playerRow(s, p, i) {
    var tr = el("tr");
    tr.appendChild(el("td", { class: "n", text: String(i + 1) }));

    var kitOpts = listOptions(lists.kits, "—", [{ value: "-1", label: "Autre…" }]);
    var kit = withOther(lookup.kits, function () { return p.kit; }, function (v) { p.kit = v; }, function () { return p.kitText; }, function (v) { p.kitText = v; }, kitOpts, "Kit du joueur " + (i + 1));
    tr.appendChild(el("td", { "data-l": "Kit" }, kit));

    var wOpts = listOptions(lists.weapons, "—");
    var main = withOther(lookup.weapons, function () { return p.primary; }, function (v) { p.primary = v; }, function () { return p.primaryText; }, function (v) { p.primaryText = v; }, wOpts, "Arme principale du joueur " + (i + 1));
    var cell = el("td", { "data-l": "Arme principale" }, main);
    if (p.alt === null && !altOpen.has(p)) {
      cell.appendChild(el("button", { type: "button", class: "small ghost", text: "+ arme alternative", onclick: function () { altOpen.add(p); renderSections(); } }));
    } else {
      var altOpts = listOptions(lists.weapons, "(aucune)");
      var alt = withOther(lookup.weapons, function () { return p.alt; }, function (v) { p.alt = v; }, function () { return p.altText; }, function (v) { p.altText = v; }, altOpts, "Arme alternative du joueur " + (i + 1));
      cell.appendChild(el("div", { class: "altrow" }, [alt[0], el("button", { type: "button", class: "small danger", "aria-label": "Retirer l'arme alternative", text: "✕", onclick: function () { p.alt = null; p.altText = ""; altOpen.delete(p); rebuild(); } })]));
      cell.appendChild(alt[1]);
    }
    tr.appendChild(cell);

    if (state.showSecondary) {
      var sec = withOther(lookup.secondaries, function () { return p.secondary; }, function (v) { p.secondary = v; }, function () { return p.secondaryText; }, function (v) { p.secondaryText = v; }, listOptions(lists.secondaries, "—"), "Arme secondaire du joueur " + (i + 1));
      tr.appendChild(el("td", { "data-l": "Arme secondaire" }, sec));
    }

    var team = el("input", { maxlength: BO.LIMITS.team, list: "teams", placeholder: s.team || "équipe", autocomplete: "off", "aria-label": "Équipe du joueur " + (i + 1) });
    team.value = p.team;
    team.addEventListener("input", function () { p.team = team.value; changed(); });
    tr.appendChild(el("td", { "data-l": "Équipe" }, [team]));
    return tr;
  }

  // ---------- fenêtre de dialogue ----------
  function showModal(title, bodyNodes, buttons) {
    $("#modal-title").textContent = title;
    var body = $("#modal-body"); body.textContent = "";
    bodyNodes.forEach(function (n) { body.appendChild(n); });
    var acts = $("#modal-actions"); acts.textContent = "";
    buttons.forEach(function (b) { acts.appendChild(el("button", { type: "button", class: b.primary ? "primary" : "", text: b.label, onclick: b.onclick })); });
    $("#modal").hidden = false;
    var first = body.querySelector("input") || acts.querySelector("button.primary") || acts.querySelector("button");
    if (first) first.focus();
  }
  function closeModal() { $("#modal").hidden = true; }

  function errorList(items) { return el("ul", {}, items.map(function (t) { return el("li", { text: t }); })); }

  function askPublish() {
    var r = BO.normalize(state, lookup);
    if (r.errors.length) {
      showModal("À corriger avant de générer le lien", [el("p", { text: "Le battle order contient des éléments à corriger :" }), errorList(r.errors)], [{ label: "Fermer", primary: true, onclick: closeModal }]);
      return;
    }
    var codeInput = el("input", { type: "password", placeholder: "Code de publication", autocomplete: "off", "aria-label": "Code de publication" });
    codeInput.value = publishCode;
    var body = [
      el("p", { text: "Une page en lecture seule va être créée, avec un lien à partager." }),
      el("p", { class: "warn", text: "Cette page sera supprimée automatiquement " + config.retentionDays + " jours après sa création." })
    ];
    if (config.codeRequired) body.push(el("p", { class: "note", text: "Un code de publication est nécessaire :" }), codeInput);
    showModal("Générer le lien", body, [
      { label: "Annuler", onclick: closeModal },
      { label: "Générer le lien", primary: true, onclick: function () { publishCode = codeInput.value; doPublish(r.order); } }
    ]);
  }

  function doPublish(order) {
    showModal("Génération en cours…", [el("p", { class: "note", text: "Merci de patienter." })], []);
    fetch("api/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: order, code: publishCode }) })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { status: res.status, json: j }; }); })
      .then(function (r) {
        if (r.status === 200) return showResult(r.json);
        var msg = r.json.message || ({ invalid: "Le serveur a refusé ce battle order.", rate: "Trop de publications récentes.", full: "Le serveur est plein.", code: "Code de publication incorrect." })[r.json.error] || ("Erreur " + r.status + ".");
        var nodes = [el("p", { class: "err", text: msg })];
        if (r.json.details && r.json.details.length) nodes.push(errorList(r.json.details));
        showModal("Impossible de générer le lien", nodes, [{ label: r.json.error === "code" ? "Saisir à nouveau le code" : "Fermer", primary: true, onclick: r.json.error === "code" ? askPublish : closeModal }]);
      })
      .catch(function () {
        showModal("Impossible de générer le lien", [el("p", { class: "err", text: "Le serveur ne répond pas. Vérifie ta connexion et réessaie." })], [{ label: "Fermer", primary: true, onclick: closeModal }]);
      });
  }

  function showResult(j) {
    var link = el("input", { type: "text", readonly: true, "aria-label": "Lien à partager" });
    link.value = j.url;
    showModal("Lien prêt", [
      el("p", { text: "Partage ce lien :" }), link,
      el("p", { class: "warn", text: "Cette page sera supprimée automatiquement le " + j.expiresText + " (" + config.retentionDays + " jours après sa création)." }),
      el("p", { class: "note", text: "Pense à exporter ton battle order si tu veux le garder au-delà, ou utilise « Dupliquer » depuis la page publiée." })
    ], [
      { label: "Copier le lien", onclick: function () { copy(link); } },
      { label: "Ouvrir", onclick: function () { window.open(j.url, "_blank", "noopener"); } },
      { label: "Fermer", primary: true, onclick: closeModal }
    ]);
    link.select();
  }
  function copy(input) {
    input.select();
    var done = function () { toast("Lien copié"); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(input.value).then(done, function () { try { document.execCommand("copy"); done(); } catch (e) { /* copie manuelle */ } });
    else { try { document.execCommand("copy"); done(); } catch (e) { /* copie manuelle */ } }
  }

  // ---------- import / export ----------
  function exportJson() {
    var r = BO.normalize(state, lookup);
    var blob = new Blob([JSON.stringify(r.order, null, 1)], { type: "application/json" });
    var a = el("a", { href: URL.createObjectURL(blob), download: "battle-order-" + new Date().toISOString().slice(0, 10) + ".json" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function importFile(file) {
    if (!file) return;
    if (file.size > 400 * 1024) { toast("Fichier trop volumineux"); return; }
    var fr = new FileReader();
    fr.onload = function () {
      var raw;
      try { raw = JSON.parse(fr.result); } catch (e) { toast("Ce fichier n'est pas un battle order valide"); return; }
      if (!raw || !Array.isArray(raw.sections) || !raw.sections.length) { toast("Ce fichier ne contient aucune section"); return; }
      if (!confirm("Remplacer le battle order en cours par celui du fichier ?")) return;
      setState(raw);
      toast("Battle order importé");
    };
    fr.readAsText(file);
  }

  // ---------- démarrage ----------
  function loadJson(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(url); return r.json(); });
  }
  function listFrom(j, key) {
    var arr = Array.isArray(j) ? j : (Array.isArray(j[key]) ? j[key] : []);
    return arr.filter(function (x) { return x && Number.isInteger(x.id) && typeof x.nom === "string"; });
  }

  function init() {
    var probe = new Image();
    probe.onload = function () { hasLogo = true; if (state) renderPreview(); };
    probe.src = "/fnfl_flag_logo_roundel.png";
    Promise.all([loadJson("kits.json"), loadJson("weapons.json"), loadJson("secondaries.json")]).then(function (res) {
      lists.kits = listFrom(res[0], "kits"); lists.weapons = listFrom(res[1], "weapons"); lists.secondaries = listFrom(res[2], "secondaries");
      ["kits", "weapons", "secondaries"].forEach(function (k) { lookup[k] = {}; lists[k].forEach(function (x) { lookup[k][x.id] = x.nom; }); });
      return fetch("api/config").then(function (r) { return r.json(); }).then(function (c) { config = Object.assign(config, c); }).catch(function () { /* éditeur utilisable sans serveur : seule la publication échouera */ });
    }).then(start).catch(function () {
      $("#sections").appendChild(el("p", { class: "err", text: "Impossible de charger les listes (kits, armes). Recharge la page." }));
    });
  }

  function start() {
    $("#f-title").addEventListener("input", function (e) { state.title = e.target.value; changed(); });
    $("#f-subtitle").addEventListener("input", function (e) { state.subtitle = e.target.value; changed(); });
    $("#f-secondary").addEventListener("change", function (e) { state.showSecondary = e.target.checked; rebuild(); });
    $("#btn-add-cmd").addEventListener("click", function () {
      if (state.command.length >= BO.LIMITS.maxCommand) { toast("Maximum " + BO.LIMITS.maxCommand + " lignes"); return; }
      state.command.push({ label: "", name: "" }); renderCommand(); changed();
    });
    $("#btn-add-section").addEventListener("click", function () {
      if (state.sections.length >= BO.LIMITS.maxSections) { toast("Maximum " + BO.LIMITS.maxSections + " sections"); return; }
      var s = newSection(); state.sections.push(s); rebuild();
      var card = document.querySelector('details[data-id="' + s.id + '"]');
      if (card && card.scrollIntoView) card.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    $("#btn-new").addEventListener("click", function () { if (confirm("Effacer le battle order en cours et repartir de zéro ?")) { defaultState(); syncGeneral(); collapsed = {}; otherMode = {}; renderCommand(); renderSections(); changed(); } });
    $("#btn-export").addEventListener("click", exportJson);
    $("#btn-import").addEventListener("click", function () { $("#file").click(); });
    $("#file").addEventListener("change", function (e) { importFile(e.target.files[0]); e.target.value = ""; });
    $("#btn-publish").addEventListener("click", askPublish);
    $("#modal").addEventListener("click", function (e) { if (e.target === $("#modal")) closeModal(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });

    var from = (new URLSearchParams(location.search).get("from") || "");
    if (/^[a-z0-9]{12}$/.test(from)) {
      defaultState();
      loadJson("o/" + from + "/data.json").then(function (raw) { setState(raw); toast("Battle order chargé : tu peux le modifier puis générer un nouveau lien."); })
        .catch(function () { toast("Impossible de charger ce battle order (page supprimée ?)"); })
        .then(function () { history.replaceState(null, "", location.pathname); });
      syncGeneral(); renderCommand(); renderSections(); changed(); renderPreview();
      return;
    }
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) { saved = null; }
    if (saved && Array.isArray(saved.sections) && saved.sections.length) setState(saved);
    else { defaultState(); syncGeneral(); renderCommand(); renderSections(); changed(); renderPreview(); }
  }

  init();
})();
