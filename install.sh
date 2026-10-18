#!/bin/bash
# Installe Battle Order : site, service de publication, purge à 30 jours, configuration nginx.
# À lancer en root, depuis le dossier décompressé :  bash install.sh
# Variables facultatives : DOMAIN (battle-order.fnfl.app), WEBROOT (/var/www/battle-order), PORT (3101)
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
DOMAIN="${DOMAIN:-battle-order.fnfl.app}"
WEBROOT="${WEBROOT:-/var/www/battle-order}"
APPDIR="${APPDIR:-/opt/battle-order}"
PORT="${PORT:-3101}"
WWW_USER="${WWW_USER:-www-data}"
SYSTEMD="${SYSTEMD:-/etc/systemd/system}"
NGINX_SITES="${NGINX_SITES:-/etc/nginx/sites-available}"
NGINX_ENABLED="${NGINX_ENABLED:-/etc/nginx/sites-enabled}"
NGINX_CONFD="${NGINX_CONFD:-/etc/nginx/conf.d}"
ENVFILE="${ENVFILE:-/etc/battle-order.env}"
FNFL_SITE="${FNFL_SITE:-/var/www/fnfl}"   # site de l'unité : source du logo et de l'arrière-plan

fail() { echo "ERREUR : $*"; exit 1; }
subst() { sed -e "s|@DOMAIN@|$DOMAIN|g" -e "s|@WEBROOT@|$WEBROOT|g" -e "s|@APPDIR@|$APPDIR|g" -e "s|@PORT@|$PORT|g" -e "s|@WWW_USER@|$WWW_USER|g" "$1"; }

echo "== 1/8  Vérifications"
[ "${SKIP_ROOT_CHECK:-0}" = "1" ] || [ "$(id -u)" = "0" ] || fail "lance ce script en root (sudo bash install.sh)"
command -v node >/dev/null || fail "Node.js est introuvable (apt install nodejs)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js 18 ou plus récent est nécessaire (version actuelle : $(node -v))"
command -v nginx >/dev/null || fail "nginx est introuvable"
[ -d "$WEBROOT" ] || fail "le dossier $WEBROOT n'existe pas"
for f in kits.json weapons.json secondaries.json; do
  [ -f "$WEBROOT/$f" ] || fail "$WEBROOT/$f est introuvable : copie d'abord tes fichiers kits.json, weapons.json et secondaries.json dans $WEBROOT"
  python3 -m json.tool "$WEBROOT/$f" >/dev/null 2>&1 || fail "$WEBROOT/$f n'est pas un JSON valide"
done
echo "   Node $(node -v), nginx, et les trois listes JSON sont présents et valides"

echo "== 2/8  Site (éditeur) dans $WEBROOT"
for f in index.html style.css editor.js bo-render.js ui.js theme.css confidentialite.html; do install -m 644 "$DIR/site/$f" "$WEBROOT/$f" || fail "copie de $f"; done
# feuilles générées plus bas : on ne les remplace jamais si elles existent déjà
for f in fonts.css theme-fnfl.css; do [ -f "$WEBROOT/$f" ] || install -m 644 "$DIR/site/$f" "$WEBROOT/$f"; done
mkdir -p "$WEBROOT/o" "$WEBROOT/fonts" "$WEBROOT/assets/theme"
if id "$WWW_USER" >/dev/null 2>&1; then chown "$WWW_USER":"$WWW_USER" "$WEBROOT/o"; fi
chmod 755 "$WEBROOT/o"
echo "   éditeur copié ; les listes JSON existantes n'ont pas été touchées"

echo "== 3/8  Charte graphique (logo, arrière-plan de fnfl.app, polices)"
if [ -f "$FNFL_SITE/fnfl_flag_logo_roundel.png" ]; then
  install -m 644 "$FNFL_SITE/fnfl_flag_logo_roundel.png" "$WEBROOT/fnfl_flag_logo_roundel.png" && echo "   logo de l'unité copié depuis $FNFL_SITE"
