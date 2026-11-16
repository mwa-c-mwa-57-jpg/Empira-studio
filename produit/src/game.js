// Moteur de « Empira Conquest » — logique pure (aucun DOM), testable sous Node.
// Le temps avance uniquement par update(dt), avec des secondes réelles : le chrono reste juste
// même si TikTok LIVE Studio affiche peu d'images par seconde.

import { REGLES, VAGUES, VAGUE_DUREE_SEC, VAGUE_PREAVIS_SEC, VAGUE_CADEAUX_MAX, VAGUE_RATTRAPAGE, EVENEMENTS, CADEAUX, ATTAQUES } from './config.js';
import { DEPARTEMENTS } from '../../public/src/france/departements.js';
import { normalizeKeyword } from '../../public/src/core/events.js';

export const PAR_CODE = new Map(DEPARTEMENTS.map((d) => [d.code, d]));
const CODES = new Set(PAR_CODE.keys());
const NOMS = new Map(DEPARTEMENTS.map((d) => [normalizeKeyword(d.name), d.code]));
const CADEAU_PAR_NOM = new Map();
for (const c of CADEAUX) for (const n of c.noms) CADEAU_PAR_NOM.set(normalizeKeyword(n), c);

/** Trouve un département dans un message : « 17 », « le 17 !! », « 2a », « 974 », « Charente-Maritime ». */
export function trouverDepartement(texte) {
  const norm = normalizeKeyword(texte);
  if (!norm) return null;
  if (NOMS.has(norm)) return NOMS.get(norm);
  for (const tok of norm.split(' ').slice(0, 3)) {
    let code = null;
    if (/^\d{1,3}$/.test(tok)) code = tok.length === 1 ? `0${tok}` : tok;
    else if (tok === '2a' || tok === '2b') code = tok.toUpperCase();
    if (code && CODES.has(code)) return code;
  }
  return null;
}

/** Cadeau du catalogue : par identifiant TikTok d'abord (champ ids), puis par nom exact. */
export function trouverCadeau(cadeau, catalogue = CADEAUX) {
  const parId = catalogue.find((c) => (c.ids || []).includes(String(cadeau.id)));
  return parId || CADEAU_PAR_NOM.get(normalizeKeyword(cadeau.name)) || null;
}

/** Soldats par pièce : 10 jusqu'à 30 pièces, puis crescendo logarithmique jusqu'à ×1,2 (Léon le chaton). */
export function soldatsParPiece(pieces) {
  const r = REGLES;
  if (pieces <= r.crescendoDebut) return r.soldatsParPiece;
  const k = Math.min(1, Math.log(pieces / r.crescendoDebut) / Math.log(r.crescendoFin / r.crescendoDebut));
  return r.soldatsParPiece * (1 + (r.crescendoMax - 1) * k);
}

/** Valeur en soldats d'un envoi : prix unitaire × nombre, au tarif du prix unitaire. */
export const valeurCadeau = (piecesUnitaires, nombre = 1) => soldatsParPiece(piecesUnitaires) * piecesUnitaires * nombre;

export class Partie {
  constructor({ random = Math.random, membres = {}, surMembres = () => {}, dureeMinutes = REGLES.dureeMinutes } = {}) {
    this.random = random;
    this.ambianceActive = true; // ravitaillements, bombardements surprises et survols (commande !ambiance)
    this.membres = membres; // identifiant TikTok → département, conservé d'une partie à l'autre
    this.surMembres = surMembres;
    this.dureeMinutes = dureeMinutes;
    this.t = 0;
    this.numero = 0;
    this.evenements = [];
    this.joueurs = new Map();
    this.inconnus = new Map();
    this.messageFixe = null;
    this.viderCarte();
    this.phase = 'attente';
  }

  // ------------------------------------------------------------------ outils

  emit(e) {
    this.evenements.push({ ...e, t: this.t });
  }

  drain() {
    const e = this.evenements;
    this.evenements = [];
    return e;
  }

  hasard(min, max) {
    return min + this.random() * (max - min);
  }

  choisir(liste) {
    return liste[Math.floor(this.random() * liste.length)];
  }

  get duree() {
    return this.dureeMinutes * 60;
  }

  get ecoule() {
    return this.phase === 'partie' ? this.t - this.debut : 0;
  }

  get tempsRestant() {
    return this.phase === 'partie' ? Math.max(0, this.duree - this.ecoule) : this.duree;
  }

  classement() {
    return [...this.equipes.values()].sort((a, b) => b.soldats - a.soldats || a.arrivee - b.arrivee);
  }

