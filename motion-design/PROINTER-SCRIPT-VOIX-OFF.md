# PRO-INTER : « L'histoire de Pro », script voix off (40 s, 9:16)

**Ton** : chaleureux, rassurant, dynamique. On **vouvoie**, comme sur le site prointer.lu.
**Pro** : la cible du « O » du logo, qui devient un petit bonhomme et accompagne un intérimaire.
**ElevenLabs** : voix française chaleureuse (par exemple Benjamin ou une voix féminine posée), modèle Multilingual v2, Stability ≈ 45 %, Style ≈ 30 %. La voix doit durer **38 secondes maximum**.

## Texte à coller dans ElevenLabs (en une fois)
Mis à jour avec les infos de PRO-INTER : profils qualifiés en bâtiment second œuvre et industrie, 6 secteurs, plus de 20 ans d'expérience.
```
Voici Pro. <break time="0.4s" /> Chez PRO-INTER, c'est lui qui vise juste. <break time="0.8s" />
Vous cherchez une mission qui vous correspond ? <break time="0.8s" />
Nous écoutons vos compétences… <break time="0.2s" /> et vos envies. <break time="0.8s" />
Puis notre viseur trouve la mission adaptée : <break time="0.2s" /> intérim, CDD ou CDI. <break time="0.8s" />
Bâtiment second œuvre et industrie : <break time="0.2s" /> des profils qualifiés. <break time="0.6s" />
Électricité, chauffage, menuiserie, serrurerie, métallerie, maintenance : <break time="0.2s" /> vous êtes sur le terrain. <break time="0.8s" />
Et nous restons à vos côtés, du premier au dernier jour. <break time="0.8s" />
Trois agences au Luxembourg, et plus de vingt ans d'expérience. <break time="0.8s" />
PRO-INTER, votre agence d'emploi. <break time="0.4s" /> Postulez sur prointer point lu.
```

Si la prononciation accroche, remplacez :
- « PRO-INTER » par « Pro Inter » ;
- « CDD ou CDI » par « C D D ou C D I ».

## Où tombe chaque phrase (je cale la voix au montage)
| Timecode | Image | Voix off |
|---|---|---|
| 00:00 → 00:05,5 | Le logo se dessine, la cible saute et devient Pro, qui salue | « Voici Pro. Chez PRO-INTER, c'est lui qui vise juste. » |
| 00:05,5 → 00:08,2 | **01 — La recherche** : un candidat cherche, téléphone en main | « Vous cherchez une mission qui vous correspond ? » |
| 00:08,2 → 00:14 | **02 — L'écoute** : Pro emmène le candidat à l'agence ; compétences, expérience, envies ; Pro scanne le CV | « Nous écoutons vos compétences… et vos envies. » |
| 00:14 → 00:19,4 | **03 — Le bon poste** : le viseur se pose sur « Électricien » ; intérim, CDD, CDI | « Puis notre viseur trouve la mission adaptée : intérim, CDD ou CDI. » |
| 00:19,4 → 00:24,8 | **04 — Sur le terrain** : chantier, bâtiment, industrie, électricité, chauffage | « Bâtiment, industrie, électricité, chauffage : vous êtes sur le terrain. » |
| 00:24,8 → 00:29,3 | **05 — Le suivi** : Pro passe sur le chantier, suivi régulier, réactivité, proximité | « Et nous restons à vos côtés, du premier au dernier jour. » |
| 00:29,3 → 00:34 | **06 — Près de chez vous** : Dudelange, Esch-sur-Alzette, Mondorf-les-Bains, +15 ans | « Trois agences au Luxembourg, et plus de quinze ans d'expertise. » |
| 00:34 → 00:40 | Pro replonge dans le logo ; « Postulez sur prointer.lu » | « PRO-INTER, votre agence d'emploi. Postulez sur prointer point lu. » |

## Calage final (voix « Benjamin », `assets/voix/prointer-benjamin.mp3`)
La voix brute dure 29,8 s. `python3 tools/voiceover.py prointer` la découpe aux silences et cale chaque phrase sur son image (tableau `PROINTER`) ; `--sans-musique` donne la version voix + bruitages. La pause muette qui suivait « Vous cherchez… » a été raccourcie de 2 s (vidéo de 40 s) : « Nous écoutons… » arrive pendant que Pro emmène le candidat à l'agence.

| Parole | Image |
|---|---|
| 2,9 s « Voici Pro. » | la cible saute hors du logo et devient Pro |
| 3,9 s « Chez PRO-INTER, c'est lui qui vise juste. » | Pro atterrit et dit bonjour |
| 6,6 s « Vous cherchez une mission qui vous correspond ? » | le candidat et ses questions |
| 9,5 s « Nous écoutons vos compétences… et vos envies. » | les bulles compétences, expérience, envies |
| 15,2 s « Puis notre viseur trouve la mission adaptée : » | le viseur parcourt les offres et se pose sur « Électricien » |
| 17,7 s « intérim, CDD ou CDI. » | les trois pastilles apparaissent sur chaque mot |
| 20,9 s « Bâtiment, industrie, électricité, chauffage : vous êtes sur le terrain. » | les badges métiers sur chaque mot |
| 25,6 s « Et nous restons à vos côtés, du premier au dernier jour. » | Pro sur le chantier, la liste se coche |
| 30,6 s « Trois agences au Luxembourg, et plus de quinze ans d'expertise. » | les épingles, puis « +15 ans » sur « quinze ans » |
| 35,6 s « PRO-INTER, votre agence d'emploi. » | Pro replonge dans le logo |
| 37,7 s « Postulez sur prointer point lu. » | le bouton « Postulez sur prointer.lu » |
