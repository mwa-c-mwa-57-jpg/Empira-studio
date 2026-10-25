'use strict';
// Tests de la logique de jeu, avec une horloge simulée : node test/simulation.test.js
const assert = require('assert');
const path = require('path');
const { Jeu } = require('../src/jeu');

const CONFIG = require(path.join(__dirname, '..', 'config.json'));

function creer(modif = {}) {
  const config = JSON.parse(JSON.stringify(CONFIG));
  config.jeu.frayeursAleatoires = false;
  config.autopilote.actifAuDemarrage = false;
  Object.assign(config.jeu, modif.jeu || {});
  Object.assign(config.autopilote, modif.autopilote || {});
  let t = 1_000_000;
  const evts = [];
  const jeu = new Jeu(config, { now: () => t, random: () => 0.1, emit: (type, d) => evts.push({ type, d }) });
  const avancer = secondes => { for (let i = 0; i < secondes * 10; i++) { t += 100; jeu.tick(0.1); } };
  return { jeu, evts, avancer, config, pas: ms => { t += ms; } };
}
const u = (p = 'sarah') => ({ id: p, pseudo: p, nom: p, avatar: '' });
const cadeau = (index, extra = {}) => Object.assign({ user: u(), nom: CONFIG.objectifs[index].nom, pieces: CONFIG.objectifs[index].pieces, giftType: 2, repeatCount: 1, repeatEnd: true }, extra);
const types = evts => evts.map(e => e.type);

