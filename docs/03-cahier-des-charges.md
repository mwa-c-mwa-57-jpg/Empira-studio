# 03 — Cahier des charges et règles du jeu (version 0.1)

## Utilisateurs
- **Spectateur** : il comprend en quelques secondes qui gagne et comment aider son camp (bandeau « COMMENT JOUER »
  affiché en permanence).
- **Créateur** : il lance le jeu par double-clic, l'ajoute à OBS, et n'a ensuite rien à manipuler (les parties
  s'enchaînent automatiquement).
- **Régie / Empira** : elle ajuste les règles dans un fichier JSON et teste avec le simulateur.

## Boucle de jeu
1. **Compte à rebours** (6 s) : « CHOISIS TON CAMP — écris 1 ou 2 ».
2. **Bataille** (5 min maximum) : chaque camp reçoit automatiquement des soldats (le jeu vit même sans
   interaction), et les spectateurs y ajoutent leurs troupes.
3. **Victoire** au premier des trois cas suivants :
   - prise de la **capitale** ennemie (château, garnison 25, défense ×1,5) ;
   - **domination** de 80 % des territoires (repères visibles sur la barre de score) ;
   - **fin du temps** : le camp qui a le plus de territoires gagne ; en cas d'égalité, la force totale (garnisons
     et unités) départage ; sinon, égalité.
4. **Écran de victoire** (12 s) avec les 3 meilleurs soutiens, puis nouvelle carte générée automatiquement.

## Carte et combats
- Une soixantaine d'hexagones, des lacs disposés en miroir (aucun camp n'est avantagé), deux capitales opposées.
- Chaque territoire a une garnison (le chiffre affiché). Une unité qui arrive retire sa puissance de la
  garnison ; si sa puissance dépasse la garnison, le territoire est conquis.
- Deux unités ennemies qui se croisent s'affrontent et se retirent mutuellement leur puissance.
- Les unités apparaissent sur la ligne de front ; les héros apparaissent sur le front le plus proche de la capitale ennemie.
- Rattrapage : le camp qui contrôle moins de territoires reçoit ses soldats automatiques plus vite (`underdogBoost`).

## Interactions (toutes configurables dans `config/default.json`)
| Interaction | Effet par défaut |
|---|---|
| Commentaire `1`, `soleil`, `solaire`… / `2`, `azur`, `bleu`… | rejoindre un camp et faire apparaître 1 soldat portant son pseudo |
| Autre commentaire d'un membre | 1 soldat (au plus 1 toutes les 6 s par spectateur) |
| Likes | jauge du camp : 150 likes = **charge** de 6 soldats |
| Cadeau de 1 à 19 💎 | **Chevalier** (puissance 8) ; en série : ×N, plafonné à 15 |
| Cadeau de 20 à 99 💎 | **Géant** (puissance 24) |
| Cadeau de 100 💎 ou plus | **Météore** : convertit le territoire ennemi le plus fort du front et détruit les unités proches (3 au maximum par série) |
| Abonnement / partage | 2 / 3 soldats |
| Capture par une unité nommée | +5 points pour son propriétaire |

Un spectateur sans camp qui like ou offre un cadeau est placé dans **l'équipe la moins nombreuse**.
Les contributions reçues pendant le compte à rebours ou l'écran de victoire ne sont **pas perdues** : elles sont
appliquées au début de la bataille suivante.

## Exigences techniques
- Format vertical 1080×1920, lisible sur téléphone. Tout l'affichage est dessiné sur le canvas, donc OBS capture
  exactement l'image prévue.
- 60 images/s visées. Mesuré : 60 images/s avec environ 200 unités dans un Chromium sans accélération graphique.
- Plafond de 240 unités : au-delà, la puissance des nouvelles unités est ajoutée aux garnisons.
- Robustesse : dédoublonnage par identifiant, rejet des événements trop anciens, limite de 500 événements/s
  (sauf pour les cadeaux, jamais rejetés), textes nettoyés, aucune commande d'administration accessible depuis le chat.
- Le jeu continue de tourner si la source TikTok se déconnecte.

## Volontairement hors périmètre pour cette version
Alliances, saisons, progression persistante, sauvegarde des statistiques, comptes créateurs, plus de deux
factions, sons et musique.
