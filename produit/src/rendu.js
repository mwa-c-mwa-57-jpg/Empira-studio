// Rendu canvas de la carte, des unités et des effets (l'interface est en HTML par-dessus, voir hud.js).
// Tout est dessiné en code : soldats, parachutistes, tanks, avions, hélicoptères, missiles, bombes, tsunami.

import { DEPARTEMENTS, MAP_SIZE } from '../../public/src/france/departements.js';
import { dessinerLogo } from './logo.js';
import { REGLES } from './config.js';

export { dessinerLogo };

export const LARGEUR = 1080;
export const HAUTEUR = 1920;
// Zone de la carte : sous l'interface et AU-DESSUS des commentaires de TikTok (qui couvrent le bas de l'écran,
// à partir d'environ 65 % de la hauteur). Colonne de gauche : outre-mer ; colonne de droite : logo, roi, événements.
const ZONE = { haut: 592, bas: 1242 };
const ECHELLE = 0.665;
const X0 = 150;
const Y0 = 598;
const OUTREMER = { '971': 600, '972': 702, '973': 804, '974': 906, '976': 1008 };
const CASE = { x: 14, l: 128, h: 94 };
const IDF = { x: 150, y: 598, l: 180, h: 108, codes: ['75', '77', '78', '91', '92', '93', '94', '95'] };
const PARTICULES_MAX = 700;
// mers où mouille le porte-avions (coordonnées de la carte) : [x, y, cap de la proue en radians]
// le long des côtes atlantiques il navigue nord-sud, pour ne pas mordre sur les cases de l'outre-mer
const MERS = [[48, 450, -Math.PI / 2], [118, 700, -Math.PI / 2], [470, 50, 0], [690, 932, Math.PI], [830, 940, Math.PI]];
const REGLES_PA = { vagues: REGLES.porteAvionsVagues };
const POLICE = "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif";
const EMOJI = "'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
const NEUTRES = ['#2c2f45', '#2a3340', '#33303f', '#2d3a3a', '#38323a', '#2f3446'];
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const lim = (v) => Math.max(0, Math.min(1, v));
const sortieDouce = (t) => 1 - (1 - t) ** 3;

function chemin(rings) {
  const p = new Path2D();
  for (const r of rings) {
    p.moveTo(r[0], r[1]);
    for (let i = 2; i < r.length; i += 2) p.lineTo(r[i], r[i + 1]);
    p.closePath();
  }
  return p;
}

function boite(rings) {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const r of rings) {
    for (let i = 0; i < r.length; i += 2) {
      x1 = Math.min(x1, r[i]);
      x2 = Math.max(x2, r[i]);
      y1 = Math.min(y1, r[i + 1]);
      y2 = Math.max(y2, r[i + 1]);
    }
  }
  return { x1, y1, x2, y2 };
}

