// Catalogue Empira Studio — source unique des produits, partagée par le site
// et par la fonction de paiement (server/checkout.js) : le prix payé est
// toujours relu ici côté serveur, jamais celui envoyé par le navigateur.
// Pour modifier un prix ou ajouter un produit, c'est ce fichier qu'on édite.
//
// ⚠️ PRIX À CONFIRMER : les prix ci-dessous reprennent les prix publics
// relevés chez les revendeurs (Amazon, Thomann, maono.com) ou sont estimés
// (marqués « estimé »). Remplace-les par tes prix de vente avant la mise en ligne.
//
// Variantes (couleur, longueur) : chaque variante est un produit à part entière
// (son propre id et son propre prix) qui partage le même `group`. La boutique
// n'affiche qu'une carte par groupe, la fiche produit propose le choix.

export const CATEGORIES = [
  { id: "micros", label: "Micros" },
  { id: "audio", label: "Interfaces audio" },
  { id: "accessoires", label: "Bras, pieds & câbles" },
  { id: "packs", label: "Packs" },
  { id: "services", label: "Services" },
];

export const PRODUCTS = [
  {
    id: "maono-pd200xs-noir",
    group: "maono-pd200xs",
    variant: "Noir",
    type: "product",
    brand: "Maono",
    name: "Maono PD200XS",
    kind: "Micro dynamique USB/XLR à éclairage RGB",
    category: "micros",
    price: 79.9, // estimé
    badge: "Best-seller",
    image: "assets/img/products/maono-pd200xs.svg",
    short: "Le micro des streamers gaming : son chaud, éclairage RGB et double sortie USB/XLR.",
    description:
      "Branché en USB, il est reconnu instantanément par ton PC ou ton Mac. Le jour où tu passes à une interface audio, sa sortie XLR prend le relais. Sa capsule dynamique cardioïde garde ta voix au premier plan et ignore les bruits de la pièce, et l'application Maono Link permet de régler égaliseur, compresseur et limiteur (en mode USB).",
    specs: ["Dynamique, directivité cardioïde", "Double sortie USB-C et XLR", "Réponse en fréquence 40 Hz – 16 kHz", "Molette gain / volume casque et bouton mute", "Éclairage RGB 9 couleurs, désactivable", "Réglages avancés via Maono Link (USB)"],
    level: ["debutant", "intermediaire"],
  },
  {
    id: "maono-pd200xs-blanc",
    group: "maono-pd200xs",
    variant: "Blanc",
    type: "product",
    brand: "Maono",
    name: "Maono PD200XS",
    kind: "Micro dynamique USB/XLR à éclairage RGB",
    category: "micros",
    price: 79.9, // estimé
    badge: "Best-seller",
    image: "assets/img/products/maono-pd200xs-blanc.svg",
    short: "Le micro des streamers gaming : son chaud, éclairage RGB et double sortie USB/XLR.",
    description:
      "Branché en USB, il est reconnu instantanément par ton PC ou ton Mac. Le jour où tu passes à une interface audio, sa sortie XLR prend le relais. Sa capsule dynamique cardioïde garde ta voix au premier plan et ignore les bruits de la pièce, et l'application Maono Link permet de régler égaliseur, compresseur et limiteur (en mode USB).",
    specs: ["Dynamique, directivité cardioïde", "Double sortie USB-C et XLR", "Réponse en fréquence 40 Hz – 16 kHz", "Molette gain / volume casque et bouton mute", "Éclairage RGB 9 couleurs, désactivable", "Réglages avancés via Maono Link (USB)"],
    level: ["debutant", "intermediaire"],
  },
  {
    id: "rode-podmic",
    type: "product",
    brand: "RØDE",
    name: "RØDE PodMic",
    kind: "Micro dynamique broadcast XLR",
    category: "micros",
    price: 74,
    badge: "Pro",
    image: "assets/img/products/rode-podmic.svg",
    short: "Le son des studios radio, dans un micro conçu pour la voix parlée.",
    description:
      "Le micro de référence des podcasts et des émissions en direct. Son filtre anti-pop et sa suspension intégrés limitent les plosives et les vibrations, et sa rotule permet de le placer pile devant ta bouche. Sortie XLR : il se branche sur une interface audio comme la Maono G1 NEO.",
    specs: ["Dynamique, directivité cardioïde", "Sortie XLR (sans alimentation fantôme)", "Réponse en fréquence 50 Hz – 15 kHz", "Filtre anti-pop et suspension internes", "Rotule de fixation intégrée", "Corps métallique, 937 g"],
    level: ["intermediaire", "pro"],
  },
  {
    id: "tonor-micro-usb-xlr",
    type: "product",
    brand: "TONOR",
    name: "TONOR USB/XLR", // modèle exact à confirmer
    kind: "Micro dynamique USB/XLR avec pied de bureau",
    category: "micros",
    price: 59.9, // estimé
    image: "assets/img/products/tonor-micro.svg",
    short: "Tout-en-un : le micro, son pied de bureau et les deux câbles, prêt en deux minutes.",
    description:
      "Un micro à double sortie : en USB-C directement sur ton ordinateur, ou en XLR sur une interface audio quand ton setup évolue. La prise casque 3,5 mm te permet de t'écouter en direct, et les commandes sont sur le micro. Livré avec son pied de bureau et ses câbles USB et XLR.",
    specs: ["Double sortie USB-C et XLR", "Prise casque 3,5 mm pour t'écouter en direct", "Commandes sur le micro", "Pied de bureau réglable inclus", "Câbles USB et XLR inclus"],
    level: ["debutant", "intermediaire"],
  },
  {
    id: "maono-pd100",
    type: "product",
    brand: "Maono",
    name: "Maono PD100",
    kind: "Micro dynamique de podcast XLR",
    category: "micros",
    price: 33,
    image: "assets/img/products/maono-pd100.svg",
    short: "Le petit prix qui sonne grand : un vrai micro dynamique pour démarrer en XLR.",
    description:
      "Un micro dynamique cardioïde pensé pour la voix, livré avec son pied de table et son câble XLR. Associé à une interface comme la Maono G1 NEO, c'est la façon la plus économique d'obtenir un son propre et posé.",
    specs: ["Dynamique, directivité cardioïde", "Sortie XLR", "Réponse en fréquence 60 Hz – 14 kHz", "Pied de table inclus", "Câble XLR inclus"],
    level: ["debutant"],
  },
  {
    id: "maono-g1-neo",
    type: "product",
    brand: "Maono",
    name: "Maono G1 NEO",
    kind: "Interface audio / mixeur de streaming",
    category: "audio",
    price: 99.9, // estimé
    badge: "Coup de cœur",
    image: "assets/img/products/maono-g1-neo.svg",
    short: "Ta régie son : réduction de bruit, effets de voix, pads sonores et faders.",
    description:
      "Branche ton micro XLR, ton casque et ton téléphone en Bluetooth : la G1 NEO mélange tout et l'envoie à ton PC en USB-C. Réduction de bruit, réverbération, changeur de voix, 4 pads sonores, sidechain et deux faders pour doser micro et musique en plein live.",
    specs: ["Entrée XLR avec alimentation fantôme 48 V", "USB-C, Bluetooth et entrée AUX", "Réduction de bruit, reverb, changeur de voix", "4 pads sonores personnalisables", "Sidechain, loopback, écoute directe", "2 faders micro / musique, éclairage RGB"],
    level: ["debutant", "intermediaire", "pro"],
  },
  {
    id: "tonor-bras-profil-bas",
    type: "product",
    brand: "TONOR",
    name: "TONOR Bras profil bas",
    kind: "Bras de micro à profil bas",
    category: "accessoires",
    price: 29.99,
    image: "assets/img/products/tonor-bras.svg",
    short: "Le bras qui reste sous ta caméra : ton micro au bon endroit, ton visage dégagé.",
    description:
      "Contrairement aux bras classiques qui passent devant l'écran, le profil bas arrive par le dessous : ton micro est à 10 cm de ta bouche sans cacher ton visage à la caméra. Pince de bureau, rotation à 360° et adaptateur de filetage pour s'adapter à la plupart des micros.",
    specs: ["Profil bas, hors du champ de la caméra", "Rotation horizontale 360°", "Fixation par pince de bureau", "Filetage 3/8\" avec adaptateur 5/8\""],
    level: ["debutant", "intermediaire", "pro"],
  },
  {
    id: "rode-ds1",
    type: "product",
    brand: "RØDE",
    name: "RØDE DS1",
    kind: "Pied de micro de bureau",
    category: "accessoires",
    price: 30,
    image: "assets/img/products/rode-ds1.svg",
    short: "Un pied de bureau lourd et stable, quand tu n'as pas la place pour un bras.",
    description:
      "Construction tout métal et base ronde lestée : le DS1 ne bouge pas, même quand tu tapes sur ton bureau. Sa hauteur se règle de 26 à 40,5 cm pour placer le micro à hauteur de bouche.",
    specs: ["Hauteur réglable de 26 à 40,5 cm", "Base ronde lestée Ø 147 mm", "Construction tout métal", "Filetage 3/8\""],
    level: ["debutant", "intermediaire", "pro"],
  },
  {
    id: "cable-xlr-1m",
    group: "cable-xlr",
    variant: "1 m",
    type: "product",
    brand: "SLDXIAN",
    name: "Câble XLR SLDXIAN",
    kind: "Câble micro XLR mâle / femelle",
    category: "accessoires",
    price: 9.69,
    image: "assets/img/products/cable-xlr.svg",
    short: "Le câble indispensable pour relier un micro XLR à ton interface audio.",
    description:
      "Un câble XLR mâle vers femelle à 3 broches, aux connecteurs robustes et contacts dorés. Il relie ton micro XLR (RØDE PodMic, Maono PD100…) à ton interface audio ou ta table de mixage.",
    specs: ["XLR mâle vers XLR femelle, 3 broches", "Contacts dorés", "Compatible micros, interfaces, tables de mixage, enceintes", "Existe en 1 m, 2 m et 3 m"],
    level: ["debutant", "intermediaire", "pro"],
  },
  {
    id: "cable-xlr-2m",
    group: "cable-xlr",
    variant: "2 m",
    type: "product",
    brand: "SLDXIAN",
    name: "Câble XLR SLDXIAN",
    kind: "Câble micro XLR mâle / femelle",
    category: "accessoires",
    price: 12.99,
    image: "assets/img/products/cable-xlr.svg",
    short: "Le câble indispensable pour relier un micro XLR à ton interface audio.",
    description:
      "Un câble XLR mâle vers femelle à 3 broches, aux connecteurs robustes et contacts dorés. Il relie ton micro XLR (RØDE PodMic, Maono PD100…) à ton interface audio ou ta table de mixage.",
    specs: ["XLR mâle vers XLR femelle, 3 broches", "Contacts dorés", "Compatible micros, interfaces, tables de mixage, enceintes", "Existe en 1 m, 2 m et 3 m"],
    level: ["debutant", "intermediaire", "pro"],
  },
  {
    id: "cable-xlr-3m",
    group: "cable-xlr",
    variant: "3 m",
    type: "product",
    brand: "SLDXIAN",
    name: "Câble XLR SLDXIAN",
    kind: "Câble micro XLR mâle / femelle",
    category: "accessoires",
    price: 13.99,
    image: "assets/img/products/cable-xlr.svg",
    short: "Le câble indispensable pour relier un micro XLR à ton interface audio.",
    description:
      "Un câble XLR mâle vers femelle à 3 broches, aux connecteurs robustes et contacts dorés. Il relie ton micro XLR (RØDE PodMic, Maono PD100…) à ton interface audio ou ta table de mixage.",
    specs: ["XLR mâle vers XLR femelle, 3 broches", "Contacts dorés", "Compatible micros, interfaces, tables de mixage, enceintes", "Existe en 1 m, 2 m et 3 m"],
    level: ["debutant", "intermediaire", "pro"],
  },
  {
    id: "pack-starter",
    type: "pack",
    name: "Pack Starter",
    kind: "Lancer ses premiers lives",
    category: "packs",
    price: 99, // à confirmer
    image: "assets/img/products/maono-pd200xs.svg",
    includes: ["maono-pd200xs-noir", "tonor-bras-profil-bas"],
    short: "Un micro USB qui sonne et un bras qui le met au bon endroit. Branche, parle, c'est en ligne.",
    description:
      "Le duo le plus simple pour démarrer : le Maono PD200XS se branche en USB sur ton PC, sans interface audio, et le bras profil bas le place à hauteur de bouche sans cacher ton visage. Livré avec notre guide de réglage OBS pas à pas.",
    specs: ["Maono PD200XS + bras TONOR profil bas", "Branchement USB, aucune interface nécessaire", "Guide de réglage OBS pas à pas"],
    level: ["debutant"],
  },
  {
    id: "pack-maono-streaming",
    type: "pack",
    name: "Pack Streaming Maono",
    kind: "Le pack officiel PD200XS + G1 NEO",
    category: "packs",
    price: 166.99,
    image: "assets/img/products/maono-g1-neo.svg",
    includes: ["maono-pd200xs-noir", "maono-g1-neo"],
    short: "Le micro PD200XS et la régie G1 NEO : effets, pads et réduction de bruit pour tes lives.",
    description:
      "Le pack de démarrage officiel Maono pour le streaming de jeux. Le micro PD200XS se branche en XLR sur la G1 NEO, qui ajoute la réduction de bruit, les effets de voix, les pads sonores et les faders pour piloter ton son en direct.",
    specs: ["Micro Maono PD200XS + interface Maono G1 NEO", "Réduction de bruit et effets de voix", "4 pads sonores pour animer ton live"],
    level: ["debutant", "intermediaire"],
  },
  {
    id: "pack-podcast-rode",
    type: "pack",
    name: "Pack Podcast RØDE",
    kind: "Le son broadcast",
    category: "packs",
    price: 199, // à confirmer
    image: "assets/img/products/rode-podmic.svg",
    includes: ["rode-podmic", "maono-g1-neo", "tonor-bras-profil-bas", "cable-xlr-3m"],
    short: "Le RØDE PodMic, la G1 NEO, le bras et le câble : un son de studio radio, prêt à brancher.",
    description:
      "Le setup des podcasts et des talk-shows : le micro broadcast RØDE PodMic, l'interface Maono G1 NEO pour le brancher et le régler, le bras profil bas pour le placer et le câble XLR de 3 m pour relier le tout. Rien à chercher ailleurs.",
    specs: ["RØDE PodMic + Maono G1 NEO + bras TONOR + câble XLR 3 m", "Tout est compatible et testé ensemble", "Idéal Just Chatting, podcast, interviews"],
    level: ["intermediaire", "pro"],
  },
  {
    id: "setup-remote",
    type: "service",
    name: "Réglages à distance",
    kind: "Session d'1 h en visio",
    category: "services",
    price: 49, // à confirmer
    image: "assets/img/products/setup-remote.svg",
    short: "Un expert règle avec toi OBS, ton son et tes scènes, en partage d'écran.",
    description:
      "Une heure en visio avec un membre d'Empira Agency : configuration d'OBS ou de Streamlabs, réglage du micro (gain, compresseur, suppression de bruit) et de tes scènes. Tu repars avec un live prêt à lancer.",
    specs: ["1 h en visio", "OBS / Streamlabs", "Son et scènes", "Récap écrit envoyé après la session"],
    level: ["debutant", "intermediaire", "pro"],
  },
];

export const PRODUCT_MAP = new Map(PRODUCTS.map((p) => [p.id, p]));

export const getProduct = (id) => PRODUCT_MAP.get(id);

// Toutes les variantes d'un produit (lui-même s'il n'en a pas).
export const variantsOf = (p) => (p?.group ? PRODUCTS.filter((x) => x.group === p.group) : p ? [p] : []);

// Un produit par groupe : c'est ce que la boutique affiche.
export const LISTED = PRODUCTS.filter((p) => !p.group || variantsOf(p)[0] === p);

// Nom complet avec la variante, pour le panier et le paiement.
export const fullName = (p) => (p.variant ? `${p.name} (${p.variant})` : p.name);

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
