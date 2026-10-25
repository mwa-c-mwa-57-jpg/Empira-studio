// Banque de sons générés en direct avec la Web Audio API : aucun fichier nécessaire.
// Des fichiers MP3 perso peuvent remplacer ou compléter ces sons (config.json > sons.fichiersPerso).
(function () {
  'use strict';
  let ctx = null;
  let master = null;
  let bruit = null;
  let volume = 0.8;
  let fichiersPerso = {};

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    master.connect(comp).connect(ctx.destination);
    bruit = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = bruit.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function actif() { return ctx && ctx.state === 'running'; }
  function debloquer() { init(); if (ctx && ctx.state !== 'running') return ctx.resume(); return Promise.resolve(); }

  // ---------- Briques ----------
  function osc(type, freq, t0, duree, gainMax, dest, opts = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (opts.vers) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.vers), t0 + (opts.rampe || duree));
    if (opts.detune) o.detune.value = opts.detune;
    const a = opts.attaque || 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gainMax, t0 + a);
    if (opts.tenue) g.gain.setValueAtTime(gainMax, t0 + opts.tenue);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
    o.connect(g).connect(dest || master);
    o.start(t0);
    o.stop(t0 + duree + 0.05);
    return { o, g };
  }

  function souffle(t0, duree, gainMax, filtre, freq, q, dest, opts = {}) {
    const s = ctx.createBufferSource();
    s.buffer = bruit;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filtre;
    f.frequency.setValueAtTime(freq, t0);
    if (opts.vers) f.frequency.exponentialRampToValueAtTime(opts.vers, t0 + duree);
    f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gainMax, t0 + (opts.attaque || 0.003));
    if (opts.tenue) g.gain.setValueAtTime(gainMax, t0 + opts.tenue);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
    s.connect(f).connect(g).connect(dest || master);
    s.start(t0, Math.random());
    s.stop(t0 + duree + 0.05);
    return { s, f, g };
  }

  // ---------- Les sons ----------
  const SONS = {
    prout(t) {
      const duree = 0.55 + Math.random() * 0.6;
      const base = 70 + Math.random() * 40;
      const sortie = ctx.createGain();
      sortie.gain.value = 1;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(900, t);
      lp.frequency.exponentialRampToValueAtTime(300, t + duree);
      lp.Q.value = 6;
      lp.connect(sortie).connect(master);
      // Vibration des « lèvres » : modulation d'amplitude rapide et irrégulière
      const trem = ctx.createGain();
      trem.gain.value = 0.5;
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.setValueAtTime(22 + Math.random() * 10, t);
      lfo.frequency.linearRampToValueAtTime(14 + Math.random() * 8, t + duree);
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.45;
      lfo.connect(lfoG).connect(trem.gain);
      trem.connect(lp);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * 1.3, t);
      o.frequency.linearRampToValueAtTime(base, t + duree * 0.4);
      o.frequency.linearRampToValueAtTime(base * (0.6 + Math.random() * 0.3), t + duree);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9, t + 0.03);
      g.gain.setValueAtTime(0.8, t + duree * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
      o.connect(g).connect(trem);
      lfo.start(t); o.start(t);
      lfo.stop(t + duree + 0.1); o.stop(t + duree + 0.1);
      souffle(t, duree, 0.25, 'bandpass', 500, 2, lp, { tenue: duree * 0.6 });
      return duree;
    },
    klaxon(t) {
      const motif = [[0, 0.18], [0.24, 0.18], [0.48, 0.9]];
      for (const [d, l] of motif) {
        for (const f of [370, 466, 554]) osc('sawtooth', f, t + d, l, 0.18, master, { tenue: l - 0.06, attaque: 0.02, detune: Math.random() * 12 - 6 });
      }
      return 1.4;
    },
    applaudissements(t) {
      for (let i = 0; i < 90; i++) {
        const d = Math.random() * 2.6;
        const env = d < 0.3 ? d / 0.3 : d > 2 ? (2.6 - d) / 0.6 : 1;
        souffle(t + d, 0.05 + Math.random() * 0.04, 0.35 * env + 0.02, 'bandpass', 1200 + Math.random() * 1800, 1.5);
      }
      return 2.7;
    },
    tambour(t) {
      const duree = 1.9;
      for (let x = 0; x < duree; x += 0.055) {
        souffle(t + x, 0.07, 0.12 + 0.3 * (x / duree), 'bandpass', 1800, 0.8);
        osc('triangle', 180, t + x, 0.06, 0.08 + 0.12 * (x / duree));
      }
      souffle(t + duree, 1.6, 0.6, 'highpass', 5000, 0.5);
      osc('sine', 60, t + duree, 0.5, 0.7, master, { vers: 40 });
      return duree + 1.6;
    },
    badumtss(t) {
      osc('sine', 160, t, 0.25, 0.8, master, { vers: 90 });
      souffle(t, 0.12, 0.3, 'bandpass', 1500, 1);
      osc('sine', 120, t + 0.18, 0.3, 0.8, master, { vers: 65 });
      osc('sine', 60, t + 0.42, 0.4, 0.8, master, { vers: 40 });
      souffle(t + 0.42, 1.3, 0.5, 'highpass', 6000, 0.7);
      return 1.8;
    },
    caisse(t) {
      souffle(t, 0.12, 0.4, 'bandpass', 3000, 3);
      souffle(t + 0.08, 0.1, 0.3, 'bandpass', 4000, 3);
      for (const f of [2093, 2637, 3136]) osc('sine', f, t + 0.15, 1.3, 0.22);
      osc('triangle', 4186, t + 0.15, 0.6, 0.08);
      return 1.5;
    },
    ding(t) {
      osc('sine', 1318, t, 1.4, 0.5);
      osc('sine', 2637, t, 0.8, 0.12);
      return 1.4;
    },
    echec(t) {
      const notes = [[392, 0, 0.45], [370, 0.5, 0.45], [349, 1.0, 0.45], [330, 1.5, 1.3]];
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 3;
      lp.connect(master);
      for (const [f, d, l] of notes) {
        const { o } = osc('sawtooth', f, t + d, l, 0.3, lp, { tenue: l - 0.1, attaque: 0.04 });
        if (l > 1) {
          const v = ctx.createOscillator(); const vg = ctx.createGain();
          v.frequency.value = 6; vg.gain.value = 9;
          v.connect(vg).connect(o.frequency); v.start(t + d); v.stop(t + d + l);
        }
      }
      return 2.9;
    },
    laser(t) {
      osc('square', 1800, t, 0.35, 0.18, master, { vers: 90 });
      osc('sawtooth', 1200, t + 0.02, 0.33, 0.1, master, { vers: 60 });
      return 0.4;
    },
    fanfare(t) {
      const seq = [[523, 0, 0.14], [659, 0.15, 0.14], [784, 0.3, 0.14], [1047, 0.45, 0.9]];
      for (const [f, d, l] of seq) {
        osc('sawtooth', f, t + d, l, 0.16, master, { tenue: l - 0.08, attaque: 0.02 });
        osc('square', f * 2, t + d, l, 0.04, master, { tenue: l - 0.08, attaque: 0.02 });
      }
      for (const f of [523, 659, 784]) osc('sawtooth', f, t + 0.45, 1.0, 0.07, master, { tenue: 0.7, attaque: 0.03 });
      return 1.5;
    },
    victoire(t) {
      const seq = [659, 784, 988, 1319];
      seq.forEach((f, i) => osc('triangle', f, t + i * 0.09, 0.35, 0.35));
      osc('sine', 1568, t + 0.4, 0.9, 0.3);
      return 1.3;
    },
    toctoc(t) {
      for (let i = 0; i < 3; i++) {
        const d = t + i * 0.22;
        osc('sine', 190, d, 0.12, 0.9, master, { vers: 120 });
        souffle(d, 0.06, 0.5, 'lowpass', 900, 1);
      }
      return 0.8;
    },
    ciseaux(t) {
      for (const d of [0, 0.18]) {
        souffle(t + d, 0.05, 0.6, 'highpass', 5000, 1);
        osc('square', 3200, t + d, 0.03, 0.1);
      }
      return 0.4;
    },
    chute(t) {
      osc('sine', 1400, t, 1.4, 0.35, master, { vers: 180, tenue: 1.1 });
      return 1.5;
    },
    boing(t) {
      const { o } = osc('sine', 180, t, 0.6, 0.6, master, { vers: 520, rampe: 0.12 });
      const v = ctx.createOscillator(); const vg = ctx.createGain();
      v.frequency.value = 18; vg.gain.value = 40;
      v.connect(vg).connect(o.frequency); v.start(t); v.stop(t + 0.6);
      return 0.6;
    },
    pop(t) {
      osc('sine', 500, t, 0.12, 0.5, master, { vers: 1100, rampe: 0.06 });
      return 0.15;
    },
    whoosh(t) {
      souffle(t, 0.9, 0.5, 'bandpass', 300, 2, master, { vers: 3000, attaque: 0.3 });
      return 0.9;
    },
    vent(t) {
      souffle(t, 3, 0.35, 'bandpass', 400, 3, master, { vers: 1200, attaque: 0.8, tenue: 2 });
      souffle(t + 0.5, 2.4, 0.2, 'bandpass', 900, 4, master, { vers: 500, attaque: 0.6 });
      return 3;
    },
    bisou(t) {
      osc('sine', 900, t, 0.08, 0.5, master, { vers: 2400, rampe: 0.06 });
      souffle(t + 0.05, 0.06, 0.3, 'highpass', 3000, 1);
      return 0.2;
    },
    coeurs(t) {
      [1047, 1319, 1568, 2093].forEach((f, i) => osc('sine', f, t + i * 0.07, 0.4, 0.2));
      return 0.7;
    },
    alarme(t) {
      for (let i = 0; i < 4; i++) osc('square', i % 2 ? 660 : 880, t + i * 0.25, 0.22, 0.2, master, { tenue: 0.18 });
      return 1;
    },
    tonnerre(t) {
      souffle(t, 2.2, 0.8, 'lowpass', 400, 1, master, { vers: 80, attaque: 0.05 });
      osc('sine', 50, t, 1.5, 0.6, master, { vers: 30 });
      return 2.2;
    }
  };

  function jouer(nom) {
    if (fichiersPerso[nom]) {
      const a = new Audio(fichiersPerso[nom]);
      a.volume = volume;
      a.play().catch(() => {});
      return 1;
    }
    if (!init() || !SONS[nom]) return 0;
    if (ctx.state !== 'running') ctx.resume();
    return SONS[nom](ctx.currentTime + 0.02);
  }

  // Charabia façon « Animal Crossing » : une syllabe par groupe de lettres.
  function charabia(texte, opts = {}) {
    if (!init()) return 0;
    if (ctx.state !== 'running') ctx.resume();
    const nb = Math.max(2, Math.min(18, Math.ceil(String(texte).replace(/\s+/g, '').length / 3.5)));
    const base = opts.hauteur || 520;
    const excite = /[!]{1,}|[A-Z]{4,}/.test(texte);
    const pas = opts.pas || (excite ? 0.075 : 0.095);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.9;
    bp.connect(master);
    let t = ctx.currentTime + 0.02;
    for (let i = 0; i < nb; i++) {
      const f = base * (excite ? 1.15 : 1) * (0.8 + Math.random() * 0.45);
      const l = pas * (0.7 + Math.random() * 0.5);
      osc('square', f, t, l, 0.16, bp, { vers: f * (Math.random() < 0.5 ? 1.12 : 0.9), attaque: 0.01 });
      osc('triangle', f / 2, t, l, 0.2, master, { attaque: 0.01 });
      t += l + 0.015;
    }
    return t - ctx.currentTime;
  }

  window.Sons = {
    init, debloquer, actif, jouer, charabia,
    liste: Object.keys(SONS),
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    setFichiersPerso(f) { fichiersPerso = f || {}; }
  };
})();
