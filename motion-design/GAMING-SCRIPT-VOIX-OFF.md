# Empira Gaming : « Level Up », script voix off (30 s, TikTok)

**Ton** : plus énergique que la pub générale, mais toujours posé et premium. On tutoie.
**ElevenLabs** : voix utilisée « Benjamin » (Roger convient aussi), modèle Multilingual v2, Stability ≈ 40 %, Style ≈ 35 %, vitesse 1.0. La voix doit durer **27 secondes maximum**.

## Texte à coller dans ElevenLabs (en une fois)
```
Tu fais du gaming sur TikTok ? <break time="0.4s" /> Passe en mode Empira Gaming. <break time="0.8s" />
Des lives interactifs : un like, un commentaire, des cadeaux… <break time="0.3s" /> et ta communauté joue avec toi, en direct. <break time="0.8s" />
Casque, micro, clavier, caméra : on monte ton setup gaming avec toi. <break time="0.8s" />
Concept, stratégie, formation : on t'aide à faire level up ta chaîne. <break time="0.8s" />
Prêt ? <break time="0.3s" /> Appuie sur A. <break time="1.0s" />
Empira Studio. <break time="0.8s" /> Développer, accompagner, influencer. <break time="0.6s" /> Retrouve-nous sur TikTok : arobase Clarky dog, tiret du bas, vingt-trois.
```

Si la prononciation accroche, remplacez :
- « lives » par « laïves » ;
- « gaming » par « guéming » ;
- « level up » par « lèvel eup » ;
- « setup » par « sètt-eupe » ;
- « Agency » par « Édjeunsi » ;
- si « underscore » est mal dit, écrivez « tiret du bas ».

## Calage final (voix « Benjamin », `assets/voix/gaming-benjamin.mp3`)
Prise du 20/10, 16 h 28. ElevenLabs resserre les pauses : la voix brute dure 28,4 s. `python3 tools/voiceover.py gaming` la découpe aux silences et replace chaque morceau sur son image (tableau `GAMING`). La dernière phrase est accélérée de 10 % sans changer la hauteur de la voix.

| Parole | Image | Voix off |
|---|---|---|
| 00:00,4 → 00:03,6 | L'étincelle plonge dans l'écran du téléphone | « Tu fais du gaming sur TikTok ? Passe en mode Empira Gaming. » |
| 00:04,3 → 00:10,1 | **01 — Lives interactifs** : bulles de chat, cœurs (« Likes, commentaires, cadeaux ») | « Des lives interactifs : un like, un commentaire, des cadeaux… et ta communauté joue avec toi, en direct. » |
| 00:10,6 / 12,0 / 13,0 | **02 — Setup gaming** : casque, micro, clavier | « Casques, micros, claviers, caméras : |
| 00:14,2 → 00:15,8 | | on monte ton setup gaming avec toi. » |
| 00:16,0 / 16,6 / 17,4 | **03 — Coaching** : niveaux de la barre d'XP | « Concept, stratégie, formation : |
| 00:18,2 → 00:19,8 | « level up » tombe sur LEVEL UP (18,8 s) | on t'aide à faire level up ta chaîne. » |
| 00:20,4 / 00:20,8 | « Prêt ? » puis « Appuie sur A. » | « Prêt ? Appuie sur A. » (le bouton s'enfonce juste après, à 21,45 s) |
| 00:22,3 | Impact, le logo apparaît | « Empira Studio. » |
| 00:23,4 / 24,2 / 25,1 | Le slogan s'écrit mot à mot avec la voix | « Développer, accompagner, influencer. » |
| 00:25,9 → 00:29,3 | RETROUVE-NOUS SUR TIKTOK, @clarkydog_23 | « Retrouve-nous sur TikTok : arobase clarkydog, tiret du bas, vingt-trois. » |
