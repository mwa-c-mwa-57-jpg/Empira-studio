# 02 — Recherche technique et choix d'architecture

Date : 30/10/2026. Légende : ✅ vérifié pendant cette session · 🔎 source consultée, non testée · ❓ à vérifier.

## A. Recevoir les événements d'un live TikTok

### Situation de l'offre officielle
- ❓ Aucune API officielle et publique de TikTok donnant accès en temps réel aux cadeaux, likes et commentaires
  d'un live n'a été trouvée lors de cette recherche. Les résultats ne renvoient qu'à des outils communautaires.
  **À confirmer directement sur <https://developers.tiktok.com>** et auprès de TikTok : un partenariat ou un
  programme réservé aux agences peut exister sans être documenté publiquement.
- ❓ TikTok LIVE Studio (le logiciel de diffusion de TikTok) n'a pas été évalué : il faut vérifier s'il accepte
  une source navigateur ou une capture de fenêtre, et à quelles conditions.

### TikTok-Live-Connector (Node.js), retenu pour l'adaptateur expérimental
- ✅ Paquet npm `tiktok-live-connector`, **version 2.5.0**, mis à jour le 16/09/2026 (`npm view`).
  Dépôt : <https://github.com/zerodytrash/TikTok-Live-Connector>.
- ✅ D'après sa documentation : API `new TikTokLiveConnection(username)`, événements `chat`, `gift`, `like`,
  `follow`, `share`, `member`, `roomUser`, `streamEnd`, etc. Il suffit du nom du compte en live.
- ✅ Il se connecte au service interne « Webcast » de TikTok : c'est de la **rétro-ingénierie, pas une API
  officielle**. La signature des connexions est déléguée à un **service tiers, Euler Stream** (clé API facultative
  `signApiKey`, offres payantes possibles).
- ✅ Limites documentées par la bibliothèque :
  - l'événement `like` n'est pas toujours émis sur les lives à forte audience ;
  - les cadeaux « en série » (giftType 1) arrivent plusieurs fois et seul l'événement `repeatEnd` doit être compté
    (géré dans `server/adapters/tiktok-live.js`, et testé).
- Risques : panne à chaque changement interne de TikTok, dépendance à un tiers pour la signature, zone grise
  au regard des conditions d'utilisation, et **risque pour le compte** si l'on envoie des messages automatisés
  (fonction volontairement non utilisée ici).
- 🔎 Équivalents dans d'autres langages : TikTokLive (Python, <https://github.com/isaackogan/TikTokLive>),
  TikTok-Live-Java (<https://github.com/jwdeveloper/TikTok-Live-Java>).

**Conséquence sur l'architecture :** la source d'événements est isolée derrière un **adaptateur**. Le jeu ne
connaît qu'un format d'événement normalisé. Si TikTok ouvre une API officielle, ou si Empira choisit un
fournisseur tiers comme TikFinity, Streamer.bot ou un webhook, il suffira d'écrire un nouvel adaptateur
d'environ 50 lignes sans toucher au jeu.

### Outils existants pour créateurs
- 🔎 **TikFinity** (<https://tikfinity.zerody.one>) : alertes, synthèse vocale, overlays, intégrations (Streamer.bot,
  Minecraft…). Le cœur de l'outil se présente comme gratuit. Le prix « Pro » (19 $/mois) n'apparaît que sur une page
  comparative d'un concurrent ([BetterTok](https://bettertok.app/compare/bettertok-vs-tikfinity)) : ❓ à vérifier.
- 🔎 Des jeux interactifs vendus sur itch.io (par exemple
  [Champions Game](https://barrage-game.itch.io/champions-game-interactive-tiktok-live-game),
  [Block Builder](https://gametikstudio.itch.io/block-builder)) s'appuient souvent sur TikFinity comme source d'événements.
- Valeur ajoutée possible d'un outil sur mesure pour Empira : identité visuelle propre à chaque créateur,
  règles configurables, données et statistiques appartenant à l'agence, et absence de dépendance à un
  abonnement tiers pour le jeu lui-même. Une comparaison complète des tarifs et fonctionnalités reste à faire (❓).

## B. Moteurs de jeu : comparaison pour ce besoin

| Critère | Web (Canvas/JS, choisi) | Godot 4 | Unity | GDevelop | Unreal |
|---|---|---|---|---|---|
| Prototype rapide | ★★★ | ★★★ | ★★ | ★★★ | ★ |
| 2D lisible et fluide | ★★★ | ★★★ | ★★★ | ★★ | ★ |
| Intégration OBS | source navigateur native | capture de fenêtre | capture de fenêtre | export web possible | capture de fenêtre |
| Brancher des événements réseau | natif (SSE, WebSocket) | à coder | à coder | extensions | à coder |
| Installation chez le créateur | Node uniquement | exécutable | exécutable | exécutable ou web | exécutable lourd |
| Tests automatisés | Node `--test` + Playwright | GUT | Unity Test Runner | limité | complexe |
| Coût | 0 € | 0 € | licence selon le CA | gratuit / payant | redevances |
| 3D future | Three.js / Babylon.js | ★★★ | ★★★ | limité | ★★★ |

Les outils « IA » (Rosebud AI et autres générateurs) ont été écartés pour le cœur du jeu : ils sont utiles pour
des maquettes, mais on ne maîtrise ni le code produit, ni sa testabilité, ni la gestion d'événements en temps
réel. ❓ Ils n'ont pas été testés pendant cette session.

## C. Deux architectures crédibles comparées

**Architecture 1 — retenue pour le prototype : « tout navigateur + mini-serveur local »**
```
[Simulateur] ─┐
[TikTok adapter (Node)] ─► serveur local (SSE) ─► page de jeu (OBS) : règles → moteur → rendu
[Régie control.html] ─┘
```
- Avantages : zéro dépendance, lancement par double-clic, la source navigateur OBS est le jeu lui-même,
  itération immédiate et tests faciles.
- Limites : l'état du jeu vit dans la page, donc deux pages ouvertes jouent deux parties distinctes ; tout tourne
  sur le PC du créateur.

**Architecture 2 — cible « plateforme » (phase 5-6)**
```
Connecteurs (1 par créateur) ─► file d'événements ─► serveur de jeu autoritaire (état, règles)
     ─► WebSocket ─► overlays OBS (rendu seul) + espace créateur web + base de données (stats, configs)
```
- Avantages : multi-créateurs, statistiques centralisées, administration, mises à jour à distance.
- Limites : hébergement, comptes, sécurité, coûts récurrents. **Prématuré** tant que l'intérêt du jeu n'est pas validé en live.

Le code du prototype est découpé pour faciliter cette migration : `rules.js` et `engine.js` n'ont aucune
dépendance au navigateur. Ils tournent déjà sous Node dans les tests et pourront devenir le serveur autoritaire.

## Sources
- <https://npmjs.com/package/tiktok-live-connector> (documentation consultée via `npm view`)
- <https://github.com/zerodytrash/TikTok-Live-Connector>
- <https://github.com/isaackogan/TikTokLive>
- <https://github.com/jwdeveloper/TikTok-Live-Java>
- <https://tikfinity.zerody.one>
- <https://bettertok.app/compare/bettertok-vs-tikfinity>
- <https://barrage-game.itch.io/champions-game-interactive-tiktok-live-game>
- <https://gametikstudio.itch.io/block-builder>
