'use strict';
// Faux spectateurs pour tester l'overlay sans être en live.
// Utilisé UNIQUEMENT en mode démo : le serveur refuse de les lancer en mode live.

const PSEUDOS = [
  'sarah.lmn', 'karim_92', 'lea.dance', 'tom_gamer', 'ines.music', 'yanis_off', 'chloe.b',
  'mehdi.lol', 'camille_rz', 'nathan.k', 'julie_ptt', 'samy.fr', 'emma.vlog', 'hugo_x',
  'lina.sun', 'adam.prod', 'manon.mtl', 'rayan_fit', 'zoe.art', 'leo.memes'
];
const MESSAGES = [
  'allez gégé !!', 'il va tomber mdr', '!prout', 'on y croit', 'tape tape tape', 'trop drôle 😂',
  '!klaxon', 'vas y monte', 'je tape à fond', 'nooon il glisse', 'bravo !!', '!applause',
  'premier !', 'coucou', 'le pigeon 😭', 'go go go', '!badum', 'il est trop mignon'
];

// Photos de profil de démo (illustrations générées avec Canva) pour voir le rendu des classements
const AVATARS = new Set(['sarah.lmn', 'karim_92', 'ines.music', 'yanis_off', 'lea.dance', 'tom_gamer']);
function avatarDemo(pseudo) {
  return AVATARS.has(pseudo) ? `demo/${pseudo}.jpg` : '';
}

class Bots {
  constructor(jeu, objectifs, random = Math.random) {
    this.jeu = jeu;
    this.objectifs = objectifs;
    this.random = random;
    this.timers = new Set();
    this.actif = false;
  }

  plus(fn, ms) {
    const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms);
    this.timers.add(id);
  }

  user() {
    const p = PSEUDOS[Math.floor(this.random() * PSEUDOS.length)];
    return { id: 'demo-' + p, pseudo: p, nom: p.replace(/[._]/g, ' '), avatar: avatarDemo(p) };
  }

  boucle(fn, min, max) {
    const go = () => {
      if (!this.actif) return;
      fn();
      this.plus(go, min + this.random() * (max - min));
    };
    this.plus(go, min);
  }

  demarrer() {
    if (this.actif) return;
    this.actif = true;
    const t0 = Date.now();
    // Les taps arrivent par vagues, avec des creux pour voir les glissades.
    this.boucle(() => {
      const vague = (Math.sin((Date.now() - t0) / 18000) + 1) / 2;
      if (this.random() < vague * 0.9) this.jeu.onLike({ user: this.user(), nombre: 1 + Math.floor(this.random() * 15) });
    }, 250, 400);
    this.boucle(() => {
      const mj = this.jeu.miniJeu;
      let texte = MESSAGES[Math.floor(this.random() * MESSAGES.length)];
      if (mj && mj.type === 'vote') texte = this.random() < 0.6 ? 'aide' : 'piège';
      if (mj && mj.type === 'mot' && this.random() < 0.25) texte = 'euh ' + mj.mot + ' !';
      this.jeu.onChat({ user: this.user(), texte });
    }, 2500, 7000);
    this.boucle(() => this.jeu.onArrivee({ user: this.user() }), 2000, 6000);
    this.boucle(() => {
      const r = this.random();
      const i = r < 0.55 ? Math.floor(this.random() * 4) : r < 0.85 ? 4 + Math.floor(this.random() * 4) : r < 0.97 ? 8 + Math.floor(this.random() * 4) : 12 + Math.floor(this.random() * 3);
      this.simulerCadeau(this.user(), i, 1 + (i < 3 && this.random() < 0.4 ? Math.floor(this.random() * 8) : 0));
    }, 9000, 22000);
    this.boucle(() => this.jeu[this.random() < 0.7 ? 'onAbonne' : 'onPartage']({ user: this.user() }), 15000, 40000);
    // De temps en temps, un saboteur (surtout des petits)
    this.boucle(() => this.simulerSabotage(this.user(), this.random() < 0.6 ? 0 : this.random() < 0.85 ? 1 : 2), 40000, 90000);
  }

  // Envoie un cadeau saboteur (config.json > saboteurs)
  simulerSabotage(user, index) {
    const liste = this.jeu.saboteurs;
    if (!liste.length) return;
    const s = liste[Math.max(0, Math.min(liste.length - 1, index))];
    this.jeu.onCadeau({ user, nom: s.nom, pieces: s.pieces, image: s.image, giftType: 2, repeatCount: 1, repeatEnd: true });
  }

  // Envoie un cadeau de la liste ; les petits cadeaux en série imitent les combos TikTok.
  simulerCadeau(user, index, repeat = 1) {
    const o = this.objectifs[Math.max(0, Math.min(this.objectifs.length - 1, index))];
    const base = { user, nom: o.nom, pieces: o.pieces, image: o.image };
    if (repeat > 1 && o.pieces < 30) {
      for (let k = 1; k <= repeat; k++) {
        const fin = k === repeat;
        this.plus(() => this.jeu.onCadeau(Object.assign({}, base, { giftType: 1, repeatCount: k, repeatEnd: false })), k * 300);
        if (fin) this.plus(() => this.jeu.onCadeau(Object.assign({}, base, { giftType: 1, repeatCount: k, repeatEnd: true })), k * 300 + 1200);
      }
    } else {
      this.jeu.onCadeau(Object.assign({}, base, { giftType: 2, repeatCount: 1, repeatEnd: true }));
    }
  }

  arreter() {
    this.actif = false;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }
}

module.exports = { Bots, avatarDemo };
