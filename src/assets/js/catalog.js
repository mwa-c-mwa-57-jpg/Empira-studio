// Catalogue Empira Studio — uniquement les articles choisis par Empira.
// Source unique des produits, partagée par le site et par la fonction de
// paiement (server/checkout.js) : le prix payé est toujours relu ici côté
// serveur, jamais celui envoyé par le navigateur.
//
// ⚠️ PRIX À CONFIRMER : prix publics relevés sur les captures envoyées
// (Amazon, Thomann, maono.com), ou estimés quand aucun prix n'était visible
// (marqués « estimé »). Remplace-les par tes prix de vente avant la mise en ligne.
//
// Variantes (ici la longueur du câble) : chaque variante est un produit à part
// entière (son propre id et son propre prix) qui partage le même `group`.
// La boutique n'affiche qu'une carte par groupe, la fiche produit propose le choix.

export const CATEGORIES = [
  { id: "micros", label: "Micros" },
  { id: "audio", label: "Interfaces audio" },
  { id: "accessoires", label: "Bras, pieds & câbles" },
  { id: "packs", label: "Packs" },
];

const IMG = "assets/img/products/";

export const PRODUCTS = [
  {
    id: "maono-pd200xs",
    brand: "Maono",
    name: "Maono PD200XS",
    kind: "Micro dynamique USB/XLR, éclairage RGB",
    category: "micros",
    price: 79.9, // estimé
    badge: "Best-seller",
    image: `${IMG}maono-pd200xs.webp`,
    short: "Le micro des streamers : son chaud, éclairage RGB et double sortie USB/XLR.",
    description:
      "Branché en USB, il est reconnu instantanément par ton PC ou ton Mac. Le jour où tu passes à une interface audio, sa sortie XLR prend le relais. Sa capsule dynamique cardioïde garde ta voix au premier plan et ignore les bruits de la pièce. L'application Maono Link règle égaliseur, compresseur et limiteur (en mode USB).",
    specs: ["Dynamique, directivité cardioïde", "Double sortie USB-C et XLR", "Réponse en fréquence 40 Hz – 16 kHz", "Molette gain / volume casque et mute tactile", "Éclairage RGB 9 couleurs, désactivable", "Réglages avancés via Maono Link (USB)"],
  },
  {
    id: "rode-podmic",
    brand: "RØDE",
    name: "RØDE PodMic",
    kind: "Micro dynamique broadcast XLR",
    category: "micros",
    price: 74,
    badge: "Pro",
    image: `${IMG}rode-podmic.webp`,
    short: "Le son des studios radio, dans un micro conçu pour la voix parlée.",
    description:
      "Le micro de référence des podcasts et des émissions en direct. Son filtre anti-pop et sa suspension intégrés limitent les plosives et les vibrations, et sa rotule permet de le placer pile devant ta bouche. Sortie XLR : il se branche sur une interface audio comme la Maono G1 NEO.",
    specs: ["Dynamique, directivité cardioïde", "Sortie XLR (sans alimentation fantôme)", "Réponse en fréquence 50 Hz – 15 kHz", "Filtre anti-pop et suspension internes", "Rotule de fixation intégrée", "Corps métallique, 937 g"],
  },
  {
    id: "tonor-micro-usb-xlr",
    brand: "TONOR",
    name: "TONOR USB/XLR", // modèle exact à confirmer
    kind: "Micro dynamique USB/XLR avec pied de bureau",
    category: "micros",
    price: 59.9, // estimé
    image: `${IMG}tonor-micro.webp`,
    short: "Tout-en-un : le micro, son pied de bureau et ses deux câbles, prêt en deux minutes.",
    description:
      "Un micro à double sortie : en USB-C directement sur ton ordinateur, ou en XLR sur une interface audio quand ton setup évolue. La prise casque 3,5 mm te permet de t'écouter en direct, et les commandes sont sur le micro. Livré avec son pied de bureau et ses câbles USB et XLR.",
    specs: ["Double sortie USB-C et XLR", "Prise casque 3,5 mm pour t'écouter en direct", "Commandes sur le micro", "Pied de bureau inclus", "Câbles USB et XLR inclus"],
  },
  {
    id: "maono-pd100",
    brand: "Maono",
    name: "Maono PD100",
    kind: "Micro dynamique de podcast XLR",
    category: "micros",
    price: 33,
    image: `${IMG}maono-pd100.webp`,
    short: "Le petit prix qui sonne grand : un vrai micro dynamique pour démarrer en XLR.",
    description:
      "Un micro dynamique cardioïde pensé pour la voix, livré avec son pied de table et son câble XLR. Associé à une interface comme la Maono G1 NEO, c'est la façon la plus économique d'obtenir un son propre et posé.",
    specs: ["Dynamique, directivité cardioïde", "Sortie XLR", "Réponse en fréquence 60 Hz – 14 kHz", "Pied de table inclus", "Câble XLR inclus"],
  },
  {
    id: "maono-g1-neo",
    brand: "Maono",
    name: "Maono G1 NEO",
    kind: "Interface audio / mixeur de streaming",
    category: "audio",
    price: 99.9, // estimé
    badge: "Coup de cœur",
    image: `${IMG}maono-g1-neo.webp`,
    short: "Ta régie son : réduction de bruit, effets de voix, pads sonores et faders.",
    description:
      "Branche ton micro XLR, ton casque et ton téléphone en Bluetooth : la G1 NEO mélange tout et l'envoie à ton PC en USB-C. Réduction de bruit, réverbération, changeur de voix, 4 pads sonores, sidechain et deux faders pour doser micro et musique en plein live.",
    specs: ["Entrée XLR avec alimentation fantôme 48 V", "USB-C, Bluetooth et entrée AUX", "Réduction de bruit, reverb, changeur de voix", "4 pads sonores personnalisables", "Sidechain, loopback, écoute directe", "2 faders micro / musique"],
  },
  {
    id: "pack-maono-streaming",
    brand: "Maono",
    name: "Pack Streaming Maono",
    kind: "Pack officiel PD200XS + G1 NEO",
    category: "packs",
    price: 166.99,
    badge: "Pack",
    image: `${IMG}pack-maono.webp`,
    short: "Le pack de démarrage officiel Maono : le micro PD200XS et la régie G1 NEO.",
    description:
      "Le pack de démarrage Maono pour le streaming de jeux. Le micro PD200XS se branche en XLR sur la G1 NEO, qui ajoute la réduction de bruit, les effets de voix, les pads sonores et les faders pour piloter ton son en direct.",
    specs: ["Micro Maono PD200XS", "Interface Maono G1 NEO", "Réduction de bruit et effets de voix", "4 pads sonores pour animer ton live"],
  },
  {
    id: "tonor-bras-profil-bas",
    brand: "TONOR",
    name: "TONOR Bras profil bas",
    kind: "Bras de micro à profil bas",
    category: "accessoires",
    price: 29.99,
    image: `${IMG}tonor-bras.webp`,
    short: "Le bras qui reste sous ta caméra : ton micro au bon endroit, ton visage dégagé.",
    description:
      "Contrairement aux bras classiques qui passent devant l'écran, le profil bas arrive par le dessous : ton micro est à 10 cm de ta bouche sans cacher ton visage à la caméra. Pince de bureau, rotation à 360° et adaptateur de filetage pour s'adapter à la plupart des micros.",
    specs: ["Profil bas, hors du champ de la caméra", "Rotation horizontale 360°", "Fixation par pince de bureau", "Filetage 3/8\" avec adaptateur 5/8\""],
  },
  {
    id: "rode-ds1",
    brand: "RØDE",
    name: "RØDE DS1",
    kind: "Pied de micro de bureau",
    category: "accessoires",
    price: 30,
    image: `${IMG}rode-ds1.webp`,
    short: "Un pied de bureau lourd et stable, quand tu n'as pas la place pour un bras.",
    description:
      "Construction tout métal et base ronde lestée : le DS1 ne bouge pas, même quand tu tapes sur ton bureau. Sa hauteur se règle de 26 à 40,5 cm pour placer le micro à hauteur de bouche.",
    specs: ["Hauteur réglable de 26 à 40,5 cm", "Base ronde lestée Ø 147 mm", "Construction tout métal", "Filetage 3/8\""],
  },
  ...[
    ["1m", "1 m", 9.69],
    ["2m", "2 m", 12.99],
    ["3m", "3 m", 13.99],
  ].map(([suffix, variant, price]) => ({
    id: `cable-xlr-${suffix}`,
    group: "cable-xlr",
    variant,
    brand: "SLDXIAN",
    name: "Câble XLR SLDXIAN",
    kind: "Câble micro XLR mâle / femelle",
    category: "accessoires",
    price,
    image: `${IMG}cable-xlr.webp`,
    short: "Le câble indispensable pour relier un micro XLR à ton interface audio.",
    description:
      "Un câble XLR mâle vers femelle à 3 broches, aux connecteurs robustes et contacts dorés. Il relie ton micro XLR (RØDE PodMic, Maono PD100…) à ton interface audio ou ta table de mixage.",
    specs: ["XLR mâle vers XLR femelle, 3 broches", "Contacts dorés", "Compatible micros, interfaces, tables de mixage, enceintes", "Existe en 1 m, 2 m et 3 m"],
  })),
].map((p) => ({ type: "product", ...p }));

