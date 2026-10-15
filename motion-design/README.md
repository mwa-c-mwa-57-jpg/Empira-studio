# Empira Agency : pub motion design 30 s « L'Ascension »

Un seul plan-séquence. Une caméra 3D vole à travers de vraies photos étalonnées noir et or : on plonge dans un objectif, on passe devant le matériel, on traverse la lumière d'une ring light, on gravit une montagne au coucher du soleil, on survole une foule en concert, et la crête du Cervin devient le « A » du logo.

## Fichiers
| Fichier | Rôle |
|---|---|
| `out/empira-pub-30s-60fps.mp4` | **Vidéo finale** 1920×1080, 60 i/s, musique et bruitages (sans voix off) |
| `out/empira-pub-30s-30fps.mp4` | Même vidéo en 30 i/s, avec flou de mouvement |
| `out/empira-music.wav` / `out/empira-sfx.wav` | Pistes audio séparées, pour mixer avec la voix off |
| `out/empira-mix.wav` | Musique + bruitages mixés |
| `SCRIPT-VOIX-OFF.md` | Texte de la voix off avec les timecodes |
| `PROMPT.md` | Prompt détaillé pour refaire ou décliner la pub sur une plateforme |
| `CREDITS.md` | Sources et licences des photos (Pexels, usage commercial libre) |
| `index.html` | Source de l'animation (s'ouvre dans un navigateur : lecture, timeline) |
| `index-v1.html` | Première version (dessin au trait, sans photos) |
| `tools/grade.py` | Étalonnage noir et or des photos (`assets/photos-src` → `assets/photos`) |
| `tools/render.mjs` | Rendu image par image → MP4 (Playwright + ffmpeg, en parallèle) |
| `tools/audio.py` | Génération de la musique et des bruitages (numpy/scipy) |

## Régénérer
```bash
pip install numpy scipy pillow opencv-python-headless
python3 tools/grade.py                                   # étalonnage des photos
python3 tools/audio.py                                   # audio → out/*.wav
node tools/render.mjs --fps 60 --workers 3 --out out/empira-v2-60fps-silent.mp4
ffmpeg -i out/empira-v2-60fps-silent.mp4 -i out/empira-mix.wav -c:v copy -c:a aac -b:a 256k -shortest out/empira-pub-30s-60fps.mp4
```
Aperçu en direct : `npx http-server .`, puis ouvrir `index.html` et cliquer sur « Lecture ».

Les textes, la caméra (`CAM`), les photos (`plane(...)`) et les timings se trouvent dans `index.html`.