else
  echo "   logo introuvable dans $FNFL_SITE : copie-le à la main sous le nom $WEBROOT/fnfl_flag_logo_roundel.png (sans lui, l'en-tête s'affiche sans logo)"
fi
if [ -d "$FNFL_SITE" ]; then
  python3 "$DIR/tools/extract-theme.py" --site "$FNFL_SITE" --out "$WEBROOT" | sed 's/^/   /'
  case "${PIPESTATUS[0]}" in
    0) echo "   arrière-plan de fnfl.app repris (theme-fnfl.css)" ;;
    3) echo "   arrière-plan non repris automatiquement : l'arrière-plan par défaut est conservé (voir les explications ci-dessus ; relance avec : python3 $DIR/tools/extract-theme.py --site $FNFL_SITE --out $WEBROOT --selector \".ton-conteneur\")" ;;
    *) echo "   ATTENTION : l'extraction de l'arrière-plan a échoué ; l'arrière-plan par défaut est conservé" ;;
  esac
else
  echo "   $FNFL_SITE introuvable : arrière-plan par défaut conservé (FNFL_SITE=/chemin bash install.sh pour indiquer le site de l'unité)"
fi
font_ok() { case "$(od -An -tx1 -N4 "$1" 2>/dev/null | tr -d ' \n')" in 774f4632|00010000|4f54544f|74727565) return 0 ;; *) return 1 ;; esac; }
fetch_font() { # nom, adresse : téléchargement facultatif, contrôlé (le fichier doit être une vraie police)
  local dest="$WEBROOT/fonts/$1" tmp; [ -s "$dest" ] && return 0
  tmp="$(mktemp)"
  if curl -fsSL --max-time 40 -o "$tmp" "$2" 2>/dev/null && font_ok "$tmp"; then install -m 644 "$tmp" "$dest"; echo "   police téléchargée : $1"
  else echo "   police non téléchargée : $1 (copie-la à la main dans $WEBROOT/fonts/ ; repli sur des polices système en attendant)"; fi
  rm -f "$tmp"
}
if [ "${NO_FONTS:-0}" != "1" ]; then
  fetch_font Anton-Regular.ttf "https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf"
  fetch_font IBMPlexMono-Regular.woff2 "https://github.com/IBM/plex/raw/master/packages/plex-mono/fonts/complete/woff2/IBMPlexMono-Regular.woff2"
  fetch_font IBMPlexMono-SemiBold.woff2 "https://github.com/IBM/plex/raw/master/packages/plex-mono/fonts/complete/woff2/IBMPlexMono-SemiBold.woff2"
fi
F="$WEBROOT/fonts"
{
  echo "/* Généré par install.sh : polices servies par ce site (licence SIL OFL). Aucune requête vers Google Fonts. */"
  if [ -s "$F/Anton-Regular.woff2" ]; then echo '@font-face{font-family:"Anton";font-weight:400;font-display:swap;src:url("/fonts/Anton-Regular.woff2") format("woff2")}'
  elif [ -s "$F/Anton-Regular.ttf" ]; then echo '@font-face{font-family:"Anton";font-weight:400;font-display:swap;src:url("/fonts/Anton-Regular.ttf") format("truetype")}'; fi
  [ -s "$F/IBMPlexMono-Regular.woff2" ] && echo '@font-face{font-family:"IBM Plex Mono";font-weight:400;font-display:swap;src:url("/fonts/IBMPlexMono-Regular.woff2") format("woff2")}'
  [ -s "$F/IBMPlexMono-SemiBold.woff2" ] && echo '@font-face{font-family:"IBM Plex Mono";font-weight:600;font-display:swap;src:url("/fonts/IBMPlexMono-SemiBold.woff2") format("woff2")}'
} > "$WEBROOT/fonts.css"
chmod 644 "$WEBROOT/fonts.css"
echo "   fonts.css : $(grep -c '@font-face' "$WEBROOT/fonts.css") police(s) déclarée(s)"

