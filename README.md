# Empira Conquest — prototype jouable

Jeu de conquête territoriale interactif conçu pour TikTok LIVE (format vertical 9:16, compatible OBS).
Deux factions, **SOLAIRE** et **AZUR**, s'affrontent sur une carte hexagonale. Les spectateurs choisissent
leur camp dans le chat, et leurs likes, commentaires et cadeaux font apparaître des troupes.

> Nom de travail provisoire, à vérifier avant toute commercialisation.

## Lancer le jeu sur un PC Windows

1. Installez **Node.js LTS** (version 22 ou plus récente) depuis <https://nodejs.org> (installation par défaut).
2. Téléchargez ou clonez ce dossier.
3. Double-cliquez sur **`start.bat`**.
   Une fenêtre noire (le serveur local) s'ouvre, puis le navigateur affiche le jeu à `http://localhost:3000/`.
   Laissez la fenêtre noire ouverte pendant toute la partie ; fermez-la pour arrêter le jeu.

Aucune autre installation n'est nécessaire : le jeu n'a **aucune dépendance npm**.

Équivalent en ligne de commande : `npm start` (ou `node server/server.js --open`).

## Tester sans TikTok

La page `http://localhost:3000/` affiche le jeu et, à droite, le **panneau de test**. Touche `D` pour le masquer.

| Bouton | Effet simulé |
|---|---|
| Commente « 1 » / « 2 » | le spectateur rejoint SOLAIRE / AZUR et fait apparaître un soldat |
| ♥ +10 / +100 | likes : remplissent la jauge de charge de son camp (150 likes = charge de 6 soldats) |
| Petit / Moyen / Gros cadeau | Chevalier (1💎) / Géant (≥ 20💎) / Météore (≥ 100💎) |
| Combo ×5 | série de 5 cadeaux identiques |
| Doublon | envoie deux fois le même événement : il ne doit être appliqué qu'une fois |
| Foule simulée | génère en continu un public virtuel (débit, camp préféré et taux de cadeaux réglables) |
| Tempête | envoie 1 000 événements d'un coup (test de robustesse) |
| Nouvelle partie / Pause / Vitesse | commandes de régie |

## Utiliser dans OBS

1. Lancez `start.bat`.
2. Dans OBS : **Sources → + → Navigateur**, URL `http://localhost:3000/?obs`, largeur **1080**, hauteur **1920**.
   Le mode `?obs` n'affiche que le jeu, sans aucun menu.
3. Pour piloter ou simuler des événements pendant que la source OBS tourne, ouvrez la régie dans votre navigateur :
   `http://localhost:3000/control.html`. Les événements passent par le serveur local et arrivent dans la page OBS.

## Connexion à un vrai live TikTok (expérimental, non testé en conditions réelles)

Double-cliquez sur `start-tiktok.bat` et saisissez le nom du compte qui est en live. Vous pouvez aussi lancer
`npm install tiktok-live-connector` puis `npm run tiktok -- <compte>`.

⚠️ Cette connexion repose sur la bibliothèque communautaire **TikTok-Live-Connector**, qui **n'est pas une API
officielle de TikTok**. Elle utilise un service de signature tiers (Euler Stream) et peut cesser de fonctionner sans
préavis. Vérifiez les conditions d'utilisation de TikTok avant de l'utiliser pendant un vrai live.
Voir [docs/02-recherche-technique.md](docs/02-recherche-technique.md).

Si la connexion TikTok tombe, le jeu continue de tourner et un indicateur discret s'affiche. La reconnexion est automatique.

## Personnaliser

Toutes les règles sont dans [`config/default.json`](config/default.json) : noms et couleurs des factions, mots-clés,
durée de la partie, effets des likes et des cadeaux, puissance des unités, limites anti-spam.
Pour essayer une variante, copiez le fichier (par exemple `config/creatrice-x.json`) et ouvrez
`http://localhost:3000/?config=creatrice-x`.

## Tests

```
npm test            # 32 tests unitaires et d'intégration (Node, sans dépendance)
npm run test:e2e    # test navigateur complet (nécessite Playwright, facultatif)
```

## Documentation

- [01 — Analyse de la vidéo de référence](docs/01-analyse-video.md)
- [02 — Recherche technique et choix d'architecture](docs/02-recherche-technique.md)
- [03 — Cahier des charges et règles du jeu](docs/03-cahier-des-charges.md)
- [04 — Architecture technique](docs/04-architecture.md)
- [05 — Bilan de validation et plan d'évolution](docs/05-bilan-et-plan.md)
