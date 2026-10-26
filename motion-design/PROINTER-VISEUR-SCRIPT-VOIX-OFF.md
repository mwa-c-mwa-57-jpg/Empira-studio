# PRO-INTER : « Le viseur », script voix off (37,5 s, 9:16)

**Concept** : un seul plan-séquence, sans coupure ni transition. La cible du logo devient un viseur qui fonce d'une info à l'autre et « tire » sur chaque mot, en rythme sur une musique à 128 BPM. Il laisse une traînée cyan. Au grand dézoom, on découvre que tout le parcours dessine une cible géante. Le viseur plonge alors en son centre et devient le « O » du logo.

**Ton** : nerveux, rapide, phrases courtes. On **vouvoie**, comme sur prointer.lu.
**ElevenLabs** : voix française énergique (par exemple Benjamin), modèle Multilingual v2, Stability ≈ 35 %, Style ≈ 45 %, vitesse 1,1. La voix dure environ **35 secondes**.

## Texte à coller dans ElevenLabs (en une fois)
Version 3 : 3 secteurs (bâtiment, industrie, tertiaire) avec 2 métiers chacun, défilement des métiers juste après (« des dizaines d'autres »), 3 agences à égalité. Seules les phrases des secteurs et « Et des dizaines d'autres métiers vous attendent » ont été enregistrées à nouveau (`prointer-viseur-benjamin-v3-secteurs.mp3`), puis insérées dans la prise v2.
```
Vous cherchez un job ? <break time="0.3s" /> Un vrai. <break time="0.2s" /> Près de chez vous. <break time="0.3s" />
Chez PRO-INTER, on vise juste. <break time="0.3s" />
Intérim. <break time="0.15s" /> CDD. <break time="0.15s" /> CDI. <break time="0.3s" />
Bâtiment : <break time="0.15s" /> électricien, serrurier. <break time="0.3s" />
Industrie : <break time="0.15s" /> soudeur, technicien de maintenance. <break time="0.3s" />
Tertiaire : <break time="0.15s" /> gestionnaire de paie, assistant administratif. <break time="0.3s" />
Et des dizaines d'autres métiers vous attendent. <break time="0.3s" />
On vous écoute, on trouve la bonne mission, et on vous suit. <break time="0.3s" />
Trois agences au Luxembourg. <break time="0.6s" /> Plus de vingt ans d'expérience. <break time="0.4s" />
Votre prochain job ? <break time="0.3s" /> En plein dans le mille. <break time="0.3s" />
PRO-INTER, votre agence d'emploi. <break time="0.3s" />
Postulez sur prointer point lu.
```

Si la prononciation accroche, remplacez :
- « PRO-INTER » par « Pro Inter » ;
- « CDD » et « CDI » par « C D D » et « C D I ».

## Où tombe chaque phrase
| Timecode | Image | Voix off |
|---|---|---|
| 00:00 → 00:03,75 | Accroche : « VOUS CHERCHEZ UN JOB ? », « UN VRAI. », « PRÈS DE CHEZ VOUS. » | « Vous cherchez un job ? Un vrai. Près de chez vous. » |
| 00:03,75 → 00:05,6 | Le drop : « CHEZ PRO-INTER, ON VISE JUSTE. » | « Chez PRO-INTER, on vise juste. » |
| 00:05,6 → 00:08,4 | Les contrats : intérim, CDD, CDI | « Intérim. CDD. CDI. » |
| 00:08,4 → 00:18 | « NOS SECTEURS » : bâtiment, industrie, tertiaire, deux métiers chacun | « Bâtiment : électricien, serrurier. Industrie : soudeur, technicien de maintenance. Tertiaire : gestionnaire de paie, assistant administratif. » |
| 00:18 → 00:21,2 | D'autres métiers défilent de plus en plus vite, puis « + DES DIZAINES D'AUTRES / SUR NOTRE SITE INTERNET » | « Et des dizaines d'autres métiers vous attendent. » |
| 00:21,2 → 00:24,4 | « ON ÉCOUTE. ON TROUVE. ON VOUS SUIT. » | « On vous écoute, on trouve la bonne mission, et on vous suit. » |
| 00:24,4 → 00:27,2 | La carte du Luxembourg, les 3 agences à égalité (plus longue) | « Trois agences au Luxembourg. » |
| 00:27,2 → 00:28,2 | Le compteur « +20 ANS D'EXPÉRIENCE » | « Plus de vingt ans d'expérience. » |
| 00:28,2 → 00:30,5 | Grand dézoom : la cible géante, « VOTRE PROCHAIN JOB ? » | « Votre prochain job ? » |
| 00:30,5 → 00:31,9 | Le viseur plonge et frappe le centre | « En plein dans le mille. » (« mille » sur l'impact) |
| 00:31,9 → 00:37,5 | Le logo dans la lunette, puis le bouton « POSTULEZ SUR PROINTER.LU » | « PRO-INTER, votre agence d'emploi. Postulez sur prointer point lu. » |

## Calage final (voix « Benjamin », `assets/voix/prointer-viseur-benjamin-v3.flac`)
La voix assemblée (prise v2 + les phrases des secteurs) dure 35,1 s. `python3 tools/voiceover.py viseur` la découpe aux silences et cale chaque phrase sur son tir (tableau `VISEUR`) ; `--sans-musique` donne la version voix + bruitages.

| Parole | Image |
|---|---|
| 0,4 s « Vous cherchez un job ? » | « UN JOB ? » claque, le viseur tire sur « JOB » |
| 3,55 s « Chez PRO-INTER, on vise juste. » | le drop sur « PRO-INTER » |
| 6,0 s « Intérim. CDD. CDI. » | un tir sur chaque contrat |
| 8,75 s « Bâtiment : électricien, serrurier. » | tirs sur BÂTIMENT, ÉLECTRICIEN, SERRURIER (8,8 / 9,7 / 10,8 s) |
| 12,05 s « Industrie : soudeur, technicien de maintenance. » | tirs sur INDUSTRIE, SOUDEUR, TECHNICIEN DE MAINTENANCE (12,1 / 13,0 / 13,8 s) |
| 15,4 s « Tertiaire : gestionnaire de paie, assistant administratif. » | tirs sur TERTIAIRE, GESTIONNAIRE DE PAIE, ASSISTANT ADMINISTRATIF (15,4 / 16,3 / 17,5 s) |
| 19,0 s « Et des dizaines d'autres métiers vous attendent. » | défilement de 18,2 à 19,8 s, « + DES DIZAINES D'AUTRES » sur « d'autres » |
| 21,6 s « On vous écoute, on trouve la bonne mission, et on vous suit. » | une coche par ligne (21,6 / 22,5 / 23,9 s) |
| 24,9 s « Trois agences au Luxembourg. » | la carte, puis les 3 agences (24,8 / 25,5 / 26,25 s) |
| 27,6 s « Plus de vingt ans d'expérience. » | « +20 » tombe sur « vingt » (27,9 s) |
| 29,5 s « Votre prochain job ? » | la cible géante et le titre, mot à mot |
| 31,2 s « En plein dans le mille ! » | « mille » sur l'impact au centre (31,9 s) |
| 32,4 s « PRO-INTER, votre agence d'emploi. » | le logo se forme |
| 34,4 s « Postulez sur prointer point lu. » | le bouton « POSTULEZ SUR PROINTER.LU » |
