---
name: "base-design-motion"
description: "Bases du motion design pro (méthode Troiscoups) : les 4 réglages vitesse, flou, raccords, son, le style visuel et le script auto-démonstratif. À charger avant toute vidéo motion."
---

# Base design Motion (méthode Troiscoups)

Référence : la vidéo TikTok de troiscoups.fr « Vous venez de vous arrêter. Et rien n'a été filmé. » (2:00, 16:9, ~14 000 likes), analysée image par image. Elle explique le motion design **en le faisant** : chaque phrase de la voix off est illustrée par l'effet dont elle parle.

Ce skill est la **couche de base**. Il passe avant les skills spécialisés (motion-design-saas, pub Empira Pneu, vidéos LinkedIn) : ceux-ci disent *quoi* montrer, celui-ci dit *comment ça doit bouger* pour faire pro.

## 1. La définition à retenir

Motion design = **du texte + des formes + une interface + du mouvement**. Rien n'est filmé. Ce qui retient : **il se passe quelque chose à chaque seconde**. Une image fixe, on la survole ; un mouvement, on le suit.

La différence entre amateur et pro n'est pas le contenu (« même texte, même couleur ») mais **4 réglages**. Sans eux, la même vidéo ressemble à un diaporama, l'attention baisse et le spectateur passe à la vidéo suivante.

## 2. Les 4 réglages (le cœur du skill)

### Réglage 1 · Vitesse — « rien ne démarre d'un coup »
- Tout mouvement suit une courbe **lent → rapide → lent**. Jamais de `linear` (sauf rotation continue ou défilement de fond).
- Arrivées : départ très rapide, atterrissage très doux (expo out). Sorties : l'inverse (expo in). Déplacement d'un point A à un point B : ease in-out.
- Durées : entrée d'un mot 8–14 images (30 fps), déplacement de carte 15–24 images, gros changement de décor 20–30 images.

```ts
import {Easing} from 'remotion';
export const EASE = {
  entree: Easing.bezier(0.16, 1, 0.3, 1),   // arrive vite, se pose doucement
  sortie: Easing.bezier(0.7, 0, 0.84, 0),   // part doucement, file vite
  trajet: Easing.bezier(0.65, 0, 0.35, 1),  // lent-rapide-lent
};
export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
```
Alternative : `spring({frame, fps, config: {damping: 200}})` (sans rebond). Rebond léger réservé aux petits éléments ludiques (pastille, toggle).

### Réglage 2 · Flou — « ce qui va vite laisse une traînée »
- Sans flou de mouvement, l'image saccade. Le flou est **proportionnel à la vitesse** et **dans la direction du mouvement** (horizontal pour un mot qui glisse).
- Signature de la vidéo : mots géants qui entrent latéralement, étirés et flous, puis nets à l'arrêt (« …es toujours », « séparer l'amateur du pro », « Si ça s'explique »).
- Calcul : vitesse = position(image) − position(image − 1) ; flou = vitesse × 0,3 à 0,4 px, plafonné à ~40 px.

```tsx
export const DirBlur: React.FC<{id: string; x: number; y?: number; children: React.ReactNode}> = ({id, x, y = 0, children}) => (
  <>
    <svg width={0} height={0} style={{position: 'absolute'}}>
      <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation={`${x} ${y}`} />
      </filter>
    </svg>
    <div style={{filter: x || y ? `url(#${id})` : undefined}}>{children}</div>
  </>
);

// Mot qui entre par la droite avec traînée
const pos = (f: number) => interpolate(f, [0, 14], [1600, 0], {...clamp, easing: EASE.entree});
const v = Math.abs(pos(frame) - pos(frame - 1));
<DirBlur id="mot-1" x={Math.min(v * 0.35, 40)}><div style={{transform: `translateX(${pos(frame)}px)`}}>toujours</div></DirBlur>
```
Pour une scène entière (caméra, 3D) : `<CameraMotionBlur>` de `@remotion/motion-blur`.

### Réglage 3 · Raccords — « on ne coupe pas, un élément survit et devient le plan suivant »
- Dans la vidéo : seulement ~3 vraies coupes en 2 minutes. Tout le reste passe par un élément qui **survit** au changement de scène.
- Raccords observés :
  - un mot-titre qui rétrécit et devient le titre d'une carte ;
  - une carte d'interface qui recule et devient l'écran d'un ordinateur portable ;
  - une pastille « La suite » avec sa sphère qui se transforme en titre de chapitre ;
  - un écran de téléphone dessiné (contour + ▶) qui devient un vrai téléphone en main ;
  - une tache bleue floue qui grossit jusqu'à remplir l'écran → l'écran de fin sur fond bleu ;
  - zoom à travers un élément (on « entre » dans l'œil, dans l'écran) ;
  - balayage par un mot géant flou qui traverse tout l'écran.
- En code : l'élément qui survit vit **hors des `<Sequence>`**, dans un calque persistant, et ses propriétés sont interpolées à cheval sur la frontière entre deux scènes. Le décor change pendant qu'il couvre ou attire l'œil.

```tsx
// Le point bleu survit puis avale l'écran (transition vers l'écran de fin)
const t = [0, 40, 58, 76];
const taille = interpolate(frame - FIN, t, [28, 28, 500, 4200], {...clamp, easing: EASE.trajet});
const flou = interpolate(frame - FIN, [40, 76], [0, 60], clamp);
<div style={{position: 'absolute', left: '50%', top: '50%', width: taille, height: taille,
  transform: 'translate(-50%,-50%)', borderRadius: '50%', background: '#2F44C3', filter: `blur(${flou}px)`}} />