  rang(code) {
    return this.classement().findIndex((e) => e.code === code);
  }

  totalSoldats() {
    let s = 0;
    for (const e of this.equipes.values()) s += e.soldats;
    return s;
  }

  part(equipe) {
    const total = this.totalSoldats();
    return total > 0 ? equipe.soldats / total : 0;
  }

  roi() {
    let meilleur = null;
    for (const j of this.joueurs.values()) if (j.equipe && j.total > 0 && (!meilleur || j.total > meilleur.total)) meilleur = j;
    return meilleur;
  }

  meilleurJoueur(equipe) {
    let m = null;
    for (const [id, v] of equipe.contributions) if (!m || v > m.v) m = { id, v };
    return m ? this.joueurs.get(m.id) : null;
  }

  vagueActive() {
    const v = this.vague;
    return v && this.t >= v.debut && this.t < v.fin ? v : null;
  }

  boost(equipe) {
    let m = 1;
    for (const b of equipe.boosts) if (b.fin > this.t) m = Math.max(m, b.mult);
    return m;
  }

  protege(equipe) {
    return equipe.bouclierFin > this.t;
  }

  blindage(equipe) {
    return Math.min(REGLES.blindageMax, equipe.tanks * REGLES.blindageParTank);
  }

  // ------------------------------------------------------------------ cycle de partie

  viderCarte() {
    this.equipes = new Map();
    this.helicos = [];
    this.programme = [];
    this.vague = null;
    this.evenement = null;
    this.prochainEvenement = Infinity;
    this.prochaineAmbiance = Infinity;
    this.vaguesFaites = new Set();
    this.rappels = new Set();
    this.leader = null;
    this.derniereArriveeAnnoncee = -Infinity;
  }

  demarrer() {
    this.viderCarte();
    this.numero++;
    this.phase = 'partie';
    this.debut = this.t;
    this.prochainEvenement = this.t + this.hasard(...EVENEMENTS.intervalleSec);
    this.prochaineAmbiance = this.t + this.hasard(...REGLES.ambianceSec);
    for (const j of this.joueurs.values()) {
      j.total = 0;
      j.arrive = false;
      j.aJoue = false;
    }
    this.emit({ type: 'debutPartie', numero: this.numero });
    // les cadeaux reçus pendant le podium (ou sans département) comptent maintenant
    for (const j of this.joueurs.values()) {
      if (!j.equipe || !j.enAttente.length) continue;
      const attente = j.enAttente;
      j.enAttente = [];
      for (const ev of attente) this.traiter(ev);
    }
  }

  terminer(raison = 'temps') {
    if (this.phase !== 'partie') return;
    const top = this.classement().slice(0, 3).map((e) => ({ code: e.code, nom: e.nom, couleur: e.couleur, soldats: Math.round(e.soldats), heros: this.meilleurJoueur(e) }));
    const roi = this.roi();
    this.podium = { top, roi: roi && { id: roi.id, nom: roi.nom, avatar: roi.avatar, equipe: roi.equipe, total: Math.round(roi.total) }, raison };
    this.phase = 'podium';
    this.finPodium = this.t + REGLES.podiumSec;
    this.emit({ type: 'podium', podium: this.podium });
  }

  update(dt) {
    if (!(dt > 0)) return;
    this.t += Math.min(dt, 5);
    if (this.phase === 'podium') {
      if (this.t >= this.finPodium) {
        this.phase = 'attente';
        this.viderCarte();
        this.emit({ type: 'attente' });
      }
      return;
    }
    if (this.phase !== 'partie') return;
    this.#programme();
    this.#helicos();
    this.#vagues();
    this.#evenements();
    this.#ambiance();
    this.#suivi();
    if (this.ecoule >= this.duree) this.terminer('temps');
  }

