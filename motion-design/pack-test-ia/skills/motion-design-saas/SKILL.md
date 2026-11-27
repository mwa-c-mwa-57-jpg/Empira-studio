---
name: "motion-design-saas"
description: "Crée des vidéos motion design de présentation produit (SaaS, app, agence) dans le style Motionlab : 30-90 s, UI en vedette, typo cinétique, verre et lueurs, rendu en code (Remotion + Blender)."
---

# Motion design de présentation produit (style Motionlab)

Référence : les 6 vidéos du portfolio de motion-lab.agency, analysées image par image (hébergées sur Wistia, 960×540). Leur chaîne réelle : script Google Docs → storyboard Figma → animation After Effects → voix et musique Artlist → validation Frame.io. V1 en 12 jours ouvrés.

Ici on obtient le même rendu **en code** : Remotion (React) pour l'animation et le montage, Blender (connecté en MCP sur le PC de Wilson) pour les objets 3D en verre, ffmpeg pour l'export.

## 1. Les 6 vidéos décodées

| Vidéo | Durée | Univers | Gestes signature |
|---|---|---|---|
| Altcoins France (crypto) | 42 s | Fond bleu nuit, grande sphère bleue avec liseré lumineux, passages en blanc | Gros chiffre « 88 % » sur un dashboard flouté ; phrase tapée avec mot-clé dans une pastille ; écran verrouillé iPhone avec notifications qui s'empilent ; logo 3D en verre ; mots géants flous en fond derrière un téléphone ; schéma en étoile avec avatars ; formulaire en carte de verre ; avis Trustpilot |
| Synthetiz (avis clients) | 60 s | Fond blanc, dégradé orange flou en bas, accents orange | Texte lettre par lettre (« hmmm... ») ; mot-clé en orange ; compteur façon machine à sous avec flou de mouvement ; mot étiré « ROOOOMAN » avec un long avis qui défile derrière ; formes d'explosion ; note Google 3,2/5 sur une vague ; QR code dans un téléphone ; toast « Bravo ! » ; carte avec épingles ; stickers de logos clients ; compte à rebours ; fin logo + bouton |
| Holovisio (hologrammes) | 62 s | Noir pur, néon violet | Phrases courtes centrées dans des pastilles lumineuses ; cercles en pointillés ; contour d'œil ; égaliseur audio ; champ d'étoiles en hyperespace ; mur de logos clients ; « +500 entreprises » ; plans filmés du produit |
| Kactus (B2B événementiel) | 90 s | Lavande et blanc, violet uni en fin | Mélange de vidéos d'archive (château, mer, homme au portable) et d'UI par-dessus ; faux résultat Google ; gros chiffre « 33 000 » qui compte ; carte d'Europe avec pastilles de chiffres ; écran de fin logo sur violet |
| Virage Prépa (étudiants) | 34 s | Noir et rouge, lueur rouge | Compte à rebours 3D qui tombe en tournant ; logo cube 3D rouge ; cartes empilées en perspective ; écrans d'UI inclinés en 3D avec liseré rouge ; quiz avec barre de progression ; note « 15/20 » entourée au marqueur rouge ; logos des grandes écoles ; CTA |
| Kapacity (CRM) | 59 s | Beige, or et brun foncé, lumière chaude | Icônes d'apps en verre 3D ; calendrier avec curseur qui clique ; ligne de connexion avec point lumineux ; frise « Comment ça fonctionne ? » ; contrat tamponné « SIGNÉ » avec paillettes ; roue de mots 3D (Vente / Échéancier / Commission) avec flou de profondeur ; anneau 3D de cartes autour d'une fiche ; grille de portraits + « 11 000 €/an » ; pièces 3D ; « Nativement / SANS SURCOÛT » ; CTA « Essayez gratuitement » |

**Points communs** : une seule couleur d'accent par vidéo (celle du client) sur fond très sombre ou très clair ; une grande tache de lumière floue (souvent en bas de l'écran) ; typo sans-serif géométrique, phrases courtes centrées, un mot-clé coloré ; l'UI réelle du produit en cartes arrondies avec ombre douce ; du flou de mouvement partout ; de la 3D légère (perspective, verre) ; preuve sociale (avis, logos, chiffres) ; fin = logo + promesse + bouton.

## 2. Bibliothèque de gestes (et comment les faire en code)

