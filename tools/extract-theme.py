#!/usr/bin/env python3
"""
Reprend l'arrière-plan de fnfl.app pour Battle Order.

Lit les feuilles de style (et les blocs <style>) du site de l'unité, repère les règles qui
habillent la page (html, body, :root et leurs pseudo-éléments ::before / ::after), en retire
les réglages d'arrière-plan, la couleur du texte et les variables CSS dont ils dépendent,
copie les images locales utilisées, et écrit <sortie>/theme-fnfl.css.
Les images hébergées ailleurs (http://, https://) ne sont jamais reprises : cela enverrait l'adresse IP
des visiteurs à un tiers.

Usage :
  python3 extract-theme.py [--site /var/www/fnfl] [--out /var/www/battle-order]
                           [--selector ".hero"] [--dry-run]
  --selector  ajoute une règle de votre site (par son sélecteur exact) à ce qui est repris, comme si
              elle s'appliquait à <body> ; utile si l'arrière-plan est posé sur un conteneur.
Code de sortie : 0 = thème écrit, 3 = aucun arrière-plan trouvé (rien n'est écrit), 1 = erreur.
"""
import argparse
import datetime
import os
import re
import shutil
import sys

DECOR = {"content", "position", "inset", "top", "right", "bottom", "left", "width", "height", "min-width", "min-height",
         "max-width", "max-height", "z-index", "pointer-events", "opacity", "filter", "backdrop-filter", "mix-blend-mode", "transform"}
PAGE_SEL = re.compile(r"^(?:html|body|:root)(?:\s+body)?$|^(?:html|body)(?:\.[\w-]+)+$", re.I)
PSEUDO_SEL = re.compile(r"^(html|body|:root)::?(before|after)$", re.I)


