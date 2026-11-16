# 09 — « La Guerre des Départements » : version vendue

Reconstruite d'après le cahier des charges « Prompt : La Guerre des Départements » (artifact Empira).
Code source : `produit/`. Version à livrer : `npm run build:produit` → `dist/La-Guerre-des-Departements/`.

## Ce que contient le dossier livré
| Fichier | Rôle |
|---|---|
| `LANCER LE JEU.bat` | démarre le serveur local et ouvre la page de démarrage |
| `demarrer.html` | licence, pseudo TikTok, vérifications (TikFinity, voix, musique), couleurs, voix, adresse à copier |
| `guerre-des-departements.html` | **le jeu, en un seul fichier** (code minifié, aucune dépendance externe) |
| `outils/serveur.ps1` | serveur Windows (PowerShell 5.1) : fichiers, `/parler`, `/voix`, `/musiques`, `/licence` |
| `musique/`, `images/` | MP3 de l'acheteur ; `images/logo-empira.png` facultatif (sinon le logo est dessiné) |
| `GUIDE.html` | guide d'installation pour l'acheteur |

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
- `npm test` : tests unitaires, dont 26 pour la version vendue (moteur, TikFinity, thème, voix).
- `npm run test:produit` : test navigateur avec un **faux TikFinity**. Il vérifie le flux d'événements, la
  reconnexion après une coupure, les commandes (refusées pour un spectateur, acceptées pour l'hôte et les
  modérateurs), le podium, la voix envoyée au serveur, la page de démarrage, le blocage sans licence, l'activation
  et l'absence de démo.

## Non testé (à faire avant la mise en vente)
- ❌ **`serveur.ps1` n'a jamais été exécuté** : PowerShell n'a pas pu être installé dans l'environnement de
  développement. Les tests utilisent un serveur Node qui l'imite. À tester sur un PC Windows : voix, liste des
  voix, musiques, licence, protection contre la traversée de dossier, et port déjà utilisé.
- ❌ **Format des messages TikFinity** : supposé conforme à TikTok-Live-Connector (`{event, data}`). À confirmer
  avec TikFinity ouvert sur un vrai live, et à vérifier aussi : l'API WebSocket est-elle gratuite ou réservée à TikFinity Pro ?
- ❌ **Lemon Squeezy** : non testé sans compte. Renseigner `$LemonProduitId` dans `serveur.ps1` et régler la
  limite de 2 activations dans Lemon Squeezy.
- ❌ **TikTok LIVE Studio** : source « Lien », son (lecture automatique de la musique et des bruitages) et performances à vérifier.

## Points d'attention pour la vente
- **Nom** : « La Guerre des Départements » est le nom affiché par le jeu de la vidéo de référence (éditeur tiers).
  Vendre un produit sous le même nom expose à un risque juridique (marque, parasitisme). Le titre se change dans
  `produit/src/config.js` (`TITRE`) et `page.html`. Faire valider le nom par un juriste.
- **Protection de la licence** : la vérification se fait sur le PC de l'acheteur, dans des fichiers qu'il possède.
  Une personne déterminée peut la contourner. La minification complique la tâche sans l'empêcher.
- **Images des cadeaux** : aucune image TikTok n'est livrée avec le jeu. Les vraies images arrivent de TikFinity
  pendant le live, avec des emojis en secours.
- **Musique** : l'acheteur doit utiliser des musiques dont il a les droits de diffusion.
