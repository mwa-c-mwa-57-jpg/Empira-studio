// Réglages de « Empira Conquest » (version vendue).
// Tout ce qui est chiffré dans le cahier des charges est ici, pour pouvoir l'ajuster sans toucher au moteur.

export const TITRE = 'Empira Conquest';
export const SOUS_TITRE = 'La bataille des départements';
export const VERSION = '1.0.0';

export const REGLES = {
  dureeMinutes: 15,
  podiumSec: 14,
  soldatsArrivee: 5,
  likesParSoldat: 20,
  soldatsCommentaire: 1,
  delaiCommentaireSec: 2,
  soldatsPartage: 8,
  soldatsAbonnement: 15,
  soldatsParPiece: 10,
  // crescendo : 10 soldats par pièce jusqu'à 30 pièces, puis jusqu'à ×1,2 (12 par pièce) à 4 888 pièces
  crescendoDebut: 30,
  crescendoFin: 4888,
  crescendoMax: 1.2,
  partAttaquant: 0.4, // les cadeaux d'attaque rapportent 40 % de leur valeur en soldats
  partButin: 0.25, // ce qui n'a pas pu être détruit revient pour un quart à l'attaquant
  ripostesec: 30,
  forceRiposte: 2,
  blindageParTank: 0.25,
  blindageMax: 0.5,
  occupationPart: 0.5,
  liberationPieces: 100,
  heliSalves: 25, // valeur de la Galaxie répartie en 25 salves
  heliIntervalleSec: 20,
  tsunamiPartCible: 0.6, // 15 000 sur 25 000 chez la cible, le reste sur les départements traversés
  nucleaireVoisins: 0.15, // souffle : les voisins des cibles perdent 15 %
  // porte-avions : 4 vagues d'avions sur la cible ; chaque vague touche aussi son plus gros voisin (25 % de la vague)
  porteAvionsVagues: 4,
  porteAvionsVoisin: 0.25,
  // ambiance : toutes les 30 à 55 s, un ravitaillement (+30 sur un département au hasard),
  // un bombardement surprise sur le 1er (−5 %, bouclier respecté) ou un simple survol
  ambianceSec: [30, 55],
  ravitaillementSoldats: 30,
  bombardementPart: 0.05,
  annonceArriveeSec: 8,
};

export const VAGUES = [
  { id: 'doublon', minute: 3, nom: 'DOUBLON', texte: 'Likes et commentaires ×2', mult: 2 },
  { id: 'pluie', minute: 6, nom: 'PLUIE DE PARACHUTISTES', texte: 'Chaque commentaire ×5 + un parachutiste', mult: 5, parachute: true },
  { id: 'triple', minute: 9, nom: 'TRIPLÉ', texte: 'Likes et commentaires ×3', mult: 3 },
  { id: 'assaut', minute: 12, nom: 'ASSAUT FINAL', texte: 'Likes et commentaires ×5', mult: 5, sirene: true, parachute: true },
];
export const VAGUE_DUREE_SEC = 60;
export const VAGUE_PREAVIS_SEC = 15;
export const VAGUE_CADEAUX_MAX = 1.5;
export const VAGUE_RATTRAPAGE = 1.5;

export const EVENEMENTS = {
  intervalleSec: [25, 50],
  revolution: { dureeSec: 60, mult: 2 },
  duel: { dureeSec: 90, vol: 0.1 },
  prime: { dureeSec: 90, prime: 100 },
  mission: { dureeSec: 100, prime: 60, messagesParEquipe: 4, soldatsParEquipe: 25 },
};