1. **Phrase tapée / mot à mot** : révéler les lettres avec `Math.floor(interpolate(...))` sur `text.slice()` ; mot-clé en couleur d'accent ou dans une pastille arrondie qui grandit.
2. **Gros chiffre qui compte** : `interpolate` de 0 à la valeur, format `toLocaleString('fr-FR')`, maintien 1,5 s.
3. **Compteur machine à sous** : une colonne de chiffres par position, `translateY` avec easing fort, flou vertical (`filter: blur()` proportionnel à la vitesse) ou `<CameraMotionBlur>` de @remotion/motion-blur.
4. **Tache de lumière** : un ou deux grands `div` ronds en couleur d'accent avec `filter: blur(120px)`, qui respirent lentement (scale 1 → 1,08).
5. **Carte de verre** : `backdrop-filter: blur(20px)`, fond blanc à 8-15 %, bordure 1 px blanche à 20 %, liseré lumineux en haut.
6. **UI en perspective 3D** : conteneur `perspective: 1600px`, carte `rotateX(12deg) rotateY(-18deg)` qui se redresse ; liseré de lueur sur le bord.
7. **Cartes empilées** : même carte répétée avec `translateZ` et `translateY` décalés, entrée en cascade (délai 4-6 images).
8. **Notifications sur écran verrouillé** : grande heure, notifications qui glissent du haut et poussent les précédentes (spring sans rebond).
9. **Curseur qui clique** : SVG de curseur qui suit une courbe de Bézier, petit scale 0,9 au clic + onde circulaire.
10. **Roue de mots 3D** : mots placés sur un cylindre (`rotateX(i*angle) translateZ(r)`), rotation du cylindre, flou et opacité selon l'éloignement.
11. **Anneau ou carrousel 3D** : cartes sur un cercle (`rotateY(i*angle) translateZ(r)`) autour d'un élément central.
12. **Mots géants en fond** : texte énorme (300-400 px), très pâle ou flou, qui glisse lentement derrière l'UI.
13. **Annotation à la main** : cercle ou souligné en SVG avec `stroke-dashoffset` animé, trait irrégulier, couleur d'accent.
14. **Tampon + paillettes** : tampon qui arrive en scale 1,4 → 1 avec légère rotation, particules dorées sur canvas.
15. **Particules / hyperespace / égaliseur** : canvas dessiné image par image avec un hasard déterministe (`random()` de Remotion, jamais `Math.random`).
16. **Objets 3D en verre** (logo, icônes, pièces, cube) : modéliser et rendre dans **Blender** (verre, éclairage studio, fond transparent) en séquence PNG, puis l'intégrer dans Remotion avec `<Img>` par image ou en vidéo WebM transparente. Alternative plus simple : @remotion/three.
17. **Vidéos d'archive + UI par-dessus** (style Kactus) : `<OffthreadVideo>` en plein écran légèrement assombri, UI en carte flottante au-dessus.
18. **Transitions** : zoom continu d'un écran à l'autre, flou de mouvement sur les glissés rapides, passage par un écran de la couleur d'accent. Pas d'effets gadgets.

**Mouvement** : entrées 300-500 ms avec easing sortie douce `Easing.bezier(0.22, 1, 0.36, 1)` ou spring sans rebond ; mouvements rapides toujours floutés ; jamais rien d'immobile plus de 2 s (dérive lente de la caméra ou de la lumière).

## 3. Ce qu'ils utilisent probablement

Confirmé par leur site : After Effects, Figma, Google Docs, Artlist, Frame.io.
Déduit des images (hypothèses) : un logiciel 3D (Cinema 4D ou Blender) pour le verre, les pièces et les icônes ; dans After Effects, des calques 3D pour les roues et les anneaux, des expressions pour les compteurs, des plugins courants de lueur (Deep Glow), de particules (Trapcode) et de courbes d'animation (Flow), du flou de mouvement natif ; des banques de vidéos pour les plans filmés.

## 4. Structures types

**30-35 s** : 0-3 s accroche (compte à rebours, gros chiffre ou question) · 3-8 s logo · 8-25 s 2-3 fonctions en UI · 25-34 s preuve (chiffre, logos) + CTA.

