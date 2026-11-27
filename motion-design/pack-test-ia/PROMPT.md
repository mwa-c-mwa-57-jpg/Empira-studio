# Brief : vidéo motion design PRO-INTER, « Le viseur »

Tu es motion designer. Réalise une vidéo motion design verticale pour PRO-INTER, une agence d'emploi luxembourgeoise. Avant de commencer, lis les deux skills fournis dans `skills/` et applique-les : `base-design-motion` en priorité (les 4 réglages vitesse, flou, raccords, son), puis `motion-design-saas` pour la méthode de production. Tout ce qui suit vient du client et ne se négocie pas, sauf mention contraire.

## 1. Le client

- **PRO-INTER**, agence d'emploi au Luxembourg **depuis plus de 20 ans** (jamais « 15 ans »).
- **Contrats** : intérim, CDD, CDI.
- **Secteurs** : bâtiment, industrie, tertiaire.
- **3 agences**, toujours dans cet ordre : **Esch-sur-Alzette** (17 rue de la Libération, L-4210 Esch-sur-Alzette), **Dudelange** (16 rue du Commerce), **Mondorf-les-Bains** (3 avenue Lou Hemmer).
- **Site** : prointer.lu.
- **Cible** : chercheurs d'emploi, dont les frontaliers de Lorraine. Diffusion TikTok, Reels, Stories et publicité.
- **Ton** : nerveux, rapide, phrases courtes, **vouvoiement**.

## 2. Format et livrables

- 1080 × 1920 (9:16), **60 images/s**, durée **31,875 s** (68 temps à 128 BPM, soit 17 mesures).
- MP4 H.264 + AAC, son normalisé à **-14 LUFS**, crête à -1 dBTP.
- Deux versions : **avec musique**, et **voix + bruitages sans musique**.
- Le projet source (code Remotion, HTML/SVG, After Effects… au choix).
- Une planche contact : une image toutes les 2,5 s.

## 3. Le concept : un seul plan-séquence

- **Aucune coupe, aucune transition** : une seule caméra du début à la fin.
- Le « O » du logo PRO-INTER est une cible (un anneau et 4 traits). Cette cible devient un **viseur** qui fonce d'une info à l'autre, en rythme sur la musique, et « tire » sur chaque info : flash, onde de choc, éclats et petit coup de zoom de la caméra à chaque tir.
- **La caméra suit le viseur** comme montée sur un ressort amorti : elle dépasse légèrement sa cible puis se recale. Pendant les déplacements rapides, elle dézoome un peu et s'incline.
- Le viseur laisse **une traînée cyan**. Les étapes déjà passées s'atténuent pour que le cadre reste lisible.
- Les étapes sont posées **en spirale, dans le sens des aiguilles d'une montre**, autour d'un centre. Au **grand dézoom**, on découvre que la traînée et les anneaux du décor dessinent **une cible géante**.
- Le viseur **plonge en spirale vers le centre** (un tour de plus, en accélérant) et frappe le centre sur le mot « mille ». Il devient alors le « O » du logo, posé dans un disque blanc comme dans une lunette.
- **Règle d'or** : le viseur ne cache jamais un mot. Il se pose toujours **sur une puce à gauche du mot** (un point cyan), sur l'icône du secteur ou sur l'épingle d'une agence, jamais au milieu du texte.

## 4. La timeline

La voix off est déjà calée sur cette timeline dans `fichiers/audio/voix-calee.wav` (31,875 s) et la musique dans `fichiers/audio/musique.wav`. **Chaque mot doit apparaître à l'écran 2 images avant d'être entendu.** Les temps sont en secondes ; un temps musical dure 0,46875 s.

