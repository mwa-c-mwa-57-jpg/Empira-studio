# 04 — Architecture technique

## Arborescence
```
config/default.json          règles, factions, paliers de cadeaux, limites (modifiable sans code)
public/index.html            page de jeu (+ panneau de test ; ?obs = jeu seul)
public/control.html          régie : envoie des événements simulés au serveur
public/src/core/events.js    schéma d'événement normalisé, validation, nettoyage
public/src/core/rules.js     moteur de règles : événement → commandes de jeu (équipes, likes, cadeaux, anti-spam)
public/src/core/rng.js       aléatoire déterministe (cartes reproductibles)
public/src/game/map.js       génération de la carte hexagonale
public/src/game/engine.js    simulation : unités, combats, conquêtes, victoire, phases
public/src/render/renderer.js rendu canvas : carte, unités animées, particules, HUD
public/src/sources/          simulateur et client SSE (serveur local)
public/src/ui/devPanel.js    panneau de test / régie
server/server.js             serveur HTTP sans dépendance : fichiers statiques, SSE /events, API locale
server/adapters/tiktok-live.js adaptateur TikTok-Live-Connector (expérimental)
tests/                       tests Node (32) + test navigateur Playwright
```

## Flux d'un événement
```
Source (TikTok / simulateur / régie)
  → adaptateur : conversion au format normalisé {id, type, user, comment|likeCount|gift, ts}
  → [serveur local → SSE] (sources externes uniquement)
  → RulesEngine.process() : validation, nettoyage, dédoublonnage, limite de débit, attribution d'équipe, règles
  → commandes {spawn | special | banner | feed}
  → Game.apply() : file d'apparition lissée (8 unités/s par camp), report si la bataille n'a pas commencé
  → Game.update() : déplacements, combats, captures, victoire → événements visuels
  → Renderer : animations, effets, HUD
```

Séparation des responsabilités, conformément au cahier des charges :

| Responsabilité | Module |
|---|---|
| Réception | `server/adapters/*`, `sources/*` |
| Validation et normalisation | `core/events.js` |
| Règles | `core/rules.js` + `config/*.json` |
| Moteur | `game/engine.js` (aucune dépendance DOM, tourne sous Node) |
| Animations et affichage | `render/renderer.js` |
| Statistiques | `RulesEngine.stats`, `leaderboard()` (en mémoire pour l'instant) |
| Administration | `/api/admin`, `control.html`, panneau de test |

## Résilience
| Risque | Traitement |
|---|---|
| Doublons | identifiant mémorisé (fenêtre de 5 000), testé |
| Événements en retard | rejet au-delà de 120 s, testé |
| Rafales de cadeaux | file d'apparition lissée, séries plafonnées, plafond d'unités |
| Flood de likes et commentaires | 500 événements/s maximum (hors cadeaux) ; délai de 6 s par spectateur pour les commentaires |
| Injection / commandes | seuls des mots-clés exacts sont reconnus, aucun `eval`, textes dessinés sur canvas ou via `textContent`, API d'administration limitée à une liste fermée et accessible uniquement depuis le PC (127.0.0.1) |
| Déconnexion TikTok | reconnexion avec délai croissant (5 s → 60 s) ; le jeu continue |
| Coupure du serveur local | `EventSource` se reconnecte automatiquement |
| Fichiers hors du dossier | protection contre la traversée de chemin, testée |

## Ajouter une nouvelle source d'événements
Écrire un module qui produit des objets au format normalisé, puis appeler `server.broadcast({ kind: 'event', event })`.
`server/adapters/tiktok-live.js` sert d'exemple (sa fonction `mapTikTokEvent` est pure et testée).

## Ajouter un jeu
Conserver `core/` (événements, règles) et les sources, puis créer un autre `game/` et un autre `render/`. À terme,
le moteur de règles pourra produire des commandes génériques interprétées par chaque jeu.
