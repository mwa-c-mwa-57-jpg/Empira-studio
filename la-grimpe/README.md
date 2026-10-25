# 🧗 La Grimpe — live TikTok interactif

Gégé, un petit grimpeur au bonnet rouge, escalade une tour géante pendant ton live :

- 👆 **Les taps** lui donnent de l'énergie et le font grimper. Sans taps, il fatigue, s'accroche au bord… puis **glisse** jusqu'au dernier refuge.
- 🎁 **Les cadeaux** débloquent les **17 refuges** (de TikTok à Léon et Lili) et ont chacun leur effet : le panda le porte, le cygne l'emporte, le taureau le propulse…
- 🪢 **La cordée** : les plus gros donateurs sont accrochés à sa corde, avec leur photo. Le premier a la couronne 👑 et peut se faire « couper la corde ».
- 💬 **Le chat** : `!prout`, `!klaxon`, `!applause`… déclenchent des sons ; les mini-jeux se jouent en écrivant dans le chat.
- 🤖 **L'autopilote** : Gégé toque à l'écran, sort sa pancarte, appelle les spectateurs par leur pseudo, boude, et lance des mini-jeux tout seul.
- 🎛️ **La régie** sur ta tablette : soundboard, faire parler Gégé, scènes, mini-jeux, écran de fin.

---

## 1. Installation (une seule fois)

1. Installe **Node.js** (version LTS) : <https://nodejs.org/fr> → bouton vert « LTS » → installe avec les options par défaut.
2. Récupère ce dossier sur ton ordinateur :
   - soit depuis GitHub : bouton vert **Code** → **Download ZIP** (choisis la branche `claude/la-grimpe-live`), puis décompresse ;
   - soit avec git : `git clone https://github.com/mwa-c-mwa-57-jpg/Empira-studio.git` puis `git checkout claude/la-grimpe-live`.
3. Ouvre le dossier **`la-grimpe`**.
4. Mets ton pseudo TikTok dans **`config.json`** (ouvre-le avec le Bloc-notes) :
   ```json
   "tiktok": {
     "pseudo": "ton_pseudo_sans_arobase",
   ```

Les dépendances s'installent toutes seules au premier lancement.

## 2. Tester en mode démo (sans être en live)

- **Windows** : double-clique sur **`demo-windows.bat`**
- **Mac** : double-clique sur **`demo-mac.command`** (la première fois : clic droit → Ouvrir)
- Ou dans un terminal : `npm install` puis `npm run demo`

Une fenêtre noire s'ouvre avec les adresses. Garde-la ouverte pendant tout le live.

1. Ouvre **<http://localhost:3000/overlay.html>** dans Chrome : c'est ce que verront les spectateurs.
2. Ouvre **<http://localhost:3000/regie.html>** dans un autre onglet (ou sur la tablette, voir plus bas).
3. Dans la régie, section **🧪 Simulation** : active « Faux spectateurs automatiques », ou envoie des cadeaux et des taps toi-même.

> Clique une fois dans la page de l'overlay pour autoriser le son dans Chrome (OBS n'en a pas besoin).

## 3. Le jour du live

1. Lance **`lancer-windows.bat`** (ou **`lancer-mac.command`**). La fenêtre affiche `MODE LIVE — @ton_pseudo`.
2. Démarre ton live. Le serveur se connecte tout seul dès que tu es en live (il réessaie toutes les 30 secondes).
3. Dans la régie, la pastille passe à **🟢 Live connecté**.

### Ajouter l'overlay au live

**Avec TikTok LIVE Studio**
- Ajoute une source **« Lien »** (ou « Navigateur / Web ») si ta version la propose : adresse `http://localhost:3000/overlay.html`, taille **1080 × 1920**.
- Sinon : double-clique sur **`fenetre-overlay-windows.bat`**. Une fenêtre Chrome au format vertical s'ouvre ; ajoute une source **« Capture de fenêtre »** sur cette fenêtre. Pour le son, active la capture du son de l'ordinateur dans les paramètres audio de LIVE Studio.

**Avec OBS** (avec une clé de stream TikTok)
- Source → **Navigateur** → URL `http://localhost:3000/overlay.html`, largeur **1080**, hauteur **1920**, coche **« Contrôler l'audio via OBS »**.

**Options d'affichage** (à ajouter à la fin de l'adresse) :
- `?ciel=0` : ciel transparent, ta caméra reste visible derrière la tour ;
- `?muet=1` : l'overlay ne joue aucun son (si tu préfères les sons sur la tablette).

### La régie sur la tablette ou le téléphone

L'appareil doit être sur le **même Wi-Fi** que le PC. Tape l'adresse affichée dans la fenêtre noire, du type `http://192.168.1.23:3000/regie.html`.