// Sélections : des setups composés uniquement des articles ci-dessus, au prix
// des articles (aucune remise inventée). Utilisées par l'accueil et le configurateur.
export const SELECTIONS = [
  {
    id: "premier-live",
    name: "Premier live",
    kind: "Démarrer en USB",
    items: ["tonor-micro-usb-xlr", "tonor-bras-profil-bas"],
    short: "Un micro USB livré avec ses câbles et un bras qui le place sous ta caméra. Branche, parle, c'est en ligne.",
    why: "En USB, le micro TONOR se branche directement sur ton ordinateur : pas besoin d'interface pour démarrer.",
  },
  {
    id: "regie-streaming",
    name: "Régie streaming",
    kind: "Le pack officiel Maono",
    items: ["pack-maono-streaming"],
    short: "Le micro PD200XS et la régie G1 NEO : effets, pads et réduction de bruit pour animer tes lives.",
    why: "La G1 NEO ajoute la réduction de bruit, les effets de voix et les pads sonores : idéal pour le gaming et le Just Chatting.",
  },
  {
    id: "son-broadcast",
    name: "Son broadcast",
    kind: "Podcast et talk-show",
    items: ["rode-podmic", "maono-g1-neo", "tonor-bras-profil-bas", "cable-xlr-3m"],
    short: "Le RØDE PodMic, la G1 NEO, le bras et le câble : un son de studio radio, prêt à brancher.",
    why: "Le RØDE PodMic est un micro de studio radio : avec la G1 NEO, ta voix passe au niveau broadcast.",
  },
];

