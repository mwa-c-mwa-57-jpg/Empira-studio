# PRO-INTER : « Le viseur », script voix off (27,5 s, 9:16)

**Concept** : un seul plan-séquence, sans coupure ni transition. La cible du logo devient un viseur qui fonce d'une info à l'autre et « tire » sur chaque mot, en rythme sur une musique à 128 BPM. Il laisse une traînée cyan. Au grand dézoom, on découvre que tout le parcours dessine une cible géante. Le viseur plonge alors en son centre et devient le « O » du logo.

**Ton** : nerveux, rapide, phrases courtes. On **vouvoie**, comme sur prointer.lu.
**ElevenLabs** : voix française énergique (par exemple Benjamin), modèle Multilingual v2, Stability ≈ 35 %, Style ≈ 45 %, vitesse 1,1. La voix doit durer **25 secondes maximum**.

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

## Où tombe chaque phrase (je cale la voix au montage)
| Timecode | Image | Voix off |
|---|---|---|
| 00:00 → 00:01,9 | Accroche : « VOUS CHERCHEZ UN JOB ? », le viseur tire sur « JOB » | « Vous cherchez un job ? » |
| 00:01,9 → 00:02,8 | « UN VRAI. », souligné en cyan | « Un vrai. » |
| 00:02,8 → 00:03,75 | « PRÈS DE CHEZ VOUS. » | « Près de chez vous. » |
| 00:03,75 → 00:05,6 | Le drop : « CHEZ PRO-INTER, ON VISE JUSTE. », le point devient une cible | « Chez PRO-INTER, on vise juste. » |
| 00:05,6 → 00:07,3 | Les contrats : intérim, CDD, CDI s'allument un par un | « Intérim. CDD. CDI. » |
| 00:07,3 → 00:10,3 | Les secteurs : bâtiment, industrie, électricité, chauffage | « Bâtiment, industrie, électricité, chauffage. » |
| 00:10,3 → 00:13,6 | « ON ÉCOUTE. ON TROUVE. ON VOUS SUIT. », chaque ligne cochée | « On vous écoute, on trouve la bonne mission, et on vous suit. » |
| 00:13,6 → 00:15,7 | La carte du Luxembourg : Esch-sur-Alzette, Dudelange, Mondorf-les-Bains | « Trois agences au Luxembourg. » |
| 00:15,7 → 00:17,3 | Le compteur monte jusqu'à « +15 ANS D'EXPERTISE » | « Plus de quinze ans d'expertise. » |
| 00:17,3 → 00:19,2 | Grand dézoom : tout le parcours forme une cible, « VOTRE PROCHAIN JOB ? » | « Votre prochain job ? » |
| 00:19,2 → 00:20,6 | Le viseur plonge en spirale et frappe le centre de la cible | « En plein dans le mille. » (« mille » sur l'impact) |
| 00:20,6 → 00:22,5 | Le logo se forme autour du viseur, dans la lunette | « PRO-INTER, votre agence d'emploi. » |
| 00:22,5 → 00:27,5 | Bouton « POSTULEZ SUR PROINTER.LU » | « Postulez sur prointer point lu. » |

## Calage final (voix « Benjamin », `assets/voix/prointer-viseur-benjamin.mp3`)
La voix brute dure 25,3 s. `python3 tools/voiceover.py viseur` la découpe aux silences et cale chaque phrase sur son tir (tableau `VISEUR`) ; `--sans-musique` donne la version voix + bruitages. Les tirs du milieu (contrats, secteurs, « on écoute / on trouve / on suit », carte) ont été recalés sur les mots, toujours sur la grille de la musique.

| Parole | Image |
|---|---|
| 0,35 s « Vous cherchez un job ? » | « UN JOB ? » claque, le viseur tire sur « JOB » |
| 2,0 s « Un vrai ! » | « UN VRAI. » |
| 2,7 s « Près de chez vous ! » | « PRÈS DE CHEZ VOUS. » |
| 3,5 s « Chez PRO-INTER, on vise juste ! » | le drop sur « PRO-INTER », puis « ON VISE JUSTE. » |
| 5,75 s « Intérim, CDD, CDI. » | un tir sur chaque contrat (5,9 / 6,6 / 7,5 s) |
| 8,4 s « Bâtiment, industrie, électricité, chauffage. » | un tir sur chaque secteur (8,4 / 9,1 / 9,8 / 10,8 s) |
| 11,7 s « On vous écoute, on trouve la bonne mission, et on vous suit ! » | une coche par ligne (11,7 / 12,7 / 13,8 s) |
| 15,0 s « Trois agences au Luxembourg. » | la carte, puis Esch-sur-Alzette, Dudelange et Mondorf-les-Bains |
| 16,4 s « Plus de quinze ans d'expertise. » | le compteur, « +15 » tombe sur « quinze » |
| 18,1 s « Votre prochain job ? » | la cible géante et le titre, mot à mot |
| 19,9 s « En plein dans le mille ! » | la plongée, « mille » sur l'impact au centre (20,6 s) |
| 21,2 s « PRO-INTER, votre agence d'emploi. » | le logo se forme |
| 23,1 s « Postulez sur prointer point lu. » | le bouton « POSTULEZ SUR PROINTER.LU » |
