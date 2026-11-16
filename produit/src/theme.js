// Personnalisation : couleurs des départements, des unités et des contours, choisies sur la page de démarrage
// et transmises par l'adresse (TikTok LIVE Studio ne partage pas le stockage du navigateur).

import { PALETTE, CONTOURS, UNITES, MOTS_INTERDITS } from './config.js';
import { createRng } from '../../public/src/core/rng.js';
import { normalizeKeyword } from '../../public/src/core/events.js';

/** Lit les réglages de l'adresse : ?couleurs=aleatoire|fixe|perso&graine=..&palette=..&unites=..&contours=..&voix=.. */
export function lireReglages(search = '') {
  const p = new URLSearchParams(search);
  const val = (k, permis, defaut) => (permis.includes(p.get(k)) ? p.get(k) : defaut);
  return {
    couleurs: val('couleurs', ['aleatoire', 'fixe', 'perso'], 'aleatoire'),
    graine: Number.parseInt(p.get('graine'), 10) || null,
    palette: (p.get('palette') || '').split(',').map((c) => c.trim().replace(/^#?/, '#')).filter((c) => /^#[0-9a-f]{6}$/i.test(c)),
    unites: val('unites', ['departement', 'bleu', 'vert', 'rouge', 'aleatoire'], 'departement'),
    contours: val('contours', ['or', 'bleu', 'vert', 'rouge', 'violet', 'aleatoire'], 'or'),
    voix: val('voix', ['homme', 'femme'], 'femme'),
    nomVoix: (p.get('nomvoix') || '').slice(0, 80),
    hote: (p.get('hote') || '').replace(/^@/, '').slice(0, 40),
    tikfinity: /^ws:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(p.get('tikfinity') || '') ? p.get('tikfinity') : null,
    // source des événements : connexion directe par le serveur du jeu (par défaut) ou TikFinity (secours)
    source: p.get('source') === 'tikfinity' || p.get('tikfinity') ? 'tikfinity' : 'direct',
  };
}

export class Theme {
  constructor(reglages, random = Math.random) {
    const graine = reglages.couleurs === 'fixe' && reglages.graine ? reglages.graine : Math.floor(random() * 2 ** 31);
    const rng = createRng(graine);
    this.graine = graine;
    const base = reglages.couleurs === 'perso' && reglages.palette.length >= 4 ? reglages.palette : PALETTE;
    // mélange de Fisher-Yates : chaque lancement (ou chaque graine) donne un autre tirage
    this.palette = [...base];
    for (let i = this.palette.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [this.palette[i], this.palette[j]] = [this.palette[j], this.palette[i]];
    }
    const hasard = (o) => o[Object.keys(o)[Math.floor(rng() * Object.keys(o).length)]];
    this.contour = reglages.contours === 'aleatoire' ? hasard(CONTOURS) : CONTOURS[reglages.contours];
    this.unitesFixes = reglages.unites === 'departement' ? null : reglages.unites === 'aleatoire' ? hasard(UNITES) : UNITES[reglages.unites];
    this.attribuees = new Map();
  }

  couleur(code) {
    let c = this.attribuees.get(code);
    if (!c) {
      c = this.palette[this.attribuees.size % this.palette.length];
      this.attribuees.set(code, c);
    }
    return c;
  }

  couleurUnites(code) {
    return this.unitesFixes || this.couleur(code);
  }

  /** Nouvelle partie : les couleurs sont réattribuées dans l'ordre d'arrivée. */
  reinitialiser() {
    this.attribuees.clear();
  }
}

/** Pseudo affichable et prononçable : les mots interdits sont masqués. */
export function pseudoPropre(nom) {
  const brut = String(nom || '').normalize('NFC');
  const norm = normalizeKeyword(brut);
  const mots = norm.split(' ');
  const interdit = MOTS_INTERDITS.some((m) => {
    const k = normalizeKeyword(m);
    return k.length <= 3 ? mots.includes(k) : norm.replace(/ /g, '').includes(k.replace(/ /g, ''));
  });
  return interdit ? 'Un soldat' : brut.replace(/[\u0000-\u001f]/g, '').slice(0, 24) || 'Un soldat';
}