export const PRODUCT_MAP = new Map(PRODUCTS.map((p) => [p.id, p]));

export const getProduct = (id) => PRODUCT_MAP.get(id);
export const getSelection = (id) => SELECTIONS.find((s) => s.id === id);

// Toutes les variantes d'un produit (lui-même s'il n'en a pas).
export const variantsOf = (p) => (p?.group ? PRODUCTS.filter((x) => x.group === p.group) : p ? [p] : []);

// Un produit par groupe : c'est ce que la boutique affiche.
export const LISTED = PRODUCTS.filter((p) => !p.group || variantsOf(p)[0] === p);

// Nom complet avec la variante, pour le panier et le paiement.
export const fullName = (p) => (p.variant ? `${p.name} (${p.variant})` : p.name);

export const selectionTotal = (s) => s.items.reduce((sum, id) => sum + (PRODUCT_MAP.get(id)?.price || 0), 0);

// Conservé pour d'éventuels packs composés plus tard (somme des articles inclus).
export function packValue(pack) {
  return (pack.includes || []).reduce((sum, id) => sum + (PRODUCT_MAP.get(id)?.price || 0), 0);
}

export const SHIPPING = {
  freeFrom: 149,
  price: 6.9,
  countries: ["FR", "BE", "CH", "LU", "MC"],
};

export const MAX_QTY = 10;
