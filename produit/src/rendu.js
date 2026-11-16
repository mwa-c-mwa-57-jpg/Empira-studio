// Rendu canvas de la carte, des unités et des effets (l'interface est en HTML par-dessus, voir hud.js).
// Tout est dessiné en code : soldats, parachutistes, tanks, avions, hélicoptères, missiles, bombes, tsunami.

import { DEPARTEMENTS, MAP_SIZE } from '../../public/src/france/departements.js';
import { dessinerLogo } from './logo.js';

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
    this.cache = document.createElement('canvas');
    this.cache.width = MAP_SIZE[0] * 2;
    this.cache.height = MAP_SIZE[1] * 2;
    this.cleCache = '';
    this.fond = this.#fond();
    this.vider();
  }

  vider() {
    this.bulles = [];
    this.paras = [];
    this.avions = [];
    this.missiles = [];
    this.helicos = [];
    this.tsunamis = [];
    this.bombes = [];
    this.champignons = [];
    this.anneaux = [];
    this.particules = [];
    this.flottants = [];
    this.pilotes = new Map(); // tanks : équipe → photos des pilotes
    this.secousse = 0;
  }

  #fond() {
    const c = document.createElement('canvas');
    c.width = LARGEUR;
    c.height = HAUTEUR;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, HAUTEUR);
    grad.addColorStop(0, '#0b0c14');
    grad.addColorStop(0.5, '#121522');
    grad.addColorStop(1, '#0a0b12');
    g.fillStyle = grad;
    g.fillRect(0, 0, LARGEUR, HAUTEUR);
    const halo = g.createRadialGradient(560, 1280, 40, 560, 1280, 620);
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
          if (e.sorte !== 'souffle') this.explosion(e.equipe, fort ? 2.2 : e.sorte === 'helicos' ? 0.6 : 1.1);
          if (e.detruit >= 1) this.flottant(e.equipe, `−${fmt(e.detruit)}`, '#ff6b5b', fort ? 46 : 34);
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
    for (let i = 0; i < n; i++) this.paras.push({ equipe, x: x + (Math.random() - 0.5) * 60, y0: y - 240 - Math.random() * 80, y, t: -i * 0.18, duree: 1.8, dore, couleur: this.theme.couleurUnites(equipe) });
  }

  avionTransport(equipe, n, dore, pilote) {
    const [x, y] = this.ecran(equipe);
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.avions.push({ sorte: 'transport', x0: x - dir * 700, y0: y - 230, x1: x + dir * 700, y1: y - 250, t: 0, duree: 3.2, equipe, n, dore, largue: false, pilote, couleur: this.theme.couleurUnites(equipe) });
  }

  attaque(e) {
    const de = e.de;
    const cibles = e.vers;
    if (e.sorte === 'chasseur' || e.sorte === 'tomate') {
      const [x0, y0] = this.ecran(de);
      const [x1, y1] = this.ecran(cibles[0]);
      if (e.sorte === 'tomate') this.missiles.push({ x0, y0, x1, y1, t: 0, duree: 1.4, haut: 160, tomate: true });
      else this.avions.push({ sorte: 'chasseur', x0, y0, x1, y1, t: 0, duree: 1.4, pilote: e.joueur, couleur: this.theme.couleurUnites(de) });
      this.viser(cibles[0], 1.4, 2);
    } else if (e.sorte === 'missiles') {
      const [x0, y0] = this.ecran(de);
      const [x1, y1] = this.ecran(cibles[0]);
      for (let i = 0; i < 6; i++) this.missiles.push({ x0: x0 + (i - 2.5) * 6, y0, x1: x1 + (i - 2.5) * 10, y1: y1 + (i % 2) * 8, t: -i * 0.08, duree: 1.6, haut: 220 + i * 18 });
      this.viser(cibles[0], 1.5, 2.6);
    } else if (e.sorte === 'helicos') {
      this.helicos.push({ de, vers: cibles[0], t: 0, pilote: e.joueur, couleur: this.theme.couleurUnites(de), tir: 0 });
      this.viser(cibles[0], 1.6, 2.6);
    } else if (e.sorte === 'nucleaire') {
      for (const c of cibles) this.bombes.push({ equipe: c, t: 0, duree: 2.6 });
      this.secousse = Math.max(this.secousse, 0.2);
    }
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
      if (b.t >= b.duree) {
        const [x, y] = this.ecran(b.equipe);
        this.champignons.push({ x, y, t: 0, duree: 3.2 });
        this.anneaux.push({ x, y, r: 10, max: 300, couleur: '#ffffff', t: 0, duree: 1 });
        this.anneaux.push({ x, y, r: 10, max: 220, couleur: '#ffb347', t: 0, duree: 1.3 });
        this.eclat(null, '#ff8a3d', 40, 420, x, y);
        for (let i = 0; i < 40 && this.particules.length < PARTICULES_MAX; i++) {
          this.particules.push({ x: x + (Math.random() - 0.5) * 120, y: y - Math.random() * 160, vx: (Math.random() - 0.5) * 20, vy: 10 + Math.random() * 20, t: 0, duree: 2.5 + Math.random() * 1.5, couleur: 'rgba(170,170,170,0.7)', taille: 2 + Math.random() * 2, g: 4 });
        }
        this.secousse = 0.9;
        this.flash = 0.5;
        return false;
      }
      return true;
    });
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.fond, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, ZONE.haut, LARGEUR, ZONE.bas - ZONE.haut);
    ctx.clip();
    if (this.secousse > 0) ctx.translate((Math.random() - 0.5) * this.secousse * 18, (Math.random() - 0.5) * this.secousse * 18);
    this.#carte();
    this.#cases();
    this.#tsunamis();
    this.#unites();
    this.#etiquettes(); // les numéros et le top 3 restent lisibles par-dessus les unités
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
      g.setTransform(2, 0, 0, 2, 0, 0);
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
      this.#texte(d.code, x, y, { taille: (e ? 18 : 14) * z, poids: 800, align: 'center', couleur: e ? '#fff' : 'rgba(255,255,255,0.35)', contour: e ? 'rgba(0,0,0,0.7)' : null });
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
        this.#texte(e.nom, x, y + 27 * s, { taille: 14 * s, poids: 800, align: 'center', contour: 'rgba(0,0,0,0.8)', epaisseur: 4 });
        this.#texte(`${(P.part(e) * 100).toFixed(1).replace('.', ',')} %`, x, y + 44 * s, { taille: 13 * s, poids: 800, align: 'center', couleur: '#ffd166', contour: 'rgba(0,0,0,0.8)', epaisseur: 4 });
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

  #avion(a) {
    const { ctx } = this;
    const k = a.t / a.duree;
    const x = a.x0 + (a.x1 - a.x0) * (a.sorte === 'chasseur' ? sortieDouce(k) : k);
    const y = a.y0 + (a.y1 - a.y0) * (a.sorte === 'chasseur' ? sortieDouce(k) : k) - (a.sorte === 'chasseur' ? Math.sin(k * Math.PI) * 120 : 0);
    const angle = Math.atan2(a.y1 - a.y0, a.x1 - a.x0);
    const s = a.sorte === 'chasseur' ? 18 : 26;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a.sorte === 'chasseur' ? angle : a.x1 > a.x0 ? 0 : Math.PI);
    ctx.fillStyle = a.sorte === 'chasseur' ? '#9aa3ad' : '#6c7a5a';
    ctx.beginPath();
    ctx.moveTo(s * 1.4, 0);
    ctx.lineTo(-s, -s * 0.22);
    ctx.lineTo(-s, s * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = a.couleur;
    ctx.beginPath();
    ctx.moveTo(s * 0.2, 0);
    ctx.lineTo(-s * 0.4, -s * (a.sorte === 'chasseur' ? 0.9 : 1.2));
    ctx.lineTo(-s * 0.7, -s * (a.sorte === 'chasseur' ? 0.9 : 1.2));
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(-s * 0.7, s * (a.sorte === 'chasseur' ? 0.9 : 1.2));
    ctx.lineTo(-s * 0.4, s * (a.sorte === 'chasseur' ? 0.9 : 1.2));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (a.sorte === 'chasseur' && this.particules.length < PARTICULES_MAX) this.particules.push({ x, y, vx: 0, vy: 0, t: 0, duree: 0.5, couleur: 'rgba(220,220,230,0.5)', taille: 5, g: 0 });
    if (a.pilote) this.#photo(a.pilote, x, y - s * 1.2, 12, a.couleur);
    if (a.sorte === 'chasseur' && k > 0.85 && !a.tire) {
      a.tire = true;
      this.missiles.push({ x0: x, y0: y, x1: a.x1, y1: a.y1, t: 0, duree: 0.25, haut: 0 });
    }
  }

  #helico(h, i, n) {
    const { ctx } = this;
    const [cx, cy] = this.ecran(h.vers);
    const a = h.t * 0.6 + (i / n) * Math.PI * 2;
    const x = cx + Math.cos(a) * 62;
    const y = cy - 70 + Math.sin(a * 2) * 12;
    const s = 14;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = h.couleur;
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-s * 2, -s * 0.12, s * 1.2, s * 0.24);
    ctx.fillStyle = 'rgba(180,220,255,0.8)';
    ctx.beginPath();
    ctx.ellipse(s * 0.45, -s * 0.1, s * 0.35, s * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,30,30,0.85)';
    ctx.lineWidth = 2.5;
    const r = this.temps * 40;
    ctx.beginPath();
    ctx.moveTo(Math.cos(r) * s * 1.6, -s * 0.7 + Math.sin(r) * 2);
    ctx.lineTo(-Math.cos(r) * s * 1.6, -s * 0.7 - Math.sin(r) * 2);
    ctx.stroke();
    ctx.restore();
    if (h.tir > 0) {
      ctx.strokeStyle = 'rgba(255,220,120,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.lineTo(cx + (Math.random() - 0.5) * 30, cy + (Math.random() - 0.5) * 20);
      ctx.stroke();
      if (Math.random() < 0.3) this.explosionEn(cx + (Math.random() - 0.5) * 30, cy + (Math.random() - 0.5) * 20, 0.3);
    }
    if (i === 0 && h.pilote) this.#photo(h.pilote, x, y - 26, 11, h.couleur);
  }

  #unites() {
    const P = this.partie;
    // soldats qui marchent sur chaque département actif
    for (const e of P.equipes.values()) {
      const d = this.parCode.get(e.code);
      const [cx, cy] = this.ecran(e.code);
      const n = Math.max(1, Math.min(6, 1 + Math.floor(Math.log10(e.soldats + 1) * 1.4)));
      const couleur = this.theme.couleurUnites(e.code);
      const ech = d.overseas ? 0.6 : Math.sqrt(this.cam.s);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rayon = (d.overseas ? 10 : 22) * ech;
        const decal = Math.sin(this.temps * 0.8 + i * 1.7) * rayon;
        this.#soldat(cx + Math.cos(a) * rayon + decal * 0.5, cy + 16 * ech + Math.sin(a) * rayon * 0.4, couleur, ech, i);
      }
      const pilotes = this.pilotes.get(e.code) || [];
      for (let i = 0; i < Math.min(e.tanks, 3); i++) this.#tank(cx + (i % 2 ? -1 : 1) * (46 + 14 * Math.floor(i / 2)) * ech, cy + (6 + 10 * i) * ech, couleur, pilotes[i], d.overseas ? 0.5 : 0.8 * ech);
    }
    for (const p of this.paras) {
      if (p.t < 0) continue;
      const k = lim(p.t / p.duree);
      const y = p.y0 + (p.y - p.y0) * k;
      const x = p.x + Math.sin(p.t * 3) * 8;
      const { ctx } = this;
      ctx.fillStyle = p.dore ? '#ffd23d' : '#f0f0f0';
      ctx.beginPath();
      ctx.arc(x, y - 22, 14, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 14, y - 22);
      ctx.lineTo(x, y - 6);
      ctx.lineTo(x + 14, y - 22);
      ctx.stroke();
      this.#soldat(x, y, p.couleur, 0.9, p.t * 3, p.dore);
    }
    for (const a of this.avions) this.#avion(a);
    for (const h of this.helicos) for (let i = 0; i < 4; i++) this.#helico(h, i, 4);
    const { ctx } = this;
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
    for (const b of this.bombes) {
      const [x, y] = this.ecran(b.equipe);
      const k = lim(b.t / b.duree);
      const by = y - 520 + 520 * k * k;
      ctx.fillStyle = '#3b3f2f';
      ctx.beginPath();
      ctx.ellipse(x, by, 9, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(x - 9, by - 22, 18, 5);
      ctx.strokeStyle = `rgba(255,60,40,${0.5 + 0.5 * Math.sin(this.temps * 20)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, 50 - 26 * k, 0, Math.PI * 2);
      ctx.stroke();
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
    dessinerLogo(this.ctx, x, y, ancrage, this.photos.logo);
  }
}
