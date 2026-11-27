# Pack de test : motion design PRO-INTER

De quoi donner à une autre IA le même travail que la vidéo « Le viseur », avec les mêmes informations.

| Dossier | Contenu |
|---|---|
| `PROMPT.md` | le brief complet, à coller en premier message |
| `skills/base-design-motion/SKILL.md` | les bases du motion design pro (méthode Troiscoups : vitesse, flou, raccords, son) |
| `skills/motion-design-saas/SKILL.md` | la méthode de production (script, voix, animation en code, rendu) |
| `fichiers/logo/` | le logo PRO-INTER vectoriel (`logo.svg`) et l'original (`logo-officiel.png`) |
| `fichiers/carte/luxembourg.json` | la frontière du Luxembourg (OpenStreetMap) et la position des 3 agences |
| `fichiers/police/` | Montserrat |
| `fichiers/audio/voix-calee.wav` | la voix off déjà placée sur la timeline de 31,875 s |
| `fichiers/audio/musique.wav` | la musique seule (128 BPM), calée sur la même timeline |
| `fichiers/audio/voix-brute.flac` | la prise ElevenLabs assemblée, avant calage, si l'IA veut caler la voix elle-même |

## Comment s'en servir

1. **Si l'IA accepte les skills** (un agent de code comme Claude Code, Cursor ou Codex) : copiez le dossier `skills/` dans son dossier de skills, ou dites-lui de lire `skills/*/SKILL.md` avant de commencer.
2. **Sinon** (une IA de chat) : envoyez d'abord le contenu des deux `SKILL.md`, puis celui de `PROMPT.md`.
3. Joignez le dossier `fichiers/` (ou le ZIP complet).

Pour un test à l'aveugle, ne lui montrez pas notre vidéo avant qu'elle ait rendu la sienne. Comparez ensuite les deux avec les critères de la partie 7 du brief.
