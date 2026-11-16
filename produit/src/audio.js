// Bruitages générés en Web Audio (aucun fichier) et musique du dossier « musique ».

export class Bruitages {
  constructor() {
    this.actif = true;
    this.ctx = null;
  }

  #ac() {
    if (!this.ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.maitre = this.ctx.createGain();
      this.maitre.gain.value = 0.6;
      this.maitre.connect(this.ctx.destination);
      const n = this.ctx.sampleRate * 2;
      this.bruitBuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = this.bruitBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  #env(g, t, attaque, duree, pic = 1) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(pic, t + attaque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  }

  #bruit(t, duree, { filtre = 'lowpass', f0 = 1000, f1 = f0, q = 1, pic = 0.6, attaque = 0.01 } = {}) {
    const ac = this.ctx;
    const s = ac.createBufferSource();
    s.buffer = this.bruitBuf;
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = filtre;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + duree);
    const g = ac.createGain();
    this.#env(g, t, attaque, duree, pic);
    s.connect(f).connect(g).connect(this.maitre);
    s.start(t);
    s.stop(t + duree + 0.05);
  }

  #ton(t, duree, { type = 'sine', f0 = 440, f1 = f0, pic = 0.3, attaque = 0.01 } = {}) {
    const ac = this.ctx;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + duree);
    const g = ac.createGain();
    this.#env(g, t, attaque, duree, pic);
    o.connect(g).connect(this.maitre);
    o.start(t);
    o.stop(t + duree + 0.05);
  }

  jouer(nom) {
    if (!this.actif) return;
    const ac = this.#ac();
    if (!ac) return;
    const t = ac.currentTime + 0.02;
    const r = Math.random;
    switch (nom) {
      case 'explosion':
        this.#bruit(t, 1.3, { f0: 1400, f1: 70, pic: 0.9 });
        this.#ton(t, 0.8, { f0: 90, f1: 35, pic: 0.6 });
        break;
      case 'nucleaire':
        this.#bruit(t, 3.5, { f0: 900, f1: 40, pic: 1, attaque: 0.05 });
        this.#ton(t, 2.5, { f0: 60, f1: 25, pic: 0.8 });
        break;
      case 'sifflet':
        this.#ton(t, 2.4, { f0: 1500, f1: 280, pic: 0.18 });
        break;
      case 'canon':
        this.#bruit(t, 0.5, { f0: 800, f1: 60, pic: 0.8 });
        this.#ton(t, 0.3, { f0: 120, f1: 40, pic: 0.5 });
        break;
      case 'rafale':
      case 'mitrailleuse':
        for (let i = 0; i < (nom === 'rafale' ? 6 : 14); i++) this.#bruit(t + i * 0.07, 0.05, { filtre: 'bandpass', f0: 1800, q: 2, pic: 0.5, attaque: 0.002 });
        break;
      case 'sirene':
        for (let i = 0; i < 2; i++) {
          this.#ton(t + i * 2, 1, { type: 'sawtooth', f0: 520, f1: 900, pic: 0.12 });
          this.#ton(t + i * 2 + 1, 1, { type: 'sawtooth', f0: 900, f1: 520, pic: 0.12 });
        }
        break;
      case 'avion':
        this.#ton(t, 3, { type: 'sawtooth', f0: 85, f1: 95, pic: 0.12, attaque: 1 });
        this.#bruit(t, 3, { f0: 500, f1: 900, pic: 0.15, attaque: 1 });
        break;
      case 'chasseur':
        this.#bruit(t, 1.6, { filtre: 'bandpass', f0: 600, f1: 3000, q: 0.8, pic: 0.45, attaque: 0.4 });
        break;
      case 'helico':
        for (let i = 0; i < 24; i++) this.#bruit(t + i * 0.085, 0.07, { f0: 300, pic: 0.35, attaque: 0.01 });
        break;
      case 'vague':
        this.#bruit(t, 4.2, { f0: 200, f1: 2500, pic: 0.6, attaque: 1.6 });
        break;
      case 'missile':
        this.#bruit(t, 1.2, { filtre: 'bandpass', f0: 400, f1: 3500, q: 1.5, pic: 0.35, attaque: 0.1 });
        break;
      case 'carillon':
        this.#ton(t, 0.9, { f0: 1318, pic: 0.15 });
        this.#ton(t + 0.12, 1.1, { f0: 1760, pic: 0.12 });
        break;
      case 'clairon':
        [523, 659, 784, 1046].forEach((f, i) => this.#ton(t + i * 0.16, 0.22, { type: 'square', f0: f, pic: 0.09 }));
        break;
      case 'tambour':
        for (let i = 0; i < 20; i++) this.#bruit(t + i * 0.06, 0.06, { filtre: 'bandpass', f0: 220, q: 1.2, pic: 0.15 + i * 0.02 });
        break;
      case 'hourra':
        for (let i = 0; i < 8; i++) this.#bruit(t + r() * 0.4, 1.2 + r() * 0.6, { filtre: 'bandpass', f0: 500 + r() * 700, f1: 700 + r() * 900, q: 4, pic: 0.18, attaque: 0.15 });
        break;
      case 'tension':
        this.#ton(t, 3, { type: 'sawtooth', f0: 180, f1: 820, pic: 0.08, attaque: 0.5 });
        this.#bruit(t, 3, { f0: 300, f1: 4000, pic: 0.2, attaque: 2 });
        break;
      case 'bataille':
        for (let i = 0; i < 4; i++) this.#bruit(t + r() * 3, 1, { f0: 400, f1: 80, pic: 0.12 });
        break;
      default:
        break;
    }
  }
}

export class Musique {
  constructor() {
    this.audio = typeof Audio !== 'undefined' ? new Audio() : null;
    this.liste = [];
    this.actif = true;
    this.volume = 0.35;
    if (this.audio) {
      this.audio.volume = this.volume;
      this.audio.addEventListener('ended', () => this.suivant());
      this.audio.addEventListener('error', () => setTimeout(() => this.suivant(), 1000));
    }
  }

  async charger() {
    try {
      const r = await fetch('/musiques', { cache: 'no-store' });
      const l = await r.json();
      this.liste = Array.isArray(l) ? l.filter((x) => typeof x === 'string') : [];
    } catch {
      this.liste = [];
    }
    if (this.liste.length && this.actif) this.suivant();
    return this.liste.length;
  }

  suivant() {
    if (!this.audio || !this.liste.length || !this.actif) return;
    this.audio.src = this.liste[Math.floor(Math.random() * this.liste.length)];
    this.audio.play().catch(() => {});
  }

  basculer() {
    this.actif = !this.actif;
    if (!this.audio) return;
    if (this.actif) this.suivant();
    else this.audio.pause();
  }

  /** Baisse le volume pendant que la voix parle. */
  baisser(ms) {
    if (!this.audio) return;
    this.audio.volume = this.volume * 0.3;
    clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => (this.audio.volume = this.volume), ms + 300);
  }
}