def strip_comments(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def scan(css, start, stops):
    """Avance jusqu'à l'un des caractères de `stops` hors chaînes et parenthèses ; renvoie sa position (ou len)."""
    i, n, quote, paren = start, len(css), None, 0
    while i < n:
        c = css[i]
        if quote:
            if c == "\\":
                i += 1
            elif c == quote:
                quote = None
        elif c in "\"'":
            quote = c
        elif c == "(":
            paren += 1
        elif c == ")":
            paren = max(0, paren - 1)
        elif paren == 0 and c in stops:
            return i
        i += 1
    return n


def parse_rules(css):
    """Règles de premier niveau [(sélecteur, corps)] ; les règles @ (@media, @font-face...) sont ignorées."""
    out, i, n = [], 0, len(css)
    while i < n:
        j = scan(css, i, "{;")
        if j >= n:
            break
        prelude = css[i:j].strip()
        if css[j] == ";":
            i = j + 1
            continue
        depth, k, quote = 1, j + 1, None
        while k < n and depth:
            c = css[k]
            if quote:
                if c == "\\":
                    k += 1
                elif c == quote:
                    quote = None
            elif c in "\"'":
                quote = c
            elif c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
            k += 1
        if prelude and not prelude.startswith("@"):
            out.append((prelude, css[j + 1:k - 1]))
        i = k
    return out


def parse_decls(body):
    decls, i, n = [], 0, len(body)
    while i < n:
        j = scan(body, i, ";")
        chunk = body[i:j].strip()
        if ":" in chunk:
            prop, value = chunk.split(":", 1)
            prop, value = prop.strip().lower(), value.strip()
            if prop and value:
                decls.append((prop, value))
        i = j + 1
    return decls


def norm_sel(sel):
    return re.sub(r"\s+", " ", sel.strip())


class Theme:
    def __init__(self):
        self.vars = {}        # définitions --x (la dernière gagne)
        self.rules = {}       # clé de sélecteur -> liste ordonnée de (propriété, valeur, dossier de la feuille)
        self.warnings = []
        self.candidates = []  # (fichier, sélecteur) ayant un arrière-plan : aide quand rien n'est trouvé

    def add(self, key, prop, value, base):
        lst = self.rules.setdefault(key, [])
        lst[:] = [d for d in lst if d[0] != prop]   # un même réglage plus loin dans la feuille remplace le précédent
        lst.append((prop, value, base))


def collect(theme, css, base, source, extra_selectors):
    for prelude, body in parse_rules(strip_comments(css)):
        decls = parse_decls(body)
        for raw in prelude.split(","):
            sel = norm_sel(raw)
            if not sel:
                continue
            is_extra = sel in extra_selectors
            m = PSEUDO_SEL.match(sel)
            if m:
                key = ("html" if m.group(1).lower() == ":root" else m.group(1).lower()) + "::" + m.group(2).lower()
                for prop, value in decls:
                    if prop.startswith("background") or prop in DECOR:
                        theme.add(key, prop, value, base)
                continue
            if sel.lower() in (":root", "html", "body") or PAGE_SEL.match(sel) or is_extra:
                low = sel.lower()
                key = "body" if (is_extra or low.startswith("body") or low == "html body") else "html"
                if low.startswith("html.") or low == "html":
                    key = "html"
                for prop, value in decls:
                    if prop.startswith("--"):
                        theme.vars[prop] = (value, base)
                    elif prop.startswith("background") or prop in ("color", "color-scheme"):
                        theme.add(key, prop, value, base)
            elif any(p.startswith("background") for p, _ in decls):
                theme.candidates.append((source, sel))


def referenced_vars(value):
    return re.findall(r"var\(\s*(--[\w-]+)", value)


def main():
    ap = argparse.ArgumentParser(description="Reprend l'arrière-plan de fnfl.app pour Battle Order")
    ap.add_argument("--site", default="/var/www/fnfl")
    ap.add_argument("--out", default="/var/www/battle-order")
    ap.add_argument("--selector", action="append", default=[])
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    site = os.path.abspath(a.site)
    if not os.path.isdir(site):
        print("Dossier du site introuvable : " + site)
        return 1
    extra = {norm_sel(s) for s in a.selector}

    # feuilles à lire : celles que la page d'accueil référence, les blocs <style>, puis les .css présents à la racine
    sheets, seen = [], set()
    index = os.path.join(site, "index.html")
    html = open(index, encoding="utf-8", errors="replace").read() if os.path.isfile(index) else ""
    for href in re.findall(r"<link\b[^>]*rel=[\"']?stylesheet[\"']?[^>]*>", html, flags=re.I):
        m = re.search(r"href=[\"']([^\"']+)[\"']", href, flags=re.I)
        if not m:
            continue
        h = m.group(1).split("?")[0].split("#")[0]
        if re.match(r"^(?:https?:)?//", h):
            continue   # feuille externe (polices Google...) : jamais reprise
        path = os.path.join(site, h.lstrip("/")) if h.startswith("/") else os.path.join(site, h)
        if os.path.isfile(path) and path not in seen:
            seen.add(path)
            sheets.append((path, open(path, encoding="utf-8", errors="replace").read(), os.path.dirname(path)))
    for blk in re.findall(r"<style\b[^>]*>(.*?)</style>", html, flags=re.S | re.I):
        sheets.append((index + " (bloc <style>)", blk, site))
    for name in sorted(os.listdir(site)):
        path = os.path.join(site, name)
        if name.lower().endswith(".css") and os.path.isfile(path) and path not in seen:
            seen.add(path)
            sheets.append((path, open(path, encoding="utf-8", errors="replace").read(), site))
    if not sheets:
        print("Aucune feuille de style trouvée dans " + site)
        return 3

    theme = Theme()
    for path, css, base in sheets:
        collect(theme, css, base, os.path.basename(path), extra)

    has_bg = any(p.startswith("background") for lst in theme.rules.values() for p, _, _ in lst)
    if not has_bg:
        print("Aucun arrière-plan trouvé sur html, body ou :root dans " + str(len(sheets)) + " feuille(s) de style.")
        if theme.candidates:
            print("Sélecteurs qui définissent un arrière-plan (relance avec --selector \"...\" pour en reprendre un) :")
            shown = set()
            for src, sel in theme.candidates:
                if (src, sel) not in shown and len(shown) < 10:
                    shown.add((src, sel))
                    print("   " + sel + "    (" + src + ")")
        return 3

    # variables nécessaires (transitivement) aux réglages repris
    needed, queue = {}, []
    for lst in theme.rules.values():
        for _, value, _ in lst:
            queue += referenced_vars(value)
    while queue:
        v = queue.pop()
        if v in needed:
            continue
        if v in theme.vars:
            needed[v] = theme.vars[v]
            queue += referenced_vars(theme.vars[v][0])
        else:
            theme.warnings.append("la variable " + v + " n'est définie nulle part : la valeur de repli éventuelle sera utilisée")

    # images : copie des fichiers locaux, refus des images externes
    assets_dir = os.path.join(a.out, "assets", "theme")
    copied = {}

    def fix_urls(value, base, context):
        """Renvoie (valeur, ok) ; ok=False si la déclaration doit être abandonnée."""
        ok = True

        def sub(m):
            nonlocal ok
            raw = m.group(2).strip()
            if raw.startswith("data:") or raw.startswith("#"):
                return m.group(0)
            if re.match(r"^(?:https?:)?//", raw):
                theme.warnings.append(context + " : image externe ignorée (" + raw + ") : elle enverrait l'adresse IP des visiteurs à un tiers")
                ok = False
                return m.group(0)
            clean = raw.split("?")[0].split("#")[0]
            src = os.path.join(site, clean.lstrip("/")) if clean.startswith("/") else os.path.join(base, clean)
            src = os.path.normpath(src)
            if not os.path.isfile(src):
                theme.warnings.append(context + " : fichier introuvable (" + raw + ")")
                ok = False
                return m.group(0)
            if src not in copied:
                name = re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(src)) or "image"
                final, i = name, 1
                while final in copied.values():
                    final = str(i) + "-" + name
                    i += 1
                copied[src] = final
            return "url(\"/assets/theme/" + copied[src] + "\")"
        return re.sub(r"url\(\s*(['\"]?)(.*?)\1\s*\)", sub, value), ok

    out = ["/* Généré par tools/extract-theme.py à partir de " + site + " le " + datetime.date.today().isoformat() +
           ". Ne pas modifier à la main : relancer l'outil (ou vider ce fichier pour revenir aux valeurs par défaut). */"]
    var_lines = []
    for v, (value, base) in needed.items():
        fixed, ok = fix_urls(value, base, v)
        if ok:
            var_lines.append("  " + v + ": " + fixed + ";")
    fg = None
    for key in ("body", "html"):
        for prop, value, base in theme.rules.get(key, []):
            if prop == "color":
                fg = value
    if fg:
        var_lines.append("  --bo-fg: " + fg + ";")
    # l'arrière-plan repris remplace --bo-bg quand c'est une couleur unie
    if var_lines:
        out.append(":root{\n" + "\n".join(var_lines) + "\n}")
    order = ["html", "body", "html::before", "html::after", "body::before", "body::after"]
    kept = 0
    # les réglages par défaut de theme.css sont d'abord effacés pour que l'arrière-plan repris s'applique seul
    has = {k: any(p.startswith("background") for p, _, _ in theme.rules.get(k, [])) for k in order}
    for key in order:
        lines = []
        if key in ("html", "body") and (has["html"] or has["body"]) and (has[key] or key == "html"):
            lines.append("  background: none;")
        for prop, value, base in theme.rules.get(key, []):
            if prop == "color":
                continue
            fixed, ok = fix_urls(value, base, key + " { " + prop + " }")
            if ok:
                lines.append("  " + prop + ": " + fixed + ";")
                if prop.startswith("background"):
                    kept += 1
        if lines:
            out.append(key + "{\n" + "\n".join(lines) + "\n}")
    if not kept:
        print("L'arrière-plan trouvé n'est pas reprenable (voir les avertissements ci-dessous).")
        for w in theme.warnings:
            print("   - " + w)
        return 3
    css_text = "\n".join(out) + "\n"

    print("Feuilles lues : " + ", ".join(os.path.basename(s[0]) for s in sheets))
    print("Réglages d'arrière-plan repris : " + str(kept) + " ; variables CSS reprises : " + str(len(needed)) + " ; images copiées : " + str(len(copied)))
    for w in theme.warnings:
        print("   attention : " + w)
    if a.dry_run:
        print("--- theme-fnfl.css (essai, rien n'est écrit) ---")
        print(css_text)
        return 0
    os.makedirs(a.out, exist_ok=True)
    if copied:
        os.makedirs(assets_dir, exist_ok=True)
        for src, name in copied.items():
            shutil.copyfile(src, os.path.join(assets_dir, name))
    target = os.path.join(a.out, "theme-fnfl.css")
    with open(target, "w", encoding="utf-8") as f:
        f.write(css_text)
    os.chmod(target, 0o644)
    print("Écrit : " + target)
    return 0


if __name__ == "__main__":
    sys.exit(main())