| Temps | À l'image | Voix off (début) |
|---|---|---|
| 0 → 1,2 | « VOUS CHERCHEZ » monte (0 s), puis « UN » (0,70), « JOB » (0,94, tir) et « ? » (1,17) claquent | 0,40 « Vous cherchez un job ? » |
| 1,97 → 2,2 | « UN » (1,97), « VRAI. » (2,11, tir), puis un trait cyan qui souligne VRAI | 2,00 « Un vrai. » |
| 2,7 → 3,1 | « PRÈS DE » (2,69), « CHEZ » (2,91), « VOUS. » (3,05, tir) | 2,74 « Près de chez vous. » |
| 3,5 → 5,2 | **Le drop** à 3,75 : « CHEZ » (3,49), « PRO-INTER, » (3,75, gros impact). Puis « ON VISE » (4,50 / 4,66), « JUSTE. » (4,88), et un tir sur le point de « JUSTE. » (5,16) | 3,55 « Chez PRO-INTER, on vise juste. » |
| 5,6 → 8,0 | « VOS CONTRATS » et trois pastilles qui se remplissent au tir : INTÉRIM (6,09), CDD (7,03), CDI (7,97) | 6,12 « Intérim. » · 7,06 « CDD. » · 8,00 « CDI. » |
| 8,2 → 12,9 | « NOS SECTEURS ». Tir sur BÂTIMENT (8,67), INDUSTRIE (10,08), TERTIAIRE (11,48). **Les deux métiers de chaque secteur s'affichent en même temps que lui** : électricien et serrurier, soudeur et technicien de maintenance, gestionnaire de paie et assistant administratif | 8,70 « Bâtiment. » · 10,10 « Industrie. » · 11,50 « Tertiaire. » (les métiers ne sont **pas** lus) |
| 12,89 → 14,41 | D'autres métiers défilent **de plus en plus vite** : chauffagiste, menuisier, métallier, électricien, soudeur, gestionnaire de paie, serrurier, technicien de maintenance, assistant administratif… Puis « **+ DES DIZAINES D'AUTRES** » claque sur « d'autres » (14,41), avec « SUR NOTRE SITE INTERNET » dessous | 13,68 « Et des dizaines d'autres métiers vous attendent. » |
| 15,94 → 18,8 | « ON ÉCOUTE. » (15,94), « ON TROUVE. » (16,88), « ON VOUS SUIT. » (18,28), chacun avec une coche, et en petit dessous : « vos compétences et vos envies », « la mission qui vous correspond », « du premier au dernier jour » | 15,98 « On vous écoute, on trouve la bonne mission, et on vous suit. » |
| 18,8 → 21,5 | « 3 AGENCES AU LUXEMBOURG ». La frontière du pays se dessine (18,80), puis la capitale apparaît. Épingles **à égalité** : Esch-sur-Alzette (19,22), Dudelange (19,92), Mondorf-les-Bains (20,63). Le client veut que la carte **dure** | 19,24 « Trois agences au Luxembourg. » |
| 21,56 → 22,27 | Compteur « +0 » → « **+20** » qui tombe sur « vingt » (22,27), puis « ANS D'EXPÉRIENCE » | 21,98 « Plus de vingt ans d'expérience. » |
| 22,62 → 24,84 | **Grand dézoom** : la cible géante apparaît. Au-dessus, « VOTRE PROCHAIN » (23,88 / 24,05) puis « JOB ? » (24,33 / 24,66) | 23,91 « Votre prochain job ? » |
| 24,84 → 26,25 | Plongée en spirale, **impact au centre à 26,25** (flash, tremblement) | 25,54 « En plein dans le mille ! » (« mille » sur l'impact) |
| 26,25 → 31,875 | Disque blanc, le viseur devient le « O » du logo PRO\|Inter. « VOTRE PROCHAIN JOB, » au-dessus (26,5), « EN PLEIN DANS LE MILLE. » (26,95), « AGENCE D'EMPLOI » qui s'écrit sur la voix (27,66), « INTÉRIM · CDD · CDI » (27,89), « Esch-sur-Alzette · Dudelange · Mondorf-les-Bains » (28,13), bouton **« POSTULEZ SUR PROINTER.LU »** (28,59) avec un reflet qui passe | 26,78 « PRO-INTER, votre agence d'emploi. » · 28,78 « Postulez sur prointer point lu. » |

**Musique** (`musique.wav`, à garder ou à refaire) : 128 BPM, la mineur (Am, F, C, G). Montée jusqu'au drop à 3,75 s. Groove jusqu'à 22,5 s, puis pont pendant le dézoom et la plongée : nappe, montée, roulement de caisse claire et un huitième de silence juste avant l'impact de 26,25 s. Outro, puis accord final à 30,0 s.

**Bruitages** : à poser toi-même, à l'image près. Un son d'impact à chaque tir, un whoosh dont le pic tombe au moment où le viseur va le plus vite (le milieu de son trajet), un petit son pour chaque pastille, épingle ou coche, des tics pour le défilement et le compteur, et un grand boum au centre.

## 5. Identité visuelle

- **Couleurs**, avec une seule couleur d'accent (le cyan) :

  | Rôle | Couleur |
  |---|---|
  | Fond nuit | `#0E1215` |
  | Cyan | `#00B8F8` |
  | Gris du logo | `#4A4A4A` |
  | Blanc | `#F4F7F8` |
  | Gris secondaire | `#8D9AA3` |

- **Typo** : Montserrat 800 et 900, en capitales serrées. Elle est fournie dans `fichiers/police/`.
- **Logo** : fourni dans `fichiers/logo/logo.svg`. Le viseur reprend **exactement** la géométrie du « O », dans le repère du logo (888 × 235,7) :
  - centre (329,44 ; 121,02), rayon 68,22, épaisseur 25,71 ;
  - 4 traits qui vont du rayon 37,44 au rayon 98,61, d'épaisseur 6,86.
- **Décor** : une grille de points discrète, les anneaux concentriques de la cible géante et 4 coins de viseur fixes sur l'écran.
- **Carte** : la vraie frontière du Luxembourg est fournie dans `fichiers/carte/luxembourg.json` (OpenStreetMap), avec les coordonnées des agences. Placez les villes exactement : le client a déjà relevé des villes mal situées.

## 6. Ce que le client a déjà demandé (à respecter)

- Un seul plan, sans transition bizarre.
- Le viseur ne cache jamais un mot : puces à gauche.
- Les métiers ne sont pas lus : ils s'affichent avec leur secteur, et la partie secteurs doit rester courte.
- Le défilement « + des dizaines d'autres » vient **juste après les secteurs**, pas à la fin : quelqu'un qui ne voit pas son métier swipe avant la fin.
- Les 3 agences sont à égalité, aucune n'est mise en avant, toujours dans l'ordre Esch, Dudelange, Mondorf, y compris sur l'image finale.
- La fin garde le logo et le bouton « Postulez sur prointer.lu ».

## 7. Ce qui sera jugé

1. **Le concept** : un vrai plan-séquence, et le grand dézoom qui révèle la cible.
2. **La lisibilité** : chaque mot lisible le temps qu'il faut, et jamais caché.
3. **La synchro** : chaque mot à 2 images de sa voix, chaque impact et chaque whoosh à l'image près.
4. **Les 4 réglages du skill** : aucun mouvement linéaire, du flou de mouvement sur ce qui va vite, aucune coupe, un son précis.
5. **La fidélité à la marque** et la précision de la carte.
6. **Les finitions** : rien ne déborde du cadre, aucun texte coupé, rien de figé plus de 2 s.

Rends la vidéo, les sources et la planche contact, avec un court texte qui explique tes choix.
