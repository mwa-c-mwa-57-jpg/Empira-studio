# Le prompt idéal — « Print Booth Live »

> Ce prompt a été écrit à partir de l'analyse image par image de la vidéo de référence
> (live TikTok « PRINT BOOTH – PENCIL PRINTS »). Il est autonome : on peut le donner tel quel
> à un développeur ou à une IA de code pour reconstruire l'application.
> L'application de ce dépôt est l'implémentation de ce prompt.

---

## Rôle

Tu es un développeur senior spécialisé dans les overlays interactifs pour le live
(TikTok LIVE Studio, OBS), en **Three.js** (3D temps réel dans le navigateur) et en **Node.js**.
Tu livres un produit fini, testé, utilisable par un créateur non-technicien.

## Contexte : ce que montre la vidéo de référence

Un live TikTok vertical (9:16) entièrement occupé par une scène 3D :

1. **La machine** : une imprimante à portique (traceur XY) vue de trois-quarts, depuis le haut,
   posée sur un parquet en bois orangé.
   - Deux longs rails chromés sur les côtés, qui partent du fond et sortent par le bas de l'écran.
   - Au fond, un caisson sombre d'où sort un long rouleau de papier crème.
   - Une barre transversale chromée (avec deux blocs de fixation sur les rails) avance le long du papier.
   - Un chariot (tête d'impression gris métal, dessous noir) fait des allers-retours sur la barre,
     avec une lumière blanche qui éclaire le papier sous lui.
2. **L'impression** : la barre balaie le papier de haut en bas, le chariot fait des passes
   gauche-droite et l'image apparaît ligne par ligne derrière lui (comme une vraie imprimante).
   - Une impression standard est la **photo de profil TikTok** du spectateur, dans un cercle,
     dans un cadre carré au trait fin, avec son **pseudo** écrit en dessous et un petit cœur.
   - Plusieurs petites impressions tiennent sur une page.
3. **La file d'attente** : chaque action d'un spectateur l'ajoute à une « draw queue ».
   Une petite notification apparaît en bas :
   « *Pseudo* follow — added to the draw queue. » (variantes : join, comment, gift).
   Pendant une impression, un statut affiche : « Drawing *Nhia* – gift 9 coins – 3 »
   (qui est imprimé, combien de coins, combien attendent).
4. **Les cadeaux** : une légende en bas à droite montre des paliers
   **1 COIN · 10 COINS · 20 COINS · 30 COINS · 60 COINS · 100 COINS**
   (les paliers premium sont en jaune). Plus le cadeau est gros, plus l'impression est
   grande et décorée. Exemple vu : un cadeau de 30 coins → une impression **pleine page**
   avec décor de fête (lanternes rouges, fleurs, nuages dorés) autour de l'avatar.
   Les cadeaux d'un même spectateur s'additionnent tant qu'il attend son tour.
5. **L'avance papier** : quand la page est pleine ou après une impression pleine page,
   le papier avance vers la caméra (les impressions glissent vers le bas de l'écran et
   grossissent avec la perspective) et une page vierge sort du caisson.
6. **L'habillage** : logo en haut à gauche « PRINT BOOTH » (lettres 3D grises),
   « PENCIL PRINTS » (rose) et un badge rouge « LIVE ».
   L'interface TikTok (chat en bas à gauche, cœurs à droite) se superpose : les éléments
   importants ne doivent pas être cachés par elle.

## Objectif

Construire **« Print Booth Live »** : une application à installer sur le PC du créateur
(Windows en priorité, Mac compatible) qui reproduit ce concept, se connecte à son live
TikTok et s'affiche dans TikTok LIVE Studio (ou OBS) comme source navigateur / lien.

## Architecture imposée

- **Serveur local Node.js (≥ 20)**, lancé par double-clic, qui :
  - se connecte au live TikTok avec la librairie `tiktok-live-connector` (juste le @pseudo,
    sans mot de passe) et normalise les événements : arrivée, follow, partage, commentaire,
    likes, cadeaux (gestion des combos : ne compter un cadeau combo qu'à la fin de la série) ;
  - détient **la file d'attente et la mise en page** (source de vérité unique), pour que
    plusieurs overlays ouverts (aperçu + TikTok LIVE Studio) affichent exactement la même chose ;
  - sert l'overlay et le tableau de bord en HTTP, et pousse tout en temps réel par WebSocket ;
  - sert de relais (proxy) pour les photos de profil TikTok, limité aux CDN TikTok, avec cache ;
  - écoute uniquement sur `127.0.0.1` et refuse les WebSocket d'une autre origine.
- **Overlay** (`/overlay`, 1080×1920) : page web Three.js, aucune dépendance CDN
  (three.js et polices servis en local depuis `node_modules`).
- **Tableau de bord** (`/`) : page web en français pour piloter le live.
- **Aucune étape technique** pour l'utilisateur : un fichier `LANCER-WINDOWS.bat`
  (et `LANCER-MAC.command`) vérifie Node.js, installe les dépendances la première fois,
  démarre le serveur et ouvre le tableau de bord.

## Fonctionnalités détaillées

### 1. Connexion TikTok
- Champ « @pseudo », boutons Se connecter / Déconnecter, connexion auto au démarrage.
- États clairs : déconnecté, connexion…, connecté (nombre de spectateurs), hors live,
  erreur. Reconnexion automatique avec délai croissant si le live coupe ou n'a pas commencé.
- Clé API Euler Stream optionnelle (signature) dans les réglages, en cas de limite de débit.

### 2. File d'impression et paliers
- Événements activables un par un : arrivée, follow, partage, commentaire (mot-clé optionnel,
  ex. « dessine »), likes (seuil par spectateur), cadeaux.
- **Priorité** : les cadeaux passent devant (triés par coins cumulés), puis follow > partage >
  commentaire > likes > arrivée, puis ordre d'arrivée.
- Pas de doublon : un spectateur déjà dans la file n'est pas ajouté deux fois ;
  s'il envoie un cadeau, ses coins s'additionnent et son impression monte de palier.
- Délai anti-spam : un spectateur déjà imprimé ne revient qu'après N minutes (sauf cadeau).
- File limitée (ex. 40) : si elle est pleine, l'entrée la moins prioritaire est retirée.
- Paliers par défaut (seuils modifiables) :

  | Déclencheur | Impression | Taille |
  |---|---|---|
  | Gratuit (arrivée, follow, commentaire…) | Croquis au crayon | petite |
  | 1 coin | Croquis au crayon | petite + |
  | 10 coins | Croquis au crayon | moyenne |
  | 20 coins | Portrait couleur | grande |
  | 30 coins | Décor de fête (lanternes, fleurs) | pleine page |
  | 60 coins | Cadre royal doré + couronne | pleine page |
  | 100 coins | « Légende » : or, rayons, étoiles, bannière | pleine page |

- La mise en page est calculée par le serveur : rangées centrées, plusieurs petites
  impressions par page, une seule si pleine page ; avance papier quand ça ne rentre plus.
- L'overlay ne consomme la file que s'il est ouvert (sinon la file attend).
- Avance papier automatique après X secondes d'inactivité.

### 3. Scène 3D (fidèle à la vidéo)
- Parquet bois procédural, papier crème légèrement texturé, rails et barre chromés
  (reflets via un environnement), caisson sombre au fond, ombres douces, lumière sous le chariot.
- Impression = balayage ligne par ligne synchronisé avec la barre (axe avant/arrière)
  et le chariot (axe gauche/droite), révélation exacte de l'image derrière la tête.
- Effet « crayon » : conversion de la photo en croquis graphite (niveaux de gris,
  dodge, grain papier). Paliers couleur et décorés dessinés en vectoriel sur canvas.
- Si la photo ne charge pas : avatar de remplacement (initiale sur dégradé).
- Avance papier animée (3 pages visibles) ; à la reconnexion d'un overlay, les pages
  déjà imprimées sont redessinées instantanément.
- Sons optionnels (moteur pas-à-pas, avance papier) générés en Web Audio.
- Fluide à 60 i/s : textures mises à jour uniquement quand nécessaire.

### 4. Habillage (HTML par-dessus la 3D)
- Logo haut-gauche personnalisable (titre, sous-titre, badge).
- Notifications « Pseudo follow — ajouté à la file d'impression. » (anti-flood : 3 max).
- Statut d'impression : « 🖨️ Pseudo · cadeau 9 coins · 3 en attente ».
- Légende des paliers en bas à droite (premium en jaune, palier en cours mis en avant).
- Langue FR / EN.

### 5. Tableau de bord (français)
- Statut de connexion, nombre de spectateurs, nombre d'overlays ouverts.
- Adresse de l'overlay à copier + bouton aperçu + mini-guide TikTok LIVE Studio / OBS.
- Boutons de test (simuler arrivée, follow, commentaire, chaque palier de cadeau, rafale)
  pour répéter **avant** le live, sans être connecté.
- File en direct : impression en cours, liste d'attente, retirer, « imprimer maintenant ».
- Commandes : pause / reprise, vider la file, avancer le papier, effacer le papier.
- Réglages enregistrés dans `config.json` et appliqués en direct.
- Journal des derniers événements.

### 6. Installation et lancement
- `README.md` en français, pas à pas, pour un non-technicien : installer Node.js LTS,
  télécharger le dossier, double-cliquer sur le lanceur, ajouter la source dans
  TikTok LIVE Studio (ou OBS), faire un test, lancer le live.
- Tests automatisés de la logique (file, priorités, paliers, mise en page) avec `node --test`.

## Contraintes
- Code lisible, commenté là où c'est utile, sans framework front (modules ES natifs).
- Rien ne doit planter si TikTok change un champ : lecture défensive des événements.
- Ne jamais demander d'identifiants TikTok. Respecter les règles TikTok LIVE.

## Critères d'acceptation
1. Double-clic sur le lanceur → le tableau de bord s'ouvre, sans commande à taper.
2. Bouton « Simuler un follow » → l'overlay affiche la notification, la barre et le chariot
   impriment l'avatar ligne par ligne, puis la machine revient en position.
3. Cadeau 30 coins pendant que des follows attendent → il passe devant, avance papier,
   impression pleine page décorée.
4. Deux overlays ouverts → ils montrent la même chose ; recharger l'un d'eux restaure le papier.
5. Connexion à un vrai live → arrivées / follows / commentaires / cadeaux alimentent la file.
6. `npm test` passe.

## Livrables
Le code complet, `README.md`, ce `PROMPT.md`, les lanceurs Windows/Mac, `config.default.json`,
et les tests.
