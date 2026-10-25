# PRO-INTER : « L'histoire de Pro », script voix off (44 s, 9:16)

**Ton** : chaleureux, rassurant, dynamique. On **vouvoie**, comme sur le site prointer.lu.
**Pro** : la cible du « O » du logo, qui devient un petit bonhomme et accompagne un intérimaire.
**ElevenLabs** : voix française chaleureuse (par exemple Benjamin ou une voix féminine posée), modèle Multilingual v2, Stability ≈ 45 %, Style ≈ 30 %. La voix doit durer **33 secondes maximum**.

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

## Où tombe chaque phrase
| Timecode | Image | Voix off |
|---|---|---|
| 00:00 → 00:05,5 | Le logo se dessine, la cible saute et devient Pro, qui salue | « Voici Pro. Chez PRO-INTER, c'est lui qui vise juste. » |
| 00:05,5 → 00:08,2 | **01 — La recherche** : un candidat cherche, téléphone en main | « Vous cherchez une mission qui vous correspond ? » |
| 00:08,2 → 00:14 | **02 — L'écoute** : Pro emmène le candidat à l'agence ; compétences, expérience, envies ; Pro scanne le CV | « Nous écoutons vos compétences… et vos envies. » |
| 00:14 → 00:19,4 | **03 — Le bon poste** : le viseur se pose sur « Électricien » ; intérim, CDD, CDI | « Puis notre viseur trouve la mission adaptée. Intérim, CDD ou CDI. » |
| 00:19,4 → 00:23,8 | **04 — Profils qualifiés** : chantier de second œuvre, la cloison se monte | « Bâtiment second œuvre et industrie : des profils qualifiés. » |
| 00:23,8 → 00:29,3 | **05 — Sur le terrain** : les 6 secteurs, un badge par mot | « Électricité, chauffage, menuiserie, serrurerie, métallerie, maintenance : vous êtes sur le terrain. » |
| 00:29,3 → 00:33,3 | **06 — Le suivi** : Pro passe sur le chantier, suivi régulier, réactivité, proximité | « Et nous restons à vos côtés, du premier au dernier jour. » |
| 00:33,3 → 00:38 | **07 — Près de chez vous** : Dudelange, Esch-sur-Alzette, Mondorf-les-Bains, +20 ans | « Trois agences au Luxembourg, et plus de vingt ans d'expérience. » |
| 00:38 → 00:44 | Pro replonge dans le logo ; « Postulez sur prointer.lu » | « PRO-INTER, votre agence d'emploi. Postulez sur prointer point lu. » |

## Calage final (voix « Benjamin », `assets/voix/prointer-benjamin-v2.mp3`)
La voix brute dure 32,2 s. `python3 tools/voiceover.py prointer` la découpe aux silences et cale chaque phrase sur son image (tableau `PROINTER`) ; `--sans-musique` donne la version voix + bruitages. Le chantier dure 4 s de plus que dans la première version (2 mesures de musique) pour les profils qualifiés et les 6 secteurs.

| Parole | Image |
|---|---|
| 2,9 s « Voici Pro. » | la cible saute hors du logo et devient Pro |
| 3,85 s « Chez PRO-INTER, c'est lui qui vise juste. » | Pro atterrit et dit bonjour |
| 6,6 s « Vous cherchez une mission qui vous correspond ? » | le candidat et ses questions |
| 9,5 s « Nous écoutons vos compétences… et vos envies. » | Pro emmène le candidat à l'agence, les bulles compétences, expérience, envies |
| 15,2 s « Puis notre viseur trouve la mission adaptée. » | le viseur parcourt les offres et se pose sur « Électricien » |
| 17,7 s « Intérim, CDD ou CDI. » | les trois pastilles apparaissent sur chaque mot |
| 20,75 s « Bâtiment second œuvre et industrie : des profils qualifiés. » | la légende « Profils qualifiés », la cloison se monte |
| 23,95 s « Électricité, chauffage, menuiserie, serrurerie, métallerie, maintenance » | un badge par secteur, sur chaque mot |
| 28,3 s « vous êtes sur le terrain. » | l'ouvrier au travail |
| 29,6 s « Et nous restons à vos côtés, du premier au dernier jour. » | Pro sur le chantier, la liste se coche |
| 34,6 s « Trois agences au Luxembourg, et plus de vingt ans d'expérience. » | les épingles, puis « +20 » sur « vingt ans » |
| 39,6 s « PRO-INTER, votre agence d'emploi. » | Pro replonge dans le logo |
| 41,65 s « Postulez sur prointer point lu. » | le bouton « Postulez sur prointer.lu » |
