// Photos de profil des joueurs (adresse fournie par TikFinity) avec initiale colorée en repli,
// images réelles des cadeaux et logo Empira (images/logo-empira.png s'il est présent).

import { safeImageUrl } from '../../public/src/core/events.js';

export class Photos {
  constructor() {
    this.images = new Map();
    this.repli = new Map();
    this.logo = null;
    this.cadeaux = new Map(); // nom ou identifiant de cadeau → adresse de son image
    const logo = new Image();
    logo.onload = () => (this.logo = logo);
    logo.src = 'images/logo-empira.png';
  }

  #charger(url) {
    let e = this.images.get(url);
    if (!e) {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      e = { img, ok: false };
      img.onload = () => (e.ok = true);
      img.src = url;
      this.images.set(url, e);
      if (this.images.size > 800) this.images.delete(this.images.keys().next().value);
    }
    return e.ok ? e.img : null;
  }

  /** Photo chargée du joueur, ou null (pas d'adresse, ou chargement en cours / en échec). */
  image(joueur) {
    const url = joueur && safeImageUrl(joueur.avatar);
    return url ? this.#charger(url) : null;
  }

  imageAdresse(url) {
    const u = safeImageUrl(url);
    return u ? this.#charger(u) : null;
  }

  initiales(joueur) {
    const cle = joueur?.id ?? '?';
    let c = this.repli.get(cle);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 96;
      const g = c.getContext('2d');
      const teinte = [...String(cle)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 11);
      const grad = g.createLinearGradient(0, 0, 96, 96);
      grad.addColorStop(0, `hsl(${teinte},70%,55%)`);
      grad.addColorStop(1, `hsl(${(teinte + 50) % 360},70%,33%)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 96, 96);
      g.fillStyle = '#fff';
      g.font = "800 46px 'Segoe UI', system-ui, sans-serif";
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText((joueur?.nom || '?').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1).toUpperCase() || '?', 48, 52);
      this.repli.set(cle, c);
      if (this.repli.size > 800) this.repli.delete(this.repli.keys().next().value);
    }
    return c;
  }

  apprendreCadeau(cadeau) {
    const url = safeImageUrl(cadeau?.image);
    if (!url) return;
    if (cadeau.id) this.cadeaux.set(`id:${cadeau.id}`, url);
    if (cadeau.name) this.cadeaux.set(`nom:${String(cadeau.name).toLowerCase()}`, url);
  }

  /** Adresse de l'image réelle d'un cadeau du catalogue, si TikFinity l'a déjà envoyée. */
  adresseCadeau(def) {
    for (const id of def.ids || []) if (this.cadeaux.has(`id:${id}`)) return this.cadeaux.get(`id:${id}`);
    for (const n of def.noms) if (this.cadeaux.has(`nom:${n.toLowerCase()}`)) return this.cadeaux.get(`nom:${n.toLowerCase()}`);
    return null;
  }
}
