# 07 — Catalogue des cadeaux TikTok (relevé du 28/10/2026)

Source : enregistrement d'écran du panneau de cadeaux TikTok (application en français, compte en France),
fourni par Empira Studio. Les prix sont en **pièces** ; dans le jeu, 1 pièce = 10 soldats par défaut.
Les noms et les prix peuvent varier selon le pays, la date et les événements TikTok. La vidéo ne montre pas tout
le panneau, car certaines lignes défilent trop vite pour être lues.

## Cadeaux utilisés dans `config/france.json`
| Onglet du jeu | Cadeau (prix) | Effet |
|---|---|---|
| Grossir | Rose (1) | +10 / pièce |
| Grossir | Cœur avec les doigts (5) | gains ×1,5 pendant 45 s |
| Grossir | Donut (30) | gains ×2 pendant 45 s |
| Grossir | Cœurs (199) | gains ×3 pendant 45 s |
| Défendre | Le petit Ourson (100) | bouclier 45 s |
| Défendre | Trésor de pirate (449) | vole 10 % au 1er |
| Défendre | Léon le chaton (4 888) | conquête éclair de 20 départements |
| Défendre | Léon et le Lion (34 000) | conquête éclair de 40 départements |
| Attaquer le 1er | Tom la tomate (1) | −0,3 % au 1er |
| Attaquer le 1er | Gants de boxe dorés (10) | −2 % au 1er |
| Attaquer le 1er | Cygne (699) | −12 % au 1er |
| Attaquer le 1er | Galaxie (1 000) | remet le 1er à 0 |

Les noms anglais ajoutés en alias (Finger Heart, Doughnut, Swan, Galaxy…) sont des suppositions : ❓ le langage
dans lequel la bibliothèque TikTok renvoie les noms n'a pas été vérifié sur un vrai live. Pendant un live de test,
le panneau de test liste les **cadeaux non reconnus** avec leur nom et leur identifiant TikTok. Il suffit alors
d'ajouter cet identifiant dans le champ `ids` du cadeau voulu : la reconnaissance par identifiant ne dépend pas de la langue.

## Images des cadeaux
- **Pendant un live** : à la connexion, le jeu demande à TikTok la liste des cadeaux de la salle, avec leurs images
  (option `enableExtendedGiftInfo` de la bibliothèque), et lit aussi l'image jointe à chaque cadeau reçu. Les vraies
  images remplacent alors les emojis dans les onglets et dans les combos sur la carte. Elles sont chargées depuis les
  serveurs de TikTok pendant le live, sans qu'aucune image TikTok ne soit copiée dans le projet. Seules les adresses
  https sont acceptées.
- **En mode test** (sans connexion), les emojis de `config/france.json` servent de remplacement.
- ❓ Non vérifié sur un vrai live : le format exact des images renvoyées par la bibliothèque. Le code accepte
  plusieurs formats (`image.url_list`, `giftImage.giftPictureUrl`…) et revient à l'emoji si aucune image n'est trouvée.

