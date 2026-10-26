# PRO-INTER : « Le viseur », script voix off (33,75 s, 9:16)

**Concept** : un seul plan-séquence, sans coupure ni transition. La cible du logo devient un viseur qui fonce d'une info à l'autre et « tire » sur chaque mot, en rythme sur une musique à 128 BPM. Il laisse une traînée cyan. Au grand dézoom, on découvre que tout le parcours dessine une cible géante. Le viseur plonge alors en son centre et devient le « O » du logo.

**Ton** : nerveux, rapide, phrases courtes. On **vouvoie**, comme sur prointer.lu.
**ElevenLabs** : voix française énergique (par exemple Benjamin), modèle Multilingual v2, Stability ≈ 35 %, Style ≈ 45 %, vitesse 1,1. La voix dure environ **35 secondes**.

## Texte à coller dans ElevenLabs (en une fois)
Version 3 : 3 secteurs (bâtiment, industrie, tertiaire) avec 2 métiers chacun, défilement des métiers juste après (« des dizaines d'autres »), 3 agences à égalité. Seules les phrases des secteurs et « Et des dizaines d'autres métiers vous attendent » ont été enregistrées à nouveau (`prointer-viseur-benjamin-v3-secteurs.mp3`), puis insérées dans la prise v2. Au montage, ces phrases sont découpées mot par mot, enchaînées sans les pauses de l'enregistrement et accélérées (×1,25), pour que la partie secteurs reste nerveuse.
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
| 00:08,4 → 00:14,9 | « NOS SECTEURS » : bâtiment, industrie, tertiaire, deux métiers chacun | « Bâtiment : électricien, serrurier. Industrie : soudeur, technicien de maintenance. Tertiaire : gestionnaire de paie, assistant administratif. » |
| 00:14,9 → 00:17,4 | D'autres métiers défilent de plus en plus vite, puis « + DES DIZAINES D'AUTRES / SUR NOTRE SITE INTERNET » | « Et des dizaines d'autres métiers vous attendent. » |
| 00:17,4 → 00:20,7 | « ON ÉCOUTE. ON TROUVE. ON VOUS SUIT. » | « On vous écoute, on trouve la bonne mission, et on vous suit. » |
| 00:20,7 → 00:23,4 | La carte du Luxembourg, les 3 agences à égalité (plus longue) | « Trois agences au Luxembourg. » |
| 00:23,4 → 00:24,5 | Le compteur « +20 ANS D'EXPÉRIENCE » | « Plus de vingt ans d'expérience. » |
| 00:24,5 → 00:26,7 | Grand dézoom : la cible géante, « VOTRE PROCHAIN JOB ? » | « Votre prochain job ? » |
| 00:26,7 → 00:28,1 | Le viseur plonge et frappe le centre | « En plein dans le mille. » (« mille » sur l'impact) |
| 00:28,1 → 00:33,75 | Le logo dans la lunette, puis le bouton « POSTULEZ SUR PROINTER.LU » | « PRO-INTER, votre agence d'emploi. Postulez sur prointer point lu. » |

## Calage final (voix « Benjamin », `assets/voix/prointer-viseur-benjamin-v3.flac`)
La voix assemblée (prise v2 + les phrases des secteurs) dure 35,1 s. `python3 tools/voiceover.py viseur` la découpe aux silences et cale chaque phrase (et, dans les secteurs, chaque mot, à ×1,25) sur son tir (tableau `VISEUR`) ; `--sans-musique` donne la version voix + bruitages.

| Parole | Image |
|---|---|
| 0,4 s « Vous cherchez un job ? » | « UN JOB ? » claque, le viseur tire sur « JOB » |
| 3,55 s « Chez PRO-INTER, on vise juste. » | le drop sur « PRO-INTER » |
| 6,0 s « Intérim. CDD. CDI. » | un tir sur chaque contrat |
| 8,7 s « Bâtiment : électricien, serrurier. » | tirs sur BÂTIMENT, ÉLECTRICIEN, SERRURIER (8,7 / 9,1 / 10,0 s) |
| 10,7 s « Industrie : soudeur, technicien de maintenance. » | tirs sur INDUSTRIE, SOUDEUR, TECHNICIEN DE MAINTENANCE (10,7 / 11,25 / 11,8 s) |
| 12,9 s « Tertiaire : gestionnaire de paie, assistant administratif. » | tirs sur TERTIAIRE, GESTIONNAIRE DE PAIE, ASSISTANT ADMINISTRATIF (12,9 / 13,4 / 14,3 s) |
| 15,4 s « Et des dizaines d'autres métiers vous attendent. » | défilement de 14,9 à 16,3 s, « + DES DIZAINES D'AUTRES » sur « d'autres » |
| 17,85 s « On vous écoute, on trouve la bonne mission, et on vous suit. » | une coche par ligne (17,8 / 18,75 / 20,2 s) |
| 21,1 s « Trois agences au Luxembourg. » | la carte, puis les 3 agences (21,1 / 21,8 / 22,5 s) |
| 23,85 s « Plus de vingt ans d'expérience. » | « +20 » tombe sur « vingt » (24,1 s) |
| 25,75 s « Votre prochain job ? » | la cible géante et le titre, mot à mot |
| 27,4 s « En plein dans le mille ! » | « mille » sur l'impact au centre (28,1 s) |
| 28,65 s « PRO-INTER, votre agence d'emploi. » | le logo se forme |
| 30,65 s « Postulez sur prointer point lu. » | le bouton « POSTULEZ SUR PROINTER.LU » |