Si la page ne s'ouvre pas : autorise Node.js dans le pare-feu Windows (« Réseaux privés ») quand Windows le demande.

### Pendant le live

- Toutes les **20 minutes** sans rien toucher à la régie, la tablette sonne : appuie sur **✋ Je suis là**. Sans réponse 5 minutes plus tard, l'autopilote se met en pause.
- **🏁 Afficher l'écran de fin** avant de couper : altitude, record, podium. Fais une capture pour ton TikTok d'après-live.
- **🔄 Nouveau live** au début du live suivant : tout repart à zéro, sauf le record à battre.

La partie est sauvegardée toutes les 3 secondes (dossier `donnees/`). Si le PC redémarre en plein live, relance simplement : tout reprend où c'était.

---

## Les règles du jeu

| Action | Effet |
|---|---|
| Taps | Remplissent l'énergie et font grimper (plus il y a de taps, plus il va vite) |
| Énergie à zéro | Il s'accroche au bord 7 secondes (« TAPEZ, JE LÂCHE ! »), puis tombe jusqu'au dernier refuge débloqué |
| Le bon cadeau | Débloque le refuge en cours et hisse Gégé jusqu'à lui |
| N'importe quel cadeau | S'ajoute à la **cagnotte** du refuge ; quand elle atteint le prix du cadeau attendu, le refuge s'ouvre |
| Très gros cadeau | Le surplus ouvre les refuges suivants : **MÉGA SAUT** |
| Combo (cadeau envoyé en série) | Animé en direct, compté une seule fois à la fin de la série |

### Les 17 refuges

| # | Cadeau | Pièces | Effet |
|---|---|---|---|
| 1 | TikTok | 1 | Encouragement |
| 2 | Tofu | 5 | Le chat lui monte sur la tête |
| 3 | Rosa | 10 | Petit saut |
| 4 | Fleurs S | 20 | Pluie de pétales |
| 5 | Donut | 30 | Énergie à fond |
| 6 | Amour en langage des signes | 49 | La foule l'acclame |
| 7 | Le petit Ourson | 100 | Câlin : ne glisse plus pendant 30 s |
| 8 | Panda Climb | 199 | Le panda le porte |
| 9 | Corgi | 299 | Le corgi le tire avec une corde |
| 10 | Rose à jamais | 399 | Bouclier doré 1 minute |
| 11 | Corail | 499 | Bulle d'eau |
| 12 | Cygne | 699 | Le cygne l'emporte en vol |
| 13 | Arbre à diamants | 1 088 | Un arbre pousse sous lui |
| 14 | Couple puissant | 2 000 | La girafe le monte sur son cou |
| 15 | Taureau | 2 999 | Charge ultime |
| 16 | Léon le chaton | 4 888 | Léon le porte |
| 17 | Léon et Lili | 9 699 | Grand final vers le sommet |

⚠️ Vérifie dans l'appli les prix de **TikTok, Donut, Corgi, Couple puissant, Léon le chaton** et **Léon et Lili**, puis corrige `config.json` si besoin.

### Mini-jeux (un toutes les 9 minutes avec l'autopilote)

