# Empira Agency : pub motion design 30 s

Un plan-séquence unique : une ligne dorée trace le parcours du créateur (équipement, accompagnement, événements) et finit en dessinant le « A » du logo.

## Fichiers
| Fichier | Rôle |
|---|---|
| `out/empira-pub-30s.mp4` | Vidéo finale 1920×1080 avec musique et bruitages (sans voix off) |
| `out/empira-music.wav` / `out/empira-sfx.wav` | Pistes audio séparées pour le mixage avec la voix off |
| `out/empira-mix.wav` | Musique + bruitages mixés |
| `SCRIPT-VOIX-OFF.md` | Texte de la voix off avec les timecodes |
| `PROMPT.md` | Prompt détaillé pour refaire ou décliner la pub sur une plateforme |
| `index.html` | Source de l'animation (s'ouvre dans un navigateur : lecture, timeline) |
| `tools/render.mjs` | Rendu image par image → MP4 (Playwright + ffmpeg) |
| `tools/audio.py` | Génération de la musique et des bruitages (numpy/scipy) |

## Régénérer
```bash
python3 tools/audio.py                                   # audio → out/*.wav
node tools/render.mjs --fps 30 --out out/empira-video-silent.mp4
ffmpeg -i out/empira-video-silent.mp4 -i out/empira-mix.wav -c:v copy -c:a aac -b:a 256k -shortest out/empira-pub-30s.mp4
```
Aperçu en direct : `npx http-server .`, puis ouvrir `index.html` et cliquer sur « Lecture ».

Tous les textes, les timings (`SPARK_KEYS`, `CAM`) et les couleurs se trouvent dans `index.html`.
