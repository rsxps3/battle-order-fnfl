/* Battle Order : traduction FR / EN de l'éditeur. Le texte français sert de clé : tr("Annuler") -> « Cancel » en anglais.
   Variables : {nom}. Un texte absent du dictionnaire est rendu tel quel. Changer de langue recharge la page (le brouillon est déjà enregistré). */
(function (root) {
  "use strict";
  var KEY = "bo-lang";
  var lang = "fr";
  try {
    var v = localStorage.getItem(KEY);
    if (v === "en" || v === "fr") lang = v;
    else lang = String(navigator.language || "fr").toLowerCase().indexOf("fr") === 0 ? "fr" : "en";
  } catch (e) { lang = String(navigator.language || "fr").toLowerCase().indexOf("fr") === 0 ? "fr" : "en"; }

  var EN = {
    "Battle order – éditeur": "Battle order – editor", "éditeur": "editor", "Les pages publiées sont supprimées automatiquement après 30 jours.": "Published pages are deleted automatically after 30 days.",
    "Nouveau": "New", "Importer": "Import", "Exporter": "Export", "Générer le lien": "Generate link", "Général": "General", "Titre": "Title", "Sous-titre (opération, carte…)": "Subtitle (operation, map…)",
    "Afficher les armes secondaires": "Show secondary weapons", "Commandement": "Command", "+ Ajouter une ligne": "+ Add a line", "+ Ajouter une section": "+ Add a section",
    "Aperçu": "Preview", "Édition": "Editing", "Aperçu du battle order": "Battle order preview", "Fonction": "Function", "Nom": "Name", "Supprimer cette ligne": "Delete this line",
    "Préciser…": "Specify…", "texte libre": "free text", "Autre…": "Other…", "Autre": "Other", "Texte au choix": "Free text",
    "Supprimer la section « {name} » ?": "Delete the section “{name}”?", "{n} joueur(s) déjà renseigné(s) seront retirés de cette section. Continuer ?": "{n} player(s) already filled in will be removed from this section. Continue?",
    "Nom de la section (facultatif)": "Section name (optional)", "Type": "Type", "Rôle": "Role", "Callsign": "Callsign", "ex. RED": "e.g. RED", "Équipe associée": "Associated team", "ex. 1ID ou [FNFL]": "e.g. 1ID or [FNFL]",
    "Nombre de joueurs": "Number of players", "Véhicules associés": "Associated vehicles", "ex. 2x Halftrack": "e.g. 2x Halftrack", "— aucune (section de premier niveau)": "— none (top-level section)",
    "Dépend de": "Depends on", "Section dont celle-ci dépend": "Section this one depends on", "Couleur": "Colour", "▲ Monter": "▲ Move up", "▼ Descendre": "▼ Move down", "Dupliquer": "Duplicate", "Supprimer": "Delete",
    "Kit": "Kit", "Arme principale": "Primary weapon", "Arme secondaire": "Secondary weapon", "Équipe": "Team", "équipe": "team",
    "Kit du joueur {n}": "Player {n} kit", "Arme principale du joueur {n}": "Player {n} primary weapon", "Arme alternative du joueur {n}": "Player {n} alternative weapon", "Arme secondaire du joueur {n}": "Player {n} secondary weapon", "Équipe du joueur {n}": "Player {n} team",
    "+ arme alternative": "+ alternative weapon", "Retirer l'arme alternative": "Remove the alternative weapon",
    "À corriger avant de générer le lien": "To fix before generating the link", "Le battle order contient des éléments à corriger :": "The battle order contains items to fix:", "Fermer": "Close", "Annuler": "Cancel",
    "Code de publication": "Publishing code", "Une page en lecture seule va être créée, avec un lien à partager.": "A read-only page will be created, with a link to share.",
    "Cette page sera supprimée automatiquement {n} jours après sa création.": "This page will be deleted automatically {n} days after it is created.", "Un code de publication est nécessaire :": "A publishing code is required:",
    "Génération en cours…": "Generating…", "Merci de patienter.": "Please wait.", "Le serveur a refusé ce battle order.": "The server rejected this battle order.", "Trop de publications récentes.": "Too many recent publications.",
    "Le serveur est plein.": "The server is full.", "Code de publication incorrect.": "Incorrect publishing code.", "Erreur {n}.": "Error {n}.", "Impossible de générer le lien": "Cannot generate the link", "Saisir à nouveau le code": "Enter the code again",
    "Le serveur ne répond pas. Vérifie ta connexion et réessaie.": "The server is not responding. Check your connection and try again.", "Lien à partager": "Link to share", "Lien prêt": "Link ready", "Partage ce lien :": "Share this link:",
    "Cette page sera supprimée automatiquement le {d} ({n} jours après sa création).": "This page will be deleted automatically on {d} ({n} days after it was created).",
    "Pense à exporter ton battle order si tu veux le garder au-delà, ou utilise « Dupliquer » depuis la page publiée.": "Remember to export your battle order if you want to keep it beyond that, or use “Duplicate” from the published page.",
    "Version anglaise (lien direct) :": "English version (direct link):", "Version française (lien direct) :": "French version (direct link):",
    "Copier le lien": "Copy the link", "Ouvrir": "Open", "Lien copié": "Link copied", "Fichier trop volumineux": "File too large", "Ce fichier n'est pas un battle order valide": "This file is not a valid battle order",
    "Ce fichier ne contient aucune section": "This file contains no section", "Remplacer le battle order en cours par celui du fichier ?": "Replace the current battle order with the one in the file?", "Battle order importé": "Battle order imported",
    "Impossible de charger les listes (kits, armes). Recharge la page.": "Cannot load the lists (kits, weapons). Reload the page.", "Maximum {n} sections": "Maximum {n} sections", "Maximum {n} lignes": "Maximum {n} lines",
    "Effacer le battle order en cours et repartir de zéro ?": "Clear the current battle order and start over?", "Battle order chargé : tu peux le modifier puis générer un nouveau lien.": "Battle order loaded: you can edit it and then generate a new link.",
    "Impossible de charger ce battle order (page supprimée ?)": "Cannot load this battle order (page deleted?)", "Passer en français": "Switch to French", "Switch to English": "Switch to English"
  };

  function t(fr, vars) {
    var s = fr;
    if (lang === "en" && typeof fr === "string" && Object.prototype.hasOwnProperty.call(EN, fr)) s = EN[fr];
    if (vars && typeof s === "string") s = s.replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m; });
    return s;
  }
  function applyStatic() {
    Array.prototype.forEach.call(document.querySelectorAll("body *, title"), function (e) {
      if (e.children.length === 0 && e.textContent.trim() && !/^(SCRIPT|STYLE)$/.test(e.tagName)) { var k = e.textContent.trim(), tr = t(k); if (tr !== k) e.textContent = e.textContent.replace(k, tr); }
      ["title", "aria-label", "placeholder", "alt"].forEach(function (a) { var v = e.getAttribute && e.getAttribute(a); if (v) { var tr = t(v); if (tr !== v) e.setAttribute(a, tr); } });
    });
    document.documentElement.lang = lang;
    var ti = t(document.title); if (ti !== document.title) document.title = ti;
  }
  root.I18N = {
    t: t, applyStatic: applyStatic, EN: EN,
    getLang: function () { return lang; },
    setLang: function (l) { lang = l === "en" ? "en" : "fr"; try { localStorage.setItem(KEY, lang); } catch (e) { /* stockage indisponible : la langue ne sera pas retenue */ } }
  };
})(window);
