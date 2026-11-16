# 09 — « La Guerre des Départements » : version vendue

Reconstruite d'après le cahier des charges « Prompt : La Guerre des Départements » (artifact Empira).
Code source : `produit/`. Version à livrer : `npm run build:produit` → `dist/La-Guerre-des-Departements/`.

## Ce que contient le dossier livré
| Fichier | Rôle |
|---|---|
| `LANCER LE JEU.bat` | démarre le serveur local (`outils/node.exe outils/serveur.cjs`) et ouvre la fenêtre de pilotage |
| `demarrer.html` | **fenêtre de pilotage unique** : licence, connexion au live (pseudo → Connecter), vérifications (voix, musique), couleurs, voix, régie par boutons, adresse à copier |
| `guerre-des-departements.html` | **le jeu, en un seul fichier** (code minifié, aucune dépendance externe) |
| `outils/serveur.cjs` | serveur Node (un seul fichier) : fichiers, **connexion directe au live TikTok**, relais WebSocket `/evenements`, régie `/commande`, `/parler`, `/voix`, `/musiques`, `/licence` |
| `outils/node.exe` | Node.js v22.22.0 pour Windows (rien à installer chez l'acheteur) |
| `LICENCES-TIERS.txt` | licences des bibliothèques embarquées (MIT, BSD, Apache) et de Node.js |
| `musique/`, `images/` | MP3 de l'acheteur ; `images/logo-empira.png` facultatif (sinon le logo est dessiné) |
| `GUIDE.html` | guide d'installation pour l'acheteur |

## Connexion au live sans TikFinity
Le serveur se connecte lui-même au live avec **tiktok-live-connector 2.4.0** (licence MIT ; les versions 2.5.0 et
suivantes sont passées sous AGPL-3.0, incompatible avec une vente fermée : la version est figée). L'animateur entre son
pseudo dans la fenêtre de pilotage ; le pseudo est retenu (`%APPDATA%/EmpiraGuerreDesDepartements/reglages.json`) et la
connexion est relancée automatiquement aux démarrages suivants, avec reconnexion en cas de coupure (5 s → 60 s).
Les événements (tchat, likes, cadeaux, abonnements, partages) sont convertis au format attendu par le jeu et relayés en
WebSocket à la page affichée dans LIVE Studio. La régie de la fenêtre de pilotage envoie les mêmes commandes que le
tchat (`!fin`, `!vague`…), par boutons. TikFinity reste disponible en secours (case « Utiliser TikFinity à la place »).

- La bibliothèque signe les connexions via le service **Euler Stream** (gratuit, limité). Une clé Euler facultative
  peut être saisie dans les options avancées. `enableExtendedGiftInfo` est désactivé : il exige le plan payant
  « Business » d'Euler (erreur constatée).
- Vérifié sur un **vrai live public** : commentaires, likes, partages et photos de profil arrivent et sont acceptés
  par le jeu (champs réels du schéma v3 : `displayId`, `content`, `count`, différents de la documentation).

## Conformité au cahier des charges
Implémenté : sections 1 à 12, dont le moteur (crescendo, 40 % pour l'attaquant, plafonds, butin 25 %, riposte ×2,
blindage des tanks, boucliers, occupation, libération par un cadeau de 100 pièces), les vagues de 3, 6, 9 et 12 min,
les événements (révolution, duel, prime, invasion, missions), les engins dessinés en code, la caméra, les bulles
photo, le fil des actions, le podium et le Roi du pays, la personnalisation des couleurs, la voix homme ou femme,
les bruitages Web Audio, la musique, les commandes de l'animateur, la licence et l'absence de démo ou de bots dans
la version vendue. Les chiffres du tableau des cadeaux sont retrouvés par les tests (2 140, 5 550, 455 par salve,
environ 25 000 pour le tsunami, environ 19 500 par bombe, 1 050 pour le tank).

Interprétations (le cahier des charges ne tranchait pas) :
- **Occupation** : l'occupé garde 50 % de ses gains (hors cadeaux), l'occupant reçoit les 50 % restants.
- **Tsunami** : 60 % de la valeur sur la cible, 40 % répartis sur les départements actifs à la même latitude ; plafond de 50 % par département.
- **Cadeaux cachés** : Gants de boxe (299) = avion de chasse, Cygne (699) = missiles.
- **`!avion`** : largage gratuit de 20 soldats sur le dernier du classement.
- **Invasion** : l'occupant est tiré dans la moitié haute du classement ; sa proie est un voisin si possible.
- **Ajout** : une loupe sur l'Île-de-France (Paris et la petite couronne seraient sinon illisibles).

## Tests
- `npm test` : tests unitaires, dont 33 pour la version vendue (moteur, conversion des événements, thème, voix,
  conversion TikTok v3, licence Lemon Squeezy avec un faux serveur, serveur avec un faux live).
- `npm run test:produit` : test navigateur sur le **vrai serveur assemblé** (`outils/serveur.cjs`), avec un faux
  live intégré au mode test (`EMPIRA_TEST=1`, retiré de la version vendue à l'assemblage). Il vérifie la connexion
  depuis la fenêtre de pilotage, les événements au format réel de TikTok (série de Roses comptée une fois, Galaxie,
  partage), les commandes (refusées pour un spectateur, acceptées pour un modérateur), la régie par boutons, la
  coupure et la reconnexion sans arrêter la partie, le podium, la voix, TikFinity en secours, le blocage sans
  licence, le refus d'une mauvaise clé, l'activation, et l'absence de faux live ou de bots dans la version vendue.

## Non testé (à faire avant la mise en vente)
- ❌ **Windows** : le serveur n'a tourné que sous Linux. À tester sur un PC Windows : `LANCER LE JEU.bat`,
  `node.exe` embarqué (et l'avertissement SmartScreen), la voix (PowerShell + System.Speech lancé par le serveur),
  la liste des voix, l'ouverture automatique du navigateur, le port déjà utilisé.
- ❌ **Cadeaux en réel** : aucun cadeau n'a été observé sur un vrai live. Leur conversion suit les définitions v3 de
  la bibliothèque (nom, diamants, série, fin de série). À vérifier sur un live avec quelques Roses et un gros cadeau.
- ❌ **Abonnements en réel** : non observés non plus (même logique que les partages, qui eux ont été vus).
- ❌ **Lemon Squeezy** : testé uniquement avec un faux serveur. Renseigner `produitId` dans
  `produit/serveur/licence.mjs` et régler la limite de 2 activations dans Lemon Squeezy.
- ❌ **TikTok LIVE Studio** : source « Lien », son (lecture automatique de la musique et des bruitages) et performances à vérifier.

## Points d'attention pour la vente
- **Nom** : « La Guerre des Départements » est le nom affiché par le jeu de la vidéo de référence (éditeur tiers).
  Vendre un produit sous le même nom expose à un risque juridique (marque, parasitisme). Le titre se change dans
  `produit/src/config.js` (`TITRE`) et `page.html`. Faire valider le nom par un juriste.
- **Protection de la licence** : la vérification se fait sur le PC de l'acheteur, dans des fichiers qu'il possède.
  Une personne déterminée peut la contourner. La minification complique la tâche sans l'empêcher.
- **Connexion non officielle** : la connexion directe repose sur une bibliothèque non officielle. TikTok peut la
  casser à tout moment ; la version 2.4.0 (MIT) ne recevra plus de correctifs sous cette licence. Prévoir de garder
  TikFinity comme plan B dans la communication de vente, et ne pas promettre un fonctionnement garanti.
- **Euler Stream** : service tiers gratuit mais limité ; avec beaucoup d'acheteurs, des connexions peuvent être
  refusées. Chaque acheteur peut saisir sa propre clé gratuite. Lire leurs conditions d'utilisation avant la vente.
- **Images des cadeaux** : aucune image TikTok n'est livrée avec le jeu. Les vraies images arrivent avec les
  événements du live, avec des emojis en secours.
- **Musique** : l'acheteur doit utiliser des musiques dont il a les droits de diffusion.
