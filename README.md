# Battle Order

Éditeur de battle order pour le 3ème Régiment de Fusiliers Marins (FNFL) : sections, kits, armes, hiérarchie, et pages
partageables par lien, supprimées automatiquement après 30 jours.

## Installation ou mise à jour

En root, depuis ce dossier :

```bash
bash install.sh
certbot --nginx -d battle-order.fnfl.app        # une seule fois, à la première installation
```

Prérequis : Node.js 18 ou plus, nginx, et les trois listes `kits.json`, `weapons.json` et `secondaries.json`
déjà copiées dans `/var/www/battle-order`. L'installateur peut être relancé sans risque : il conserve la configuration
nginx et les fichiers générés.

## Contenu

| Dossier | Rôle |
|---|---|
| `site/` | éditeur (`index.html`, `style.css`, `editor.js`), rendu partagé (`bo-render.js`), charte graphique (`theme.css`, `fonts.css`, `theme-fnfl.css`), page `confidentialite.html`, `ui.js` |
| `server/` | service de publication (`server.js`) et purge à 30 jours (`purge.js`), sans aucune dépendance |
| `systemd/` | service, service de purge et minuteur quotidien (4 h 20) |
| `nginx/` | configuration du site et zone de limitation de débit |
| `tools/` | `extract-theme.py` (reprend l'arrière-plan de fnfl.app), `git-save.sh` (enregistre et envoie sur GitHub) |

## Charte graphique

`install.sh` s'en occupe ; chaque étape peut aussi être relancée seule.

- **Logo** : copié depuis `/var/www/fnfl/fnfl_flag_logo_roundel.png`.
- **Arrière-plan** : `python3 tools/extract-theme.py --site /var/www/fnfl --out /var/www/battle-order`.
  `--dry-run` montre le résultat sans rien écrire ; `--selector ".conteneur"` reprend l'arrière-plan d'un autre
  élément que `html` ou `body`. Pour revenir au fond par défaut, vider `theme-fnfl.css`.
- **Polices** Anton et IBM Plex Mono (licence SIL OFL) : téléchargées dans `/var/www/battle-order/fonts`, ou déposées à
  la main (`Anton-Regular.ttf` ou `.woff2`, `IBMPlexMono-Regular.woff2`, `IBMPlexMono-SemiBold.woff2`), puis relancer
  `install.sh` (`NO_FONTS=1` pour ne rien télécharger). Sans elles : polices système, aucun appel à Google Fonts.

## Exploitation

```bash
systemctl status battle-order                    # état du service de publication
journalctl -u battle-order -n 30 --no-pager      # derniers messages
systemctl list-timers battle-order-purge.timer   # prochaine purge
BO_ROOT=/var/www/battle-order node /opt/battle-order/purge.js --dry-run   # pages qui seraient supprimées
ls /var/www/battle-order/o | wc -l               # nombre de pages publiées
rm -rf /var/www/battle-order/o/<identifiant>     # supprimer une page avant ses 30 jours
```

`/etc/battle-order.env` : code de publication (`BO_PUBLISH_CODE`) et limites, puis `systemctl restart battle-order`.
Les listes JSON (kits, armes) se modifient directement dans `/var/www/battle-order`, sans redémarrage.

## Git

Ce dossier est le dépôt source ; `install.sh` le déploie. Aucun secret n'y figure (le fichier de réglages
`/etc/battle-order.env` et les pages publiées restent sur le serveur, hors du dépôt).

```bash
bash tools/git-save.sh "Message du commit"      # enregistre et envoie (1re fois : ajouter l'adresse du dépôt GitHub)
```
