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

---

# Empira Gaming : présentation TikTok 44 s « Jeux & interactions »

Présentation des lives interactifs du guide de jeux, en un plan-séquence 9:16. Aucun logiciel n'est cité, et le logo de l'agence est l'original, intact :
1. Setup néon : « Et si ton live devenait un jeu ? »
2. Le principe : like → boost, cadeau → explosion, commentaire → téléportation.
3. **GTA V** : du point A au Mont Chiliad, le camp qui t'aide et le camp qui t'empêche.
4. **Minecraft** : mode TNT.
5. **Roblox** : les six modes.
6. **Jeux d'horreur** : coupure de courant, screamer.
7. **Dix jeux interactifs** prêts à lancer.
8. **Sur demande** : le mur des autres jeux, puis le logo et @clarkydog_23.

| Fichier | Rôle |
|---|---|
| `jeux.html` | Source de l'animation (9:16) |
| `out/jeux-tiktok-9x16-60fps.mp4` | Vidéo (musique + bruitages) |
| `out/jeux-tiktok-9x16-sans-musique.mp4` | Vidéo avec les bruitages seulement |
| `out/jeux-music.wav` / `out/jeux-sfx.wav` / `out/jeux-mix.wav` | Pistes audio |
| `JEUX-SCRIPT-VOIX-OFF.md` | Texte ElevenLabs et timecodes |
| `tools/upscale.py`, `tools/upscale_guide.py` | Agrandissement ×4 des visuels du guide (Real-ESRGAN, CPU) |
| `tools/grade_jeux.py`, `tools/audio_jeux.py` | Étalonnage, découpe des cartes du guide, bande son |

```bash
pdfimages -png assets/docs/guide-de-jeux.pdf assets/jeux-src/pages/p
pip install torch --index-url https://download.pytorch.org/whl/cpu   # + poids RealESRGAN_x4plus.pth (GitHub xinntao/Real-ESRGAN)
python3 tools/upscale_guide.py && python3 tools/grade_jeux.py && python3 tools/audio_jeux.py
node tools/render.mjs --page jeux.html --fps 60 --to 44 --workers 3 --out out/jeux-9x16-silent.mp4
```

---

# PRO-INTER : motion design 40 s « L'histoire de Pro » (9:16)

Le « O » du logo PRO-INTER, la cible, saute hors du logo et devient **Pro**, un petit bonhomme qui accompagne un intérimaire, en un seul plan qui défile :
1. Le logo se dessine, la cible prend vie et dit bonjour.
2. **La recherche** : un candidat cherche une mission qui lui correspond.
3. **L'écoute** : à l'agence, compétences, expérience et envies ; Pro passe en mode viseur et scanne le CV.
4. **Le bon poste** : le viseur se pose sur la bonne offre (intérim, CDD, CDI).
5. **Sur le terrain** : bâtiment, industrie, électricité, chauffage-ventilation.
6. **Le suivi** : suivi régulier, réactivité, proximité.
7. **Près de chez vous** : Dudelange, Esch-sur-Alzette, Mondorf-les-Bains, plus de 15 ans d'expertise.
8. Pro replonge dans le logo : « Postulez sur prointer.lu ».

| Fichier | Rôle |
|---|---|
| `prointer.html` | Animation (SVG, 9:16), lecture et timeline dans le navigateur |
| `out/prointer-9x16-voix.mp4` / `out/prointer-9x16-voix-sans-musique.mp4` | **Vidéos finales avec voix off** (Benjamin), avec ou sans musique, -14 LUFS |
| `out/prointer-9x16-60fps.mp4` / `out/prointer-9x16-sans-musique.mp4` | Vidéos (musique + bruitages / bruitages seuls) |
| `assets/voix/prointer-benjamin.mp3` | Voix off brute (ElevenLabs) |
| `out/prointer-music.wav` / `out/prointer-sfx.wav` / `out/prointer-mix.wav` | Pistes audio |
| `assets/prointer/logo-officiel.png` → `logo.svg`, `logo-paths.json` | Logo officiel et sa version vectorielle animable |
| `tools/prointer_logo.py` | Tracé vectoriel (potrace) du logo officiel, cible redessinée en géométrie exacte |
| `tools/audio_prointer.py` | Musique (marimba, 120 BPM) et bruitages |
| `PROINTER-SCRIPT-VOIX-OFF.md` | Texte ElevenLabs et timecodes |

```bash
pip install potracer && python3 tools/prointer_logo.py && python3 tools/audio_prointer.py
node tools/render.mjs --page prointer.html --fps 60 --to 40 --workers 3 --out out/prointer-9x16-silent.mp4
python3 tools/voiceover.py prointer && python3 tools/voiceover.py prointer --sans-musique
```