**45-60 s** : 0-4 s accroche (problème vécu, tapé à l'écran) · 4-10 s la douleur en chiffres · 10-12 s révélation du logo · 12-45 s parcours dans l'UI, une fonction par scène, « Et là, la magie opère » comme pivot · 45-55 s preuve sociale · 55-60 s logo + bouton.

**90 s (B2B)** : accroche filmée · 4 arguments dans l'ordre : volume d'affaires → visibilité → qualité des demandes → lever le frein (sans frais, sans engagement) · un chiffre par argument · fin sur aplat de la couleur de marque.

L'accroche des 3 premières secondes doit se comprendre sans le son.

## 5. Règles de Wilson

- Utiliser les **vraies captures** des applications (WhatsApp, TikTok, etc.) telles quelles : ne pas recréer les écrans, ne pas changer la typo.
- Seule retouche autorisée : **masquer les numéros de téléphone** (flou ou bande) des personnes de l'agence.
- Charte Empira si la vidéo concerne Empira Studio.

## 6. Méthode de production

1. **Brief** : produit, cible, objectif, durée, formats (16:9 et 9:16), langue, voix off oui/non, couleur d'accent, fond sombre ou clair.
2. **Script** en tableau : temps | texte à l'écran / voix | visuel (avec le n° du geste de la section 2) | son. Le faire valider.
3. **Storyboard** : une image fixe par scène pour valider le style.
4. **Assets** : captures en haute résolution, logo SVG, polices ; objets 3D rendus dans Blender si besoin.
5. **Animation** dans Remotion : `npx create-video@latest`, une `<Composition>` par format (1920×1080 et 1080×1920, 30 fps), une scène par `<Sequence>`, composants réutilisables (`TypeLine`, `StatCounter`, `SlotNumber`, `GlowBlob`, `GlassCard`, `UiTilt`, `PhoneFrame`, `Cursor`, `WordWheel`, `HandCircle`, `BlurBox`, `EndCard`).
6. **Son** : musique libre de droits + un whoosh ou un clic discret par apparition importante.
7. **Rendu** : `npx remotion render <id> out/16x9.mp4` et `out/9x16.mp4`, H.264.
8. **Contrôle** : planche de 16 images par vidéo (ffmpeg), vérifier lisibilité, numéros masqués, temps de lecture, CTA.

### Exemple : compteur machine à sous (Remotion)

```tsx
import {interpolate, useCurrentFrame, Easing} from 'remotion';
export const SlotNumber = ({value, start = 0, color = '#111'}: {value: string; start?: number; color?: string}) => {
  const f = useCurrentFrame() - start;
  return (
    <div style={{display: 'flex', fontSize: 160, fontWeight: 600, color, lineHeight: 1}}>
      {value.split('').map((ch, i) => {
        if (!/\d/.test(ch)) return <span key={i}>{ch}</span>;
        const target = Number(ch) + 20;
        const p = interpolate(f, [i * 3, 30 + i * 3], [0, target], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.22, 1, 0.36, 1)});
        const speed = Math.abs(p - interpolate(f - 1, [i * 3, 30 + i * 3], [0, target], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.22, 1, 0.36, 1)}));
        return (
          <div key={i} style={{height: 160, overflow: 'hidden'}}>
            <div style={{transform: `translateY(${-p * 160}px)`, filter: `blur(0px ${Math.min(speed * 6, 12)}px)`}}>
              {Array.from({length: 30}, (_, n) => <div key={n} style={{height: 160}}>{n % 10}</div>)}
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

(`blur(0px Ypx)` n'existe pas en CSS : pour un vrai flou vertical, utiliser un filtre SVG `feGaussianBlur stdDeviation="0 Y"` ou @remotion/motion-blur.)

## 7. Checklist finale

- [ ] Accroche compréhensible en 3 s, sans le son
- [ ] Une seule couleur d'accent, une tache de lumière, fond très sombre ou très clair
- [ ] Récit centré sur le problème de la cible, chaque chiffre avec son argument
- [ ] Flou de mouvement sur les gestes rapides, rien de figé plus de 2 s
- [ ] Interfaces lisibles en 9:16 sur téléphone
- [ ] Numéros masqués, captures non modifiées par ailleurs
- [ ] Preuve sociale (avis, logos ou chiffres)
- [ ] Fin : logo + promesse + bouton
- [ ] Versions 16:9 et 9:16 rendues et vérifiées