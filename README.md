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
| `site/` | éditeur (`index.html`, `style.css`, `editor.js`), traduction de l'éditeur (`i18n.js`), rendu partagé FR/EN (`bo-render.js`), charte graphique (`theme.css`, `fonts.css`, `theme-fnfl.css`), pages `confidentialite.html` et `privacy.html`, `ui.js` |
| `server/` | service de publication (`server.js`) et purge à 30 jours (`purge.js`), sans aucune dépendance |
| `systemd/` | service, service de purge et minuteur quotidien (4 h 20) |
| `nginx/` | configuration du site et zone de limitation de débit |
| `tools/` | `extract-theme.py` (reprend l'arrière-plan de fnfl.app), `git-save.sh` (enregistre et envoie sur GitHub) |

## Français / anglais

Bouton **FR / EN** en haut de l'éditeur (la langue du navigateur est utilisée au départ, puis le choix est mémorisé ; le brouillon est
conservé quand on change de langue). Tout l'éditeur, ses messages, l'aperçu et la page de confidentialité (`confidentialite.html` en français,
`privacy.html` en anglais) sont traduits.

Chaque page publiée existe **dans les deux langues** : `/o/<id>/fr.html` et `/o/<id>/en.html`, qui se renvoient l'une à l'autre par un bouton FR / EN
(un simple lien, sans script : la politique de sécurité des pages publiées n'en autorise aucun). `/o/<id>/` (donc le lien partagé) ouvre la langue
dans laquelle l'éditeur était réglé à la génération ; l'éditeur affiche aussi le lien direct de l'autre version. Les dates, le bandeau de suppression,
« joueurs / players », « Véhicules / Vehicles », etc. suivent la langue de la page. Les noms de kits et d'armes viennent de vos fichiers JSON : ils ne sont pas
traduits (« Autre » et « Other » y sont tous deux reconnus comme l'entrée à texte libre ; « Autre » est affiché « Other » dans l'interface anglaise).
Les pages déjà publiées avant cette mise à jour restent en français seules.

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
