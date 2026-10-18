// Catalogue Empira Studio — uniquement les articles choisis par Empira.
// Les produits eux-mêmes sont dans products-data.js, modifiable depuis l'espace
// admin du site (/admin). Ce catalogue est partagé par le site et par la
// fonction de paiement (server/checkout.js) : le prix payé est toujours relu
// ici côté serveur, jamais celui envoyé par le navigateur.
//
// Variantes (ex. la longueur du câble) : chaque variante est un produit à part
// entière (son propre id et son propre prix) qui partage le même `group`.
// La boutique n'affiche qu'une carte par groupe, la fiche produit propose le choix.

import DATA from "./products-data.js";

export const CATEGORIES = [
  { id: "micros", label: "Micros" },
  { id: "audio", label: "Interfaces audio" },
  { id: "accessoires", label: "Bras, pieds & câbles" },
  { id: "packs", label: "Packs" },
];

export const PRODUCTS = DATA.map((p) => ({ type: "product", ...p }));

export const PRODUCT_MAP = new Map(PRODUCTS.map((p) => [p.id, p]));

// Sélections : des setups composés uniquement des articles ci-dessus, au prix
// des articles (aucune remise inventée). Utilisées par l'accueil et le configurateur.
// Un produit supprimé depuis l'admin disparaît simplement des sélections.
export const SELECTIONS = [
  {
    id: "premier-live",
    name: "Premier live",
    kind: "Démarrer en USB",
    items: ["tonor-micro-usb-xlr", "tonor-bras-profil-bas"],
    short: "Un micro USB livré avec ses câbles et un bras qui le place sous ta caméra. Branche, parle, c'est en ligne.",
    why: "En USB, le TONOR TD510 se branche directement sur ton ordinateur : pas besoin d'interface pour démarrer.",
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
]
  .map((s) => ({ ...s, items: s.items.filter((id) => PRODUCT_MAP.has(id)) }))
  .filter((s) => s.items.length);

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
