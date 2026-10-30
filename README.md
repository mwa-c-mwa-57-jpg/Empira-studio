# Empira Conquest — prototype jouable

Jeu interactif pour TikTok LIVE (format vertical 9:16, compatible OBS). Deux modes :

- **Conquête de France** (mode par défaut) : chaque spectateur écrit le numéro de **son département** dans le chat
  pour le faire entrer en guerre. Ses likes, commentaires, partages et cadeaux recrutent des soldats, et les départements
  conquièrent leurs voisins sur une vraie carte de France (96 départements, outre-mer en encarts, zoom sur l'Île-de-France).
  Au programme : attaques contre le 1er, duels, révolutions, missions régionales, têtes mises à prix, bulles en direct,
  podium et « Roi du pays ».
- **Deux camps** (`?mode=factions`) : le premier prototype, SOLAIRE contre AZUR sur une carte hexagonale.

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

### Mode Conquête de France (par défaut)

| Bouton | Effet simulé |
|---|---|
| Écrit son département | le spectateur écrit le numéro saisi (17, 2A, 974…) : le département entre en guerre (+5 soldats) |
| Commente | +1 soldat (au plus 1 toutes les 2 s par spectateur) |
| ♥ +20 / +200 | likes : +1 soldat par tranche de 20 likes, et progression de l'objectif collectif |
| Partage / Abonnement | +8 / +15 soldats |
| Boutons de cadeaux | +10 soldats par pièce, plus l'effet du cadeau (bonus ×2, bouclier, vol, attaque contre le 1er, remise à zéro, conquête éclair…) |
| Combo ×10 Rose / Doublon | série de cadeaux / test anti-doublon |
| Foule simulée / Tempête | public virtuel réglable / 1 000 événements d'un coup |
| Événement maintenant / Terminer la partie | déclenche un duel, une révolution, une mission ou une prime / affiche le podium |

Le catalogue des cadeaux (noms, prix, effets) se règle dans [`config/france.json`](config/france.json). Les noms et prix
fournis par défaut sont des **valeurs indicatives, à vérifier** dans le panneau de cadeaux TikTok du créateur, car un
cadeau est reconnu par son nom. Un cadeau inconnu rapporte quand même +10 soldats par pièce.

### Mode deux camps (`http://localhost:3000/?mode=factions`)

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

Toutes les règles sont dans des fichiers JSON, modifiables sans toucher au code :
[`config/france.json`](config/france.json) (titre, économie, coûts de conquête, cadeaux, événements, durée) et
[`config/default.json`](config/default.json) (mode deux camps).
Pour essayer une variante, copiez le fichier (par exemple `config/creatrice-x.json`) et ouvrez
`http://localhost:3000/?config=creatrice-x`.

## Tests

```
npm test            # 47 tests unitaires et d'intégration (Node, sans dépendance)
npm run test:e2e    # test navigateur complet (nécessite Playwright, facultatif)
```

## Données cartographiques

Contours des départements : IGN Admin Express, via le projet open source
[france-geojson](https://github.com/gregoiredavid/france-geojson), sous **Licence Ouverte / Etalab**.
Le fichier `public/src/france/departements.js` est généré par `node tools/build-france-map.mjs`.

## Documentation

- [01 — Analyse des vidéos de référence](docs/01-analyse-video.md)
- [02 — Recherche technique et choix d'architecture](docs/02-recherche-technique.md)
- [03 — Cahier des charges et règles du jeu](docs/03-cahier-des-charges.md)
- [04 — Architecture technique](docs/04-architecture.md)
- [05 — Bilan de validation et plan d'évolution](docs/05-bilan-et-plan.md)
- [06 — Règles du mode Conquête de France](docs/06-mode-france.md)