```

### Réglage 4 · Son — « chaque son posé à l'image près, ni avant, ni après »
- Méthode de production : **on enregistre la voix off d'abord**, puis on anime **chaque mot calé sur la voix**, puis on pose **chaque bruitage à l'image près** sur les images clés.
- Impact (clic, pop, toggle) = exactement l'image où l'objet se pose. Whoosh = son pic calé sur l'image de vitesse maximale (donc il commence avant le mouvement : mesurer le décalage du pic dans le fichier).
- Un fond musical discret, une nappe ou un léger souffle sous les passages sombres.

```tsx
import {Audio, Sequence, staticFile} from 'remotion';
const Sfx = ({at, src, avance = 0}: {at: number; src: string; avance?: number}) => (
  <Sequence from={at - avance} layout="none"><Audio src={staticFile(src)} /></Sequence>
);
<Sfx at={K.carteSePose} src="sfx/pop.wav" />
<Sfx at={K.motPasse} src="sfx/whoosh.wav" avance={9} /> {/* pic du whoosh 9 images après son début */}
```

**Calage mot à mot sur la voix** : transcrire la voix off avec horodatage par mot (`@remotion/install-whisper-cpp` ou `openai-whisper --word_timestamps True`) → `mots.json` `[{text, start, end}]` en secondes. Chaque mot à l'écran démarre à `Math.round(start * fps) - 2` (2 images d'avance : le mot se pose quand on l'entend).

### Le test des 4 interrupteurs
Prévoir une prop `reglages = {vitesse, flou, raccords, son}` dans la composition. Tout à `false` → easing linéaire, pas de flou, coupes sèches, pas de bruitages. Rendre les deux versions et comparer : si la version « tout coupé » ne fait pas diaporama par contraste, les réglages ne sont pas assez marqués. Bonus : c'est un avant/après prêt à montrer à un prospect.

## 3. Langage visuel observé

**Palette** (une seule couleur d'accent, alternance sombre/clair toutes les 10–20 s) :
| Rôle | Couleur |
|---|---|
| Noir de départ | `#0D0C11` |
| Bleu nuit (fonds sombres) | `#1A245F` |
| Bleu électrique (accent, aplats) | `#2F44C3` / `#3146C5` |
| Blanc froid (fonds clairs) | `#FBFDFF` |
| Lavande pâle (ombres, reflets) | `#CAD4EF` |
| Texte foncé sur clair | bleu marine ~`#1B2050` |

Pour un client : remplacer le bleu par SA couleur, garder la logique (sombre ↔ clair + 1 accent).

**Typo** : grotesque très grasse, serrée (Inter Tight 800, Geist Bold, Satoshi Black), interlettrage −2 à −4 %, phrases courtes, point final assumé (« Faites-les rester. »). Mots-clés géants (200–400 px en 1080p).

**Matières** : cartes arrondies (rayon 24–40 px) en verre ou noir mat avec liseré clair ; ombres douces bleutées ; lueur (glow) autour des éléments bleus ; taches de lumière floues en fond ; sphère et carré arrondi 3D bleus brillants qui flottent ; petites étoiles ✦ ; photos en noir et blanc de mains tenant des objets, dans des cartes qui flottent en 3D.

