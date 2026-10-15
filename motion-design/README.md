# Empira Agency : pub TikTok 30 s « L'Ascension »

Un seul plan-séquence. Une caméra 3D vole à travers de vraies photos étalonnées noir et or :
1. On plonge dans l'objectif d'un smartphone.
2. On passe devant le setup du créateur (téléphone, micro, carte son, ring light).
3. On traverse la lumière de la ring light.
4. On monte du pied de la montagne au sommet (coaching).
5. On traverse une chambre de gamer.
6. On survole une foule en concert (événements).
7. La crête du Cervin devient le « A » du logo, suivi de @empiraagency.

## Fichiers
| Fichier | Rôle |
|---|---|
| `out/empira-tiktok-9x16-60fps.mp4` | **Vidéo TikTok** 1080×1920, 60 i/s, musique + bruitages (sans voix off) |
| `out/empira-16x9-60fps.mp4` | Déclinaison paysage 1920×1080 (YouTube, site, écrans) |
| `out/empira-music.wav` / `out/empira-sfx.wav` | Pistes audio séparées, pour mixer avec la voix off |
| `out/empira-mix.wav` | Musique + bruitages mixés |
| `SCRIPT-VOIX-OFF.md` | Texte de la voix off avec les timecodes |
| `PROMPT.md` | Prompt détaillé pour refaire ou décliner la pub sur une plateforme |
| `CREDITS.md` | Sources et licences des photos (Pexels, usage commercial libre) |
| `index.html` | Source de l'animation : 9:16 par défaut, `?ar=16x9` pour le paysage (lecture et timeline dans le navigateur) |
| `index-v2.html`, `index-v1.html` | Versions précédentes (archive) |
| `tools/grade.py` | Étalonnage noir et or des photos (`assets/photos-src` → `assets/photos`) |
| `tools/render.mjs` | Rendu image par image → MP4 (Playwright + ffmpeg, en parallèle) |
| `tools/audio.py` | Génération de la musique et des bruitages (numpy/scipy) |

## Régénérer
```bash
pip install numpy scipy pillow opencv-python-headless
python3 tools/grade.py
python3 tools/audio.py
node tools/render.mjs --ar 9x16 --fps 60 --workers 3 --out out/v3-9x16-silent.mp4
node tools/render.mjs --ar 16x9 --fps 60 --workers 3 --out out/v3-16x9-silent.mp4
ffmpeg -i out/v3-9x16-silent.mp4 -i out/empira-mix.wav -map 0:v -map 1:a -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -c:a aac -b:a 256k -shortest -movflags +faststart out/empira-tiktok-9x16-60fps.mp4
```
Aperçu en direct : `npx http-server .`, puis ouvrir `index.html` (ou `index.html?ar=16x9`) et cliquer sur « Lecture ».

Les textes (`SECTIONS`), la caméra (`CAM`, une par format), les photos (`plane(...)`) et le CTA se trouvent dans `index.html`.
