# 09 — « Empira Conquest — La bataille des départements » : version vendue

Reconstruite d'après le cahier des charges Empira (artifact « Prompt : La Guerre des Départements »). Le nom a été
changé pour ne pas reprendre celui du jeu de la vidéo de référence ; il se règle dans `produit/src/config.js`
(`TITRE`, `SOUS_TITRE`).
Code source : `produit/`. Version à livrer : `npm run build:produit` → `dist/Empira-Conquest/`.

## Ce que contient le dossier livré
| Fichier | Rôle |
|---|---|
| `LANCER LE JEU.bat` | démarre le serveur local (`outils/node.exe outils/serveur.cjs`) et ouvre la fenêtre de pilotage |
| `demarrer.html` | **fenêtre de pilotage unique** : licence, connexion au live (pseudo → Connecter), vérifications (voix, musique), couleurs, voix, régie par boutons, adresse à copier |
| `outils/jeu.bin` | **le jeu, chiffré** (AES-256-GCM) : le serveur ne le déchiffre, en mémoire, qu'avec une licence valide et le sert sur `/empira-conquest.html` |
| `outils/serveur.cjs` | serveur Node, **code protégé** : fichiers, réception du live (direct ou TikFinity), relais WebSocket `/evenements`, régie `/commande`, `/parler`, `/voix`, `/musiques`, `/licence` |
| `outils/bibliotheques.cjs` | bibliothèques libres (tiktok-live-connector et dépendances), non protégées, à part pour respecter leurs licences |
| `outils/node.exe` | Node.js v22.22.0 pour Windows (rien à installer chez l'acheteur) |
| `LICENCES-TIERS.txt` | licences des bibliothèques embarquées (MIT, BSD, Apache) et de Node.js |
| `musique/`, `images/` | MP3 de l'acheteur ; `images/logo-empira.png` facultatif (sinon le logo est dessiné) |
| `GUIDE.html` | guide d'installation pour l'acheteur |

## Licence payante et protections
Réglages de vente dans `produit/vente.json` (aucun secret) : `storeId` (ID de la boutique Lemon Squeezy), `produitId`
(ID du produit) et `urlAchat` (lien de paiement, affiché par le bouton « Acheter une clé »). **Sans `storeId` et
`produitId`, la version vendue refuse toutes les clés** (l'assemblage l'annonce par un avertissement).

| Protection | Ce qu'elle empêche |
|---|---|
| Boutique et produit vérifiés à l'activation et à chaque vérification | utiliser une clé Lemon Squeezy d'un autre produit, ou d'une boutique créée par le pirate ; une clé étrangère activée par erreur est aussitôt libérée |
| Activation limitée à 2 PC (réglage Lemon Squeezy) + « Libérer ce PC » | partager une clé entre amis |
| Fichier de licence chiffré et scellé avec l'identifiant du PC (MachineGuid) et un secret d'assemblage | copier la licence sur un autre PC, modifier les dates à la main |
| Révocation sans tolérance, horloge reculée détectée | couper Internet après un remboursement, reculer l'horloge pour prolonger les 5 jours hors ligne |
| Vérification au lancement puis toutes les 6 h ; une clé révoquée bloque le jeu en direct | continuer à jouer après un remboursement |
| Refus si Node est lancé avec `NODE_OPTIONS`, `NODE_EXTRA_CA_CERTS`, `NODE_TLS_REJECT_UNAUTHORIZED=0`, des options en ligne de commande… | intercepter la vérification avec un faux serveur Lemon Squeezy et un faux certificat |
| Adresse de Lemon Squeezy gravée dans le code (pas de variable de remplacement dans la version vendue) | rediriger la vérification |
| Jeu chiffré sur le disque, servi seulement avec licence ; régie, connexion au live et WebSocket refusés sans licence | ouvrir le fichier du jeu directement, ou retirer la vérification de la page |
| Code obfusqué (javascript-obfuscator) : serveur avec aplatissement du flux de contrôle, code mort, textes chiffrés (RC4) ; jeu avec textes encodés et auto-défense ; **le jeu ne tourne que servi par `localhost`/`127.0.0.1`** | lire et modifier le code, héberger le jeu extrait sur un site |

Limites (à dire honnêtement) : tout code qui s'exécute sur le PC de l'acheteur peut être désobfusqué par une personne
très motivée. Ces protections arrêtent le partage de clé, la copie de dossier et les astuces courantes, pas un pirate
expérimenté. Une protection plus forte demanderait un petit serveur de licence à nous (réponses signées), ou de
garder une partie du jeu en ligne.

**Secret d'assemblage** : `produit/.secret-vente` (jamais dans git, créé au premier assemblage). Il doit rester le
même pour toutes les versions, sinon les acheteurs devront ressaisir leur clé. À sauvegarder en lieu sûr ; on peut
aussi le fournir par la variable `EMPIRA_SECRET_VENTE`.

**Clé API Euler Stream d'Empira** (facultative) : placée dans `produit/.cle-euler` (jamais dans git) ou dans la
variable `EMPIRA_CLE_EULER`, elle est incluse, chiffrée par l'obfuscateur, dans la version vendue. Les acheteurs ne
dépendent alors plus de la limite gratuite ; une clé saisie par l'acheteur reste prioritaire. Une clé incluse dans un
logiciel peut toujours être extraite par un expert : prendre une clé dédiée au produit, avec un quota surveillé, et
vérifier que les conditions d'Euler Stream autorisent cet usage.

**Dépôt GitHub** : il est **public**. N'importe qui peut donc lire le code source et assembler une version sans
licence. Le passer en privé est la première protection à mettre en place.

## Réception du live : connexion directe ou TikFinity
Le serveur se connecte lui-même au live avec **tiktok-live-connector 2.4.0** (licence MIT ; les versions 2.5.0 et
suivantes sont passées sous AGPL-3.0, incompatible avec une vente fermée : la version est figée). L'animateur entre son
pseudo dans la fenêtre de pilotage ; le pseudo est retenu (`%APPDATA%/EmpiraConquest/reglages.json`) et la
connexion est relancée automatiquement aux démarrages suivants, avec reconnexion en cas de coupure (5 s → 60 s).
Les événements (tchat, likes, cadeaux, abonnements, partages) sont convertis au format attendu par le jeu et relayés en
WebSocket à la page affichée dans LIVE Studio. La régie de la fenêtre de pilotage envoie les mêmes commandes que le
tchat (`!fin`, `!vague`…), par boutons.

**TikFinity passe aussi par le serveur** (le jeu ne parle qu'au serveur). Trois modes dans la fenêtre de pilotage :
« Automatique » (par défaut : TikFinity s'il répond sur `ws://127.0.0.1:21213`, sinon connexion directe, bascule
toute seule dans les deux sens), « Connexion directe uniquement », « TikFinity uniquement ».

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
- `npm test` : tests unitaires, dont 37 pour la version vendue (moteur, conversion des événements, thème, voix,
  conversion TikTok v3, licence et ses protections avec un faux Lemon Squeezy, serveur avec un faux live, modes
  automatique / direct / TikFinity avec un faux TikFinity).
- `npm run test:produit` : test navigateur sur les **vrais serveurs assemblés** : `dist/dev`, `dist/essai-vente` (copie
  protégée identique à la version vendue, mais boutique fictive et faux Lemon Squeezy) et `dist/Empira-Conquest`
  (vérifie que l'adresse de remplacement et le mode test y sont ignorés, que le jeu n'existe que chiffré et que le code
  est illisible). Le live est simulé par un faux live intégré au mode test (`EMPIRA_TEST=1`, retiré de la version vendue). Il vérifie la connexion
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
- ❌ **Lemon Squeezy** : testé uniquement avec un faux serveur. Renseigner `produit/vente.json` et
  régler la limite de 2 activations dans Lemon Squeezy, puis faire un achat test en mode test de Lemon Squeezy.
- ❌ **TikTok LIVE Studio** : source « Lien », son (lecture automatique de la musique et des bruitages) et performances à vérifier.

## Points d'attention pour la vente
- **Nom** : renommé « Empira Conquest — La bataille des départements » (marque Empira). Vérifier sur la base INPI
  que « Empira Conquest » est libre, et envisager un dépôt de marque.
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
