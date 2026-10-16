// Catalogue Empira Studio — source unique des produits, partagée par le site
// et par la fonction de paiement (server/checkout.js) : le prix payé est
// toujours relu ici côté serveur, jamais celui envoyé par le navigateur.
// Pour modifier un prix ou ajouter un produit, c'est ce fichier qu'on édite.

export const CATEGORIES = [
  { id: "micros", label: "Micros" },
  { id: "cameras", label: "Caméras" },
  { id: "lumieres", label: "Lumières" },
  { id: "controle", label: "Contrôle" },
  { id: "capture", label: "Capture" },
  { id: "audio", label: "Audio" },
  { id: "accessoires", label: "Accessoires" },
  { id: "packs", label: "Packs" },
  { id: "services", label: "Services" },
];

export const PRODUCTS = [
  {
    id: "vox-one",
    type: "product",
    name: "Vox One",
    kind: "Micro USB à condensateur",
    category: "micros",
    price: 129,
    badge: "Best-seller",
    image: "assets/img/products/vox-one.svg",
    short: "Le micro plug & play qui fait passer ta voix en qualité studio dès le premier live.",
    description:
      "Branché en USB-C, reconnu instantanément par OBS, Streamlabs ou Discord. Sa capsule cardioïde capte ta voix et ignore le reste de la pièce. Bouton mute tactile, molette de gain et sortie casque zéro latence : tout est sous ta main.",
    specs: ["USB-C, plug & play", "Capsule cardioïde 14 mm", "24 bits / 96 kHz", "Mute tactile + LED", "Sortie casque zéro latence"],
    level: ["debutant", "intermediaire"],
  },
  {
    id: "vox-pro",
    type: "product",
    name: "Vox Pro XLR",
    kind: "Micro dynamique broadcast",
    category: "micros",
    price: 299,
    badge: "Pro",
    image: "assets/img/products/vox-pro.svg",
    short: "Le son radio : chaud, précis, insensible aux bruits de clavier.",
    description:
      "Le micro dynamique des studios radio et des plus gros streamers. Il rejette naturellement l'écho et les bruits de la pièce, avec un grave profond et une voix au premier plan. À associer à une interface audio comme la Mix One.",
    specs: ["Dynamique cardioïde", "Connectique XLR", "Bonnette anti-pop incluse", "Filtre coupe-bas intégré", "Suspension anti-choc"],
    level: ["intermediaire", "pro"],
  },
  {
    id: "arm-flex",
    type: "product",
    name: "Arm Flex",
    kind: "Bras articulé pour micro",
    category: "accessoires",
    price: 79,
    image: "assets/img/products/arm-flex.svg",
    short: "Ton micro pile au bon endroit, et hors champ quand tu n'en as pas besoin.",
    description:
      "Ressorts internes silencieux, câble caché dans le bras et pince de bureau solide : le bras qui libère ton bureau et garde le micro à 10 cm de ta bouche, là où il sonne le mieux.",
    specs: ["Ressorts internes silencieux", "Passe-câble intégré", "Pince bureau jusqu'à 6 cm", "Charge max 2 kg", "Rotation 360°"],
    level: ["debutant", "intermediaire", "pro"],
  },
  {
    id: "optic-4k",
    type: "product",
    name: "Optic 4K",
    kind: "Webcam 4K HDR",
    category: "cameras",
    price: 189,
    badge: "Nouveau",
    image: "assets/img/products/optic-4k.svg",
    short: "Une image nette et lumineuse, même dans une chambre peu éclairée.",
    description:
      "Capteur grand format, autofocus rapide et HDR : ta facecam garde des couleurs naturelles et un visage net, même avec un éclairage moyen. 1080p à 60 i/s pour un mouvement fluide.",
    specs: ["4K 30 i/s · 1080p 60 i/s", "Capteur 1/2,5\"", "Autofocus + HDR", "Correction d'éclairage", "Clip écran + pas de vis trépied"],
    level: ["debutant", "intermediaire"],
  },
  {
    id: "optic-pro",
    type: "product",
    name: "Optic Pro",
    kind: "Caméra hybride + objectif 16-50 mm",
    category: "cameras",
    price: 899,
    image: "assets/img/products/optic-pro.svg",
    short: "Le flou d'arrière-plan cinéma qui fait passer ton stream dans une autre catégorie.",
    description:
      "Capteur APS-C, sortie HDMI propre et alimentation continue incluse : la caméra tourne des heures sans surchauffe. Avec la Capture 4K, tu obtiens une image de qualité cinéma en direct.",
    specs: ["Capteur APS-C 24 Mpx", "Sortie HDMI clean 4K", "Alimentation secteur incluse", "Objectif 16-50 mm stabilisé", "Autofocus suivi des yeux"],
    level: ["pro"],
  },
  {
    id: "lumen-key",
    type: "product",
    name: "Lumen Key",
    kind: "Panneau LED pilotable",
    category: "lumieres",
    price: 169,
    image: "assets/img/products/lumen-key.svg",
    short: "La lumière douce des studios, réglable depuis ton téléphone.",
    description:
      "Un panneau LED diffusé qui sculpte ton visage sans éblouir. Température de 2 900 à 7 000 K, intensité réglable au pourcent près et pilotage Wi-Fi depuis l'application ou ton contrôleur de stream.",
    specs: ["2 900 – 7 000 K", "2 800 lumens", "Indice de rendu IRC 96", "Pilotage Wi-Fi / appli", "Pied télescopique de bureau"],
    level: ["intermediaire", "pro"],
  },
  {
    id: "lumen-ring",
    type: "product",
    name: "Lumen Ring 18\"",
    kind: "Anneau lumineux + trépied",
    category: "lumieres",
    price: 89,
    image: "assets/img/products/lumen-ring.svg",
    short: "Un éclairage uniforme et flatteur pour tes lives et tes vidéos courtes.",
    description:
      "L'anneau de 45 cm qui élimine les ombres du visage. Trois modes de couleur, dix niveaux d'intensité et un support smartphone pour tourner tes TikTok et tes Reels dans la foulée.",
    specs: ["Anneau 45 cm", "3 températures, 10 intensités", "Support smartphone rotatif", "Trépied jusqu'à 2 m", "Alimentation USB"],
    level: ["debutant"],
  },
  {
    id: "deck-15",
    type: "product",
    name: "Deck 15",
    kind: "Contrôleur de stream 15 touches",
    category: "controle",
    price: 159,
    badge: "Coup de cœur",
    image: "assets/img/products/deck-15.svg",
    short: "Change de scène, coupe le micro, lance un son : en une touche.",
    description:
      "15 touches LCD que tu personnalises avec tes propres icônes. Scènes OBS, musique, lumière, alertes, multi-actions : tu pilotes tout ton live sans jamais quitter ta partie des yeux.",
    specs: ["15 touches LCD", "Intégration OBS, Twitch, YouTube", "Multi-actions & dossiers", "Pied magnétique réglable", "USB-C"],
    level: ["debutant", "intermediaire", "pro"],
  },
  {
    id: "capture-4k",
    type: "product",
    name: "Capture 4K",
    kind: "Carte d'acquisition externe",
    category: "capture",
    price: 199,
    image: "assets/img/products/capture-4k.svg",
    short: "Diffuse ta console ou ta caméra en 4K sans latence.",
    description:
      "Branche ta PS5, ta Xbox, ta Switch ou ta caméra hybride : tu joues en 4K 60 HDR sur ta télé pendant que ton PC capture et diffuse en 1080p 60. Latence quasi nulle, aucune installation compliquée.",
    specs: ["Passthrough 4K 60 HDR", "Capture 1080p 60", "USB 3.2", "Latence ultra-faible", "PS5 · Xbox · Switch · caméra"],
    level: ["intermediaire", "pro"],
  },
  {
    id: "mix-one",
    type: "product",
    name: "Mix One",
    kind: "Interface audio / mixeur streaming",
    category: "audio",
    price: 249,
    image: "assets/img/products/mix-one.svg",
    short: "Ton micro, ta musique, ton chat vocal : chacun sur sa piste.",
    description:
      "Deux entrées XLR avec préamplis silencieux, alimentation fantôme et effets voix intégrés. Gère séparément le son du jeu, de la musique et de Discord pour que ton audience entende exactement ce que tu veux.",
    specs: ["2 entrées XLR / jack", "Préamplis 60 dB", "Alimentation fantôme 48 V", "4 pistes indépendantes", "Effets voix intégrés"],
    level: ["intermediaire", "pro"],
  },
  {
    id: "monitor-h1",
    type: "product",
    name: "Monitor H1",
    kind: "Casque studio fermé",
    category: "audio",
    price: 119,
    image: "assets/img/products/monitor-h1.svg",
    short: "Entends ta voix et ton jeu tels que ton audience les entend.",
    description:
      "Un casque fermé à transducteurs 50 mm, neutre et confortable pendant de longues sessions. Il isole du bruit extérieur et évite que le son du jeu repasse dans ton micro.",
    specs: ["Fermé, isolation passive", "Transducteurs 50 mm", "38 ohms", "Câble détachable", "Coussinets mémoire de forme"],
    level: ["debutant", "intermediaire", "pro"],
  },
  {
    id: "backdrop-green",
    type: "product",
    name: "Backdrop Green",
    kind: "Fond vert rétractable",
    category: "accessoires",
    price: 149,
    image: "assets/img/products/backdrop-green.svg",
    short: "Remplace ta chambre par n'importe quel décor, et range-le en 3 secondes.",
    description:
      "Un fond vert tendu sans pli qui se déploie et se range dans son caisson. Idéal pour incruster ta facecam proprement dans ton jeu ou dans un décor à ton image.",
    specs: ["148 × 180 cm", "Tissu anti-pli", "Ouverture à vérin en 3 s", "Caisson aluminium", "Fixation sans outil"],
    level: ["intermediaire", "pro"],
  },
  {
    id: "pack-starter",
    type: "pack",
    name: "Pack Starter",
    kind: "Lancer ses premiers lives",
    category: "packs",
    price: 349,
    image: "assets/img/products/vox-one.svg",
    includes: ["vox-one", "optic-4k", "lumen-ring"],
    short: "Le trio essentiel pour un premier stream propre : son, image, lumière.",
    description:
      "Tout ce qu'il faut pour démarrer sans se tromper : un micro qui sonne, une webcam nette et une lumière qui te met en valeur. Livré avec notre guide de configuration OBS pas à pas.",
    specs: ["Vox One · Optic 4K · Lumen Ring", "Guide OBS pas à pas", "Prêt en moins d'une heure"],
    level: ["debutant"],
  },
  {
    id: "pack-createur",
    type: "pack",
    name: "Pack Créateur",
    kind: "Passer un cap",
    category: "packs",
    price: 949,
    image: "assets/img/products/vox-pro.svg",
    includes: ["vox-pro", "arm-flex", "mix-one", "optic-4k", "lumen-key", "deck-15"],
    short: "Son broadcast, lumière studio et contrôle total de ton live.",
    description:
      "Le setup des streamers réguliers : micro dynamique sur bras, interface audio, panneau LED pilotable et contrôleur de stream. Inclut une session de réglage à distance avec un membre d'Empira Agency.",
    specs: ["6 produits", "1 h de réglages à distance offerte", "Scènes OBS préconfigurées"],
    level: ["intermediaire"],
  },
  {
    id: "pack-studio",
    type: "pack",
    name: "Pack Studio",
    kind: "Le setup complet",
    category: "packs",
    price: 1990,
    image: "assets/img/products/optic-pro.svg",
    includes: ["vox-pro", "arm-flex", "mix-one", "optic-pro", "lumen-key", "deck-15", "capture-4k", "backdrop-green"],
    short: "Image cinéma, son radio, installation par nos soins.",
    description:
      "Le studio complet, pensé comme un plateau télé : caméra hybride, capture 4K, deux sources de lumière, audio broadcast et fond vert. Installation et calibrage complets par Empira Agency inclus.",
    specs: ["8 produits", "Installation & calibrage inclus", "Overlays de base offerts", "Suivi 30 jours"],
    level: ["pro"],
  },
  {
    id: "setup-remote",
    type: "service",
    name: "Réglages à distance",
    kind: "Session d'1 h en visio",
    category: "services",
    price: 49,
    image: "assets/img/products/setup-remote.svg",
    short: "Un expert règle avec toi OBS, ton son et tes scènes, en partage d'écran.",
    description:
      "Une heure en visio avec un membre d'Empira Agency : configuration d'OBS ou de Streamlabs, réglage du micro (gain, compresseur, suppression de bruit), de la caméra et de tes scènes. Tu repars avec un live prêt à lancer.",
    specs: ["1 h en visio", "OBS / Streamlabs", "Son, image, scènes", "Récap écrit envoyé après la session"],
    level: ["debutant", "intermediaire", "pro"],
  },
];

export const PRODUCT_MAP = new Map(PRODUCTS.map((p) => [p.id, p]));

export const getProduct = (id) => PRODUCT_MAP.get(id);

// Somme des prix à l'unité des produits d'un pack (pour afficher l'économie).
export function packValue(pack) {
  return (pack.includes || []).reduce((sum, id) => sum + (PRODUCT_MAP.get(id)?.price || 0), 0);
}

export const SHIPPING = {
  freeFrom: 149,
  price: 6.9,
  countries: ["FR", "BE", "CH", "LU", "MC"],
};

export const MAX_QTY = 10;
