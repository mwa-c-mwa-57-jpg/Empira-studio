# Neon Tulp — concept de coffeeshop à Amsterdam

Site vitrine animé pour un coffeeshop fictif de la *grachtengordel* (ceinture des canaux).
Concept : **Koffie bij dag, rust bij nacht** — café de spécialité le jour, lounge feutré la nuit.

## Ce que fait le site

| Élément | Détail |
|---|---|
| **Écran de chargement + contrôle 18+** | Compteur typographique, puis porte d'entrée « Avez-vous 18 ans ? » (obligatoire pour un coffeeshop) sur fond vidéo flouté. |
| **Mode Jour / Nuit** | Choisi automatiquement selon l'heure **réelle à Amsterdam** (08:00–17:00 = Jour). Bascule animée en cercle (View Transitions API). Jour = faïence de Delft (bleu cobalt + rouge tulipe), Nuit = encre de Delft + néon rose + ambre des réverbères. |
| **Hero vidéo** | Montage ffmpeg de 25 s en boucle parfaite, fumée WebGL (shader fBm) qui réagit à la souris, lettres « NEON » à graisse/largeur variables qui respirent sous le curseur. |
| **Le film** | Film de 29 s monté avec titres animés incrustés ; la vidéo grandit jusqu'au plein écran au scroll (section épinglée), timecode et barre de progression. |
| **Galerie horizontale** | Défilement horizontal piloté par le scroll vertical, parallaxe interne des images. |
| **La carte** | Onglets Café / Herbe / Haschich / Pâtisserie, fiche détaillée (THC/CBD, intensité, profil aromatique en barres segmentées), image qui suit le curseur. |
| **Graphique** | Affluence moyenne par heure (café vs lounge), courbes monotones, ligne « Maintenant » à l'heure d'Amsterdam, infobulle au survol, vue tableau accessible. |
| **Règles, agenda, plan** | 6 règles de la maison (AHOJG), agenda dont les dates se recalculent toutes seules, plan stylisé des canaux, horaires avec statut ouvert/fermé en direct. |
| **3 langues** | NL / EN / FR, détection automatique de la langue du navigateur. |

## Lancer en local

```bash
cd neon-tulp
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Aucune étape de build : HTML, CSS et JavaScript natifs. GSAP 3.12.5 + ScrollTrigger (cdnjs) et Lenis 1.1.13 (jsDelivr) sont chargés depuis un CDN.

## Structure

```
neon-tulp/
├── index.html
├── css/style.css          # tokens Jour/Nuit, mise en page, responsive
├── js/i18n.js             # textes NL / EN / FR
├── js/data.js             # carte, horaires, agenda, données du graphique
├── js/smoke.js            # fumée WebGL
├── js/main.js             # comportement de la page
├── assets/img/            # photos optimisées en WebP
├── assets/video/          # hero, film, fumée (MP4 H.264 + WebM VP9) et posters
└── tools/                 # script de montage ffmpeg + configuration
```

## Refaire les vidéos

`tools/montage.py` assemble les plans (effet Ken Burns sur les photos, clips découpés, transitions `xfade`,
étalonnage, titres `drawtext`, boucle sans couture). Télécharger les sources listées dans `CREDITS.md`
dans `sources/vid`, `sources/raw`, `sources/raw2`, les polices Archivo / Instrument Serif dans `tools/fonts`, puis :

```bash
python3 tools/montage.py tools/videos.json
for n in hero film smoke; do ffmpeg -i assets/video/$n.mp4 -c:v libvpx-vp9 -crf 36 -b:v 0 -an assets/video/$n.webm; done
```

## Avant une mise en ligne réelle aux Pays-Bas

- Les coffeeshops sont soumis aux critères **AHOJG** ; le « A » interdit la publicité (*affichering*).
  Un vrai site doit rester informatif : pas de promotion des produits, pas de prix mis en avant hors du lieu.
  La carte devra probablement être retirée ou limitée à la version sur place. À valider avec un juriste local et la commune.
- Remplacer l'adresse, les horaires, les prix et les chiffres d'affluence (tous fictifs).
- Vérifier la licence de chaque média (voir `CREDITS.md`).
