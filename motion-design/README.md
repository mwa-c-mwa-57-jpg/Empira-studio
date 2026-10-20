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
| `out/empira-tiktok-9x16-voix.mp4` | **Vidéo TikTok finale avec voix off** 1080×1920, 60 i/s, -14 LUFS |
| `out/empira-16x9-voix.mp4` | Version paysage finale avec voix off |
| `out/empira-tiktok-9x16-60fps.mp4` | Vidéo TikTok sans voix off (musique + bruitages) |
| `out/empira-16x9-60fps.mp4` | Déclinaison paysage 1920×1080 (YouTube, site, écrans) |
| `out/empira-music.wav` / `out/empira-sfx.wav` | Pistes audio séparées, pour mixer avec la voix off |
| `out/empira-mix.wav` | Musique + bruitages mixés |
| `out/empira-voix.wav` / `out/empira-mix-voix.wav` | Voix off calée et traitée / mix final voix + musique + bruitages |
| `assets/voix/elevenlabs-roger.mp3` | Voix off brute (ElevenLabs, voix « Roger ») |
| `tools/voiceover.py` | Découpe la voix aux silences, la cale sur l'image, ducking, -14 LUFS, assemble les vidéos (`pub` ou `gaming`) |
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
Voix off : `python3 tools/voiceover.py pub [fichier_voix]` (instants de calage dans `PUB`).

Aperçu en direct : `npx http-server .`, puis ouvrir `index.html` (ou `index.html?ar=16x9`) et cliquer sur « Lecture ».

Les textes (`SECTIONS`), la caméra (`CAM`, une par format), les photos (`plane(...)`) et le CTA se trouvent dans `index.html`.

---

# Empira Gaming : pub TikTok 30 s « Level Up »

Même moteur, même charte noir et or, rythme plus nerveux :
1. On plonge dans l'écran d'un téléphone.
2. **Lives interactifs** : le chat et les likes font réagir le jeu.
3. **Setup gaming** : casque, micro, clavier et souris.
4. **Coaching** : barre d'XP, puis LEVEL UP.
5. « Prêt ? Appuie sur A. » : le bouton A de la manette devient le « A » du logo, suivi de EMPIRA GAMING et du compte TikTok @clarkydog_23.

| Fichier | Rôle |
|---|---|
| `gaming.html` | Source (9:16 par défaut, `?ar=16x9`) |
| `out/gaming-tiktok-9x16-voix.mp4` / `out/gaming-16x9-voix.mp4` | **Vidéos finales avec voix off** (voix « Benjamin »), -14 LUFS |
| `out/gaming-tiktok-9x16-voix-sans-musique.mp4` / `out/gaming-16x9-voix-sans-musique.mp4` | Voix off + bruitages, sans musique (pour ajouter un son TikTok) |
| `out/gaming-tiktok-9x16-60fps.mp4` / `out/gaming-16x9-60fps.mp4` | Vidéos sans voix off (musique + bruitages) |
| `out/gaming-voix.wav` / `out/gaming-mix-voix.wav` | Voix off calée et traitée / mix final |
| `assets/voix/gaming-benjamin.mp3` | Voix off brute (ElevenLabs) |
| `out/gaming-music.wav` / `out/gaming-sfx.wav` / `out/gaming-mix.wav` | Pistes audio |
| `GAMING-SCRIPT-VOIX-OFF.md` | Texte ElevenLabs et timecodes |
| `tools/grade_gaming.py`, `tools/audio_gaming.py` | Étalonnage des photos et bande son |

```bash
python3 tools/grade_gaming.py && python3 tools/audio_gaming.py
node tools/render.mjs --page gaming.html --ar 9x16 --fps 60 --workers 3 --out out/gaming-9x16-silent.mp4
python3 tools/voiceover.py gaming          # voix off : calage dans GAMING, ajouter --dry pour seulement afficher le calage
python3 tools/voiceover.py gaming --sans-musique   # même chose, voix off + bruitages uniquement
```