**Bibliothèque de gestes** (avec moment dans la vidéo) :
1. Interface fantôme qui se construit (carte + carré + onde audio), 0:02.
2. Mot barré dans une pastille (« ~~Caméra~~ · Décor · Acteur »), 0:04.
3. Mot clé souligné par un trait qui se dessine (« filmé. »), 0:04 et 1:47 (avec un point lumineux au bout).
4. Mot géant qui entre en traînée floue, 0:19, 0:37, 1:44.
5. Étiquette blanche en pastille à côté d'une image (« Image fixe » / « Mouvement »), 0:22.
6. Mur de cartes photo en profondeur 3D, la caméra avance au travers, 0:29.
7. Courbe de vitesse dessinée avec étiquettes « Lent / Rapide / Lent » et une boule qui la parcourt, 0:39.
8. Règle graduée dont les traits se resserrent au milieu (visualise l'easing), 0:42.
9. Onde audio en barres verticales blanches, timeline avec losanges d'images clés, 0:57 et 1:24.
10. Liste numérotée avec interrupteurs (toggles) qui basculent un par un, 1:02.
11. Contour de lettres en courbes de Bézier avec poignées bleues (le mot « mot » vectoriel), 1:22.
12. Viseur de caméra (4 coins) + pastille « REC » qui devient toggle, 1:32.
13. Mots empilés qui s'ajoutent sous une barre-curseur bleue (Lancement / Offre / Appli / Service), 1:37.
14. Barre de progression jusqu'à « 100 % », 1:49.
15. Champ de message qui se tape (« Message privé » → « @troiscoups »), 1:52.
16. Écran de fin : logo + promesse + « Vidéos en motion design » + pastille @compte, 1:57.

**Rythme** : un changement visible toutes les 2–3 s ; rien d'immobile plus de 2 s (dérive lente de caméra, lumière qui respire) ; une idée visuelle par phrase de voix off ; le mot à l'écran = le mot clé prononcé, pas la phrase entière.

## 4. Le script auto-démonstratif (structure de 2 min)

La force de la vidéo : elle **prouve en direct** ce qu'elle affirme. Réutilisable pour vendre du motion design (offre LinkedIn, Empira) ou expliquer n'importe quel produit.

| Temps | Rôle | Ce qui est dit (résumé) | Astuce |
|---|---|---|---|
| 0–8 s | Accroche | Parler de ce que le spectateur vient de faire (« vous venez de vous arrêter… rien n'a été filmé ») | Interrompre le défilement en décrivant son propre geste |
| 8–30 s | Définition + preuve | Texte, formes, interface, mouvement → « ça s'appelle… » ; image fixe vs mouvement | Chaque mot prononcé apparaît à l'écran |
| 30–62 s | Méthode en N points | « La suite » : 1 · 2 · 3 · 4, chaque point illustré par lui-même | Numéroter, un chapitre = un décor |
| 62–74 s | Contre-démonstration | On coupe tout → diaporama → l'attention baisse → « ils passent à la vidéo suivante » | Montrer la perte, ligne qui descend |
| 74–95 s | Comment on fabrique | Script → voix off → animation calée → son → livré en 4K ; « vous n'avez rien eu à filmer » | Lever le frein (pas de tournage) |
| 95–107 s | Cas d'usage + slogan | Lancement, offre, appli, service → « Si ça s'explique, ça s'anime. » | Slogan court, rythmé, souligné |
| 107–120 s | Appel à l'action | « vos clients regarderont aussi » → message privé → écran de fin | Promesse en 3 mots + compte |

Version courte 30–45 s : accroche (5 s) → 2 réglages démontrés (20 s) → avant/après (10 s) → écran de fin (5 s).

## 5. Méthode de production (en code)

1. **Script** en tableau : temps | voix off | mot(s) à l'écran | geste (n° section 3) | raccord vers la scène suivante | son. Le faire valider.
2. **Voix off** enregistrée en premier (voix de Wilson ou voix de synthèse), nettoyée, en WAV.
3. **Horodatage mot à mot** → `mots.json`.
4. **Animation Remotion** : compositions 3840×2160 (4K 16:9) et 2160×3840 ou 1080×1920 (9:16), 30 fps. Une `<Sequence>` par scène + un calque persistant pour les éléments qui font raccord. Composants : `KineticWord`, `DirBlur`, `Underline`, `Pill`, `GlassCard`, `Toggle`, `Waveform`, `KeyframeTimeline`, `SpeedCurve`, `Viewfinder`, `TypeField`, `ProgressBar`, `GlowBlob`, `EndCard`.
5. **Objets 3D** (sphère, carré arrondi, logo en verre) : Blender, rendu en PNG transparents, ou `@remotion/three`.
6. **Son** : bruitages posés sur les constantes d'images clés (`K.xxx`), musique à −18/−22 dB sous la voix.
7. **Rendu** : `npx remotion render <id> out/16x9-4k.mp4 --codec h264 --crf 18`, puis la version 9:16.
8. **Contrôle** : planche contact (1 image / 2,5 s via ffmpeg) + test des 4 interrupteurs.

## 6. Checklist finale

- [ ] Accroche qui parle du geste du spectateur, compréhensible sans le son
- [ ] Aucun mouvement linéaire (sauf fonds en dérive continue)
- [ ] Flou directionnel sur tout ce qui va vite, net à l'arrêt
- [ ] Pas plus de 2–3 coupes sèches : chaque scène naît d'un élément de la précédente
- [ ] Chaque mot clé apparaît quand il est prononcé (± 2 images)
- [ ] Chaque impact et chaque whoosh calé à l'image près
- [ ] Un changement toutes les 2–3 s, rien de figé plus de 2 s
- [ ] Une seule couleur d'accent, alternance fond sombre / fond clair
- [ ] Slogan court + écran de fin : logo, promesse, compte ou bouton
- [ ] Version « tout coupé » rendue : le contraste avec la vraie version saute aux yeux
- [ ] Versions 16:9 (4K) et 9:16 vérifiées sur téléphone