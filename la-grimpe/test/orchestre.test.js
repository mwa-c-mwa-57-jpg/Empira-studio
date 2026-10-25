'use strict';
// Tests du chef d'orchestre des sons : node test/orchestre.test.js
// Horloge simulée : on vérifie qu'aucun son ne se superpose, quelles que soient les combinaisons.
const assert = require('assert');
const { creerOrchestre, RAISONS, ECART_POUR_COUPER } = require('../public/js/orchestre');

// Durées réelles (en secondes) des sons de public/js/sons.js
const DUREES = {
  prout: 1.1, klaxon: 1.4, applaudissements: 2.7, tambour: 3.5, badumtss: 1.8, caisse: 1.5, ding: 1.4, echec: 2.9,
  laser: 0.4, fanfare: 1.5, victoire: 1.3, toctoc: 0.8, ciseaux: 0.4, chute: 1.5, boing: 0.6, pop: 0.15, whoosh: 0.9,
  vent: 3, bisou: 0.2, coeurs: 0.7, alarme: 1, tonnerre: 2.2, coffre: 2.3
};

function monde() {
  let t = 0, id = 0;
  let taches = [];
  const journal = [];
  let attenuation = 1;
  const historiqueAttenuation = [];
  const o = creerOrchestre({
    maintenant: () => t,
    planifier: (fn, ms) => { const x = { id: ++id, quand: t + ms, fn }; taches.push(x); return x.id; },
    annuler: i => { taches = taches.filter(x => x.id !== i); },
    jouerEffet: nom => ({ duree: DUREES[nom] || 1, arreter: () => {} }),
    jouerVoix: texte => ({ duree: Math.min(3, texte.length / 12), arreter: () => {} }),
    attenuer: v => { attenuation = v; historiqueAttenuation.push([t, v]); },
    journal: e => journal.push(e)
  });
  function avancer(ms) {
    const fin = t + ms;
    for (;;) {
      taches.sort((a, b) => a.quand - b.quand || a.id - b.id);
      const x = taches[0];
      if (!x || x.quand > fin) break;
      taches.shift();
      t = x.quand;
      x.fn();
    }
    t = fin;
  }
  return { o, journal, avancer, temps: () => t, attenuation: () => attenuation, historiqueAttenuation };
}

// Intervalles réellement joués (fin raccourcie si le son a été coupé)
function intervalles(journal, type = 'effet') {
  const joues = [];
  for (const e of journal) {
    if (e.type !== type) continue;
    if (e.statut === 'joue') joues.push({ nom: e.nom || e.texte, raison: e.raison, debut: e.debut, fin: e.fin });
    if (e.statut === 'coupe') {
      const x = joues.slice().reverse().find(j => (j.nom === (e.nom || e.texte)) && j.fin > e.debut);
      if (x) x.fin = e.debut;
    }
  }
  return joues;
}
function aucunChevauchement(journal, type) {
  const iv = intervalles(journal, type).sort((a, b) => a.debut - b.debut);
  for (let i = 1; i < iv.length; i++) {
    assert.ok(iv[i].debut >= iv[i - 1].fin - 1e-6, `chevauchement : ${iv[i - 1].nom} (${iv[i - 1].debut}-${iv[i - 1].fin}) et ${iv[i].nom} (${iv[i].debut})`);
  }
  return iv;
}

