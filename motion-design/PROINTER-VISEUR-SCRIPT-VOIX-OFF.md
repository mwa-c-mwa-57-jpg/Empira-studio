# PRO-INTER : « Le viseur », script voix off (31,6 s, 9:16)

**Concept** : un seul plan-séquence, sans coupure ni transition. La cible du logo devient un viseur qui fonce d'une info à l'autre et « tire » sur chaque mot, en rythme sur une musique à 128 BPM. Il laisse une traînée cyan. Au grand dézoom, on découvre que tout le parcours dessine une cible géante. Le viseur plonge alors en son centre et devient le « O » du logo.

**Ton** : nerveux, rapide, phrases courtes. On **vouvoie**, comme sur prointer.lu.
**ElevenLabs** : voix française énergique (par exemple Benjamin), modèle Multilingual v2, Stability ≈ 35 %, Style ≈ 45 %, vitesse 1,1. La voix doit durer **31 secondes maximum**.

## Texte à coller dans ElevenLabs (en une fois)
Mis à jour avec les infos de PRO-INTER : profils qualifiés en bâtiment second œuvre et industrie, 6 secteurs, plus de 20 ans d'expérience.
```
Vous cherchez un job ? <break time="0.3s" /> Un vrai. <break time="0.2s" /> Près de chez vous. <break time="0.3s" />
Chez PRO-INTER, on vise juste. <break time="0.3s" />
Intérim. <break time="0.15s" /> CDD. <break time="0.15s" /> CDI. <break time="0.3s" />
Des profils qualifiés, en bâtiment second œuvre et en industrie. <break time="0.3s" />
Électricité, chauffage, menuiserie, serrurerie, métallerie, maintenance. <break time="0.3s" />
On vous écoute, on trouve la bonne mission, et on vous suit. <break time="0.3s" />
Trois agences au Luxembourg. <break time="0.3s" /> Plus de vingt ans d'expérience. <break time="0.4s" />
Votre prochain job ? <break time="0.3s" /> En plein dans le mille. <break time="0.3s" />
PRO-INTER, votre agence d'emploi. <break time="0.2s" /> Postulez sur prointer point lu.
```

Si la prononciation accroche, remplacez :
- « PRO-INTER » par « Pro Inter » ;
- « CDD » et « CDI » par « C D D » et « C D I ».

## Où tombe chaque phrase
| Timecode | Image | Voix off |
|---|---|---|
| 00:00 → 00:01,9 | Accroche : « VOUS CHERCHEZ UN JOB ? », le viseur tire sur « JOB » | « Vous cherchez un job ? » |
| 00:01,9 → 00:02,8 | « UN VRAI. », souligné en cyan | « Un vrai. » |
| 00:02,8 → 00:03,75 | « PRÈS DE CHEZ VOUS. » | « Près de chez vous. » |
| 00:03,75 → 00:05,6 | Le drop : « CHEZ PRO-INTER, ON VISE JUSTE. », le point devient une cible | « Chez PRO-INTER, on vise juste. » |
| 00:05,6 → 00:08,4 | Les contrats : intérim, CDD, CDI s'allument un par un | « Intérim. CDD. CDI. » |
| 00:08,4 → 00:12,2 | « PROFILS QUALIFIÉS », « BÂTIMENT SECOND ŒUVRE ET INDUSTRIE » | « Des profils qualifiés, en bâtiment second œuvre et en industrie. » |
| 00:12,2 → 00:17 | Les 6 secteurs, une tuile par mot | « Électricité, chauffage, menuiserie, serrurerie, métallerie, maintenance. » |
| 00:17 → 00:20,4 | « ON ÉCOUTE. ON TROUVE. ON VOUS SUIT. », chaque ligne cochée | « On vous écoute, on trouve la bonne mission, et on vous suit. » |
| 00:20,4 → 00:22 | La carte du Luxembourg : Esch-sur-Alzette, Dudelange, Mondorf-les-Bains | « Trois agences au Luxembourg. » |
| 00:22 → 00:23 | Le compteur monte jusqu'à « +20 ANS D'EXPÉRIENCE » | « Plus de vingt ans d'expérience. » |
| 00:23 → 00:24,8 | Grand dézoom : tout le parcours forme une cible, « VOTRE PROCHAIN JOB ? » | « Votre prochain job ? » |
| 00:24,8 → 00:26,25 | Le viseur plonge en spirale et frappe le centre de la cible | « En plein dans le mille. » (« mille » sur l'impact) |
| 00:26,25 → 00:28,1 | Le logo se forme autour du viseur, dans la lunette | « PRO-INTER, votre agence d'emploi. » |
| 00:28,1 → 00:31,6 | Bouton « POSTULEZ SUR PROINTER.LU » | « Postulez sur prointer point lu. » |

## Calage final (voix « Benjamin », `assets/voix/prointer-viseur-benjamin-v2.mp3`)
La voix brute dure 30,5 s. `python3 tools/voiceover.py viseur` la découpe aux silences et cale chaque phrase sur son tir (tableau `VISEUR`) ; `--sans-musique` donne la version voix + bruitages. Les tirs sont recalés sur les mots, toujours sur la grille de la musique (128 BPM) ; la vidéo a gagné 3 mesures pour les profils qualifiés et les 6 secteurs.

| Parole | Image |
|---|---|
| 0,4 s « Vous cherchez un job ? » | « UN JOB ? » claque, le viseur tire sur « JOB » |
| 2,0 s « Un vrai. » | « UN VRAI. » |
| 2,7 s « Près de chez vous. » | « PRÈS DE CHEZ VOUS. » |
| 3,55 s « Chez PRO-INTER, on vise juste. » | le drop sur « PRO-INTER », puis « ON VISE JUSTE. » |
| 6,0 s « Intérim. CDD. CDI. » | un tir sur chaque contrat (6,1 / 7,0 / 8,0 s) |
| 8,95 s « Des profils qualifiés, en bâtiment second œuvre et en industrie. » | tirs sur « QUALIFIÉS », « ŒUVRE » et « INDUSTRIE » (9,4 / 11,0 / 11,6 s) |
| 12,5 s « Électricité, chauffage, menuiserie, serrurerie, métallerie, maintenance. » | un tir par secteur (12,5 / 13,5 / 14,2 / 15,0 / 15,8 / 16,5 s) |
| 17,5 s « On vous écoute, on trouve la bonne mission, et on vous suit. » | une coche par ligne (17,6 / 18,5 / 19,8 s) |
| 20,8 s « Trois agences au Luxembourg. » | la carte, puis Esch-sur-Alzette, Dudelange et Mondorf-les-Bains |
| 22,3 s « Plus de vingt ans d'expérience. » | le compteur, « +20 » tombe sur « vingt » (22,6 s) |
| 24,2 s « Votre prochain job ? » | la cible géante et le titre, mot à mot |
| 25,5 s « En plein dans le mille ! » | la plongée, « mille » sur l'impact au centre (26,25 s) |
| 26,75 s « PRO-INTER, votre agence d'emploi. » | le logo se forme |
| 28,75 s « Postulez sur prointer point lu. » | le bouton « POSTULEZ SUR PROINTER.LU » |
