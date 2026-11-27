# Sapin de Noël (overlay fond vert) – créé le 27/11/2026

- Fichier : `sapin-de-noel.html` (un seul fichier, canvas 2D, aucune image externe). BUILD `2026-11-27a`.
- Sapin + étoile + guirlandes + neige dessinés en canvas ; boules en DOM (`<img>` pour les photos TikTok, pas de CORS → jamais en texture).
- Cadeau → boule avec la photo de profil. Même personne = sa boule grossit (paliers `tailles`). ≥ `seuilDore` (1000 💎) : boule dorée, pluie d'or, étoile, tremblement.
- Séries : différence de `repeatCount` (giftType 1), clé uid|giftId|groupId, purge 12 s. File d'attente (1 boule / 450 ms), rien de perdu.
- Placement aléatoire sans chevauchement dans la silhouette ; zone commentaires bas-gauche évitée ; max 45 boules, éviction de la plus petite/plus ancienne.
- Sauvegarde localStorage `sapinNoelEmpira_v1` (pas en `?demo`). Commandes `!sapin vider` / `!sapin test` (hôte + modos). Panneau touche A / `?admin`.
- Prudence : pas de voix, pas de remerciement, pseudo affiché 5 s seulement, rien qui réclame des cadeaux.
- Couleurs du sapin sombres/bleutées (hue ~163) pour survivre au chroma key ; option `styleSapin: 'neige'`.
- Serveur : port 8765 (`outils/serveur.ps1`). Rechargement auto toutes les 15 s si BUILD change.