- 🎲 **Vote du destin** : le chat écrit `aide` (échelle géante) ou `piège` (banane, rafale de vent ou pigeon).
- ⚡ **Course aux taps** : atteindre un nombre de taps en 60 secondes (la cible s'adapte à ton audience).
- 🔤 **Mot magique** : le premier qui écrit le mot affiché gagne, avec sa photo à l'écran.
- 🌪️ **Tempête** : l'énergie fond 3 fois plus vite pendant 40 secondes.

### Les sons des cadeaux (sans spam)

- **Petits cadeaux** (roses, TikTok…) : aucun son un par un. Quand une rafale se termine (3 secondes sans nouveau petit cadeau), **un seul applaudissement**.
- **Cadeau de 100 pièces ou plus** : applaudissement à la fin de son alerte.
- **Cadeau de 1 000 pièces ou plus** : Gégé crie « MERCI MERCI BEAUCOUP @pseudo !!! » dans son charabia, puis applaudissement.
- **Cagnotte pleine** (refuge débloqué) : un **coffre** s'ouvre sous la carte du refuge et les pièces s'écroulent sur l'écran, avec le bruit de la cascade de pièces.

Les seuils se règlent dans `config.json` → `sons` (`applaudirDesPieces`, `merciVocalDesPieces`, `secondesFinRafalePetitsCadeaux`).

### Le chef d'orchestre des sons

Deux effets sonores ne se superposent jamais. Chaque son a une priorité :

| Priorité | Sons |
|---|---|
| 1. Immédiat | La **soundboard de l'animateur** (coupe tout le reste), l'écran de fin, le sommet |
| 2. Très haute | Le **coffre** (refuge débloqué), nouveau record, « il va lâcher » et la chute |
| 3. Haute | Applaudissements des **cadeaux de 1 000 puis de 100 pièces**, mini-jeux, toc toc |
| 4. Moyenne | Nouveau premier de cordée, applaudissement de fin de rafale, atterrissage |
| 5. Basse | Paliers de taps, bisou, abonnements et partages (un son toutes les 20 s au plus) |
| 6. Très basse | Les **commandes du chat** (`!prout`…) : elles passent quand c'est calme |
| 7. Ambiance | Le tonnerre : seulement quand rien d'autre ne joue |

Un son beaucoup plus important coupe celui en cours (par exemple le coffre coupe un `!prout`). Sinon, il attend quelques secondes son tour, et il est abandonné s'il n'est plus d'actualité. Quand Gégé parle, les effets baissent pour qu'on l'entende bien.

Tests : `npm test` vérifie entre autres toutes les paires de sons à tous les décalages, et 3 000 lives simulés au hasard, sans aucune superposition.

### Commandes du chat

`!prout` `!klaxon` `!applause` `!bravo` `!tambour` `!badum` `!ding` `!laser` `!wah` — 30 secondes d'attente par spectateur et 4 secondes entre deux sons. Modifiable dans `config.json` → `commandesChat`.

---

## Personnaliser (`config.json`)

| Réglage | Rôle |
|---|---|
| `mascotte.nom` | Le nom du grimpeur |
| `jeu.metresEntreRefuges` | Distance entre deux refuges (300 m) |
| `jeu.perteEnergieParSeconde` | Plus c'est haut, plus il glisse vite sans taps |
| `jeu.tapsParSecondePourVitesseMax` | Nombre de taps par seconde pour grimper à fond |
| `jeu.surplusEnchaineLesRefuges` | `false` pour qu'un cadeau n'ouvre qu'un seul refuge |
| `autopilote.minutesEntreMiniJeux` | Fréquence des mini-jeux |
| `autopilote.secondesEntrePancartes` | Délai minimum entre deux demandes de cadeau |
| `autopilote.phrasesBandeau` | Les phrases qui défilent en bas de l'écran |
| `presence.minutesAvantAlerte` | Délai avant que la tablette te demande si tu es là |
| `sons.fichiersPerso` | Remplacer un son par ton MP3, ex. `{ "prout": "sons/mon-prout.mp3" }` (fichier à mettre dans `public/sons/`) |
| `objectifs` | Les 17 refuges : nom, prix, image, noms acceptés (`alias`) et effet |

Après une modification, ferme la fenêtre noire et relance.

---

## En cas de problème

| Problème | Solution |
|---|---|
| « config.json est illisible » | Une virgule ou un guillemet manque. Colle le fichier sur <https://jsonlint.com> pour trouver l'erreur. |
| « Le port 3000 est déjà utilisé » | La Grimpe tourne déjà dans une autre fenêtre : ferme-la. |
| La régie affiche « En attente du live » | Normal tant que tu n'es pas en live. Vérifie aussi le pseudo dans `config.json`. |
| « Erreur » en boucle à la connexion | Le service de signature gratuit est peut-être saturé. Crée une clé gratuite sur <https://www.eulerstream.com> et mets-la dans `"signApiKey"`. |
| Pas de son sur l'overlay | Clique une fois dans la page (Chrome) ou coche « Contrôler l'audio via OBS ». |
| La tablette n'ouvre pas la régie | Même Wi-Fi que le PC ? Pare-feu Windows : autorise Node.js sur les réseaux privés. |

**Bon à savoir** : la connexion à TikTok passe par une bibliothèque non officielle (`tiktok-live-connector`). Si TikTok change quelque chose, la connexion peut tomber. L'overlay et la soundboard continuent de marcher, et une mise à jour (`npm install tiktok-live-connector@latest`) règle généralement le problème.

Règles TikTok : reste présent pendant le live et laisse le jeu réagir aux vrais spectateurs. La simulation est automatiquement bloquée en mode live.

---

## Pour les développeurs

- `server.js` : serveur HTTP + WebSocket, sauvegarde, commandes de la régie
- `src/jeu.js` : toute la logique (altitude, énergie, refuges, cagnotte, autopilote, mini-jeux)
- `src/tiktok.js` : connexion TikTok et conversion des événements
- `src/demo.js` : faux spectateurs du mode démo
- `public/overlay.html` + `js/overlay.js` + `js/mascotte.js` : rendu (canvas 1080×1920)
- `public/regie.html` + `js/regie.js` : régie
- `public/js/sons.js` : sons générés avec la Web Audio API et voix « charabia »
- `npm test` : tests de la logique de jeu