// Reconnaissance par nom exact (français et anglais), pour ne pas confondre « Parfum » et « Parfum d'amour ».
// coins = prix affiché ; les soldats sont calculés sur le prix réellement reçu de TikFinity.
export const CADEAUX = [
  // Renforts (dans TON département)
  { id: 'rose', noms: ['Rose'], coins: 1, onglet: 'renforts', icone: '🌹', effetTexte: '+10 soldats', effet: { type: 'soldats' } },
  { id: 'escouade', noms: ['Cœur avec les doigts', 'Finger Heart'], coins: 5, onglet: 'renforts', icone: '💞', effetTexte: 'escouade : 60 soldats', effet: { type: 'escouade', mult: 1.2 } },
  { id: 'commandos', noms: ['Gants de boxe dorés', 'Golden Gloves', 'Golden Boxing Gloves'], coins: 10, onglet: 'renforts', icone: '🥇', effetTexte: '10 commandos : 200', effet: { type: 'commandos', mult: 2 } },
  { id: 'tank', noms: ['Cœur dans les mains', 'Heart in Hand'], coins: 100, onglet: 'renforts', icone: '💝', effetTexte: 'tank : +1 050, blindé', effet: { type: 'tank' } },
  // Bonus et défense
  { id: 'rosa', noms: ['Rosa'], coins: 10, onglet: 'bonus', icone: '🌷', effetTexte: '+50 % pendant 45 s', effet: { type: 'boost', mult: 1.5, sec: 45 } },
  { id: 'parfum', noms: ['Parfum', 'Perfume'], coins: 20, onglet: 'bonus', icone: '🧴', effetTexte: '×2 pendant 30 s', effet: { type: 'boost', mult: 2, sec: 30 } },
  { id: 'donut', noms: ['Donut', 'Doughnut', 'Beignet'], coins: 30, onglet: 'bonus', icone: '🍩', effetTexte: '×2 pendant 45 s', effet: { type: 'boost', mult: 2, sec: 45 } },
  { id: 'papillon', noms: ['Papillon', 'Butterfly'], coins: 88, onglet: 'bonus', icone: '🦋', effetTexte: 'bouclier 45 s', effet: { type: 'bouclier', sec: 45 } },
  { id: 'corgi', noms: ['Corgi'], coins: 299, onglet: 'bonus', icone: '🐕', effetTexte: 'bouclier 2 min', effet: { type: 'bouclier', sec: 120 } },
  // Attaques (sur le département juste devant au classement ; si tu es 1er, sur le 2e)
  { id: 'cote', noms: ['Côte à côte', 'Side by Side'], coins: 199, onglet: 'attaques', icone: '✈️', nomCarte: 'Côte à côte / Panda Climb', effetTexte: 'avion de chasse', effet: { type: 'chasseur', plafond: 0.5 } },
  { id: 'panda', noms: ['Panda Climb'], coins: 199, onglet: null, icone: '🐼', effetTexte: 'avion de chasse', effet: { type: 'chasseur', plafond: 0.5 } },
  { id: 'pistolet', noms: ['Pistolet à argent', 'Money Gun'], coins: 500, onglet: 'attaques', icone: '💸', effetTexte: '6 missiles', effet: { type: 'missiles', plafond: 0.6 } },
  { id: 'galaxie', noms: ['Galaxie', 'Galaxy'], coins: 1000, onglet: 'attaques', icone: '🌌', effetTexte: '4 hélicoptères', effet: { type: 'helicos', plafond: 0.1 } },
  { id: 'baleines', noms: ['Plongée avec les baleines', 'Whale Diving'], coins: 2150, onglet: 'attaques', icone: '🐋', effetTexte: 'tsunami', effet: { type: 'tsunami', plafond: 0.5 } },
  { id: 'leon', noms: ['Léon le chaton', 'Leon the Kitten'], coins: 4888, onglet: 'attaques', icone: '🦁', effetTexte: '3 bombes nucléaires', effet: { type: 'nucleaire', plafond: 0.8 } },
  { id: 'voiture', noms: ['Voiture de sport', 'Sports Car'], coins: 7000, onglet: 'attaques', icone: '🚢', nomCarte: 'Voiture de sport', effetTexte: 'porte-avions', effet: { type: 'porteavions', plafond: 0.35 } },
  // Cachés mais reconnus
  { id: 'tomate', noms: ['Tom la tomate', 'Tom the Tomato'], coins: 1, onglet: null, icone: '🍅', effetTexte: 'petite attaque sur le 1er', effet: { type: 'tomate', plafond: 0.5 } },
  { id: 'gants', noms: ['Gants de boxe', 'Boxing Gloves'], coins: 299, onglet: null, icone: '🥊', effetTexte: 'avion de chasse', effet: { type: 'chasseur', plafond: 0.5 } },
  { id: 'cygne', noms: ['Cygne', 'Swan'], coins: 699, onglet: null, icone: '🦢', effetTexte: 'missiles', effet: { type: 'missiles', plafond: 0.6 } },
  { id: 'coeur', noms: ['Envoie-moi un cœur', 'Send Me a Heart'], coins: 1, onglet: null, icone: '💌', effetTexte: '+20 soldats', effet: { type: 'fixe', soldats: 20 } },
];

export const ATTAQUES = new Set(['chasseur', 'missiles', 'helicos', 'tsunami', 'nucleaire', 'porteavions', 'tomate']);

// 32 couleurs vives et bien distinctes, mélangées à chaque lancement
export const PALETTE = [
  '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be', '#30b0ff', '#007aff', '#5856d6',
  '#af52de', '#ff2d55', '#c08552', '#64d2ff', '#ff6482', '#ffe14d', '#7ee04f', '#0a84ff',
  '#d17bff', '#ff8a3d', '#5ee0d6', '#e6007e', '#b6f400', '#00e5ff', '#ff5c38', '#9ccc65',
  '#1fbf9f', '#9b4dff', '#ff4fa0', '#ffb648', '#38b6ff', '#e0ec4a', '#a0705a', '#ff85b8',
];

export const CONTOURS = { or: '#d9a84e', bleu: '#3b82f6', vert: '#22c55e', rouge: '#ef4444', violet: '#a855f7' };
// couleurs proposées pour les soldats et pour les véhicules (tanks, avions, hélicoptères, navires)
export const UNITES = { bleu: '#2f6fe4', vert: '#1f9d4c', rouge: '#d63b3b', or: '#e8b931', violet: '#8b5cf6', noir: '#2b2b2e', blanc: '#ececec', camouflage: '#5b6b3a' };

// Mots interdits dans les pseudos (voix et affichage). Liste volontairement courte, à compléter.
export const MOTS_INTERDITS = ['connard', 'connasse', 'salope', 'pute', 'encule', 'enculé', 'nique', 'fdp', 'batard', 'bâtard', 'nazi', 'hitler', 'negro', 'pédé', 'pd', 'tapette', 'bougnoule', 'youpin', 'chienne', 'merde'];
