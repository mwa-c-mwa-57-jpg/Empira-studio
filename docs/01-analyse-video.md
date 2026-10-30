# 01 — Analyse de la vidéo de référence

## Statut : vidéo non reçue

La demande mentionne une vidéo de référence « fournie avec cette demande ». **Aucune vidéo n'était
présente** : ni pièce jointe dans la conversation, ni fichier dans le dépôt (qui ne contenait qu'un `README.md`).
L'analyse n'a donc **pas pu être réalisée**, et ce document ne prétend pas l'avoir faite.

Le prototype a été conçu à partir de la description écrite du projet : carte à territoires, factions, unités
animées, conquêtes, interactions par likes, commentaires et cadeaux.

## Comment compléter cette analyse

Déposez la vidéo dans le dépôt (par exemple `docs/reference/video.mp4`) ou envoyez-la dans la conversation.
L'analyse suivra alors la grille ci-dessous, en distinguant systématiquement **observé**, **déduit** et **non confirmable**.

| # | Élément | Questions à trancher | Impact sur le prototype |
|---|---|---|---|
| 1 | Structure de la carte | Carte réelle, grille ou provinces libres ? Combien de zones ? | `map.cols/rows`, forme des territoires |
| 2 | Territoires | Couleur pleine, bordures, chiffres de garnison ? | rendu de `renderer.js` |
| 3 | Unités | Sprites, nombre visible, taille relative ? | `units` dans la configuration |
| 4 | Déplacements | Chemins, vitesse, regroupements ? | `engine.js` (`chooseTarget`) |
| 5 | Conquêtes | Bascule instantanée ou progressive ? | règle de capture |
| 6 | Affrontements | Combat au contact, projectiles, PV ? | `resolveClashes` |
| 7 | Animations | Effets de capture, secousses, particules ? | effets visuels |
| 8 | HUD | Scores, timer, jauges, flux d'événements ? | `#drawHud` |
| 9 | Classements | Top donateurs, top factions ? | `leaderboard` |
| 10 | Interactions visibles | Pseudos affichés, commandes du chat ? | règles des commentaires |
| 11-12 | Effets liés aux cadeaux | Paliers, effets spéciaux ? | `interactions.gift.tiers` |
| 13 | Progression | Niveaux, améliorations, saisons ? | non implémenté |
| 14 | Rythme | Durée d'une partie, temps morts ? | `match.durationSec` |
| 15 | Intérêt à regarder | Suspense, retournements ? | rattrapage `underdogBoost` |

## Cadre légal (rappel)

La vidéo sert de référence **fonctionnelle**. Les mécaniques génériques (carte à territoires, factions, jauges
de likes) ne sont pas protégeables en tant que telles. En revanche, le code, les graphismes, les personnages,
les noms et l'identité visuelle d'un produit tiers le sont. Empira Conquest utilise un univers, des noms
(SOLAIRE / AZUR) et des graphismes entièrement originaux, dessinés par code.