  #programme() {
    const prets = this.programme.filter((p) => p.a <= this.t);
    this.programme = this.programme.filter((p) => p.a > this.t);
    for (const p of prets) p.f();
  }

  plus(sec, f) {
    this.programme.push({ a: this.t + sec, f });
  }

  // ------------------------------------------------------------------ joueurs et équipes

  joueur(user) {
    let j = this.joueurs.get(user.id);
    if (!j) {
      j = { id: user.id, nom: user.name, avatar: user.avatar, equipe: this.membres[user.id] || null, total: 0, arrive: false, aJoue: false, resteLikes: 0, dernierCommentaire: -Infinity, enAttente: [] };
      this.joueurs.set(user.id, j);
    }
    j.nom = user.name;
    if (user.avatar) j.avatar = user.avatar;
    return j;
  }

  equipe(code) {
    let e = this.equipes.get(code);
    if (!e) {
      const d = PAR_CODE.get(code);
      e = { code, nom: d.name, region: d.region, soldats: 0, arrivee: this.t, contributions: new Map(), boosts: [], bouclierFin: 0, tanks: 0, occupant: null, attaquePar: null, gainsEvenement: 0 };
      this.equipes.set(code, e);
      this.emit({ type: 'nouvelleEquipe', equipe: code });
    }
    return e;
  }

  #arriver(j) {
    if (j.arrive || !j.equipe) return;
    j.arrive = true;
    const e = this.equipe(j.equipe);
    this.ajouter(e, REGLES.soldatsArrivee, j, 'arrivee', { brut: true });
    const annoncer = this.t - this.derniereArriveeAnnoncee >= REGLES.annonceArriveeSec;
    if (annoncer) this.derniereArriveeAnnoncee = this.t;
    this.emit({ type: 'arrivee', equipe: e.code, joueur: j, annoncer });
  }

  choisirDepartement(j, code) {
    if (j.equipe === code) return false;
    // on peut changer tant qu'on n'a pas encore joué dans la partie
    if (j.equipe && j.aJoue && this.phase === 'partie') return false;
    j.equipe = code;
    j.arrive = false;
    this.membres[j.id] = code;
    this.surMembres(this.membres);
    return true;
  }

  /**
   * Ajoute des soldats avec tous les multiplicateurs. sorte : 'like' | 'commentaire' | 'partage' |
   * 'abonnement' | 'cadeau' | 'arrivee' | 'prime'. Renvoie le nombre réellement ajouté.
   */
  ajouter(e, base, j, sorte, { brut = false } = {}) {
    if (!e || base <= 0) return 0;
    let mult = 1;
    if (!brut) {
      mult *= this.boost(e);
      const v = this.vagueActive();
      if (v) {
        if (sorte === 'like' || sorte === 'commentaire') mult *= v.mult;
        if (sorte === 'cadeau') mult *= VAGUE_CADEAUX_MAX;
        const cl = this.classement();
        if (cl.length >= 2 && cl.findIndex((x) => x.code === e.code) >= Math.ceil(cl.length / 2)) mult *= VAGUE_RATTRAPAGE;
      }
      const ev = this.evenement;
      if (ev?.type === 'revolution' && ev.cible !== e.code) mult *= EVENEMENTS.revolution.mult;
    }
    let gain = base * mult;
    // occupation : l'occupant touche la moitié des gains, jamais les cadeaux
    if (e.occupant && sorte !== 'cadeau' && this.equipes.has(e.occupant)) {
      const part = gain * REGLES.occupationPart;
      gain -= part;
      this.equipes.get(e.occupant).soldats += part;
    }
    e.soldats += gain;
    if (j) {
      j.total += gain;
      if (sorte !== 'arrivee') j.aJoue = true;
      e.contributions.set(j.id, (e.contributions.get(j.id) || 0) + gain);
    }
    const ev = this.evenement;
    if (ev?.type === 'duel' && ev.scores[e.code] !== undefined) ev.scores[e.code] += gain;
    if (ev?.type === 'mission' && e.region === ev.region) {
      ev.participants.add(e.code);
      if (ev.sorte === 'soldats') ev.progres += gain;
      else if (sorte === 'commentaire') ev.progres += 1;
    }
    return gain;
  }

  // ------------------------------------------------------------------ événements du live

  /** Traite un événement normalisé (format core/events.js). Renvoie { accepte, ignore? }. */
  traiter(ev) {
    const j = this.joueur(ev.user);
    if (this.phase === 'podium') {
      // pendant le podium : on retient le choix et les cadeaux pour la partie suivante
      if (ev.type === 'comment') {
        const code = trouverDepartement(ev.comment);
        if (code) this.choisirDepartement(j, code);
      } else if (ev.type === 'gift') j.enAttente.push(ev);
      return { accepte: true, ignore: 'podium' };
    }
    if (this.phase === 'attente') this.demarrer(); // la partie démarre à la première action

    switch (ev.type) {
      case 'comment': {
        const code = trouverDepartement(ev.comment);
        if (code && code !== j.equipe && this.choisirDepartement(j, code)) {
          this.#arriver(j);
          j.dernierCommentaire = this.t;
          for (const enAttente of j.enAttente.splice(0)) this.traiter(enAttente);
          return { accepte: true };
        }
        if (!j.equipe) return { accepte: true, ignore: 'sans-departement' };
        this.#arriver(j);
        if (this.t - j.dernierCommentaire < REGLES.delaiCommentaireSec) return { accepte: true, ignore: 'delai' };
        j.dernierCommentaire = this.t;
        const e = this.equipe(j.equipe);
        const n = this.ajouter(e, REGLES.soldatsCommentaire, j, 'commentaire');
        const v = this.vagueActive();
        this.emit({ type: 'gain', sorte: 'commentaire', equipe: e.code, joueur: j, soldats: n, parachute: Boolean(v?.parachute) });
        return { accepte: true };
      }
      case 'like': {
        if (!j.equipe) return { accepte: true, ignore: 'sans-departement' };
        this.#arriver(j);
        j.resteLikes += ev.likeCount;
        const s = Math.floor(j.resteLikes / REGLES.likesParSoldat);
        j.resteLikes -= s * REGLES.likesParSoldat;
        const e = this.equipe(j.equipe);
        const n = this.ajouter(e, s, j, 'like');
        this.emit({ type: 'gain', sorte: 'like', equipe: e.code, joueur: j, soldats: n, likes: ev.likeCount });
        return { accepte: true };
      }
      case 'share':
      case 'follow': {
        if (!j.equipe) return { accepte: true, ignore: 'sans-departement' };
        this.#arriver(j);
        const e = this.equipe(j.equipe);
        const sorte = ev.type === 'share' ? 'partage' : 'abonnement';
        const n = this.ajouter(e, ev.type === 'share' ? REGLES.soldatsPartage : REGLES.soldatsAbonnement, j, sorte);
        this.emit({ type: 'gain', sorte, equipe: e.code, joueur: j, soldats: n });
        return { accepte: true };
      }
      case 'gift':
        if (!j.equipe) {
          j.enAttente.push(ev); // jamais perdu : compte dès qu'il choisit un département
          this.emit({ type: 'cadeauEnAttente', joueur: j, cadeau: ev.gift });
          return { accepte: true, enAttente: true };
        }
        this.#arriver(j);
        this.#cadeau(j, ev.gift);
        return { accepte: true };
      default:
        return { accepte: true, ignore: 'type' };
    }
  }

  // ------------------------------------------------------------------ cadeaux

  #cadeau(j, g) {
    const e = this.equipe(j.equipe);
    const def = trouverCadeau(g);
    if (!def) {
      const cle = `${g.name}|${g.id}`;
      const inc = this.inconnus.get(cle) || { nom: g.name, id: g.id, pieces: g.diamonds, nombre: 0 };
      inc.nombre += g.count;
      this.inconnus.set(cle, inc);
    }
    const pieces = g.diamonds * g.count;
    const valeur = valeurCadeau(g.diamonds, g.count);
    const effet = def?.effet || { type: 'soldats' };
    const info = { joueur: j, equipe: e.code, cadeau: def, nom: g.name, image: g.image, nombre: g.count, pieces };

    // un gros cadeau libère un département occupé
    if (e.occupant && pieces >= REGLES.liberationPieces) {
      const occupant = e.occupant;
      e.occupant = null;
      this.emit({ type: 'liberation', equipe: e.code, occupant, joueur: j });
    }

    if (ATTAQUES.has(effet.type)) {
      // la cible est choisie au moment de l'envoi, avant que les 40 % ne changent le classement
      const cibles = effet.type === 'nucleaire' ? this.classement().filter((x) => x.code !== e.code).slice(0, 3) : null;
      const choix = effet.type === 'nucleaire' ? null : this.cible(e, { premier: effet.type === 'tomate' });
      const gain = this.ajouter(e, valeur * REGLES.partAttaquant, j, 'cadeau');
      this.emit({ type: 'cadeau', ...info, soldats: gain, attaque: effet.type });
      this.#attaque(e, j, effet, valeur, choix, cibles);
      return;
    }
    let base = valeur;
    if (effet.type === 'escouade' || effet.type === 'commandos') base = valeur * effet.mult;
    if (effet.type === 'fixe') base = effet.soldats * g.count;
    const gain = this.ajouter(e, base, j, 'cadeau');
    this.emit({ type: 'cadeau', ...info, soldats: gain, renfort: effet.type });
    if (effet.type === 'tank') {
      e.tanks += g.count;
      this.emit({ type: 'tank', equipe: e.code, joueur: j, tanks: e.tanks });
    } else if (effet.type === 'boost') {
      e.boosts.push({ mult: effet.mult, fin: this.t + effet.sec * Math.min(g.count, 4) });
      this.emit({ type: 'boost', equipe: e.code, mult: effet.mult, sec: effet.sec * Math.min(g.count, 4), joueur: j });
    } else if (effet.type === 'bouclier') {
      e.bouclierFin = Math.max(e.bouclierFin, this.t) + effet.sec * Math.min(g.count, 4);
      this.emit({ type: 'bouclier', equipe: e.code, sec: Math.round(e.bouclierFin - this.t), joueur: j });
    }
  }

  /** Cible d'une attaque : en riposte, l'agresseur (force ×2) ; sinon le département juste devant ; le 2e si on est 1er. */
  cible(e, { premier = false } = {}) {
    const a = e.attaquePar;
    if (a && a.fin > this.t && this.equipes.has(a.code) && a.code !== e.code) return { cible: this.equipes.get(a.code), force: REGLES.forceRiposte, riposte: true };
    const cl = this.classement();
    if (premier) {
      const t = cl[0]?.code === e.code ? cl[1] : cl[0];
      return t ? { cible: t, force: 1 } : null;
    }
    const i = cl.findIndex((x) => x.code === e.code);
    const t = i === 0 ? cl[1] : cl[i - 1];
    return t ? { cible: t, force: 1 } : null;
  }

  /**
   * Dégâts sur une équipe : bouclier (sauf bombes), blindage des tanks, plafond en % de la cible.
   * Ce qui n'a pas pu être détruit revient pour un quart à l'attaquant (butin).
   */
  degats(cible, montant, { plafond = 0.5, ignoreBouclier = false, attaquant = null, sorte = '', joueur = null } = {}) {
    let detruit = 0;
    let bloque = false;
    if (this.protege(cible) && !ignoreBouclier) bloque = true;
    else {
      const efficace = montant * (1 - this.blindage(cible));
      detruit = Math.min(efficace, plafond * cible.soldats);
      cible.soldats -= detruit;
    }
    const reste = montant - detruit;
    let butin = 0;
    if (attaquant && this.equipes.has(attaquant.code) && reste > 0) {
      butin = reste * REGLES.partButin;
      attaquant.soldats += butin;
    }
    if (attaquant) cible.attaquePar = { code: attaquant.code, fin: this.t + REGLES.ripostesec };
    this.emit({ type: 'impact', sorte, equipe: cible.code, attaquant: attaquant?.code, detruit, bloque, butin, joueur, reste: cible.soldats });
    return { detruit, bloque, butin };
  }

  #attaque(e, j, effet, valeur, choix, cibles) {
    const sorte = effet.type;
    if (sorte === 'nucleaire') {
      // 3 bombes sur les 3 premiers (hors l'envoyeur), voisins −10 %, ignore les boucliers
      if (!cibles.length) return;
      this.emit({ type: 'attaque', sorte, de: e.code, vers: cibles.map((c) => c.code), joueur: j });
      this.plus(2.6, () => {
        for (const c of cibles) {
          if (!this.equipes.has(c.code)) continue;
          this.degats(c, valeur / 3, { plafond: effet.plafond, ignoreBouclier: true, attaquant: e, sorte, joueur: j });
          for (const v of PAR_CODE.get(c.code).neighbors) {
            const voisin = this.equipes.get(v);
            if (voisin && voisin.code !== e.code) {
              const perte = voisin.soldats * REGLES.nucleaireVoisins;
              voisin.soldats -= perte;
              this.emit({ type: 'impact', sorte: 'souffle', equipe: v, attaquant: e.code, detruit: perte, bloque: false, butin: 0 });
            }
          }
        }
      });
      return;
    }
    if (!choix) {
      // personne à attaquer : le butin s'applique à toute la valeur
      e.soldats += valeur * REGLES.partButin;
      return;
    }
    const { cible, force, riposte } = choix;
    const montant = valeur * force;
    this.emit({ type: 'attaque', sorte, de: e.code, vers: [cible.code], joueur: j, riposte: Boolean(riposte) });
    const opts = { plafond: effet.plafond, attaquant: e, sorte, joueur: j };
    if (sorte === 'chasseur' || sorte === 'tomate') this.plus(1.4, () => this.equipes.has(cible.code) && this.degats(cible, montant, opts));
    else if (sorte === 'missiles') this.plus(2.0, () => this.equipes.has(cible.code) && this.degats(cible, montant, opts));
    else if (sorte === 'helicos') {
      this.helicos.push({ de: e.code, vers: cible.code, salve: montant / REGLES.heliSalves, prochain: this.t + 3, joueur: j, plafond: effet.plafond });
    } else if (sorte === 'porteavions') {
      // le porte-avions arrive au large, puis lance des vagues d'avions sur la cible et son plus gros voisin
      const vagues = REGLES.porteAvionsVagues;
      for (let i = 0; i < vagues; i++) {
        this.plus(3 + i * 1.5, () => {
          if (!this.equipes.has(cible.code)) return;
          this.emit({ type: 'vagueAerienne', de: e.code, vers: cible.code, numero: i + 1, total: vagues });
          this.degats(cible, montant / vagues, opts);
          const voisin = PAR_CODE.get(cible.code).neighbors.map((v) => this.equipes.get(v)).filter((v) => v && v.code !== e.code).sort((a, b) => b.soldats - a.soldats)[0];
          if (voisin) this.degats(voisin, (montant / vagues) * REGLES.porteAvionsVoisin, { ...opts, plafond: opts.plafond / 2 });
        });
      }
    } else if (sorte === 'tsunami') {
      // la vague traverse la carte d'ouest en est à la hauteur de la cible
      const yCible = PAR_CODE.get(cible.code).center[1];
      const traverses = [...this.equipes.values()].filter((x) => x.code !== e.code && x.code !== cible.code && !PAR_CODE.get(x.code).overseas && Math.abs(PAR_CODE.get(x.code).center[1] - yCible) < 90);
      const xDe = (code) => (PAR_CODE.get(code).overseas ? 500 : PAR_CODE.get(code).center[0]);
      this.emit({ type: 'tsunami', y: yCible, cible: cible.code, traverses: traverses.map((x) => x.code) });
      this.plus(0.5 + (xDe(cible.code) / 1000) * 4, () => this.equipes.has(cible.code) && this.degats(cible, montant * REGLES.tsunamiPartCible, opts));
      const partTraverses = traverses.length ? (montant * (1 - REGLES.tsunamiPartCible)) / traverses.length : 0;
      for (const x of traverses) this.plus(0.5 + (xDe(x.code) / 1000) * 4, () => this.equipes.has(x.code) && this.degats(x, partTraverses, opts));
      if (!traverses.length) e.soldats += montant * (1 - REGLES.tsunamiPartCible) * REGLES.partButin;
    }
  }

  #helicos() {
    for (const h of this.helicos) {
      if (this.t < h.prochain) continue;
      h.prochain = this.t + REGLES.heliIntervalleSec;
      const cible = this.equipes.get(h.vers);
      const attaquant = this.equipes.get(h.de);
      if (!cible || !attaquant) continue;
      this.emit({ type: 'salve', de: h.de, vers: h.vers });
      this.degats(cible, h.salve, { plafond: h.plafond, attaquant, sorte: 'helicos', joueur: h.joueur });
    }
  }

  // ------------------------------------------------------------------ vagues et événements

  #vagues() {
    const ecoule = this.ecoule;
    for (const v of VAGUES) {
      const debut = v.minute * 60;
      if (this.vaguesFaites.has(v.id) || debut + VAGUE_DUREE_SEC > this.duree) continue;
      if (ecoule >= debut - VAGUE_PREAVIS_SEC) this.lancerVague(v.id, debut - ecoule);
    }
    const va = this.vague;
    if (va && !va.annonceDebut && this.t >= va.debut) {
      va.annonceDebut = true;
      this.emit({ type: 'vagueDebut', vague: va });
    }
    if (va && this.t >= va.fin) {
      this.emit({ type: 'vagueFin', vague: va });
      this.vague = null;
      this.prochainEvenement = Math.max(this.prochainEvenement, this.t + this.hasard(...EVENEMENTS.intervalleSec));
    }
  }

  /** Lance une vague (automatiquement, ou par la commande !vague). preavis en secondes. */
  lancerVague(id, preavis = VAGUE_PREAVIS_SEC) {
    const def = VAGUES.find((v) => v.id === id);
    if (!def || this.phase !== 'partie') return false;
    this.vaguesFaites.add(id);
    if (this.evenement) this.finirEvenement(false);
    const debut = this.t + Math.max(0, preavis);
    this.vague = { ...def, debut, fin: debut + VAGUE_DUREE_SEC, annonceDebut: false };
    this.emit({ type: 'vagueAnnonce', vague: this.vague, dans: Math.round(Math.max(0, preavis)) });
    return true;
  }

  #evenements() {
    const ev = this.evenement;
    if (ev) {
      if (ev.type === 'mission' && ev.progres >= ev.objectif) return this.finirEvenement(true);
      if (ev.type === 'prime') {
        const tete = this.equipes.get(ev.cible);
        const depasse = [...this.equipes.values()].find((x) => x.code !== ev.cible && x.soldats > (tete?.soldats ?? 0));
        if (depasse) return this.finirEvenement(depasse);
      }
      if (this.t >= ev.fin) this.finirEvenement(false);
      return;
    }
    if (this.vague || this.t < this.prochainEvenement || this.equipes.size === 0) return;
    this.lancerEvenement();
  }

  /** Lance un événement (au hasard, ou celui demandé par une commande). */
  lancerEvenement(type = null) {
    if (this.phase !== 'partie') return false;
    const cl = this.classement();
    const possibles = ['mission'];
    if (cl.length >= 2) possibles.push('revolution', 'duel', 'prime', 'invasion');
    const choix = type && possibles.includes(type) ? type : type ? null : this.choisir(possibles);
    if (!choix) return false;
    if (this.evenement) this.finirEvenement(false);
    const E = EVENEMENTS;
    if (choix === 'revolution') this.evenement = { type: choix, cible: cl[0].code, fin: this.t + E.revolution.dureeSec, duree: E.revolution.dureeSec };
    else if (choix === 'duel') this.evenement = { type: choix, a: cl[0].code, b: cl[1].code, scores: { [cl[0].code]: 0, [cl[1].code]: 0 }, fin: this.t + E.duel.dureeSec, duree: E.duel.dureeSec };
    else if (choix === 'prime') this.evenement = { type: choix, cible: cl[0].code, fin: this.t + E.prime.dureeSec, duree: E.prime.dureeSec };
    else if (choix === 'invasion') {
      // un département en occupe un autre (voisin si possible) : il touche 50 % de ses gains jusqu'à libération
      const libres = cl.filter((x) => !x.occupant);
      const occupant = this.choisir(cl.slice(0, Math.max(1, Math.ceil(cl.length / 2))));
      const voisins = libres.filter((x) => x.code !== occupant.code && PAR_CODE.get(occupant.code).neighbors.includes(x.code));
      const proies = voisins.length ? voisins : libres.filter((x) => x.code !== occupant.code && x.occupant !== occupant.code && occupant.occupant !== x.code);
      if (!proies.length) return false;
      const proie = this.choisir(proies);
      proie.occupant = occupant.code;
      this.emit({ type: 'occupation', occupant: occupant.code, equipe: proie.code });
      this.prochainEvenement = this.t + this.hasard(...E.intervalleSec);
      return true;
    } else {
      const regionsActives = [...new Set(cl.map((x) => x.region))].filter((r) => r !== 'Outre-mer');
      const toutes = [...new Set(DEPARTEMENTS.map((d) => d.region))].filter((r) => r !== 'Outre-mer');
      const region = this.choisir(regionsActives.length ? regionsActives : toutes);
      const n = Math.max(1, cl.filter((x) => x.region === region).length);
      const sorte = this.random() < 0.5 ? 'messages' : 'soldats';
      const objectif = sorte === 'messages' ? Math.max(5, E.mission.messagesParEquipe * n) : E.mission.soldatsParEquipe * n;
      this.evenement = { type: 'mission', region, sorte, objectif, progres: 0, participants: new Set(), fin: this.t + E.mission.dureeSec, duree: E.mission.dureeSec };
    }
    this.emit({ type: 'evenementDebut', evenement: this.evenement });
    return true;
  }

  finirEvenement(resultat) {
    const ev = this.evenement;
    if (!ev) return;
    this.evenement = null;
    const res = {};
    if (ev.type === 'duel') {
      const sa = ev.scores[ev.a];
      const sb = ev.scores[ev.b];
      const ea = this.equipes.get(ev.a);
      const eb = this.equipes.get(ev.b);
      if (sa !== sb && ea && eb) {
        const [g, p] = sa > sb ? [ea, eb] : [eb, ea];
        const vol = p.soldats * EVENEMENTS.duel.vol;
        p.soldats -= vol;
        g.soldats += vol;
        Object.assign(res, { gagnant: g.code, perdant: p.code, vol });
      }
    } else if (ev.type === 'mission' && resultat === true) {
      res.reussie = true;
      for (const code of ev.participants) {
        const e = this.equipes.get(code);
        if (e) e.soldats += EVENEMENTS.mission.prime;
      }
    } else if (ev.type === 'prime' && resultat && resultat.code) {
      resultat.soldats += EVENEMENTS.prime.prime;
      res.gagnant = resultat.code;
    }
    this.emit({ type: 'evenementFin', evenement: ev, resultat: res });
    this.prochainEvenement = this.t + this.hasard(...EVENEMENTS.intervalleSec);
  }

  #suivi() {
    const cl = this.classement();
    const premier = cl[0];
    if (premier && premier.code !== this.leader && premier.soldats > 0) {
      if (this.leader) this.emit({ type: 'depassement', equipe: premier.code, ancien: this.leader });
      this.leader = premier.code;
    }
    for (const m of [10, 5, 1]) {
      if (this.tempsRestant <= m * 60 && this.duree > m * 60 && !this.rappels.has(m)) {
        this.rappels.add(m);
        this.emit({ type: 'rappel', minutes: m });
      }
    }
  }

  // ------------------------------------------------------------------ ambiance : ravitaillements, bombardements, survols

  #ambiance() {
    if (!this.ambianceActive || this.t < this.prochaineAmbiance || this.equipes.size === 0) return;
    this.prochaineAmbiance = this.t + this.hasard(...REGLES.ambianceSec);
    const r = this.random();
    if (r < 0.55) this.ravitaillement();
    else if (r < 0.85 && this.equipes.size >= 2) this.bombardement();
    else this.emit({ type: 'ambiance', sorte: 'survol' });
  }

  /** Un avion cargo largue une caisse de ravitaillement sur un département (au hasard si non précisé). */
  ravitaillement(code = null) {
    const e = code ? this.equipes.get(code) : this.choisir([...this.equipes.values()]);
    if (!e) return false;
    this.emit({ type: 'ambiance', sorte: 'ravitaillement', equipe: e.code, soldats: REGLES.ravitaillementSoldats });
    this.plus(2.4, () => {
      if (!this.equipes.has(e.code)) return;
      const n = this.ajouter(e, REGLES.ravitaillementSoldats, null, 'ravitaillement', { brut: true });
      this.emit({ type: 'ravitaille', equipe: e.code, soldats: n });
    });
    return true;
  }

  /** Bombardement surprise sur le 1er du classement (le bouclier protège). */
  bombardement() {
    const cl = this.classement();
    const e = cl[0];
    if (!e || cl.length < 2) return false;
    this.emit({ type: 'ambiance', sorte: 'bombardement', equipe: e.code });
    this.plus(2.2, () => {
      if (!this.equipes.has(e.code)) return;
      this.degats(e, Math.max(5, e.soldats * REGLES.bombardementPart), { plafond: REGLES.bombardementPart, sorte: 'bombardement' });
    });
    return true;
  }

  // ------------------------------------------------------------------ commandes de l'animateur

  /** Commandes du tchat (hôte ou modérateur). Renvoie true si la commande est connue. */
  commande(nom, arg = '') {
    switch (nom) {
      case 'fin':
        this.terminer('commande');
        return true;
      case 'duree': {
        const m = Math.round(Number(String(arg).replace(',', '.')));
        if (!(m >= 1 && m <= 120)) return false;
        this.dureeMinutes = m;
        this.emit({ type: 'duree', minutes: m });
        return true;
      }
      case 'vague':
        return this.lancerVague({ doublon: 'doublon', pluie: 'pluie', triple: 'triple', 'triplé': 'triple', assaut: 'assaut' }[String(arg).toLowerCase()] || '', VAGUE_PREAVIS_SEC);
      case 'revolution':
      case 'duel':
      case 'prime':
      case 'invasion':
      case 'mission':
        return this.lancerEvenement(nom);
      case 'avion': {
        // largage gratuit sur le dernier du classement (rattrapage)
        const dernier = this.classement().at(-1);
        if (!dernier) return false;
        const n = this.ajouter(dernier, 20, null, 'prime', { brut: true });
        this.emit({ type: 'largage', equipe: dernier.code, soldats: n });
        return true;
      }
      case 'ravitaillement':
        return this.ravitaillement(this.equipes.has(String(arg)) ? String(arg) : null);
      case 'bombardement':
        return this.bombardement();
      case 'ambiance':
        this.ambianceActive = !this.ambianceActive;
        this.emit({ type: 'ambianceActive', actif: this.ambianceActive });
        return true;
      case 'fixe':
        this.messageFixe = String(arg).slice(0, 120) || null;
        return true;
      case 'efface':
        this.messageFixe = null;
        return true;
      case 'membres':
        for (const k of Object.keys(this.membres)) delete this.membres[k];
        for (const j of this.joueurs.values()) j.equipe = null;
        this.surMembres(this.membres);
        this.emit({ type: 'membresOublies' });
        return true;
      case 'reset':
        this.commande('membres');
        this.joueurs.clear();
        this.phase = 'attente';
        this.viderCarte();
        this.numero = 0;
        this.emit({ type: 'attente', reset: true });
        return true;
      default:
        return false;
    }
  }
}
