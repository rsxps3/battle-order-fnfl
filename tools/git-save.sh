#!/bin/bash
# Enregistre le projet dans Git et l'envoie sur GitHub.
#   bash tools/git-save.sh "Message du commit" [adresse-du-dépôt]
# L'adresse n'est nécessaire qu'au premier envoi (dépôt GitHub créé vide au préalable),
# par exemple : https://github.com/rsxps3/battle-order-fnfl.git
set -u
MSG="${1:-}"
URL="${2:-}"
[ -n "$MSG" ] || { echo 'Usage : bash tools/git-save.sh "Message du commit" [adresse-du-dépôt]'; exit 1; }
command -v git >/dev/null || { echo "git est introuvable (apt install git)"; exit 1; }
cd "$(dirname "$0")/.." || exit 1

if [ ! -d .git ]; then
  git init -q -b main 2>/dev/null || { git init -q && git checkout -q -b main; }
  echo "Dépôt Git créé dans $(pwd) (branche main)"
fi
BRANCH="$(git branch --show-current)"; [ -n "$BRANCH" ] || BRANCH=main
if [ -z "$(git config user.name)" ] || [ -z "$(git config user.email)" ]; then
  echo "Git ne connaît pas ton nom ou ton adresse e-mail. Lance d'abord :"
  echo '   git config --global user.name "Ton nom"'
  echo '   git config --global user.email "ton@email"'
  exit 1
fi
if ! git remote get-url origin >/dev/null 2>&1; then
  [ -n "$URL" ] || { echo "Premier envoi : indique l'adresse du dépôt GitHub (créé vide) en second argument."; exit 1; }
  git remote add origin "$URL"
elif [ -n "$URL" ] && [ "$(git remote get-url origin)" != "$URL" ]; then
  echo "Attention : le dépôt distant déjà configuré est $(git remote get-url origin) ; c'est celui-là qui sera utilisé."
fi
echo "Dépôt distant : $(git remote get-url origin)  (branche $BRANCH)"

git add -A
if [ -z "$(git diff --cached --name-only)" ]; then echo "Rien à enregistrer : tout est déjà à jour."; exit 0; fi
echo "-- fichiers prêts à être enregistrés :"
git diff --cached --name-status | sed 's/^/   /'

BAD="$(git diff --cached --name-only | grep -i -E '(^|/)\.env($|\.)|\.(pem|key|crt|p12|pfx)$|(^|/)id_(rsa|ed25519)|secret|password|passwd|token|\.bak|(^|/)o/[a-z0-9]{12}/')"
if [ -n "$BAD" ]; then
  echo "STOP : fichiers sensibles ou générés détectés :"; echo "$BAD" | sed 's/^/   /'
  git reset -q
  echo "Rien n'a été enregistré. Retire ces fichiers du dossier (ou ajoute-les à .gitignore), puis relance."
  exit 1
fi
BIG=""
while IFS= read -r f; do [ -f "$f" ] && [ "$(wc -c < "$f")" -gt 5000000 ] && BIG="$BIG$f\n"; done < <(git diff --cached --name-only)
if [ -n "$BIG" ]; then
  echo "STOP : fichier(s) de plus de 5 Mo :"; printf "$BIG" | sed 's/^/   /'
  git reset -q; echo "Rien n'a été enregistré. Un fichier aussi gros n'a probablement rien à faire dans ce dépôt."
  exit 1
fi
echo "OK : aucun fichier sensible ni volumineux."

read -rp "Enregistrer ces fichiers et les envoyer sur GitHub ? (o/N) " REP
case "$REP" in o|O|oui|OUI) ;; *) git reset -q; echo "Annulé : rien n'a été enregistré."; exit 1 ;; esac

git commit -q -m "$MSG" || { echo "Le commit a échoué."; exit 1; }
if git push -u origin "$BRANCH"; then
  echo "Envoyé."
else
  echo "L'envoi a échoué : le commit est enregistré chez toi. Vérifie l'adresse du dépôt, que le dépôt GitHub existe (vide, sans README), et ton nom d'utilisateur / jeton, puis relance : git push -u origin $BRANCH"
  exit 1
fi
git log --oneline -3