const tests = {
  'un son seul se joue tout de suite'() {
    const m = monde();
    m.o.effet('coffre', 'coffre');
    assert.strictEqual(intervalles(m.journal)[0].debut, 0);
  },
  'une rafale de 20 commandes !prout : 1 joué, 1 en attente, les autres ignorés'() {
    const m = monde();
    for (let i = 0; i < 20; i++) { m.o.effet('prout', 'chat'); m.o.effet('klaxon', 'chat'); m.avancer(50); }
    m.avancer(10000);
    const iv = aucunChevauchement(m.journal);
    assert.ok(iv.length <= 2, iv.map(x => x.nom).join(','));
  },
  'le coffre coupe un prout du chat (beaucoup plus important)'() {
    const m = monde();
    m.o.effet('prout', 'chat');
    m.avancer(200);
    m.o.effet('coffre', 'coffre');
    assert.ok(m.journal.some(e => e.statut === 'coupe' && e.nom === 'prout'));
    assert.strictEqual(intervalles(m.journal).find(x => x.nom === 'coffre').debut, 200);
    aucunChevauchement(m.journal);
  },
  'l\'applaudissement attend la fin du coffre au lieu de le couper'() {
    const m = monde();
    m.o.effet('coffre', 'coffre');
    m.avancer(500);
    m.o.effet('applaudissements', 'merci');
    m.avancer(10000);
    const iv = aucunChevauchement(m.journal);
    assert.deepStrictEqual(iv.map(x => x.nom), ['coffre', 'applaudissements']);
  },
  'la soundboard de l\'animateur passe toujours immédiatement'() {
    const m = monde();
    m.o.effet('coffre', 'coffre');
    m.avancer(300);
    m.o.effet('badumtss', 'regie');
    const b = intervalles(m.journal).find(x => x.nom === 'badumtss');
    assert.strictEqual(b.debut, 300);
    aucunChevauchement(m.journal);
  },
  'l\'animateur peut relancer le même son en rappuyant'() {
    const m = monde();
    m.o.effet('prout', 'regie');
    m.avancer(300);
    m.o.effet('prout', 'regie');
    const joues = intervalles(m.journal).filter(x => x.nom === 'prout');
    assert.strictEqual(joues.length, 2);
    assert.strictEqual(joues[1].debut, 300);
    aucunChevauchement(m.journal);
  },
  'en attente, le plus important passe en premier'() {
    const m = monde();
    m.o.effet('tambour', 'miniJeu');
    m.avancer(100);
    m.o.effet('pop', 'social');
    m.o.effet('coeurs', 'palier');
    m.o.effet('applaudissements', 'rafale');
    m.avancer(20000);
    const ordre = aucunChevauchement(m.journal).map(x => x.nom);
    assert.deepStrictEqual(ordre.slice(0, 2), ['tambour', 'applaudissements']);
  },
  'un son trop vieux dans la file est abandonné'() {
    const m = monde();
    m.o.effet('tambour', 'miniJeu'); // 3,5 s
    m.o.effet('pop', 'social'); // ne peut attendre que 1,5 s
    m.avancer(10000);
    assert.ok(m.journal.some(e => e.statut === 'expire' && e.nom === 'pop'));
    assert.ok(!intervalles(m.journal).some(x => x.nom === 'pop'));
  },
  'le tonnerre d\'ambiance ne dérange jamais rien'() {
    const m = monde();
    m.o.effet('applaudissements', 'rafale');
    m.o.effet('tonnerre', 'ambiance');
    m.avancer(10000);
    assert.ok(!intervalles(m.journal).some(x => x.nom === 'tonnerre'));
  },
  'les doublons sont ignorés'() {
    const m = monde();
    m.o.effet('applaudissements', 'merci');
    m.o.effet('applaudissements', 'merci');
    m.o.effet('applaudissements', 'merci');
    m.avancer(10000);
    assert.strictEqual(intervalles(m.journal).length, 1);
  },
  'une seule voix à la fois, la plus importante gagne'() {
    const m = monde();
    m.o.parler('Merci @lea !', 2);
    m.avancer(100);
    assert.ok(!m.o.parler('Bonjour', 1));
    assert.ok(m.o.parler('MERCI MERCI BEAUCOUP !!!', 5));
    m.avancer(10000);
    aucunChevauchement(m.journal, 'voix');
  },
  'les effets baissent pendant que la mascotte parle, puis remontent'() {
    const m = monde();
    m.o.effet('applaudissements', 'merci');
    m.o.parler('MERCI MERCI BEAUCOUP @sarah !!!', 5);
    assert.ok(m.attenuation() < 1);
    m.avancer(10000);
    assert.strictEqual(m.attenuation(), 1);
  },
  'toutes les paires de raisons, à tous les décalages : jamais de superposition'() {
    const raisons = Object.keys(RAISONS);
    const sonDe = r => ({ regie: 'prout', chat: 'klaxon', coffre: 'coffre', merci: 'applaudissements', merciGros: 'applaudissements', rafale: 'applaudissements', danger: 'alarme', miniJeu: 'tambour', appel: 'toctoc', chef: 'ciseaux', scene: 'boing', palier: 'coeurs', bisou: 'bisou', social: 'ding', ambiance: 'tonnerre', fin: 'fanfare', sommet: 'fanfare', record: 'victoire' }[r] || 'pop');
    let n = 0;
    for (const a of raisons) for (const b of raisons) for (const dec of [0, 100, 700, 1500, 3000]) {
      const m = monde();
      m.o.effet(sonDe(a), a);
      m.avancer(dec);
      const t = m.temps();
      m.o.effet(sonDe(b), b);
      m.avancer(20000);
      const iv = aucunChevauchement(m.journal);
      // b de priorité nettement supérieure (ou la régie) : il démarre tout de suite
      const ra = RAISONS[a], rb = RAISONS[b];
      if ((rb.coupeTout || rb.prio - ra.prio >= ECART_POUR_COUPER) && !(sonDe(a) === sonDe(b) && a === b)) {
        assert.ok(iv.some(x => x.raison === b && x.debut === t), `${b} devait couper ${a}`);
      }
      n++;
    }
    assert.ok(n > 1000);
  },
  'fuzz : 3 000 live simulés avec des sons au hasard'() {
    const raisons = Object.keys(RAISONS);
    const noms = Object.keys(DUREES);
    let graine = 42;
    const alea = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
    for (let k = 0; k < 3000; k++) {
      const m = monde();
      const nb = 5 + Math.floor(alea() * 40);
      for (let i = 0; i < nb; i++) {
        if (alea() < 0.2) m.o.parler('blabla '.repeat(1 + Math.floor(alea() * 5)), 1 + Math.floor(alea() * 5));
        else m.o.effet(noms[Math.floor(alea() * noms.length)], raisons[Math.floor(alea() * raisons.length)]);
        m.avancer(Math.floor(alea() * 1500));
      }
      m.avancer(30000);
      aucunChevauchement(m.journal, 'effet');
      aucunChevauchement(m.journal, 'voix');
      assert.strictEqual(m.attenuation(), 1, 'le volume des effets revient toujours à la normale');
      assert.strictEqual(m.o.etat().courant, null);
    }
  }
};

let ok = 0, ko = 0;
for (const [nom, fn] of Object.entries(tests)) {
  try { fn(); ok++; console.log('  ✅ ' + nom); } catch (e) { ko++; console.log('  ❌ ' + nom + '\n     ' + e.message); }
}
console.log(`\n${ok} réussi(s), ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
