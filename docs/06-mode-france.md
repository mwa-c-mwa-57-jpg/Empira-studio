# 06 — Règles du mode « Conquête de France »

Tous les chiffres ci-dessous sont des valeurs par défaut, modifiables dans `config/france.json`.

## Entrer en guerre
- Un spectateur écrit le numéro de son département (`17`, `le 17 !!`, `1` pour l'Ain, `2A`, `974`) ou son nom
  (`Charente-Maritime`). La détection porte sur les 3 premiers mots du message.
- Premier spectateur d'un département : celui-ci **entre en guerre** (+5 soldats) et prend sa capitale sur la carte.
- Un spectateur peut changer de département en écrivant un autre numéro.
- Un cadeau envoyé **avant** d'avoir choisi un département n'est pas perdu : il est crédité dès que le spectateur en choisit un.

## Recruter des soldats
| Action | Soldats |
|---|---|
| Commentaire | +1 (au plus 1 toutes les 2 s par spectateur) |
| Likes | +1 par tranche de 20 likes (le reste est conservé) |
| Partage / abonnement | +8 / +15 |
| Cadeau | +10 par pièce, plus l'effet éventuel du cadeau |
| Objectif collectif de 5 000 likes | +20 pour tous les départements en guerre |

## Conquérir
- Chaque département vise automatiquement le voisin le moins coûteux. Le cadenas affiché sur la carte indique la progression,
  par exemple « 🔒 12/50 » (soldats recrutés depuis la dernière conquête / coût).
- Coût de la conquête : 30 + 20 × (territoires déjà possédés − 1). Pour un territoire ennemi, on ajoute
  0,6 × (soldats du défenseur ÷ nombre de ses territoires), et le coût est doublé s'il s'agit d'une capitale.
- Une armée part en arc de cercle du territoire le plus proche, puis le département change de couleur à l'arrivée.
- Corse : liaisons maritimes avec le 06, le 13 et le 83. Outre-mer : débarquement sur n'importe quel département côtier ou frontalier.
- **Empire trop étendu** : si un département a moins de 12 soldats par territoire (par exemple après une attaque), il perd
  un territoire périphérique toutes les 3 s. Sa capitale n'est jamais perdue de cette façon.

## Cadeaux à effet (catalogue par défaut, à vérifier)
| Onglet | Cadeau | Effet |
|---|---|---|
| Grossir | Rose (1) | +10 / pièce |
| Grossir | Finger Heart (5) / Doughnut (30) | gains ×1,5 / ×2 pendant 45 s |
| Défendre | Butterfly (88) | bouclier 45 s : territoires imprenables, attaques bloquées |
| Défendre | Money Gun (500) | vole 10 % des soldats du 1er |
| Défendre | Lion (29 999) | conquête éclair de 20 départements |
| Attaquer le 1er | Tomato (1) / Boxing Gloves (299) / Swan (699) | −0,3 % / −2 % / −12 % de soldats au 1er |
| Attaquer le 1er | Galaxy (1 000) | remet le 1er à 0 |

Les attaques visent le 1er au classement des soldats ; si c'est le département du donateur, elles visent le 2e.

## Événements automatiques (un toutes les 60 à 100 s)
- **Duel** (90 s) : le 1er contre le 2e. Celui qui recrute le plus vole 10 % des soldats de l'autre.
- **Révolution** (60 s) : tout le monde contre le 1er, gains ×2 pour les autres départements.
- **Mission régionale** (120 s) : une région doit recruter N soldats. En cas de succès, +60 pour chaque département participant.
- **Tête mise à prix** (90 s) : +100 soldats au premier département qui dépasse le 1er.
- **Pop-up du Général** toutes les 75 s : partager, s'abonner, entrer en guerre, envoyer des renforts.

## Fin de partie
- Au bout de 10 minutes, ou dès qu'un département contrôle 60 % de la métropole.
- Le vainqueur est le département qui possède le plus de territoires ; en cas d'égalité, celui qui a le plus de soldats.
- Écran de 15 s : podium des 3 premiers avec leur héros, et le Roi du pays. Une nouvelle partie démarre ensuite automatiquement.
  Les spectateurs gardent leur département, et les cadeaux reçus pendant l'écran de victoire sont crédités à la partie suivante.
