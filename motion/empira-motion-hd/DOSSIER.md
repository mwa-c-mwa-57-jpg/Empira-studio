# EMPIRA — Motion HD : « Du A au A »

Plan-séquence de 20,5 s en vraie 3D, vertical 1080×1920 (30 i/s). La caméra recule sans coupe, du détail du petit A doré jusqu'à un A monumental qui abrite le studio.

## 1. Inventaire réel

| Ressource | État |
|---|---|
| 4 vidéos de référence (R1 4 roues, R2 @motionlovee, R3 FS Prospection, R4 @zensu.visuals) | Présentes, avec leur piste audio, et analysées |
| Logo officiel | Seulement un export Canva matriciel : le A fait environ 230 px. **Pas de fichier vectoriel.** |
| Vectorisation du A | Reconstruite par ajustement des arêtes au sous-pixel (écart inférieur à 1 px, recouvrement de 95,8 % avec l'original). Le symbole n'est pas redessiné. Fichier : `assets/A_geometry.json` |
| Mot EMPIRA AGENCY et devise | Repris tels quels de l'export officiel, en texture. Pas de police disponible, donc pas de recomposition. |
| Capture du profil TikTok @empiraagency | Utilisée sur l'écran du setup |
| Outils | three.js 0.170 en WebGL 2 dans Chromium headless (rendu logiciel) : matières physiques, ombres, halo. Environ 0,7 à 1 s par image en 1080×1920. Son généré en Python (numpy), ffmpeg. |
| Non disponibles | Blender, générateur vidéo IA. Image IA : Canva seulement, sans contrôle de la géométrie. |

## 2. Audit des références

Vérification adverse faite sur R1 et R2 (16 et 12 affirmations confirmées, 4 et 5 corrigées). Sur R3 et R4, la vérification n'a pas pu tourner (limite de session) : leurs constats ne sont **pas contre-vérifiés**.

| Élément | Observation réelle | Technique | Application à EMPIRA |
|---|---|---|---|
| Caméra (R1) | Un seul vrai mouvement 3D : le garage isométrique (17,9 à 18,4 s), où la perspective change. Tout le reste, ce sont des plans 2D inclinés. *(vérifié)* | Faux 3D par plans d'interface | **Vraie caméra 3D sur tout le film** : c'est notre différence. |
| Transitions (R1, R3) | Coupes masquées par un flash ou un halo en une seule image, un flou radial ou un flou de mouvement (0,87 ; 3,57 ; 7,83 ; 20,83 s…). *(R1 vérifié)* | Masquer la coupe | **Aucun flash pour masquer une coupe** : il n'y a pas de coupe. Le seul voile de lumière (ring light) a une cause physique. |
| Passage dans un anneau (R2, 10,9 s) | Plongée à travers le trou d'un tore. *(vérifié, relevé par le vérificateur)* | Ouverture circulaire servant de porte | **La ring light comme premier portail.** |
| Rythme (R2) | Animation calée sur une grille de 128 BPM (métronome visible dans l'interface), musique à environ 130,8 BPM, donc décalage entre les deux. *(vérifié)* | Grille rythmique | Tous nos passages tombent sur une grille de 128 BPM **commune à l'image et au son**. |
| Dézoom (R4) | Dézoom brusque qui ralentit de façon exponentielle (lettre de 42 → 28 → 22 px). *(non contre-vérifié)* | Courbe de vitesse exponentielle | Distance de caméra pilotée **en échelle logarithmique**, comme dans *Powers of Ten*. |
| Raccords d'objet (R1) | L'avatar garde sa place entre la liste et le profil ; la plaque d'immatriculation devient une carte. *(vérifié)* | Objet persistant | Le **même A** passe de 20 cm à 20 m. |
| Lumière (R2) | Écran filmé dans le noir sur une surface miroir : l'écran est la seule source de lumière. *(vérifié)* | Lumière motivée | Chaque lumière a une source visible : ring light, LED, softbox, éclairages de façade. |
| Son (R1, R3) | Son peu ponctuant (R1 à −30,7 LUFS, transitoires décalés de 140 ms à plus de 1,5 s). | Limite | Son **généré à l'image près** : souffles, résonance de l'anneau, silence puis impact. |
| Fin (R4) | 1,28 s de noir puis une fin TikTok bien plus forte. *(non contre-vérifié)* | Limite | Fin tenue sur l'enseigne allumée, avec un fondu du son. |
| Captation (R1, R2, R3) | Écran filmé au téléphone : l'animation n'occupe que 40 à 55 % du cadre, les noirs sont relevés. | Limite | Rendu natif plein cadre, noirs profonds. |

**Diagnostic.** Les références impressionnent par leurs raccords d'objets et leur rythme, mais elles **trichent** sur la profondeur (plans 2D) et masquent leurs coupes par des flashs. L'écart à creuser pour EMPIRA : une vraie perspective continue, sans aucune coupe, avec des transitions qui viennent de la géométrie des objets.

## 3. Identité cinématographique

Noirs profonds, or sombre et métallique (pas d'or brillant « bling »), une source de lumière motivée par plan, un seul geste de caméra (le recul), les matières avant les effets. Le logo n'est jamais redessiné : géométrie ajustée sur l'original, mot et devise repris de l'export officiel.

## 4. Concepts

**A. « Du A au A » (recommandé et produit).** Le petit A du bureau est la maquette du siège : on recule du symbole jusqu'au bâtiment qui a sa forme, et le logo complet (grand A, petit A intérieur, enseigne EMPIRA AGENCY) se reconstitue à l'échelle de l'architecture. La boucle donne le sens : *tout part d'EMPIRA et tout y revient.*

**B. Alternative : « Dans l'objectif ».** On part du reflet du A dans la lentille d'une caméra de tournage. On recule à travers les lentilles de l'objectif (cercles imbriqués), on découvre le plateau, puis le plateau apparaît sur l'écran d'un téléphone en LIVE. Ce concept est plus « tournage » et moins « marque ». Il est aussi plus risqué : le verre et la réfraction coûtent cher en rendu logiciel.

## 5. Architecture et schéma de continuité

```
[macro arête du A] --recul--> [A + socle EMPIRA] --traversée--> (RING LIGHT) --l'anneau entre par les bords-->
[ring light + bureau] --frôlement à gauche--> (MICRO) --> [setup : écran @empiraagency, caméra, softbox]
--recul + montée--> [studio dans l'ouverture du A, arche petit A au fond] --traversée--> (FAÇADE VITRÉE)
--> [A monumental de nuit] --impact--> [enseigne EMPIRA AGENCY qui s'allume, plan final tenu]
```

Distance caméra–logo : 3 cm → 57 m, interpolée en échelle logarithmique (spline monotone, sans dépassement).

## 6. Grammaire des transitions

| # | Caméra (début → fin) | Objet de passage | Raccord | Lumière | Son |
|---|---|---|---|---|---|
| T1 | 3 cm → 55 cm de l'axe du A, recul plein axe et léger arc à droite | **Ring light** (Ø 54 cm), centrée exactement sur la trajectoire | Plan du cercle franchi à 3,75 s (temps 8). L'anneau entre par les bords du cadre entre 4,6 et 5,6 s. | Voile de lumière (halation) de 0,2 s au franchissement | Souffle d'air qui culmine au passage, puis résonance cristalline (880 / 1318 / 1760 Hz) |
| T2 | 1,5 → 2,2 m, montée de 4° | **Micro sur bras**, à 7 cm à gauche de la trajectoire, tourné vers la caméra | Passage en amorce : la grille entre en gros plan par la gauche et rapetisse | Ring light en contre-jour | Souffle court à gauche (7,5 à 8,1 s, temps 16) |
| T3 | 3 → 4 m, montée vers 2 m de haut | **Façade vitrée** = ouverture intérieure du grand A | Franchissement à 12,19 s (temps 26). Les montants défilent au premier plan, puis les jambes du A entrent dans le cadre. | L'intérieur chaud déborde sur l'extérieur froid (lune) | Long souffle aigu et scintillement de verre |
| T4 | 4 → 19 m | (révélation) | Le A monumental se lit en entier | Projecteurs au sol sur les jambes | Coupure du son de 0,4 s, puis **impact** à 15,0 s (temps 32) |
| T5 | 19 → 57 m, ralentissement | Enseigne au sol | L'enseigne s'allume entre 15,0 et 16,9 s | Projecteur de l'enseigne | Accord final à 16,9 s (temps 36), fondu jusqu'à 20,5 s |

## 7. Storyboard (un seul plan, découpé en moments)

| Moment | Durée | Première image | Dernière image | Caméra | Contrôle |
|---|---|---|---|---|---|
| 1. Macro | 0 → 2,4 s | Arête biseautée de l'apex intérieur du A, or sombre, reflet rasant | A entier, de trois quarts | De 3 cm à 20 cm, cible apex → centre | Biseau net, pas de brûlure |
| 2. Logo | 2,4 → 3,75 s | A et socle | Mot EMPIRA lisible sur le socle | De 20 cm à 55 cm | Mot officiel non déformé |
| 3. Ring light | 3,75 → 5,6 s | Voile de lumière | L'anneau encadre le logo | Accélération de 55 cm à 1,5 m | L'anneau doit être visible avant 5,6 s ✔ |
| 4. Micro | 5,6 → 8,5 s | Ring light et bureau | Grille du micro en amorce à gauche | De 1,5 à 2,3 m | Le micro se lit comme un micro (grille et bague dorée) ✔ |
| 5. Setup / studio | 8,5 → 12,2 s | Bureau, écran @empiraagency, caméra, softbox | Studio dans l'ouverture du A, arche dorée au fond | Recul lent de 2,3 à 4 m | Pas d'objet traversé par erreur |
| 6. Façade | 12,2 → 15 s | Montants vitrés | A monumental en entier | Accélération de 4 à 19 m | Raccord de perspective continu |
| 7. Final | 15 → 20,5 s | A et enseigne éteinte | Enseigne EMPIRA AGENCY allumée, plan tenu | Ralentissement de 19 à 57 m | Logo complet et lisible, pas de noir mort |

## 8. Faisabilité et méthode

- **Choix : 3D procédurale contrôlée (three.js).** La caméra et les objets sont définis par le code, donc la perspective est continue et les raccords sont exacts (la ring light et le micro sont placés à partir de la trajectoire). Pas de modèle importé : tout est construit et vérifiable.
- **IA vidéo écartée** pour ce film : elle ne garantit pas la géométrie du logo ni la continuité d'un plan-séquence.
- **Limites actuelles :** pas de réfraction réelle du verre ni de profondeur de champ optique (trop coûteuses en rendu logiciel) ; un setup volontairement épuré ; le créateur est suggéré par sa place (micro, écran, lumière) plutôt que montré.
- **Pour aller plus loin :** le fichier vectoriel officiel du logo, une vraie vidéo de LIVE pour l'écran, une musique sous licence à caler sur la même grille de 128 BPM.

## 9. Contrôle qualité

Voir la grille dans le message de livraison : chaque moment a été contrôlé sur images fixes avant le rendu final.