const tests = {
  'les taps font grimper et la grille du refuge 1 bloque à 300 m'() {
    const { jeu, avancer } = creer();
    for (let s = 0; s < 120; s++) { jeu.onLike({ user: u(), nombre: 15 }); avancer(1); }
    assert.strictEqual(jeu.etat.alt, 300);
    assert.strictEqual(jeu.statut, 'bloque');
  },
  'le bon cadeau débloque le refuge et le surplus reste dans la cagnotte'() {
    const { jeu, evts } = creer();
    jeu.onCadeau(cadeau(0));
    assert.strictEqual(jeu.etat.objIndex, 1);
    assert.strictEqual(jeu.etat.cagnotte, 0);
    assert.ok(types(evts).includes('refuge'));
  },
  'un gros cadeau enchaîne plusieurs refuges (MÉGA SAUT)'() {
    const { jeu, evts } = creer();
    jeu.onCadeau({ user: u('karim'), nom: 'Inconnu', pieces: 5000, giftType: 2, repeatCount: 1, repeatEnd: true });
    // 1+5+10+20+30+49+100+199+299+399+499+699+1088 = 3398, +2000 dépasserait 5000
    assert.strictEqual(jeu.etat.objIndex, 13);
    assert.strictEqual(jeu.etat.cagnotte, 5000 - 3398);
    const refuges = evts.filter(e => e.type === 'refuge');
    assert.strictEqual(refuges.length, 13);
    assert.ok(refuges.every(r => r.d.mega));
  },
  'débloquer des refuges hisse la mascotte jusqu\'au dernier refuge ouvert'() {
    const { jeu, avancer } = creer();
    jeu.onCadeau({ user: u('karim'), nom: 'Inconnu', pieces: 300, giftType: 2, repeatCount: 1, repeatEnd: true });
    assert.strictEqual(jeu.etat.objIndex, 7); // 1+5+10+20+30+49+100 = 215
    avancer(30);
    assert.ok(jeu.etat.alt >= 7 * 300, 'altitude ' + jeu.etat.alt);
    assert.ok(jeu.etat.alt <= 8 * 300);
  },
  'sans enchaînement, un cadeau ne débloque qu\'un refuge'() {
    const { jeu } = creer({ jeu: { surplusEnchaineLesRefuges: false } });
    jeu.onCadeau({ user: u(), nom: 'Inconnu', pieces: 5000, giftType: 2, repeatCount: 1, repeatEnd: true });
    assert.strictEqual(jeu.etat.objIndex, 1);
  },
  'les petits cadeaux s\'additionnent dans la cagnotte'() {
    const { jeu } = creer();
    jeu.onCadeau(cadeau(0)); // refuge 1 (TikTok)
    jeu.onCadeau(cadeau(0)); // 1 pièce vers Tofu (5)
    assert.strictEqual(jeu.etat.objIndex, 1);
    assert.strictEqual(jeu.etat.cagnotte, 1);
    for (let i = 0; i < 4; i++) jeu.onCadeau(cadeau(0));
    assert.strictEqual(jeu.etat.objIndex, 2);
    assert.strictEqual(jeu.etat.cagnotte, 0);
  },
  'un combo n\'est compté qu\'une fois, à la fin de la série'() {
    const { jeu, evts } = creer();
    for (let k = 1; k <= 5; k++) jeu.onCadeau(cadeau(2, { giftType: 1, repeatCount: k, repeatEnd: false }));
    assert.strictEqual(jeu.etat.piecesTotal, 0);
    assert.strictEqual(types(evts).filter(t => t === 'combo').length, 5);
    jeu.onCadeau(cadeau(2, { giftType: 1, repeatCount: 5, repeatEnd: true }));
    assert.strictEqual(jeu.etat.piecesTotal, 50);
    assert.strictEqual(jeu.etat.users.sarah.pieces, 50);
  },
  'sans taps il s\'accroche, puis tombe jusqu\'au dernier refuge'() {
    const { jeu, evts, avancer } = creer();
    jeu.onCadeau(cadeau(0)); // refuge 1 ouvert
    jeu.etat.alt = 420;
    jeu.energie = 0;
    avancer(0.2);
    assert.strictEqual(jeu.statut, 'accroche');
    avancer(CONFIG.jeu.secondesAccrocheAvantChute + 1);
    assert.strictEqual(jeu.statut, 'chute');
    avancer(30);
    assert.strictEqual(jeu.etat.alt, 300, 'il retombe sur le refuge 1, pas plus bas');
    assert.strictEqual(jeu.statut, 'repos');
    assert.strictEqual(jeu.etat.chutes, 1);
    assert.ok(evts.some(e => e.type === 'scene' && e.d.type === 'atterrit'));
  },
  'des taps pendant qu\'il est accroché le sauvent'() {
    const { jeu, evts, avancer } = creer();
    jeu.etat.alt = 100;
    jeu.energie = 0;
    avancer(0.2);
    assert.strictEqual(jeu.statut, 'accroche');
    jeu.onLike({ user: u(), nombre: 20 });
    avancer(0.2);
    assert.notStrictEqual(jeu.statut, 'chute');
    assert.ok(evts.some(e => e.type === 'scene' && e.d.type === 'ouf'));
  },
  'la protection (ourson, rose à jamais…) empêche de glisser'() {
    const { jeu, avancer } = creer();
    jeu.onCadeau(cadeau(0));
    jeu.onCadeau(cadeau(1));
    jeu.onCadeau(cadeau(2));
    jeu.onCadeau(cadeau(3));
    jeu.onCadeau(cadeau(4));
    jeu.onCadeau(cadeau(5));
    jeu.onCadeau(cadeau(6)); // Le petit Ourson : 30 s de protection
    jeu.energie = 0;
    avancer(10);
    assert.notStrictEqual(jeu.statut, 'accroche');
    assert.notStrictEqual(jeu.statut, 'chute');
  },
  'le vote du destin : AIDE gagne et le fait monter'() {
    const { jeu, avancer } = creer();
    jeu.onCadeau(cadeau(0));
    jeu.lancerMiniJeu('vote');
    jeu.onChat({ user: u('a'), texte: 'AIDE !!' });
    jeu.onChat({ user: u('b'), texte: 'aide' });
    jeu.onChat({ user: u('b'), texte: 'piège' }); // un seul vote par personne
    jeu.onChat({ user: u('c'), texte: 'piège' });
    assert.deepStrictEqual(jeu.miniJeu.votes, { aide: 2, piege: 1 });
    const avant = jeu.boostRestant;
    jeu.finirMiniJeu();
    assert.ok(jeu.boostRestant > avant);
  },
  'un piège ne fait jamais descendre sous le refuge acquis'() {
    const { jeu } = creer();
    jeu.onCadeau(cadeau(0));
    jeu.etat.alt = 305;
    jeu.lancerMiniJeu('vote');
    jeu.onChat({ user: u('c'), texte: 'piege' });
    jeu.finirMiniJeu();
    assert.ok(jeu.etat.alt >= 300);
  },
  'le mot magique : le premier qui l\'écrit gagne'() {
    const { jeu, evts } = creer();
    jeu.lancerMiniJeu('mot');
    const mot = jeu.miniJeu.mot;
    jeu.onChat({ user: u('lea'), texte: 'Euh ' + mot.toUpperCase() + ' ?' });
    const fin = evts.find(e => e.type === 'miniJeuFin');
    assert.strictEqual(fin.d.gagnant.pseudo, 'lea');
    assert.strictEqual(jeu.miniJeu, null);
  },
  'la course aux taps se gagne en atteignant la cible'() {
    const { jeu, evts } = creer();
    jeu.lancerMiniJeu('course');
    const cible = jeu.miniJeu.cible;
    jeu.onLike({ user: u(), nombre: cible });
    assert.strictEqual(evts.find(e => e.type === 'miniJeuFin').d.resultat, 'gagne');
  },
  'les commandes sons du chat respectent le délai anti-spam'() {
    const { jeu, evts, pas } = creer();
    jeu.onChat({ user: u('a'), texte: '!prout' });
    jeu.onChat({ user: u('b'), texte: '!prout' }); // trop tôt (délai global)
    pas(5000);
    jeu.onChat({ user: u('a'), texte: '!klaxon' }); // trop tôt pour a (30 s)
    jeu.onChat({ user: u('b'), texte: '!KLAXON fort' });
    const sons = evts.filter(e => e.type === 'son').map(e => e.d.son + ':' + e.d.user.pseudo);
    assert.deepStrictEqual(sons, ['prout:a', 'klaxon:b']);
  },
  'présence : alerte puis pause de l\'autopilote'() {
    const { jeu, evts, avancer } = creer();
    avancer(CONFIG.presence.minutesAvantAlerte * 60 + 1);
    assert.strictEqual(jeu.presence, 'alerte');
    avancer(CONFIG.presence.minutesAvantPause * 60);
    assert.strictEqual(jeu.presence, 'pause');
    jeu.present();
    assert.strictEqual(jeu.presence, 'ok');
    assert.deepStrictEqual(evts.filter(e => e.type === 'presence').map(e => e.d.presence), ['alerte', 'pause', 'ok']);
  },
  'nouveau premier de cordée annoncé'() {
    const { jeu, evts } = creer();
    jeu.onCadeau(Object.assign(cadeau(2), { user: u('a') }));
    assert.ok(!evts.some(e => e.type === 'nouveauChef'), 'le tout premier chef ne « vole » la place de personne');
    jeu.onCadeau(Object.assign(cadeau(4), { user: u('b') }));
    const ev = evts.find(e => e.type === 'nouveauChef');
    assert.strictEqual(ev.d.user.pseudo, 'b');
    assert.strictEqual(ev.d.ancien.pseudo, 'a');
  },
  'le nom seul (prix inconnu) suffit pour le cadeau attendu'() {
    const { jeu } = creer();
    jeu.onCadeau({ user: u(), nom: 'TikTok', pieces: 0, giftType: 2, repeatCount: 1, repeatEnd: true });
    assert.strictEqual(jeu.etat.objIndex, 1);
  },
  'une petite « Rose » à 1 pièce ne valide pas le Rosa à 10'() {
    const { jeu } = creer();
    jeu.onCadeau(cadeau(0));
    jeu.onCadeau(cadeau(1));
    jeu.onCadeau({ user: u(), nom: 'Rose', pieces: 1, giftType: 1, repeatCount: 1, repeatEnd: true });
    assert.strictEqual(jeu.etat.objIndex, 2);
    assert.strictEqual(jeu.etat.cagnotte, 1);
  },
  'le sommet est annoncé une seule fois après le dernier refuge'() {
    const { jeu, evts, avancer } = creer();
    jeu.onCadeau({ user: u(), nom: 'x', pieces: 30000, giftType: 2, repeatCount: 1, repeatEnd: true });
    assert.strictEqual(jeu.etat.objIndex, jeu.N);
    jeu.etat.alt = jeu.N * jeu.esp - 1;
    jeu.boostRestant = 50;
    avancer(5);
    avancer(5);
    assert.strictEqual(evts.filter(e => e.type === 'sommet').length, 1);
  },
  'sauvegarde puis reprise de la partie'() {
    const { jeu } = creer();
    jeu.onCadeau(cadeau(0));
    jeu.etat.alt = 333;
    const copie = JSON.parse(JSON.stringify(jeu.versJSON()));
    const b = creer().jeu;
    b.charger(copie);
    assert.strictEqual(b.etat.objIndex, 1);
    assert.strictEqual(b.etat.alt, 333);
    assert.strictEqual(b.classement()[0].pseudo, 'sarah');
  },
  'nouveau live : tout repart à zéro sauf le record'() {
    const { jeu } = creer();
    jeu.onCadeau(cadeau(0));
    jeu.etat.alt = 500;
    jeu.etat.record = 500;
    jeu.nouveauLive();
    assert.strictEqual(jeu.etat.objIndex, 0);
    assert.strictEqual(jeu.etat.alt, 0);
    assert.strictEqual(jeu.etat.record, 500);
    assert.strictEqual(jeu.classement().length, 0);
  },
  'l\'autopilote montre la pancarte quand il est bloqué'() {
    const { jeu, evts, avancer } = creer({ autopilote: { actifAuDemarrage: true, minutesEntreMiniJeux: 999 } });
    jeu.etat.alt = 300;
    for (let s = 0; s < 60; s++) { jeu.onLike({ user: u(), nombre: 5 }); avancer(1); }
    assert.strictEqual(jeu.statut, 'bloque');
    assert.ok(evts.some(e => e.type === 'scene' && e.d.type === 'pancarte'));
  }
,
  'un cadeau saboteur lâche un boss, sans entrer dans la cordée ni la cagnotte'() {
    const { jeu, evts } = creer();
    jeu.onCadeau({ user: u('tom'), nom: 'Cœur avec les doigts', pieces: 5, giftType: 1, repeatCount: 1, repeatEnd: true });
    assert.strictEqual(jeu.boss.type, 'pigeon');
    assert.strictEqual(jeu.boss.saboteur.pseudo, 'tom');
    assert.strictEqual(jeu.etat.cagnotte, 0);
    assert.strictEqual(jeu.etat.objIndex, 0);
    assert.strictEqual(jeu.classement().length, 0);
    assert.strictEqual(jeu.saboteursClassement()[0].pseudo, 'tom');
    assert.ok(types(evts).includes('sabotage') && types(evts).includes('boss'));
  },
  'le nom anglais est reconnu, et un Tofu au même prix n\'est pas un saboteur'() {
    const { jeu } = creer();
    jeu.onCadeau(cadeau(1)); // Tofu, même prix que Cœur avec les doigts
    assert.strictEqual(jeu.boss, null);
    jeu.onCadeau({ user: u('tom'), nom: 'Finger Heart', pieces: 5, giftType: 1, repeatCount: 1, repeatEnd: true });
    assert.strictEqual(jeu.boss.type, 'pigeon');
  },
  'les taps battent le pigeon'() {
    const { jeu, evts } = creer();
    jeu.onCadeau({ user: u('tom'), nom: 'Cœur avec les doigts', pieces: 5, giftType: 1, repeatCount: 1, repeatEnd: true });
    for (let i = 0; i < 6; i++) jeu.onLike({ user: u('lea'), nombre: 10 });
    const fin = evts.find(e => e.type === 'bossFin');
    assert.ok(fin.d.gagne);
    assert.strictEqual(fin.d.coupFinal.pseudo, 'lea');
    assert.strictEqual(jeu.boss, null);
    assert.strictEqual(jeu.etat.bossVaincus, 1);
  },
  'un cadeau d\'aide frappe le boss (1 pièce = 6 coups)'() {
    const { jeu, evts } = creer();
    jeu.onCadeau({ user: u('tom'), nom: 'Cœur dans les mains', pieces: 100, giftType: 2, repeatCount: 1, repeatEnd: true });
    assert.strictEqual(jeu.boss.type, 'araignee');
    jeu.onCadeau(Object.assign(cadeau(4), { user: u('lea') })); // Donut : 180 coups
    assert.strictEqual(jeu.boss.pv, 600 - 180);
    jeu.onCadeau(Object.assign(cadeau(8), { user: u('karim') })); // Corgi : K.O.
    const fin = evts.find(e => e.type === 'bossFin');
    assert.ok(fin.d.gagne);
    assert.strictEqual(fin.d.meilleurs[0].pseudo, 'karim');
  },
  'boss non vaincu : il redescend, mais jamais sous le dernier refuge'() {
    const { jeu, evts, avancer } = creer();
    jeu.onCadeau(cadeau(0));
    jeu.etat.alt = 320;
    jeu.energie = 100;
    jeu.onCadeau({ user: u('tom'), nom: 'Ours dansants', pieces: 3000, giftType: 2, repeatCount: 1, repeatEnd: true });
    for (let s = 0; s < 35; s++) { jeu.onLike({ user: u('lea'), nombre: 3 }); avancer(1); }
    const fin = evts.find(e => e.type === 'bossFin');
    assert.ok(!fin.d.gagne);
    assert.ok(jeu.etat.alt >= 300, 'altitude ' + jeu.etat.alt);
    assert.strictEqual(jeu.etat.objIndex, 1, 'le refuge payé reste débloqué');
  },
  'un saboteur renforce le boss en cours'() {
    const { jeu, evts } = creer();
    jeu.onCadeau({ user: u('tom'), nom: 'Cœur avec les doigts', pieces: 5, giftType: 1, repeatCount: 1, repeatEnd: true });
    const fin = jeu.boss.fin;
    jeu.onCadeau({ user: u('zoe'), nom: 'Cœur dans les mains', pieces: 100, giftType: 2, repeatCount: 1, repeatEnd: true });
    assert.strictEqual(jeu.boss.type, 'pigeon');
    assert.strictEqual(jeu.boss.pvMax, 60 + 600);
    assert.ok(jeu.boss.fin > fin);
    assert.ok(types(evts).includes('bossRenfort'));
  },
  'un boss attend la fin du mini-jeu, et aucun mini-jeu ne démarre pendant un combat'() {
    const { jeu, avancer } = creer();
    jeu.lancerMiniJeu('mot');
    jeu.onCadeau({ user: u('tom'), nom: 'Cœur avec les doigts', pieces: 5, giftType: 1, repeatCount: 1, repeatEnd: true });
    assert.strictEqual(jeu.boss, null);
    assert.strictEqual(jeu.fileBoss.length, 1);
    avancer(50);
    assert.ok(jeu.boss, 'le boss arrive après le mini-jeu');
    assert.strictEqual(jeu.lancerMiniJeu('vote'), false);
  },
  'l\'autopilote lâche un boss au hasard quand c\'est calme'() {
    const { jeu, evts, avancer } = creer({ autopilote: { actifAuDemarrage: true, minutesEntreMiniJeux: 999 } });
    for (let s = 0; s < 8 * 60; s++) { jeu.onLike({ user: u(), nombre: 3 }); jeu.present(); avancer(1); }
    const b = evts.find(e => e.type === 'boss');
    assert.ok(b, 'un boss au hasard est apparu');
    assert.strictEqual(b.d.saboteur, null);
  }
,
  'économie : 3 000 pièces de saboteur annulent 3 000 pièces d\'aide (cagnotte et mètres)'() {
    const { jeu, evts, avancer } = creer();
    jeu.etat.objIndex = 14; // refuge 15 : Taureau, 2 999 pièces pour 300 m
    jeu.etat.alt = 4499;
    jeu.energie = 100;
    jeu.onCadeau({ user: u('tom'), nom: 'Ours dansants', pieces: 3000, giftType: 2, repeatCount: 1, repeatEnd: true });
    avancer(31);
    const fin = evts.find(e => e.type === 'bossFin');
    assert.ok(!fin.d.gagne);
    assert.strictEqual(fin.d.dette, 3000);
    assert.strictEqual(jeu.etat.cagnotte, -3000);
    assert.ok(fin.d.perte >= 290, 'perte ' + fin.d.perte); // ≈ 300 m, le prix d'un refuge
    // Il faut maintenant 3 000 + 2 999 pièces pour ouvrir le refuge
    jeu.onCadeau(Object.assign(cadeau(14), { user: u('lea') }));
    assert.strictEqual(jeu.etat.objIndex, 14);
    jeu.onCadeau({ user: u('lea'), nom: 'x', pieces: 3000, giftType: 2, repeatCount: 1, repeatEnd: true });
    assert.strictEqual(jeu.etat.objIndex, 15);
  },
  'économie : au début, un petit pigeon pèse plus lourd (les mètres y coûtent moins cher)'() {
    const { jeu, evts, avancer } = creer();
    jeu.etat.objIndex = 2; // refuge 3 : Rosa, 10 pièces pour 300 m
    jeu.etat.alt = 750;
    jeu.energie = 100;
    jeu.onCadeau({ user: u('tom'), nom: 'Cœur avec les doigts', pieces: 5, giftType: 1, repeatCount: 1, repeatEnd: true });
    avancer(16);
    const fin = evts.find(e => e.type === 'bossFin');
    assert.strictEqual(fin.d.perte, 150); // 5 pièces × 300 m / 10 pièces
    assert.strictEqual(jeu.etat.cagnotte, -5);
  },
  'réglage « partage » : le cadeau bat d\'abord le boss, le reste va dans la cagnotte'() {
    const { jeu, config } = creer();
    config.saboteurs.cadeauxContreBoss = 'partage';
    jeu.onCadeau({ user: u('tom'), nom: 'Cœur avec les doigts', pieces: 5, giftType: 1, repeatCount: 1, repeatEnd: true });
    jeu.onCadeau(Object.assign(cadeau(4), { user: u('lea') })); // Donut 30 : 10 pièces pour le pigeon (60 PV)
    assert.strictEqual(jeu.boss, null);
    // Les 20 pièces restantes vont dans la cagnotte : TikTok (1) + Tofu (5) + Rosa (10) = 16, il reste 4
    assert.strictEqual(jeu.etat.objIndex, 3);
    assert.strictEqual(jeu.etat.cagnotte, 4);
  },
  'réglage « non » : seuls les taps frappent le boss'() {
    const { jeu, config } = creer();
    config.saboteurs.cadeauxContreBoss = 'non';
    jeu.onCadeau({ user: u('tom'), nom: 'Cœur avec les doigts', pieces: 5, giftType: 1, repeatCount: 1, repeatEnd: true });
    jeu.onCadeau(Object.assign(cadeau(13), { user: u('lea') }));
    assert.ok(jeu.boss && jeu.boss.pv === 60);
  }
};

let ok = 0, ko = 0;
for (const [nom, fn] of Object.entries(tests)) {
  try { fn(); ok++; console.log('  ✅ ' + nom); } catch (e) { ko++; console.log('  ❌ ' + nom + '\n     ' + e.message); }
}
console.log(`\n${ok} réussi(s), ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