## Relevé complet (par ordre d'apparition)
| Prix | Cadeaux |
|---|---|
| 1 | Rose, TikTok, Cornet de crème glacée, Le bisou, GG, Piment, Étoile de mer, White Dove, Café, Clin d'œil, Éclair, Cœur nuage, Mamma Mia, Tom la tomate, Rythme de mirwas, Mélodie du maté, Cool, Arc-en-ciel, Ailes d'ange, Excellent, Fleur du matin, Tranche de gâteau, Pop, Classiques, Basketball, Un éclat d'espoir, Dolce Vita |
| 5 | Cœur avec les doigts, Feux d'artifice vague, Tofu, Crème glacée, Billet de rappel |
| 10 | Gants de boxe dorés, Rosa, Sceau Firelight, Collier d'amitié, J'aime ce que je vois, Ralenti, Je t'aime (I♥U) |
| 15 – 30 | Bravo ! (15), Félicitations à ma star (15), Fleurs S (20), Parfum (20), Donut (30), Capybara (30), You are on a Roll (30), You are my Jam (30) |
| 90 – 199 | Poing contre poing (90), Famille (90), Chapeau et moustache (99), Grue en origami (99), Maître du clavier (99), Carillon de perles (99), Guitare Groove (99), Accordéon fiesta (99), Souffle de quena (99), Qanun du palais (99), Mercredi gagnant (99), Cœur dans les mains (100), Cœur avec les mains (100), Le petit Ourson (100), Manette de jeu (100), Confettis (100), Cœur sur mon Terrien (100), Lunettes cœur (149), Ney mystique (149), Flûte Tempo (149), Cœurs (199), Panda Climb (199), Robot musical (199), Chat gamer (199), Je t'aime (199), Best to give me (199), Tambour parlant (199) |
| 200 – 499 | Semsemia (200), Baglama (200), Batterie explosive (249), Corgi (299), Tcheck (299), Couronne rythmique (299), Joueur(euse) 2025 (299), Amis fruités (299), Serviette de supporter (299), Violoncelle swing (299), Top du top de la galaxie (300), Ambiance électro (349), Phoque DJ (349), Casque rétro (349), Champi-rockeur (349), Maître du djembé (349), Mélodie rétro (349), Bonsoir (399), Rose à jamais (399), Ours chanteur (399), Masque cyber de joueur (399), Set de DJ (399), Sage, le Haripote futé (399), Chat porte bonheur (399), Jeu de fusée (399), Cactus Shuffle (399), Sérénade florale (399), Ailes rythmiques (399), Perroquet pop (400), Saxophone étoilé (400), Accordéon magique (400), Roi du rock néon (400), Trésor de pirate (449), Cordes cybernétiques (449), Clown Boogie (449), Chorale lumineuse (450), Koala Cupidon (450), Pop urbaine (450), Corail (499), Maître du clavier (499), Ukulélé des îles (499) |
| 500 – 999 | Polaris, Des bonbons ou un sort, Lunettes de DJ, Perdu dans ta musique, Prince, Batterie pop, Génie de la batterie, Guitare cœur, Enchantement sonore (500) ; Hamster Tambour (549) ; Flûte sakura (600) ; Hippocampe Pop (649) ; Cygne (699) ; Charme du saxo, Trophée de basket (700) ; Ours surfeur (800) ; Chapelier funky (900) ; Flamme divine (999) |
| 1 000 – 4 999 | Galaxie, Gerry la girafe, dinosaure (1 000) ; Étincelle exclusive (1 099) ; Lapin DJ (1 200) ; Laser en fête (1 300) ; Fleur au clair de lune (1 400) ; Rencontre future, Débuts de course, Chat de l'espace, Manifestation XXL, Micro en folie, Pomme de terre flottante, Bons présages (1 500) ; Carrousel (1 999) ; Couple puissant (2 000) ; Plongée avec les baleines (2 150) ; Le MécaPièce de Sage (2 199) ; Lumières vacillantes (2 200) ; Chien de l'espace (2 500) ; Moto (2 988) ; Taureau, Sérénade de raie manta, Ours rythmique, Match Maniac (2 999) ; Poule hip-hop (3 200) ; Gorille explorateur (4 088) ; Léon le chaton (4 888) ; Vaisseau spatial héros (4 999) |
| 5 000 et plus | Romance en bord de mer, Fusil à Diamants, Elise l'éléphante, Canne mystique (5 000) ; Loup (5 500) ; Fin en beauté, C'est bien de t'avoir (6 000) ; Cygne noir (7 000) ; Léon et Lili (9 699) ; Planète merveilleuse, Canne de cristal, Pieuvre (10 000) ; Faucon (10 999) ; Superstar, Troisième anniversaire (12 000) ; Pass été XL (13 500) ; Léopard, Bel étalon en avant, Rose nébuleuse, Parcours futur, Une maison sympa, Pyramides, Moments en famille, Bateau de pirate, La nuit de rêve (15 000) ; Parc d'attractions (17 000) ; Rust contre le monde (18 999) ; Mont Olympe (19 999) ; Phénix, T-Rex (25 999) ; Flamme du dragon (26 999) ; Gorille, Sam la baleine, Canne magique (30 000) ; Léon et le Lion (34 000) |