function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export class Rendu {
  constructor(canvas, partie, theme, { photos }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = LARGEUR;
    canvas.height = HAUTEUR;
    this.partie = partie;
    this.theme = theme;
    this.photos = photos;
    this.temps = 0;
    this.zoomActif = true;
    this.deps = DEPARTEMENTS.map((d, i) => ({ ...d, chemin: chemin(d.rings), boite: boite(d.rings), neutre: NEUTRES[i % NEUTRES.length] }));
    this.parCode = new Map(this.deps.map((d) => [d.code, d]));
    this.boiteIdf = IDF.codes.map((c) => this.parCode.get(c).boite).reduce((a, b) => ({ x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1), x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2) }));
    this.cam = { x: MAP_SIZE[0] / 2, y: MAP_SIZE[1] / 2, s: 1, cx: MAP_SIZE[0] / 2, cy: MAP_SIZE[1] / 2, cs: 1, jusqua: 0, repos: 0 };
    this.q = 1; // pixels réels par pixel de la scène 1080 × 1920 (voir adapter)
    this.cacheK = 2; // résolution du cache de la carte
    this.cache = document.createElement('canvas');
    this.cache.width = MAP_SIZE[0] * this.cacheK;
    this.cache.height = MAP_SIZE[1] * this.cacheK;
    this.cleCache = '';
    this.fond = this.#fond();
    this.vider();
  }

  /**
   * Netteté : le canevas est dessiné à la résolution réelle de l'affichage (taille de la source dans LIVE Studio ×
   * mise à l'échelle de Windows), au lieu d'une image fixe de 1080 × 1920 agrandie (floue à 125 % ou 150 %).
   */
  adapter(q) {
    // q n'est plus arrondi : un canevas de 605 px affiché sur 607 px était ré-étiré par le navigateur, donc flou
    const l = Math.max(Math.round(LARGEUR * 0.25), Math.min(LARGEUR * 3, Math.round(LARGEUR * q)));
    const nq = l / LARGEUR;
    if (nq === this.q && this.canvas.width === l) return;
    this.q = nq;
    this.canvas.width = l;
    this.canvas.height = Math.round(HAUTEUR * nq);
    // la carte peut être zoomée ×2 : son cache doit suivre la résolution
    const ck = Math.min(4, Math.max(2, Math.ceil(nq * 1.4)));
    if (ck !== this.cacheK) {
      this.cacheK = ck;
      this.cache.width = MAP_SIZE[0] * ck;
      this.cache.height = MAP_SIZE[1] * ck;
    }
    this.cleCache = '';
    this.fond = this.#fond();
  }

  vider() {
    this.bulles = [];
    this.paras = [];
    this.avions = [];
    this.missiles = [];
    this.helicos = [];
    this.tsunamis = [];
    this.bombes = [];
    this.bombardiers = []; // bombardier nucléaire, bombardier surprise
    this.caisses = []; // caisses de ravitaillement sous parachute
    this.porteAvions = [];
    this.crateres = []; // départements brûlés après une bombe nucléaire
    this.prochainSurvol = this.temps + 8 + Math.random() * 8;
    this.champignons = [];
    this.anneaux = [];
    this.particules = [];
    this.flottants = [];
    this.pilotes = new Map(); // tanks : équipe → photos des pilotes
    this.secousse = 0;
  }

  #fond() {
    const c = document.createElement('canvas');
    c.width = Math.round(LARGEUR * this.q);
    c.height = Math.round(HAUTEUR * this.q);
    const g = c.getContext('2d');
    g.scale(this.q, this.q);
    const grad = g.createLinearGradient(0, 0, 0, HAUTEUR);
    grad.addColorStop(0, '#0b0c14');
    grad.addColorStop(0.5, '#121522');
    grad.addColorStop(1, '#0a0b12');
    g.fillStyle = grad;
    g.fillRect(0, 0, LARGEUR, HAUTEUR);
    const halo = g.createRadialGradient(540, 920, 40, 540, 920, 560);
    halo.addColorStop(0, 'rgba(217,168,78,0.10)');
    halo.addColorStop(1, 'rgba(217,168,78,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, LARGEUR, HAUTEUR);
    g.strokeStyle = 'rgba(255,255,255,0.03)';
    g.lineWidth = 1;
    for (let x = 0; x < LARGEUR; x += 40) {
      g.beginPath();
      g.moveTo(x, ZONE.haut);
      g.lineTo(x, ZONE.bas);
      g.stroke();
    }
    for (let y = ZONE.haut; y < ZONE.bas; y += 40) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(LARGEUR, y);
      g.stroke();
    }
    return c;
  }

  // ------------------------------------------------------------------ coordonnées

  /** Position à l'écran du centre d'un département (les départements d'outre-mer sont dans leurs cases). */
  ecran(code) {
    const d = this.parCode.get(code);
    if (d.overseas) {
      const k = this.#kCase(d);
      return [CASE.x + (CASE.l - d.box[0] * k) / 2 + d.center[0] * k, OUTREMER[code] + 6 + d.center[1] * k];
    }
    return this.versEcran(d.center[0], d.center[1]);
  }

  #kCase(d) {
    return Math.min(CASE.l / d.box[0], (CASE.h - 22) / d.box[1]);
  }

  versEcran(mx, my) {
    const c = this.cam;
    const cx = X0 + (MAP_SIZE[0] * ECHELLE) / 2;
    const cy = Y0 + (MAP_SIZE[1] * ECHELLE) / 2;
    return [cx + (mx - c.x) * c.s * ECHELLE, cy + (my - c.y) * c.s * ECHELLE];
  }

  viser(code, echelle = 1.6, duree = 2.6) {
    const d = this.parCode.get(code);
    if (!this.zoomActif || !d || d.overseas || this.temps < this.cam.repos) return;
    Object.assign(this.cam, { cx: d.center[0], cy: d.center[1], cs: Math.max(1.25, Math.min(2, echelle)), jusqua: this.temps + duree, repos: this.temps + duree + 3 });
  }

  // ------------------------------------------------------------------ événements du moteur → animations

  surEvenements(evs) {
    const P = this.partie;
    for (const e of evs) {
      switch (e.type) {
        case 'debutPartie':
        case 'attente':
          this.vider();
          this.cleCache = '';
          break;
        case 'calme':
          this.parachuter(e.equipe, 1, false);
          this.anneau(e.equipe, this.theme.couleur(e.equipe), 90, 0.9);
          this.viser(e.equipe, 1.5, 2.2);
          break;
        case 'arrivee':
          this.bulle(e.joueur, e.equipe, 3, '');
          this.anneau(e.equipe, this.theme.couleur(e.equipe), 120, 0.9);
          if (e.annoncer) this.viser(e.equipe, 1.5, 2.2);
          break;
        case 'gain':
          if (e.sorte === 'like' && e.soldats <= 0) {
            this.bulle(e.joueur, e.equipe, 0, '', e.likes);
            break;
          }
          this.bulle(e.joueur, e.equipe, e.sorte === 'abonnement' ? 2 : 1, e.soldats > 0 ? `+${fmt(e.soldats)}` : '', e.likes);
          if (e.parachute) this.parachuter(e.equipe, 1, false);
          break;
        case 'cadeau': {
          this.bulle(e.joueur, e.equipe, 4 + Math.log10(e.pieces + 1), `+${fmt(e.soldats)}`);
          if (e.renfort === 'escouade') this.avionTransport(e.equipe, Math.min(3, e.nombre) * 6, false, e.joueur);
          else if (e.renfort === 'commandos') this.avionTransport(e.equipe, 10, true, e.joueur);
          else if (e.renfort === 'tank') {
            const l = this.pilotes.get(e.equipe) || [];
            for (let i = 0; i < Math.min(e.nombre, 3); i++) l.push(e.joueur);
            this.pilotes.set(e.equipe, l.slice(-3));
            this.eclat(e.equipe, '#9fd36b', 30, 220);
          } else if (e.renfort === 'boost') this.anneau(e.equipe, '#ffd23d', 160, 1.2);
          if (e.pieces >= 100) this.viser(e.equipe, 1.6, 2.6);
          break;
        }
        case 'bouclier':
          this.anneau(e.equipe, '#7ee7ff', 140, 1);
          break;
        case 'attaque':
          this.attaque(e);
          break;
        case 'tsunami':
          this.tsunamis.push({ y: e.y, t: 0, duree: 4.6 });
          this.secousse = Math.max(this.secousse, 0.4);
          break;
        case 'salve':
          this.salve(e);
          break;
        case 'impact': {
          if (e.bloque) {
            this.anneau(e.equipe, '#7ee7ff', 110, 0.7);
            this.flottant(e.equipe, '🛡', '#7ee7ff', 40);
            break;
          }
          const fort = e.sorte === 'nucleaire' || e.sorte === 'tsunami';
          // la bombe nucléaire et le bombardement surprise ont leur propre explosion (à l'arrivée des bombes)
          if (e.sorte !== 'souffle' && e.sorte !== 'nucleaire' && e.sorte !== 'bombardement') this.explosion(e.equipe, fort ? 2.2 : e.sorte === 'helicos' ? 0.6 : 1.1);
          if (e.sorte === 'souffle') this.anneau(e.equipe, 'rgba(140,255,120,0.9)', 90, 1.2);
          if (e.detruit >= 1) this.flottant(e.equipe, `${e.sorte === 'nucleaire' ? '☢ ' : ''}−${fmt(e.detruit)}`, e.sorte === 'souffle' ? '#9dff8a' : '#ff6b5b', e.sorte === 'nucleaire' ? 56 : fort ? 46 : 34);
          if (e.sorte === 'nucleaire' && e.detruit >= 1 && e.detruit / (e.detruit + (e.reste ?? 0)) >= 0.6) {
            const [x, y] = this.ecran(e.equipe);
            this.flottants.push({ x, y: y - 90, texte: 'RASÉ !', couleur: '#ffd23d', taille: 48, t: 0, duree: 2.2 });
          }
          if (e.butin >= 1 && e.attaquant) this.flottant(e.attaquant, `butin +${fmt(e.butin)}`, '#ffd166', 26);
          break;
        }
        case 'occupation':
        case 'liberation':
          this.anneau(e.equipe, e.type === 'occupation' ? this.theme.couleur(e.occupant) : '#ffffff', 160, 1.1);
          this.cleCache = '';
          break;
        case 'largage':
          this.avionTransport(e.equipe, 8, false, null);
          break;
        case 'ambiance':
          if (e.sorte === 'ravitaillement') this.ravitaillement(e.equipe);
          else if (e.sorte === 'bombardement') this.bombardier(e.equipe, false);
          else this.survol(true);
          break;
        case 'ravitaille':
          this.eclat(e.equipe, '#ffd23d', 26, 200);
          this.anneau(e.equipe, '#ffd23d', 110, 0.9);
          this.flottant(e.equipe, `📦 +${fmt(e.soldats)}`, '#ffd23d', 34);
          break;
        case 'vagueAerienne':
          this.decollage(e);
          break;
        case 'vagueDebut':
          if (e.vague.parachute) this.assaut = e.vague.fin;
          if (e.vague.sirene) this.secousse = Math.max(this.secousse, 0.3);
          break;
        case 'vagueFin':
          this.assaut = 0;
          break;
        default:
          break;
      }
    }
    void P;
  }

  // ------------------------------------------------------------------ fabriques d'effets

  bulle(joueur, equipe, poids, texte, likes = 0) {
    if (!joueur) return;
    // likes regroupés : une seule bulle « ×12 » par joueur
    const existante = this.bulles.find((b) => b.joueur.id === joueur.id && b.equipe === equipe && b.t < 1.2);
    if (existante) {
      existante.likes += likes;
      if (texte) existante.texte = texte;
      existante.poids = Math.max(existante.poids, poids);
      return;
    }
    if (this.bulles.length >= 5) {
      // 5 bulles au plus : les grosses en priorité
      const plusPetite = this.bulles.reduce((a, b) => (a.poids <= b.poids ? a : b));
      if (plusPetite.poids >= poids) return;
      this.bulles.splice(this.bulles.indexOf(plusPetite), 1);
    }
    this.bulles.push({ joueur, equipe, poids, texte, likes, t: 0, duree: 2.2 });
  }

  anneau(equipe, couleur, max, duree) {
    const [x, y] = this.ecran(equipe);
    this.anneaux.push({ x, y, equipe, r: 8, max, couleur, t: 0, duree });
  }

  flottant(equipe, texte, couleur, taille) {
    const [x, y] = this.ecran(equipe);
    this.flottants.push({ x, y: y - 26, texte, couleur, taille, t: 0, duree: 1.7 });
  }

  eclat(equipe, couleur, n, vitesse, x0, y0) {
    let [x, y] = equipe ? this.ecran(equipe) : [x0, y0];
    if (x0 !== undefined) [x, y] = [x0, y0];
    for (let i = 0; i < n && this.particules.length < PARTICULES_MAX; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = vitesse * (0.25 + Math.random() * 0.75);
      this.particules.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, duree: 0.5 + Math.random() * 0.6, couleur, taille: 3 + Math.random() * 4, g: 0 });
    }
  }

  explosion(equipe, force = 1) {
    const [x, y] = this.ecran(equipe);
    this.explosionEn(x, y, force);
  }

  explosionEn(x, y, force = 1) {
    this.anneaux.push({ x, y, r: 6, max: 70 * force, couleur: '#ffd28a', t: 0, duree: 0.5 + 0.2 * force });
    this.eclat(null, '#ffb347', Math.round(14 * force), 240 * force, x, y);
    this.eclat(null, '#ff5c38', Math.round(8 * force), 160 * force, x, y);
    for (let i = 0; i < 6 * force && this.particules.length < PARTICULES_MAX; i++) {
      this.particules.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 12, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, t: 0, duree: 1.4 + Math.random(), couleur: 'rgba(90,90,100,0.55)', taille: 10 + Math.random() * 12 * force, g: 0, fumee: true });
    }
    this.secousse = Math.max(this.secousse, 0.15 * force);
  }

  parachuter(equipe, n, dore) {
    const [x, y] = this.ecran(equipe);
    for (let i = 0; i < n; i++) this.paras.push({ equipe, x: x + (Math.random() - 0.5) * 60, y0: y - 240 - Math.random() * 80, y, t: -i * 0.18, duree: 1.8, dore, couleur: this.theme.couleurSoldats(equipe) });
  }

  avionTransport(equipe, n, dore, pilote) {
    const [x, y] = this.ecran(equipe);
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.avions.push({ sorte: 'transport', x0: x - dir * 700, y0: y - 230, x1: x + dir * 700, y1: y - 250, t: 0, duree: 3.2, equipe, n, dore, largue: false, pilote, couleur: this.theme.couleurVehicules(equipe) });
  }

  attaque(e) {
    const de = e.de;
    const cibles = e.vers;
    if (e.sorte === 'chasseur' || e.sorte === 'tomate') {
      const [x0, y0] = this.ecran(de);
      const [x1, y1] = this.ecran(cibles[0]);
      if (e.sorte === 'tomate') this.missiles.push({ x0, y0, x1, y1, t: 0, duree: 1.4, haut: 160, tomate: true });
      else this.avions.push({ sorte: 'chasseur', x0, y0, x1, y1, t: 0, duree: 1.4, pilote: e.joueur, couleur: this.theme.couleurVehicules(de) });
      this.viser(cibles[0], 1.4, 2);
    } else if (e.sorte === 'missiles') {
      const [x0, y0] = this.ecran(de);
      const [x1, y1] = this.ecran(cibles[0]);
      for (let i = 0; i < 6; i++) this.missiles.push({ x0: x0 + (i - 2.5) * 6, y0, x1: x1 + (i - 2.5) * 10, y1: y1 + (i % 2) * 8, t: -i * 0.08, duree: 1.6, haut: 220 + i * 18 });
      this.viser(cibles[0], 1.5, 2.6);
    } else if (e.sorte === 'helicos') {
      this.helicos.push({ de, vers: cibles[0], t: 0, pilote: e.joueur, couleur: this.theme.couleurVehicules(de), tir: 0 });
      this.viser(cibles[0], 1.6, 2.6);
    } else if (e.sorte === 'nucleaire') {
      // un bombardier stratégique traverse la carte et largue une bombe sur chaque cible ;
      // les cibles sont marquées (☢ et compte à rebours) jusqu'à l'impact, 2,6 s après l'envoi
      this.bombardier(cibles, true, de);
      this.secousse = Math.max(this.secousse, 0.2);
    } else if (e.sorte === 'porteavions') {
      const cible = this.parCode.get(cibles[0]);
      const [mx, my] = cible.overseas ? [100, 600] : cible.center;
      const mer = MERS.reduce((a, b) => (Math.hypot(b[0] - mx, b[1] - my) < Math.hypot(a[0] - mx, a[1] - my) ? b : a));
      this.porteAvions.push({ mx: mer[0], my: mer[1], cap: mer[2], de, vers: cibles[0], t: 0, duree: 4 + REGLES_PA.vagues * 1.5 + 3, couleur: this.theme.couleurVehicules(de), pilote: e.joueur });
    }
  }

  /** Bombardier : nucléaire (une grosse bombe par cible) ou surprise (3 petites bombes sur le leader). */
  bombardier(cibles, nucleaire, de = null) {
    const liste = Array.isArray(cibles) ? cibles : [cibles];
    const pts = liste.map((c) => this.ecran(c));
    const y = Math.max(ZONE.haut + 36, Math.min(...pts.map((p) => p[1])) - (nucleaire ? 190 : 150));
    const dir = Math.random() < 0.5 ? 1 : -1;
    const x0 = dir > 0 ? -220 : LARGEUR + 220;
    const x1 = dir > 0 ? LARGEUR + 220 : -220;
    const duree = nucleaire ? 2.2 : 2.6;
    this.bombardiers.push({ x0, x1, y, t: 0, duree, couleur: de ? this.theme.couleurVehicules(de) : '#59626e', taille: nucleaire ? 1.5 : 1.1 });
    for (const [i, c] of liste.entries()) {
      const [cx] = pts[i];
      // la bombe quitte la soute quand le bombardier passe au-dessus de sa cible
      const largage = lim((cx - x0) / (x1 - x0)) * duree;
      // la bombe tombe d'au moins 130 px (au besoin depuis derrière les fenêtres du haut)
      const y0 = Math.min(y + 20, pts[i][1] - 130);
      if (nucleaire) this.bombes.push({ equipe: c, t: 0, largage: Math.min(largage, 1.4), duree: 2.6, nucleaire: true, y0 });
      else for (let k = 0; k < 3; k++) this.bombes.push({ equipe: c, t: 0, largage: largage + k * 0.12, duree: largage + 1.0 + k * 0.12, y0, dx: (k - 1) * 22 });
    }
  }

  ravitaillement(equipe) {
    const [x, y] = this.ecran(equipe);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const yv = Math.max(ZONE.haut + 30, y - 190);
    // l'avion cargo passe au-dessus du département à ~0,6 s ; la caisse se pose à ~2,4 s (comme le moteur)
    this.avions.push({ sorte: 'cargo', x0: x - dir * 520, y0: yv, x1: x + dir * 900, y1: yv - 20, t: 0, duree: 2.2, couleur: this.theme.couleurVehicules(equipe) });
    this.caisses.push({ equipe, x, y0: Math.min(yv + 18, y - 120), y, t: -0.6, duree: 1.8 });
  }

  /** Avions qui passent : patrouille (événement « survol ») ou décor aléatoire. */
  survol(patrouille = false) {
    const equipes = [...this.partie.equipes.keys()];
    const couleur = equipes.length && Math.random() < 0.7 ? this.theme.couleurVehicules(equipes[Math.floor(Math.random() * equipes.length)]) : '#8a94a0';
    const dir = Math.random() < 0.5 ? 1 : -1;
    const y = ZONE.haut + 40 + Math.random() * (ZONE.bas - ZONE.haut - 120);
    const pente = (Math.random() - 0.5) * 260;
    const x0 = dir > 0 ? -160 : LARGEUR + 160;
    const x1 = dir > 0 ? LARGEUR + 160 : -160;
    const r = Math.random();
    if (patrouille || r < 0.5) {
      const n = patrouille ? 3 : 2;
      for (let i = 0; i < n; i++) this.avions.push({ sorte: 'survol', x0: x0 - dir * i * 46, y0: y + i * 28, x1: x1 - dir * i * 46, y1: y + pente + i * 28, t: -i * 0.05, duree: 3.2, couleur, trainee: true });
    } else if (r < 0.8) this.avions.push({ sorte: 'cargo', x0, y0: y, x1, y1: y + pente * 0.4, t: 0, duree: 6.5, couleur });
    else this.avions.push({ sorte: 'helico', x0, y0: y, x1, y1: y + pente * 0.3, t: 0, duree: 8, couleur });
  }

  /** Vague d'avions du porte-avions : 3 chasseurs décollent vers la cible. */
  decollage(e) {
    const pa = this.porteAvions.find((p) => p.de === e.de && p.vers === e.vers);
    const [x1, y1] = this.ecran(e.vers);
    const [x0, y0] = pa ? this.versEcran(pa.mx, pa.my) : [x1 - 300, y1];
    for (let i = 0; i < 3; i++) this.avions.push({ sorte: 'chasseur', x0: x0 + (i - 1) * 14, y0: y0 - 6, x1: x1 + (i - 1) * 26, y1: y1 + (i % 2) * 10, t: -i * 0.18, duree: 1.3, couleur: pa?.couleur || '#9aa3ad', pilote: i === 0 ? pa?.pilote : null });
  }

  salve(e) {
    for (const h of this.helicos) if (h.de === e.de && h.vers === e.vers) h.tir = 0.6;
  }

  // ------------------------------------------------------------------ boucle

  #avancer(dt) {
    this.temps += dt;
    this.secousse = Math.max(0, this.secousse - dt);
    const c = this.cam;
    if (this.temps > c.jusqua) Object.assign(c, { cx: MAP_SIZE[0] / 2, cy: MAP_SIZE[1] / 2, cs: 1 });
    const k = 1 - Math.exp(-dt * 3.2);
    c.x += (c.cx - c.x) * k;
    c.y += (c.cy - c.y) * k;
    c.s += (c.cs - c.s) * k;
    const vivant = (o) => (o.t += dt) < o.duree;
    for (const p of this.particules) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= p.fumee ? 0.98 : 0.92;
      p.vy = p.vy * (p.fumee ? 0.98 : 0.92) + p.g * dt;
    }
    this.particules = this.particules.filter(vivant);
    this.anneaux = this.anneaux.filter(vivant);
    this.flottants = this.flottants.filter(vivant);
    this.bulles = this.bulles.filter(vivant);
    this.tsunamis = this.tsunamis.filter(vivant);
    this.champignons = this.champignons.filter(vivant);
    this.paras = this.paras.filter((p) => {
      p.t += dt;
      if (p.t >= p.duree) {
        this.eclat(p.equipe, p.dore ? '#ffd23d' : p.couleur, 3, 60);
        return false;
      }
      return true;
    });
    this.avions = this.avions.filter((a) => {
      a.t += dt;
      if (a.t < 0) return true;
      if (a.sorte === 'transport' && !a.largue && a.t / a.duree > 0.42) {
        a.largue = true;
        this.parachuter(a.equipe, a.n, a.dore);
      }
      return a.t < a.duree;
    });
    this.missiles = this.missiles.filter((m) => {
      m.t += dt;
      if (m.t >= m.duree) {
        if (m.tomate) this.eclat(null, '#e8382b', 18, 160, m.x1, m.y1);
        else this.explosionEn(m.x1, m.y1, 0.8);
        return false;
      }
      return true;
    });
    this.bombes = this.bombes.filter((b) => {
      b.t += dt;
      if (b.t < b.duree) return true;
      const [cx, cy] = this.ecran(b.equipe);
      const x = cx + (b.dx || 0);
      const y = cy + (b.dx ? (Math.random() - 0.5) * 16 : 0);
      if (!b.nucleaire) {
        this.explosionEn(x, y, 1.1);
        return false;
      }
      // explosion nucléaire : éclair, onde de choc, boule de feu, champignon, cratère, retombées
      this.champignons.push({ x, y, t: 0, duree: 4.6 });
      this.anneaux.push({ x, y, r: 10, max: 420, couleur: '#ffffff', t: 0, duree: 1.1 });
      this.anneaux.push({ x, y, r: 10, max: 300, couleur: '#ffb347', t: 0, duree: 1.4 });
      this.anneaux.push({ x, y, r: 10, max: 190, couleur: '#ff5c38', t: 0, duree: 1.7 });
      this.eclat(null, '#ffe08a', 50, 520, x, y);
      this.eclat(null, '#ff6a2b', 40, 380, x, y);
      for (let i = 0; i < 46 && this.particules.length < PARTICULES_MAX; i++) {
        this.particules.push({ x: x + (Math.random() - 0.5) * 140, y: y - Math.random() * 190, vx: (Math.random() - 0.5) * 24, vy: 10 + Math.random() * 22, t: 0, duree: 2.8 + Math.random() * 1.6, couleur: 'rgba(170,170,170,0.7)', taille: 2 + Math.random() * 2, g: 4 });
      }
      this.crateres.push({ equipe: b.equipe, t: 0, duree: 9 });
      this.secousse = 1.1;
      this.flash = 0.75;
      return false;
    });
    this.bombardiers = this.bombardiers.filter((a) => (a.t += dt) < a.duree);
    this.caisses = this.caisses.filter((c) => {
      c.t += dt;
      if (c.t < c.duree) return true;
      const [x, y] = this.ecran(c.equipe);
      this.eclat(null, '#c8a165', 14, 120, x, y);
      return false;
    });
    this.porteAvions = this.porteAvions.filter((p) => {
      p.t += dt;
      if (Math.random() < dt * 14 && this.particules.length < PARTICULES_MAX) {
        const [x, y] = this.versEcran(p.mx, p.my);
        const [cx, cy] = [Math.cos(p.cap), Math.sin(p.cap)];
        const l = 80 * Math.sqrt(this.cam.s);
        this.particules.push({ x: x - cx * l, y: y - cy * l, vx: -cx * (30 + Math.random() * 30), vy: -cy * (30 + Math.random() * 30), t: 0, duree: 1.4, couleur: 'rgba(220,240,255,0.55)', taille: 3 + Math.random() * 3, g: 0 });
      }
      return p.t < p.duree;
    });
    this.crateres = this.crateres.filter((c) => (c.t += dt) < c.duree);
    // avions qui passent au hasard pendant la partie (décor)
    if (this.partie.phase === 'partie' && this.temps >= this.prochainSurvol) {
      this.prochainSurvol = this.temps + 12 + Math.random() * 14;
      this.survol(false);
    }
    for (const h of this.helicos) {
      h.t += dt;
      h.tir = Math.max(0, h.tir - dt);
    }
    // pendant les vagues « parachutistes », des renforts tombent un peu partout
    if (this.assaut && this.partie.t < this.assaut && Math.random() < dt * 2.5) {
      const eq = [...this.partie.equipes.keys()];
      if (eq.length) this.parachuter(eq[Math.floor(Math.random() * eq.length)], 1, false);
    }
    this.flash = Math.max(0, (this.flash || 0) - dt);
  }

  dessiner(dt) {
    this.#avancer(dt);
    const { ctx } = this;
    ctx.setTransform(this.q, 0, 0, this.q, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.fond, 0, 0, LARGEUR, HAUTEUR);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, ZONE.haut, LARGEUR, ZONE.bas - ZONE.haut);
    ctx.clip();
    const sx = (Math.random() - 0.5) * this.secousse * 18;
    const sy = (Math.random() - 0.5) * this.secousse * 18;
    if (this.secousse > 0) ctx.translate(sx, sy);
    // couche du sol : carte, cratères, navires, troupes
    this.#carte();
    this.#crateres();
    this.#cases();
    this.#tsunamis();
    for (const pa of this.porteAvions) this.#porteAvion(pa);
    this.#sol();
    this.#etiquettes(); // les numéros et le top 3 restent lisibles par-dessus les unités
    ctx.restore();
    // couche du ciel : les avions et les bombes arrivent d'au-dessus de la carte (derrière les fenêtres du haut)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 232, LARGEUR, ZONE.bas - 232);
    ctx.clip();
    if (this.secousse > 0) ctx.translate(sx, sy);
    this.#air();
    this.#effets();
    ctx.restore();
    this.#logo(1060, 604, 'droite');
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,250,235,${this.flash})`;
      ctx.fillRect(0, ZONE.haut, LARGEUR, ZONE.bas - ZONE.haut);
    }
  }

  // ------------------------------------------------------------------ carte

  #remplir(g, d, echelle, live) {
    const P = this.partie;
    const e = P.equipes.get(d.code);
    if (!e) {
      g.fillStyle = d.neutre;
      g.fill(d.chemin);
    } else {
      const couleur = this.theme.couleur(d.code);
      g.fillStyle = couleur;
      g.fill(d.chemin);
      // la photo du meilleur joueur, découpée dans la forme du département
      const heros = P.meilleurJoueur(e);
      const img = heros && this.photos.image(heros);
      if (img) {
        const b = d.boite;
        const cote = Math.max(b.x2 - b.x1, b.y2 - b.y1);
        g.save();
        g.clip(d.chemin);
        g.globalAlpha = 0.85;
        g.drawImage(img, (b.x1 + b.x2) / 2 - cote / 2, (b.y1 + b.y2) / 2 - cote / 2, cote, cote);
        g.globalAlpha = 0.28;
        g.fillStyle = couleur;
        g.fill(d.chemin);
        g.restore();
      }
      if (e.occupant) {
        // rayures d'occupation aux couleurs de l'occupant
        g.save();
        g.clip(d.chemin);
        g.strokeStyle = alpha(this.theme.couleur(e.occupant), 0.85);
        g.lineWidth = 5 / echelle;
        const b = d.boite;
        for (let x = b.x1 - (b.y2 - b.y1); x < b.x2; x += 12 / echelle) {
          g.beginPath();
          g.moveTo(x, b.y2);
          g.lineTo(x + (b.y2 - b.y1), b.y1);
          g.stroke();
        }
        g.restore();
      }
    }
    g.lineWidth = 1.2 / echelle;
    g.strokeStyle = 'rgba(4,5,12,0.9)';
    g.stroke(d.chemin);
    if (e) {
      g.lineWidth = 3 / echelle;
      g.strokeStyle = this.theme.couleur(d.code);
      g.stroke(d.chemin);
    }
    if (live && e && P.protege(e)) {
      g.lineWidth = 4 / echelle;
      g.strokeStyle = `rgba(126,231,255,${0.55 + 0.45 * Math.sin(this.temps * 7)})`;
      g.stroke(d.chemin);
    }
  }

  #cle() {
    const P = this.partie;
    let k = '';
    for (const e of P.equipes.values()) {
      const h = P.meilleurJoueur(e);
      k += `${e.code}:${this.theme.couleur(e.code)}:${e.occupant || ''}:${h ? h.id : ''}:${h && this.photos.image(h) ? 1 : 0}|`;
    }
    return k;
  }

  #carte() {
    const cle = this.#cle();
    if (cle !== this.cleCache) {
      this.cleCache = cle;
      const g = this.cache.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, this.cache.width, this.cache.height);
      g.setTransform(this.cacheK, 0, 0, this.cacheK, 0, 0);
      g.imageSmoothingQuality = 'high';
      g.shadowColor = 'rgba(217,168,78,0.25)';
      g.shadowBlur = 24;
      g.fillStyle = '#1b1e2c';
      for (const d of this.deps) if (!d.overseas) g.fill(d.chemin);
      g.shadowBlur = 0;
      for (const d of this.deps) if (!d.overseas) this.#remplir(g, d, 1.6, false);
    }
    const { ctx } = this;
    const [ox, oy] = this.versEcran(0, 0);
    const s = this.cam.s * ECHELLE;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    ctx.drawImage(this.cache, 0, 0, MAP_SIZE[0], MAP_SIZE[1]);
    // boucliers animés par-dessus le cache
    for (const e of this.partie.equipes.values()) {
      const d = this.parCode.get(e.code);
      if (d.overseas || !this.partie.protege(e)) continue;
      ctx.lineWidth = 4 / s;
      ctx.strokeStyle = `rgba(126,231,255,${0.55 + 0.45 * Math.sin(this.temps * 7)})`;
      ctx.stroke(d.chemin);
    }
    ctx.restore();
  }

  #cases() {
    const { ctx } = this;
    const zoom = this.cam.s;
    const a = lim((1.3 - zoom) / 0.3);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    for (const [code, y] of Object.entries(OUTREMER)) {
      const d = this.parCode.get(code);
      this.#panneau(CASE.x - 4, y - 4, CASE.l + 8, CASE.h + 8);
      const k = this.#kCase(d);
      ctx.save();
      ctx.translate(CASE.x + (CASE.l - d.box[0] * k) / 2, y + 6);
      ctx.scale(k, k);
      this.#remplir(ctx, d, k, true);
      ctx.restore();
      this.#texte(`${code} ${d.name}`, CASE.x + CASE.l / 2, y + CASE.h - 6, { taille: 13, poids: 700, align: 'center', couleur: 'rgba(255,255,255,0.7)', max: CASE.l });
    }
    // loupe sur l'Île-de-France
    this.#panneau(IDF.x, IDF.y, IDF.l, IDF.h);
    this.#texte('Île-de-France', IDF.x + 10, IDF.y + 15, { taille: 13, poids: 800, couleur: 'rgba(255,255,255,0.7)' });
    const b = this.boiteIdf;
    const k = Math.min((IDF.l - 16) / (b.x2 - b.x1), (IDF.h - 30) / (b.y2 - b.y1));
    const ox = IDF.x + (IDF.l - (b.x2 - b.x1) * k) / 2 - b.x1 * k;
    const oy = IDF.y + 24 + (IDF.h - 30 - (b.y2 - b.y1) * k) / 2 - b.y1 * k;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    for (const c of IDF.codes) this.#remplir(ctx, this.parCode.get(c), k, true);
    ctx.restore();
    for (const c of IDF.codes) {
      const d = this.parCode.get(c);
      this.#texte(c, ox + d.center[0] * k, oy + d.center[1] * k, { taille: c === '75' ? 11 : 14, poids: 800, align: 'center', contour: 'rgba(0,0,0,0.65)' });
    }
    ctx.globalAlpha = 1;
  }

  #etiquettes() {
    const P = this.partie;
    const z = Math.sqrt(this.cam.s);
    const cl = P.classement();
    const top = new Set(cl.slice(0, 3).map((e) => e.code));
    for (const d of this.deps) {
      if (d.overseas) continue;
      const e = P.equipes.get(d.code);
      if (top.has(d.code)) continue;
      if (['75', '92', '93', '94'].includes(d.code) && this.cam.s < 1.6) continue;
      const [x, y] = this.ecran(d.code);
      if (y < ZONE.haut || y > ZONE.bas) continue;
      this.#texte(d.code, x, y, { taille: (e ? 21 : 15) * z, poids: 800, align: 'center', couleur: e ? '#fff' : 'rgba(255,255,255,0.45)', contour: e ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.35)', epaisseur: e ? 5 : 3 });
    }
    // le top 3 en grand, avec nom et pourcentage
    cl.slice(0, 3).forEach((e, i) => {
      const d = this.parCode.get(e.code);
      const [x, y] = this.ecran(e.code);
      if (y < ZONE.haut - 20 || y > ZONE.bas + 20) return;
      const s = (i === 0 ? 1.3 : 1.1) * z * (d.overseas ? 0.65 : 1);
      const couleur = this.theme.couleur(e.code);
      if (i === 0) this.#couronne(x, y - 34 * s, 16 * s);
      this.#texte(e.code, x, y, { taille: 36 * s, poids: 900, align: 'center', contour: couleur, epaisseur: 7 * s });
      if (!d.overseas) {
        this.#texte(e.nom, x, y + 29 * s, { taille: 17 * s, poids: 900, align: 'center', contour: 'rgba(0,0,0,0.9)', epaisseur: 5 });
        this.#texte(`${(P.part(e) * 100).toFixed(1).replace('.', ',')} %`, x, y + 49 * s, { taille: 16 * s, poids: 900, align: 'center', couleur: '#ffd166', contour: 'rgba(0,0,0,0.9)', epaisseur: 5 });
      }
    });
  }

  #tsunamis() {
    const { ctx } = this;
    for (const w of this.tsunamis) {
      const k = w.t / w.duree;
      const [, y] = this.versEcran(0, w.y);
      const xa = X0 - 120 + k * (MAP_SIZE[0] * ECHELLE * this.cam.s + 260);
      const h = 120;
      const grad = ctx.createLinearGradient(xa - 260, 0, xa, 0);
      grad.addColorStop(0, 'rgba(30,120,220,0)');
      grad.addColorStop(0.7, 'rgba(40,150,240,0.55)');
      grad.addColorStop(1, 'rgba(200,240,255,0.9)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(xa - 260, y - h / 2);
      for (let i = 0; i <= 12; i++) {
        const yy = y - h / 2 + (h * i) / 12;
        ctx.lineTo(xa + Math.sin(this.temps * 9 + i) * 12, yy);
      }
      ctx.lineTo(xa - 260, y + h / 2);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 3 && this.particules.length < PARTICULES_MAX; i++) {
        this.particules.push({ x: xa, y: y + (Math.random() - 0.5) * h, vx: 60 + Math.random() * 80, vy: (Math.random() - 0.5) * 60, t: 0, duree: 0.6, couleur: 'rgba(230,248,255,0.9)', taille: 3 + Math.random() * 3, g: 0 });
      }
    }
  }

  // ------------------------------------------------------------------ unités

  #soldat(x, y, couleur, echelle, phase, dore = false) {
    const { ctx } = this;
    const pas = Math.sin(this.temps * 9 + phase);
    const s = 7 * echelle;
    ctx.save();
    ctx.translate(x, y - Math.abs(pas) * s * 0.15);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = s * 0.32;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, s * 0.4);
    ctx.lineTo(-s * 0.2 + pas * s * 0.3, s);
    ctx.moveTo(s * 0.2, s * 0.4);
    ctx.lineTo(s * 0.2 - pas * s * 0.3, s);
    ctx.stroke();
    ctx.fillStyle = dore ? '#e8b931' : couleur;
    ctx.fillRect(-s * 0.42, -s * 0.3, s * 0.84, s * 0.8);
    ctx.fillStyle = '#f2d4b3';
    ctx.beginPath();
    ctx.arc(0, -s * 0.55, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dore ? '#b8860b' : '#2c3a24';
    ctx.beginPath();
    ctx.arc(0, -s * 0.62, s * 0.33, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.5);
    ctx.lineTo(s * 0.5, -s * 1.1);
    ctx.stroke();
    ctx.restore();
  }

  #tank(x, y, couleur, pilote, echelle) {
    const { ctx } = this;
    const s = 16 * echelle;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.55, s * 1.2, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2d22';
    ctx.beginPath();
    ctx.roundRect(-s * 1.1, s * 0.05, s * 2.2, s * 0.5, s * 0.25);
    ctx.fill();
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.roundRect(-s, -s * 0.35, s * 2, s * 0.5, s * 0.12);
    ctx.fill();
    ctx.fillStyle = alpha('#000000', 0.25);
    ctx.fillRect(-s, -s * 0.12, s * 2, s * 0.08);
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.arc(0, -s * 0.38, s * 0.42, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(s * 0.3, -s * 0.5);
    ctx.lineTo(s * 1.4, -s * 0.62);
    ctx.stroke();
    ctx.restore();
    if (pilote) this.#photo(pilote, x - s * 0.05, y - s * 0.95, s * 0.42, couleur);
  }

  /** Avions : chasseur (attaque), transport (parachutistes), cargo (ravitaillement), survol (décor), hélicoptère de passage. */
  #avion(a) {
    const k = lim(a.t / a.duree);
    const chasseur = a.sorte === 'chasseur';
    const kk = chasseur ? sortieDouce(k) : k;
    const x = a.x0 + (a.x1 - a.x0) * kk;
    const y = a.y0 + (a.y1 - a.y0) * kk - (chasseur ? Math.sin(k * Math.PI) * 120 : 0);
    const dir = a.x1 >= a.x0 ? 1 : -1;
    if (a.sorte === 'helico') {
      this.#helico(x, y, dir, a.couleur, 1.1, null);
      return;
    }
    if (chasseur || a.sorte === 'survol') {
      const angle = chasseur ? Math.atan2(a.y1 - a.y0, a.x1 - a.x0) : Math.atan2(a.y1 - a.y0, a.x1 - a.x0);
      this.#jet(x, y, angle, chasseur ? 22 : 18, a.couleur);
      if (this.particules.length < PARTICULES_MAX) this.particules.push({ x: x - Math.cos(angle) * 18, y: y - Math.sin(angle) * 18, vx: 0, vy: 0, t: 0, duree: a.trainee ? 1.1 : 0.5, couleur: 'rgba(225,228,235,0.45)', taille: a.trainee ? 4 : 5, g: 0 });
    } else this.#transport(x, y, dir, a.sorte === 'cargo' ? 34 : 30, a.couleur);
    if (a.pilote) this.#photo(a.pilote, x, y - 30, 12, a.couleur);
    if (chasseur && k > 0.85 && !a.tire) {
      a.tire = true;
      this.missiles.push({ x0: x, y0: y, x1: a.x1, y1: a.y1, t: 0, duree: 0.25, haut: 0 });
    }
  }

  /** Avion de chasse vu de dessus (ailes delta, dérive, verrière), orienté selon l'angle. */
  #jet(x, y, angle, s, couleur) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.2, s * 2.2, s * 1.2, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, 0);
    ctx.lineTo(-s * 0.55, -s * 1.05);
    ctx.lineTo(-s * 0.85, -s * 1.05);
    ctx.lineTo(-s * 0.6, 0);
    ctx.lineTo(-s * 0.85, s * 1.05);
    ctx.lineTo(-s * 0.55, s * 1.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9aa3ad';
    ctx.beginPath();
    ctx.moveTo(s * 1.5, 0);
    ctx.lineTo(s * 0.6, -s * 0.2);
    ctx.lineTo(-s * 1.1, -s * 0.16);
    ctx.lineTo(-s * 1.1, s * 0.16);
    ctx.lineTo(s * 0.6, s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.moveTo(-s * 0.8, 0);
    ctx.lineTo(-s * 1.2, -s * 0.42);
    ctx.lineTo(-s * 1.2, s * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(160,215,255,0.9)';
    ctx.beginPath();
    ctx.ellipse(s * 0.75, 0, s * 0.28, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,170,80,0.85)';
    ctx.beginPath();
    ctx.arc(-s * 1.18, 0, s * 0.12 + Math.random() * s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Avion de transport ou cargo (ailes droites, quatre hélices). */
  #transport(x, y, dir, s, couleur) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, s * 2, s * 1.4, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6c7a5a';
    ctx.fillRect(-s * 0.35, -s * 1.35, s * 0.42, s * 2.7);
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.roundRect(-s * 1.3, -s * 0.24, s * 2.7, s * 0.48, s * 0.24);
    ctx.fill();
    ctx.fillStyle = '#6c7a5a';
    ctx.beginPath();
    ctx.moveTo(-s * 1.1, 0);
    ctx.lineTo(-s * 1.4, -s * 0.55);
    ctx.lineTo(-s * 1.55, -s * 0.55);
    ctx.lineTo(-s * 1.4, 0);
    ctx.lineTo(-s * 1.55, s * 0.55);
    ctx.lineTo(-s * 1.4, s * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,30,30,0.6)';
    ctx.lineWidth = 2;
    const r = this.temps * 50;
    for (const e of [-1, -0.5, 0.5, 1]) {
      const hx = s * 0.12;
      const hy = e * s * 1.05;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(r) * 2, hy - s * 0.2);
      ctx.lineTo(hx - Math.cos(r) * 2, hy + s * 0.2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(170,220,255,0.85)';
    ctx.fillRect(s * 1.1, -s * 0.12, s * 0.2, s * 0.24);
    ctx.restore();
  }

  /** Hélicoptère de combat (vu de profil) : fuselage, rotor, rotor de queue, patins, paniers de roquettes. */
  #helico(x, y, dir, couleur, taille, cible) {
    const { ctx } = this;
    const s = 15 * taille;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, s * 2.6, s * 1.3, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    // poutre de queue et dérive
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 0.18);
    ctx.lineTo(-s * 2.3, -s * 0.1);
    ctx.lineTo(-s * 2.3, s * 0.12);
    ctx.lineTo(-s * 0.6, s * 0.22);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 2.1, -s * 0.05);
    ctx.lineTo(-s * 2.45, -s * 0.75);
    ctx.lineTo(-s * 2.3, s * 0.1);
    ctx.fill();
    // rotor de queue
    ctx.strokeStyle = 'rgba(30,30,30,0.8)';
    ctx.lineWidth = 2;
    const rq = this.temps * 60;
    ctx.beginPath();
    ctx.moveTo(-s * 2.35 + Math.cos(rq) * s * 0.4, -s * 0.35 + Math.sin(rq) * s * 0.4);
    ctx.lineTo(-s * 2.35 - Math.cos(rq) * s * 0.4, -s * 0.35 - Math.sin(rq) * s * 0.4);
    ctx.stroke();
    // fuselage effilé
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.moveTo(s * 1.3, s * 0.15);
    ctx.quadraticCurveTo(s * 1.1, -s * 0.55, 0, -s * 0.55);
    ctx.lineTo(-s * 0.8, -s * 0.3);
    ctx.lineTo(-s * 0.8, s * 0.35);
    ctx.lineTo(s * 0.8, s * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = alpha('#000000', 0.25);
    ctx.fillRect(-s * 0.8, s * 0.12, s * 1.9, s * 0.1);
    // verrière en tandem
    ctx.fillStyle = 'rgba(160,215,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(s * 1.15, s * 0.02);
    ctx.quadraticCurveTo(s * 0.9, -s * 0.48, s * 0.2, -s * 0.45);
    ctx.lineTo(s * 0.2, -s * 0.05);
    ctx.closePath();
    ctx.fill();
    // ailette et paniers de roquettes
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(-s * 0.3, s * 0.3, s * 0.9, s * 0.12);
    ctx.fillRect(-s * 0.2, s * 0.42, s * 0.75, s * 0.2);
    // canon sous le nez
    ctx.fillRect(s * 0.9, s * 0.4, s * 0.5, s * 0.07);
    // patins
    ctx.strokeStyle = '#2b2f35';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, s * 0.95);
    ctx.lineTo(s * 0.95, s * 0.95);
    ctx.moveTo(-s * 0.35, s * 0.45);
    ctx.lineTo(-s * 0.45, s * 0.95);
    ctx.moveTo(s * 0.5, s * 0.45);
    ctx.lineTo(s * 0.6, s * 0.95);
    ctx.stroke();
    // rotor principal : disque flou + deux pales
    ctx.fillStyle = 'rgba(200,200,210,0.16)';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.72, s * 2.1, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(25,25,25,0.85)';
    ctx.lineWidth = 2.5;
    const r = this.temps * 40;
    ctx.beginPath();
    ctx.moveTo(Math.cos(r) * s * 2.1, -s * 0.72 + Math.sin(r) * s * 0.2);
    ctx.lineTo(-Math.cos(r) * s * 2.1, -s * 0.72 - Math.sin(r) * s * 0.2);
    ctx.stroke();
    ctx.fillStyle = '#2b2f35';
    ctx.fillRect(-s * 0.08, -s * 0.72, s * 0.16, s * 0.2);
    ctx.restore();
    if (cible) {
      // tir : roquettes et canon vers la cible
      const [cx, cy] = cible;
      const tx = cx + (Math.random() - 0.5) * 30;
      const ty = cy + (Math.random() - 0.5) * 20;
      ctx.strokeStyle = 'rgba(255,220,120,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + dir * s * 1.3, y + s * 0.44);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      if (Math.random() < 0.15) this.missiles.push({ x0: x, y0: y + s * 0.5, x1: tx, y1: ty, t: 0, duree: 0.35, haut: 0 });
      if (Math.random() < 0.3) this.explosionEn(tx, ty, 0.3);
    }
  }

  /** Troupes au sol : soldats qui marchent et tanks, puis hélicoptères de combat en vol stationnaire. */
  #sol() {
    const P = this.partie;
    for (const e of P.equipes.values()) {
      const d = this.parCode.get(e.code);
      const [cx, cy] = this.ecran(e.code);
      const n = Math.max(1, Math.min(6, 1 + Math.floor(Math.log10(e.soldats + 1) * 1.4)));
      const couleur = this.theme.couleurSoldats(e.code);
      const couleurV = this.theme.couleurVehicules(e.code);
      const ech = d.overseas ? 0.6 : Math.sqrt(this.cam.s);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rayon = (d.overseas ? 10 : 22) * ech;
        const decal = Math.sin(this.temps * 0.8 + i * 1.7) * rayon;
        this.#soldat(cx + Math.cos(a) * rayon + decal * 0.5, cy + 16 * ech + Math.sin(a) * rayon * 0.4, couleur, ech, i);
      }
      const pilotes = this.pilotes.get(e.code) || [];
      for (let i = 0; i < Math.min(e.tanks, 3); i++) this.#tank(cx + (i % 2 ? -1 : 1) * (46 + 14 * Math.floor(i / 2)) * ech, cy + (6 + 10 * i) * ech, couleurV, pilotes[i], d.overseas ? 0.5 : 0.8 * ech);
    }
    for (const h of this.helicos) {
      const [cx, cy] = this.ecran(h.vers);
      for (let i = 0; i < 4; i++) {
        const a = h.t * 0.6 + (i / 4) * Math.PI * 2;
        const x = cx + Math.cos(a) * 62;
        const y = cy - 70 + Math.sin(a * 2) * 12;
        const dir = -Math.sin(a) >= 0 ? 1 : -1; // nez dans le sens de la rotation
        this.#helico(x, y, dir, h.couleur, 1.2, h.tir > 0 ? [cx, cy] : null);
        if (i === 0 && h.pilote) this.#photo(h.pilote, x, y - 30, 11, h.couleur);
      }
    }
  }

  /** Ciel : parachutistes, caisses, missiles, avions, bombardiers et bombes. */
  #air() {
    const { ctx } = this;
    for (const p of this.paras) {
      if (p.t < 0) continue;
      const k = lim(p.t / p.duree);
      const y = p.y0 + (p.y - p.y0) * k;
      const x = p.x + Math.sin(p.t * 3) * 8;
      this.#parachute(x, y - 22, 14, p.dore ? '#ffd23d' : '#f0f0f0');
      this.#soldat(x, y, p.couleur, 0.9, p.t * 3, p.dore);
    }
    for (const c of this.caisses) {
      if (c.t < 0) continue;
      const k = lim(c.t / c.duree);
      const x = c.x + Math.sin(c.t * 2.6) * 10;
      const y = c.y0 + (c.y - c.y0) * k;
      this.#parachute(x, y - 30, 22, '#e9e2cf');
      ctx.fillStyle = '#9a6b34';
      ctx.fillRect(x - 13, y - 16, 26, 22);
      ctx.strokeStyle = '#5b3d1b';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x - 13, y - 16, 26, 22);
      ctx.beginPath();
      ctx.moveTo(x - 13, y - 16);
      ctx.lineTo(x + 13, y + 6);
      ctx.moveTo(x + 13, y - 16);
      ctx.lineTo(x - 13, y + 6);
      ctx.stroke();
    }
    for (const m of this.missiles) {
      if (m.t < 0) continue;
      const k = lim(m.t / m.duree);
      const x = m.x0 + (m.x1 - m.x0) * k;
      const y = m.y0 + (m.y1 - m.y0) * k - Math.sin(k * Math.PI) * m.haut;
      if (m.tomate) {
        this.#texte('🍅', x, y, { taille: 28, align: 'center', police: EMOJI });
        continue;
      }
      ctx.fillStyle = '#f5f5f5';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      if (this.particules.length < PARTICULES_MAX) this.particules.push({ x, y, vx: 0, vy: 0, t: 0, duree: 0.6, couleur: 'rgba(255,170,90,0.6)', taille: 5, g: 0 });
    }
    for (const a of this.avions) if (a.t >= 0) this.#avion(a);
    for (const b of this.bombardiers) {
      const k = b.t / b.duree;
      this.#bombardierDessin(b.x0 + (b.x1 - b.x0) * k, b.y, b.x1 > b.x0 ? 1 : -1, b.couleur, b.taille);
    }
    for (const b of this.bombes) {
      const [cx, cy] = this.ecran(b.equipe);
      const x = cx + (b.dx || 0);
      if (b.nucleaire) {
        // cible marquée : cercle rouge, ☢ et compte à rebours jusqu'à l'impact
        const reste = Math.max(0, b.duree - b.t);
        const r = 64 - 30 * lim(b.t / b.duree);
        ctx.strokeStyle = `rgba(255,50,40,${0.55 + 0.45 * Math.sin(this.temps * 18)})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - r - 14, cy);
        ctx.lineTo(cx - r + 10, cy);
        ctx.moveTo(cx + r - 10, cy);
        ctx.lineTo(cx + r + 14, cy);
        ctx.moveTo(cx, cy - r - 14);
        ctx.lineTo(cx, cy - r + 10);
        ctx.moveTo(cx, cy + r - 10);
        ctx.lineTo(cx, cy + r + 14);
        ctx.stroke();
        this.#texte(`☢ ${Math.ceil(reste)}`, cx, cy - r - 22, { taille: 30, poids: 900, align: 'center', couleur: '#ffd23d', contour: 'rgba(0,0,0,0.85)', epaisseur: 6 });
      }
      if (b.t < b.largage) continue;
      const k = lim((b.t - b.largage) / Math.max(0.01, b.duree - b.largage));
      const y = b.y0 + (cy - b.y0) * k * k;
      const s = b.nucleaire ? 1.5 : 0.8;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = b.nucleaire ? '#4a5038' : '#2f3236';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8 * s, 17 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.nucleaire ? '#ffcc00' : '#7a7f86';
      ctx.fillRect(-8 * s, -21 * s, 16 * s, 5 * s);
      ctx.beginPath();
      ctx.moveTo(-8 * s, -17 * s);
      ctx.lineTo(-13 * s, -27 * s);
      ctx.lineTo(13 * s, -27 * s);
      ctx.lineTo(8 * s, -17 * s);
      ctx.fill();
      if (b.nucleaire) this.#texte('☢', 0, 4 * s, { taille: 13 * s, poids: 900, align: 'center', couleur: '#ffcc00' });
      ctx.restore();
      if (this.particules.length < PARTICULES_MAX) this.particules.push({ x, y: y - 20 * s, vx: 0, vy: 0, t: 0, duree: 0.5, couleur: 'rgba(230,230,230,0.45)', taille: 4 * s, g: 0 });
    }
  }

  #parachute(x, y, r, couleur) {
    const { ctx } = this;
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x, y + r + 2);
    ctx.lineTo(x + r, y);
    ctx.stroke();
  }

  /** Bombardier stratégique (ailes en flèche, quatre réacteurs, fuselage aux couleurs du département). */
  #bombardierDessin(x, y, dir, couleur, taille) {
    const { ctx } = this;
    const s = 34 * taille;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, s * 2.2, s * 1.6, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4b5360';
    ctx.beginPath();
    ctx.moveTo(s * 0.3, 0);
    ctx.lineTo(-s * 0.9, -s * 1.5);
    ctx.lineTo(-s * 1.25, -s * 1.5);
    ctx.lineTo(-s * 0.5, 0);
    ctx.lineTo(-s * 1.25, s * 1.5);
    ctx.lineTo(-s * 0.9, s * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = couleur;
    ctx.beginPath();
    ctx.moveTo(s * 1.8, 0);
    ctx.quadraticCurveTo(s * 1.3, -s * 0.28, 0, -s * 0.26);
    ctx.lineTo(-s * 1.7, -s * 0.18);
    ctx.lineTo(-s * 1.7, s * 0.18);
    ctx.lineTo(0, s * 0.26);
    ctx.quadraticCurveTo(s * 1.3, s * 0.28, s * 1.8, 0);
    ctx.fill();
    ctx.fillStyle = '#4b5360';
    ctx.beginPath();
    ctx.moveTo(-s * 1.3, 0);
    ctx.lineTo(-s * 1.75, -s * 0.6);
    ctx.lineTo(-s * 1.9, -s * 0.6);
    ctx.lineTo(-s * 1.7, 0);
    ctx.lineTo(-s * 1.9, s * 0.6);
    ctx.lineTo(-s * 1.75, s * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2b3038';
    for (const e of [-1.0, -0.6, 0.6, 1.0]) ctx.fillRect(-s * 0.55 - Math.abs(e) * s * 0.3, e * s - s * 0.07, s * 0.42, s * 0.14);
    ctx.fillStyle = 'rgba(170,220,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(s * 1.35, 0, s * 0.2, s * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (this.particules.length < PARTICULES_MAX - 4) for (const e of [-1, 1]) this.particules.push({ x: x - dir * s * 0.9, y: y + e * s * 0.8, vx: 0, vy: 0, t: 0, duree: 0.9, couleur: 'rgba(235,235,240,0.35)', taille: 6, g: 0 });
  }

  /** Porte-avions au large : il arrive, lance ses vagues d'avions, puis repart. */
  #porteAvion(p) {
    const { ctx } = this;
    const entree = sortieDouce(lim(p.t / 2.5));
    const sortie = lim((p.t - (p.duree - 2)) / 2);
    const d = -120 * (1 - entree) + 120 * sortie; // arrive puis repart dans l'axe de son cap
    const [bx, by] = this.versEcran(p.mx + Math.cos(p.cap) * d, p.my + Math.sin(p.cap) * d);
    const s = 1.15 * Math.sqrt(this.cam.s);
    ctx.save();
    ctx.globalAlpha = 1 - sortie;
    ctx.translate(bx, by);
    ctx.rotate(p.cap);
    ctx.scale(s, s);
    // sillage
    ctx.fillStyle = 'rgba(210,235,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(-70, -10);
    ctx.lineTo(-170, -26);
    ctx.lineTo(-170, 26);
    ctx.lineTo(-70, 10);
    ctx.fill();
    // coque
    ctx.fillStyle = '#5a6270';
    ctx.beginPath();
    ctx.moveTo(84, 0);
    ctx.lineTo(60, -20);
    ctx.lineTo(-74, -20);
    ctx.lineTo(-80, 0);
    ctx.lineTo(-74, 20);
    ctx.lineTo(60, 20);
    ctx.closePath();
    ctx.fill();
    // pont d'envol avec piste oblique
    ctx.fillStyle = '#2f343c';
    ctx.beginPath();
    ctx.moveTo(78, -2);
    ctx.lineTo(56, -17);
    ctx.lineTo(-70, -17);
    ctx.lineTo(-70, 15);
    ctx.lineTo(40, 15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(-64, 8);
    ctx.lineTo(58, -10);
    ctx.stroke();
    ctx.setLineDash([]);
    // bande aux couleurs du département
    ctx.fillStyle = p.couleur;
    ctx.fillRect(-74, 15, 134, 5);
    ctx.fillRect(-74, -20, 134, 3);
    // îlot
    ctx.fillStyle = '#727b88';
    ctx.fillRect(10, 10, 22, 9);
    ctx.fillStyle = '#9aa3ad';
    ctx.fillRect(18, 4, 7, 7);
    // avions sur le pont
    ctx.fillStyle = '#b8c0ca';
    for (const [x, y] of [[-50, -8], [-34, -8], [-18, -8], [-56, 4]]) {
      ctx.beginPath();
      ctx.moveTo(x + 8, y);
      ctx.lineTo(x - 5, y - 6);
      ctx.lineTo(x - 5, y + 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    if (p.pilote && p.t < p.duree - 2) this.#photo(p.pilote, bx, by - 40 * s, 14, p.couleur);
  }

  /** Département brûlé après une bombe nucléaire : sol calciné et braises, qui s'estompent. */
  #crateres() {
    if (!this.crateres.length) return;
    const { ctx } = this;
    const [ox, oy] = this.versEcran(0, 0);
    const sc = this.cam.s * ECHELLE;
    for (const c of this.crateres) {
      const d = this.parCode.get(c.equipe);
      const a = c.t < 0.3 ? c.t / 0.3 : 1 - lim((c.t - c.duree + 3) / 3);
      if (d.overseas) {
        const [x, y] = this.ecran(c.equipe);
        ctx.fillStyle = `rgba(30,12,4,${0.7 * a})`;
        ctx.beginPath();
        ctx.arc(x, y, 26, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(sc, sc);
      ctx.fillStyle = `rgba(28,12,6,${0.78 * a})`;
      ctx.fill(d.chemin);
      ctx.lineWidth = 3 / sc;
      ctx.strokeStyle = `rgba(255,${90 + 60 * Math.sin(this.temps * 6)},30,${0.8 * a})`;
      ctx.stroke(d.chemin);
      ctx.restore();
      const [x, y] = this.ecran(c.equipe);
      if (Math.random() < 0.5 * a && this.particules.length < PARTICULES_MAX) this.particules.push({ x: x + (Math.random() - 0.5) * 50, y: y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 10, vy: -20 - Math.random() * 20, t: 0, duree: 1 + Math.random(), couleur: Math.random() < 0.5 ? '#ff8a3d' : 'rgba(80,80,80,0.6)', taille: 3 + Math.random() * 3, g: 0, fumee: Math.random() < 0.4 });
    }
  }

  // ------------------------------------------------------------------ effets

  #effets() {
    const { ctx } = this;
    for (const c of this.champignons) {
      const k = c.t / c.duree;
      const monte = sortieDouce(lim(k * 1.6));
      const a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.globalAlpha = a;
      const tige = ctx.createLinearGradient(0, c.y - 160 * monte, 0, c.y);
      tige.addColorStop(0, '#ffcf7a');
      tige.addColorStop(1, '#a8501f');
      ctx.fillStyle = tige;
      ctx.fillRect(c.x - 14, c.y - 150 * monte, 28, 150 * monte);
      const tete = ctx.createRadialGradient(c.x, c.y - 170 * monte, 10, c.x, c.y - 170 * monte, 90);
      tete.addColorStop(0, '#fff2c4');
      tete.addColorStop(0.4, '#ff9a3c');
      tete.addColorStop(1, 'rgba(120,50,20,0.85)');
      ctx.fillStyle = tete;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y - 170 * monte, 80 * monte + 10, 48 * monte + 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const r of this.anneaux) {
      const k = r.t / r.duree;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.couleur;
      ctx.lineWidth = 8 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + (r.max - r.r) * sortieDouce(k), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.particules) {
      ctx.globalAlpha = 1 - p.t / p.duree;
      ctx.fillStyle = p.couleur;
      if (p.fumee) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.taille * (1 + p.t), 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(p.x - p.taille / 2, p.y - p.taille / 2, p.taille, p.taille);
    }
    ctx.globalAlpha = 1;
    // bulles : la photo tombe sur son département et « tape » la carte
    for (const b of this.bulles) {
      const [x, y] = this.ecran(b.equipe);
      const k = b.t / 0.45;
      const yy = k < 1 ? y - 140 * (1 - sortieDouce(k)) : y - Math.abs(Math.sin((b.t - 0.45) * 6)) * 10 * Math.max(0, 1 - (b.t - 0.45) * 1.5);
      if (k >= 1 && !b.tape) {
        b.tape = true;
        this.anneaux.push({ x, y, r: 6, max: 50 + b.poids * 8, couleur: this.theme.couleur(b.equipe), t: 0, duree: 0.6 });
      }
      const a = b.t > b.duree - 0.4 ? (b.duree - b.t) / 0.4 : 1;
      ctx.globalAlpha = Math.max(0, a);
      const r = 16 + Math.min(14, b.poids * 2.2);
      this.#photo(b.joueur, x, yy - r - 4, r, this.theme.couleur(b.equipe));
      const etiquette = b.likes > 0 && !b.texte ? `×${b.likes}` : b.likes > 0 ? `${b.texte} ×${b.likes}` : b.texte;
      if (etiquette) this.#texte(etiquette, x, yy - 2 * r - 14, { taille: 18, poids: 900, align: 'center', couleur: '#5cff8a', contour: 'rgba(0,0,0,0.8)', epaisseur: 4 });
      ctx.globalAlpha = 1;
    }
    for (const f of this.flottants) {
      const k = f.t / f.duree;
      ctx.globalAlpha = 1 - k * k;
      this.#texte(f.texte, f.x, f.y - k * 60, { taille: f.taille, poids: 900, align: 'center', couleur: f.couleur, contour: 'rgba(0,0,0,0.8)', epaisseur: 6 });
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ dessins utilitaires

  #photo(joueur, x, y, r, anneau) {
    const { ctx } = this;
    const img = this.photos.image(joueur) || this.photos.initiales(joueur);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
    ctx.restore();
    ctx.lineWidth = Math.max(2.5, r * 0.14);
    ctx.strokeStyle = anneau;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  #couronne(x, y, s) {
    const { ctx } = this;
    ctx.fillStyle = '#ffd23d';
    ctx.strokeStyle = '#7a5600';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - s, y + s * 0.5);
    ctx.lineTo(x - s, y - s * 0.3);
    ctx.lineTo(x - s * 0.5, y + s * 0.1);
    ctx.lineTo(x, y - s * 0.6);
    ctx.lineTo(x + s * 0.5, y + s * 0.1);
    ctx.lineTo(x + s, y - s * 0.3);
    ctx.lineTo(x + s, y + s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  #panneau(x, y, l, h) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.roundRect(x, y, l, h, 12);
    ctx.fillStyle = 'rgba(12,13,22,0.82)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = alpha(this.theme.contour, 0.7);
    ctx.stroke();
  }

  #texte(t, x, y, { taille = 20, poids = 700, couleur = '#fff', align = 'left', contour = null, epaisseur, max, police = POLICE } = {}) {
    const { ctx } = this;
    ctx.font = `${poids} ${taille}px ${police}, ${EMOJI}`;
    if (max) {
      let s = taille;
      while (ctx.measureText(t).width > max && s > 9) ctx.font = `${poids} ${(s -= 1)}px ${police}, ${EMOJI}`;
    }
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (contour) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = epaisseur ?? taille / 4;
      ctx.strokeStyle = contour;
      ctx.strokeText(t, x, y);
    }
    ctx.fillStyle = couleur;
    ctx.fillText(t, x, y);
  }

  /** Logo Empira (A doré en chevron + « EMPIRA AGENCY ») ; image fournie si présente. */
  #logo(x, y, ancrage) {
    dessinerLogo(this.ctx, x, y, ancrage);
  }
}