echo "== 4/8  Service de publication dans $APPDIR"
mkdir -p "$APPDIR"
install -m 644 "$DIR/server/server.js" "$APPDIR/server.js"
install -m 644 "$DIR/server/purge.js" "$APPDIR/purge.js"
install -m 644 "$DIR/site/bo-render.js" "$APPDIR/bo-render.js"
if [ ! -f "$ENVFILE" ]; then
  printf '# Réglages facultatifs de Battle Order (puis : systemctl restart battle-order)\n# Code à saisir pour publier une page (recommandé si le site est public) :\n#BO_PUBLISH_CODE=choisis-un-code\n# Limites : publications par adresse et par heure / par jour, pages stockées au maximum\n#BO_PER_HOUR=10\n#BO_PER_DAY=30\n#BO_MAX_PAGES=3000\n' > "$ENVFILE"
  chmod 600 "$ENVFILE"
  echo "   fichier de réglages créé : $ENVFILE"
fi

echo "== 5/8  Services systemd (publication + purge quotidienne à 4 h 20)"
subst "$DIR/systemd/battle-order.service" > "$SYSTEMD/battle-order.service"
subst "$DIR/systemd/battle-order-purge.service" > "$SYSTEMD/battle-order-purge.service"
subst "$DIR/systemd/battle-order-purge.timer" > "$SYSTEMD/battle-order-purge.timer"
systemctl daemon-reload
systemctl enable --now battle-order.service || fail "le service battle-order n'a pas démarré (journalctl -u battle-order -n 30)"
systemctl restart battle-order.service
systemctl enable --now battle-order-purge.timer || fail "le minuteur de purge n'a pas démarré"
echo "   services activés"

echo "== 6/8  nginx"
if [ ! -f "$NGINX_CONFD/battle-order-zone.conf" ]; then install -m 644 "$DIR/nginx/battle-order-zone.conf" "$NGINX_CONFD/battle-order-zone.conf"; echo "   zone de limitation de débit ajoutée"; fi
if [ -f "$NGINX_SITES/battle-order" ]; then
  echo "   $NGINX_SITES/battle-order existe déjà : conservé tel quel (il contient peut-être le HTTPS ajouté par certbot)"
  echo "   configuration d'origine : $DIR/nginx/battle-order.conf"
  # mise à jour de la politique de sécurité des pages publiées (elles chargent maintenant les feuilles, polices et logo du site)
  python3 - "$NGINX_SITES/battle-order" << 'PYEOF'
import shutil, sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
old = "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
new = "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
if old in s:
    shutil.copyfile(p, p + ".bak-charte")
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
    print("   politique de sécurité des pages publiées mise à jour (sauvegarde : " + p + ".bak-charte)")
PYEOF
else
  subst "$DIR/nginx/battle-order.conf" > "$NGINX_SITES/battle-order"
  ln -sf "$NGINX_SITES/battle-order" "$NGINX_ENABLED/battle-order"
  echo "   site $DOMAIN créé"
fi
if nginx -t >/dev/null 2>&1; then systemctl reload nginx && echo "   nginx rechargé"; else nginx -t; fail "nginx -t a échoué : rien n'a été rechargé (configuration : $NGINX_SITES/battle-order)"; fi

echo "== 7/8  Contrôle du service"
OK=0
if [ "${SKIP_SMOKE:-0}" != "1" ]; then
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS "http://127.0.0.1:$PORT/api/health" 2>/dev/null | grep -q '"ok":true'; then OK=1; break; fi
    sleep 1
  done
  if [ "$OK" = "1" ]; then echo "   le service répond"; else echo "   ATTENTION : le service ne répond pas encore (journalctl -u battle-order -n 30)"; fi
fi
echo "== 8/8  Purge : essai à blanc"
BO_ROOT="$WEBROOT" node "$APPDIR/purge.js" --dry-run

echo
echo "Terminé. Il reste à activer le HTTPS (une seule fois) :"
echo "   certbot --nginx -d $DOMAIN"
echo "Puis ouvre https://$DOMAIN/ et génère un lien d'essai."
echo "Pour exiger un code de publication : édite $ENVFILE (BO_PUBLISH_CODE=...), puis systemctl restart battle-order"
