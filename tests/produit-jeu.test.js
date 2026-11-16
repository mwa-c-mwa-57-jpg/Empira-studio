import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Partie, soldatsParPiece, valeurCadeau, trouverDepartement, trouverCadeau } from '../produit/src/game.js';

let n = 0;
const user = (id) => ({ id, name: id });
const com = (id, comment) => ({ id: `c${++n}`, type: 'comment', user: user(id), comment });
const like = (id, likeCount) => ({ id: `l${++n}`, type: 'like', user: user(id), likeCount });
const gift = (id, name, diamonds, count = 1) => ({ id: `g${++n}`, type: 'gift', user: user(id), gift: { id: name, name, diamonds, count } });
const share = (id) => ({ id: `s${++n}`, type: 'share', user: user(id) });
const follow = (id) => ({ id: `f${++n}`, type: 'follow', user: user(id) });

function partie(opts = {}) {
  const p = new Partie({ random: () => 0.5, ...opts });
  const run = (sec, pas = 0.25) => {
    for (let t = 0; t < sec - 1e-9; t += pas) p.update(pas);
  };
  return { p, run };
}
const soldats = (p, code) => p.equipes.get(code)?.soldats ?? 0;
const approx = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

test('crescendo : 10 par pièce jusqu’à 30, 12 par pièce pour Léon le chaton, valeurs du cahier des charges', () => {
  assert.equal(soldatsParPiece(1), 10);
  assert.equal(soldatsParPiece(30), 10);
  approx(soldatsParPiece(4888), 12, 1e-9);
  approx(valeurCadeau(199), 2140, 5); // avion de chasse
  approx(valeurCadeau(500), 5550, 5); // missiles
  approx(valeurCadeau(1000) / 25, 455, 2); // salve d’hélicoptères
  approx(valeurCadeau(2150), 25000, 150); // tsunami
  approx(valeurCadeau(4888) / 3, 19500, 100); // bombe nucléaire
  approx(valeurCadeau(100), 1050, 5); // tank
});

test('reconnaissance exacte des départements et des cadeaux (pas de confusion)', () => {
  assert.equal(trouverDepartement('le 17 !!'), '17');
  assert.equal(trouverDepartement('2a'), '2A');
  assert.equal(trouverDepartement('974'), '974');
  assert.equal(trouverDepartement('Charente-Maritime'), '17');
  assert.equal(trouverDepartement('salut'), null);
  assert.equal(trouverCadeau({ name: 'Parfum' }).id, 'parfum');
  assert.equal(trouverCadeau({ name: "Parfum d'amour" }), null);
  assert.equal(trouverCadeau({ name: 'Galaxie' }).id, 'galaxie');
  assert.equal(trouverCadeau({ name: 'Top du top de la galaxie' }), null);
  assert.equal(trouverCadeau({ name: 'Cœur dans les mains' }).id, 'tank');
  assert.equal(trouverCadeau({ name: 'Cœur avec les mains' }), null);
  assert.equal(trouverCadeau({ name: 'Money Gun' }).id, 'pistolet');
  assert.equal(trouverCadeau({ id: '777', name: 'x' }, [{ id: 'rose', ids: ['777'], noms: ['Rose'] }]).id, 'rose');
});

test('la partie démarre à la première action ; arrivée +5 ; likes, commentaires, partages, abonnements', () => {
  const { p, run } = partie();
  assert.equal(p.phase, 'attente');
  p.traiter(com('nana', '17'));
  assert.equal(p.phase, 'partie');
  assert.equal(soldats(p, '17'), 5);
  const arrivee = p.drain().find((e) => e.type === 'arrivee');
  assert.equal(arrivee.annoncer, true);
  p.traiter(like('nana', 45));
  assert.equal(soldats(p, '17'), 7);
  assert.equal(p.joueurs.get('nana').resteLikes, 5);
  assert.equal(p.traiter(com('nana', 'go')).ignore, 'delai');
  run(2);
  p.traiter(com('nana', 'go'));
  p.traiter(share('nana'));
  p.traiter(follow('nana'));
  assert.equal(soldats(p, '17'), 7 + 1 + 8 + 15);
});

test('une arrivée est annoncée au plus toutes les 8 s', () => {
  const { p, run } = partie();
  p.traiter(com('a', '17'));
  p.traiter(com('b', '63'));
  const arr = p.drain().filter((e) => e.type === 'arrivee');
  assert.deepEqual(arr.map((e) => e.annoncer), [true, false]);
  run(8);
  p.traiter(com('c', '21'));
  assert.equal(p.drain().find((e) => e.type === 'arrivee').annoncer, true);
});

test('aucun cadeau perdu : sans département il attend, pendant le podium il compte à la partie suivante', () => {
  const { p, run } = partie();
  p.traiter(gift('x', 'Rose', 1, 7));
  p.traiter(com('x', '21'));
  assert.equal(soldats(p, '21'), 5 + 70);
  p.terminer('test');
  p.traiter(gift('x', 'Rose', 1, 3));
  run(14);
  assert.equal(p.phase, 'attente');
  assert.equal(p.equipes.size, 0, 'la carte se vide');
  p.traiter(like('x', 1));
  assert.equal(p.phase, 'partie');
  assert.equal(soldats(p, '21'), 5 + 30, 'le cadeau du podium compte au début de la partie suivante');
});

test('le département est gardé d’une partie à l’autre ; on peut en changer tant qu’on n’a pas joué', () => {
  const sauvegardes = [];
  const { p } = partie({ surMembres: (m) => sauvegardes.push({ ...m }) });
  p.traiter(com('a', '17'));
  p.traiter(com('a', '63'));
  assert.equal(p.joueurs.get('a').equipe, '63', 'pas encore joué : changement accepté');
  p.traiter(like('a', 40));
  p.traiter(com('a', '21'));
  assert.equal(p.joueurs.get('a').equipe, '63', 'a déjà joué : changement refusé');
  assert.deepEqual(sauvegardes.at(-1), { a: '63' });
  const p2 = new Partie({ membres: { a: '63' } });
  p2.traiter(like('a', 20));
  assert.equal(p2.equipes.get('63').soldats, 5 + 1);
});

test('renforts : escouade 60, commandos 200, tank +1 050 avec blindage', () => {
  const { p } = partie();
  p.traiter(com('a', '17'));
  p.traiter(gift('a', 'Cœur avec les doigts', 5));
  approx(soldats(p, '17'), 5 + 60, 1e-6);
  p.traiter(gift('a', 'Gants de boxe dorés', 10));
  approx(soldats(p, '17'), 65 + 200, 1e-6);
  p.traiter(gift('a', 'Cœur dans les mains', 100));
  approx(soldats(p, '17'), 265 + valeurCadeau(100), 1e-6);
  assert.equal(p.equipes.get('17').tanks, 1);
  assert.equal(p.blindage(p.equipes.get('17')), 0.25);
  p.traiter(gift('a', 'Cœur dans les mains', 100, 3));
  assert.equal(p.blindage(p.equipes.get('17')), 0.5, 'blindage plafonné à 50 %');
});

test('attaque : vise le département juste devant (le 2e si on est 1er), 40 % pour l’attaquant, plafond, butin', () => {
  const { p, run } = partie();
  p.traiter(com('a', '17'));
  p.traiter(gift('a', 'Rose', 1, 500)); // 17 : 5 005
  p.traiter(com('b', '63'));
  p.traiter(gift('b', 'Rose', 1, 300)); // 63 : 3 005
  p.traiter(com('c', '21'));
  p.traiter(gift('c', 'Rose', 1, 100)); // 21 : 1 005
  const v = valeurCadeau(199);
  p.traiter(gift('c', 'Côte à côte', 199)); // 21 (3e) attaque le 63 (juste devant)
  approx(soldats(p, '21'), 1005 + 0.4 * v, 1e-6);
  run(1.5);
  const detruit = Math.min(v, 0.5 * 3005);
  approx(soldats(p, '63'), 3005 - detruit, 1e-6);
  approx(soldats(p, '21'), 1005 + 0.4 * v + 0.25 * (v - detruit), 1e-6);
  // le 1er attaque le 2e (ici le 21, remonté grâce à son attaque)
  p.drain();
  const deuxieme = p.classement()[1].code;
  p.traiter(gift('a', 'Côte à côte', 199));
  assert.equal(p.drain().find((e) => e.type === 'attaque').vers[0], deuxieme);
});

test('bouclier : bloque tout, un quart revient en butin ; riposte ×2 contre l’agresseur pendant 30 s', () => {
  const { p, run } = partie();
  p.traiter(com('a', '17'));
  p.traiter(gift('a', 'Rose', 1, 600));
  p.traiter(com('b', '63'));
  p.traiter(gift('b', 'Rose', 1, 400));
  p.traiter(gift('a', 'Papillon', 88)); // 17 se protège
  const avant63 = soldats(p, '63');
  p.traiter(gift('b', 'Côte à côte', 199)); // 63 attaque 17 (devant)
  run(1.5);
  const v = valeurCadeau(199);
  approx(soldats(p, '17'), 6005 + valeurCadeau(88), 1e-6);
  approx(soldats(p, '63'), avant63 + 0.4 * v + 0.25 * v, 1e-6);
  // le 17 a été attaqué par le 63 : sa riposte vise le 63 avec une force ×2
  p.drain();
  p.traiter(gift('a', 'Tom la tomate', 1));
  const att = p.drain().find((e) => e.type === 'attaque');
  assert.equal(att.vers[0], '63');
  assert.equal(att.riposte, true);
});

test('hélicoptères (Galaxie) : une salve toutes les 20 s jusqu’à la fin, 10 % max par salve', () => {
  const { p, run } = partie();
  p.traiter(com('a', '17'));
  p.traiter(gift('a', 'Rose', 1, 1000));
  p.traiter(com('b', '63'));
  p.traiter(gift('b', 'Rose', 1, 100));
  p.traiter(gift('b', 'Galaxie', 1000));
  assert.equal(p.helicos.length, 1);
  run(3.1);
  const salves = p.drain().filter((e) => e.type === 'salve').length;
  assert.equal(salves, 1);
  run(40);
  assert.equal(p.drain().filter((e) => e.type === 'salve').length, 2);
});

test('bombes nucléaires : les 3 premiers hors l’envoyeur, ignorent les boucliers, voisins −10 %', () => {
  const { p, run } = partie();
  for (const [u, d, k] of [['a', '17', 900], ['b', '63', 800], ['c', '21', 700], ['d', '16', 600]]) {
    p.traiter(com(u, d));
    p.traiter(gift(u, 'Rose', 1, k));
  }
  p.traiter(gift('a', 'Corgi', 299)); // le bouclier ne protège pas des bombes
  p.traiter(com('e', '59'));
  p.drain();
  p.traiter(gift('e', 'Léon le chaton', 4888));
  const att = p.drain().find((e) => e.type === 'attaque');
  assert.deepEqual(att.vers.sort(), ['17', '21', '63'].sort());
  const avant16 = soldats(p, '16');
  run(3);
  const impacts = p.drain().filter((e) => e.type === 'impact');
  assert.ok(impacts.some((i) => i.equipe === '17' && i.detruit > 0 && !i.bloque));
  // la Charente (16) est voisine de la Charente-Maritime (17) : −10 %
  assert.ok(soldats(p, '16') < avant16);
});

test('vagues : annoncées 15 s avant, likes et commentaires multipliés, cadeaux ×1,5, rattrapage', () => {
  const { p, run } = partie();
  p.traiter(com('a', '17'));
  p.traiter(gift('a', 'Rose', 1, 100));
  p.traiter(com('b', '63'));
  run(3 * 60 - 15);
  assert.ok(p.drain().some((e) => e.type === 'vagueAnnonce' && e.vague.id === 'doublon'));
  run(15.5);
  assert.equal(p.vagueActive()?.id, 'doublon');
  const s = soldats(p, '17');
  p.traiter(like('a', 20));
  assert.equal(soldats(p, '17'), s + 2, 'likes ×2');
  const s63 = soldats(p, '63');
  p.traiter(like('b', 20));
  assert.equal(soldats(p, '63'), s63 + 2 * 1.5, 'moitié basse : rattrapage ×1,5');
  const s2 = soldats(p, '17');
  p.traiter(gift('a', 'Rose', 1, 10));
  assert.equal(soldats(p, '17'), s2 + 100 * 1.5, 'cadeaux ×1,5 au plus');
  run(61);
  assert.equal(p.vagueActive(), null);
});

test('événements : révolution ×2 sauf le 1er, duel avec vol de 10 %, invasion et libération', () => {
  const { p } = partie();
  p.traiter(com('a', '17'));
  p.traiter(gift('a', 'Rose', 1, 100));
  p.traiter(com('b', '16'));
  p.traiter(gift('b', 'Rose', 1, 50));
  assert.ok(p.lancerEvenement('revolution'));
  const s16 = soldats(p, '16');
  p.traiter(share('b'));
  assert.equal(soldats(p, '16'), s16 + 16);
  const s17 = soldats(p, '17');
  p.traiter(share('a'));
  assert.equal(soldats(p, '17'), s17 + 8);

  assert.ok(p.lancerEvenement('duel'));
  p.traiter(follow('b'));
  const a = soldats(p, '17');
  const b = soldats(p, '16');
  p.finirEvenement(false);
  approx(soldats(p, '16'), b + a * 0.1, 1e-6);

  assert.ok(p.lancerEvenement('invasion'));
  const occupe = [...p.equipes.values()].find((e) => e.occupant);
  assert.ok(occupe, 'un département est occupé');
  const occupant = p.equipes.get(occupe.occupant);
  const u = occupe.code === '17' ? 'a' : 'b';
  const avantOccupant = occupant.soldats;
  p.traiter(share(u));
  approx(occupant.soldats, avantOccupant + 4, 1e-6);
  p.traiter(gift(u, 'Rose', 1, 5));
  approx(occupant.soldats, avantOccupant + 4, 1e-6, 'un cadeau n’est jamais partagé avec un occupant');
  p.traiter(gift(u, 'Rose', 1, 100));
  assert.equal(occupe.occupant, null, 'un cadeau de 100 pièces libère');
});

test('mission par région : objectif de messages, prime de 60 par département participant', () => {
  const { p, run } = partie({ random: () => 0.1 });
  p.traiter(com('a', '63'));
  p.lancerEvenement('mission');
  const ev = p.evenement;
  assert.equal(ev.region, 'Auvergne-Rhône-Alpes');
  assert.equal(ev.sorte, 'messages');
  const avant = soldats(p, '63');
  for (let i = 0; i < ev.objectif; i++) {
    run(2);
    p.traiter(com('a', 'go'));
  }
  run(0.25);
  assert.equal(p.evenement, null);
  assert.equal(soldats(p, '63'), avant + ev.objectif + 60);
});

test('fin au bout de 15 minutes, rappels à 10, 5 et 1 minute, podium de 14 s avec le roi', () => {
  const { p, run } = partie();
  p.ambianceActive = false; // les ravitaillements au hasard changeraient le classement
  p.traiter(com('a', '17'));
  p.traiter(gift('a', 'Rose', 1, 50));
  p.traiter(com('b', '63'));
  run(15 * 60, 1);
  const evs = p.drain();
  assert.deepEqual(evs.filter((e) => e.type === 'rappel').map((e) => e.minutes), [10, 5, 1]);
  assert.equal(p.phase, 'podium');
  assert.equal(p.podium.top[0].code, '17');
  assert.equal(p.podium.roi.nom, 'a');
  run(14);
  assert.equal(p.phase, 'attente');
});

test('commandes de l’animateur', () => {
  const { p } = partie();
  p.traiter(com('a', '17'));
  assert.ok(p.commande('duree', '10'));
  assert.equal(p.duree, 600);
  assert.ok(p.commande('vague', 'assaut'));
  assert.equal(p.vague.id, 'assaut');
  assert.ok(p.commande('fixe', 'Abonnez-vous !'));
  assert.equal(p.messageFixe, 'Abonnez-vous !');
  assert.ok(p.commande('efface'));
  assert.equal(p.messageFixe, null);
  assert.ok(p.commande('avion'));
  assert.ok(p.commande('membres'));
  assert.equal(p.joueurs.get('a').equipe, null);
  assert.ok(p.commande('fin'));
  assert.equal(p.phase, 'podium');
  assert.ok(p.commande('reset'));
  assert.equal(p.phase, 'attente');
  assert.equal(p.commande('inconnue'), false);
});

test('tsunami : la cible et les départements traversés à sa hauteur', () => {
  const { p, run } = partie();
  for (const [u, d, k] of [['a', '29', 500], ['b', '67', 400], ['c', '35', 100]]) {
    p.traiter(com(u, d));
    p.traiter(gift(u, 'Rose', 1, k));
  }
  p.drain();
  p.traiter(gift('c', 'Plongée avec les baleines', 2150)); // 35 (3e) vise le 67 (devant)
  const ts = p.drain().find((e) => e.type === 'tsunami');
  assert.equal(ts.cible, '67');
  const avant = soldats(p, '67');
  run(6);
  assert.ok(soldats(p, '67') < avant);
});

test('porte-avions (Voiture de sport) : 4 vagues d’avions sur le département devant, et son plus gros voisin', () => {
  const { p, run } = partie();
  p.ambianceActive = false;
  for (const [u, d, k] of [['a', '17', 3000], ['b', '16', 900], ['c', '79', 400], ['e', '59', 10]]) {
    p.traiter(com(u, d));
    p.traiter(gift(u, 'Rose', 1, k));
  }
  p.drain();
  p.traiter(gift('b', 'Voiture de sport', 7000)); // le 16 attaque le département juste devant : le 17
  const att = p.drain().find((e) => e.type === 'attaque');
  assert.deepEqual([att.sorte, att.vers[0]], ['porteavions', '17']);
  const avant17 = soldats(p, '17');
  const avant79 = soldats(p, '79'); // les Deux-Sèvres, voisines du 17
  run(10);
  const evs = p.drain();
  assert.equal(evs.filter((e) => e.type === 'vagueAerienne').length, 4);
  assert.ok(soldats(p, '17') < avant17 * 0.3, 'jusqu’à ~82 % détruits en 4 vagues');
  assert.ok(soldats(p, '17') > 0, 'jamais rasé d’un coup');
  assert.ok(soldats(p, '79') < avant79, 'le plus gros voisin est touché aussi');
});

test('bombe nucléaire : jusqu’à 80 % de chaque cible, souffle −15 % sur les voisins', () => {
  const { p, run } = partie();
  p.ambianceActive = false;
  for (const [u, d, k] of [['a', '17', 2000], ['b', '63', 1500], ['c', '21', 1200], ['d', '16', 600]]) {
    p.traiter(com(u, d));
    p.traiter(gift(u, 'Rose', 1, k));
  }
  p.traiter(com('e', '59'));
  const avant = { 17: soldats(p, '17'), 16: soldats(p, '16') };
  p.traiter(gift('e', 'Léon le chaton', 4888));
  run(3);
  approx(soldats(p, '17'), avant[17] * 0.2, 1);
  assert.ok(soldats(p, '16') <= avant[16] * 0.85 + 1);
});

test('ambiance : ravitaillements, bombardements surprises sur le 1er, survols ; désactivable (!ambiance)', () => {
  let r = 0.1;
  const { p, run } = partie({ random: () => r });
  p.traiter(com('a', '17'));
  p.traiter(gift('a', 'Rose', 1, 50));
  p.traiter(com('b', '63'));
  p.drain();
  // 0.1 → délai de 32,5 s puis ravitaillement
  const avant = soldats(p, '17') + soldats(p, '63');
  run(36);
  let evs = p.drain();
  assert.ok(evs.some((e) => e.type === 'ambiance' && e.sorte === 'ravitaillement'));
  assert.ok(evs.some((e) => e.type === 'ravitaille' && e.soldats === 30));
  approx(soldats(p, '17') + soldats(p, '63'), avant + 30, 0.01);
  // bombardement surprise : le 1er perd 5 %
  r = 0.7;
  const premier = soldats(p, '17');
  run(55);
  evs = p.drain();
  assert.ok(evs.some((e) => e.type === 'ambiance' && e.sorte === 'bombardement' && e.equipe === '17'));
  assert.ok(evs.some((e) => e.type === 'impact' && e.sorte === 'bombardement' && e.equipe === '17'));
  assert.ok(soldats(p, '17') < premier);
  // désactivée : plus rien
  assert.equal(p.commande('ambiance'), true);
  run(120);
  assert.ok(!p.drain().some((e) => e.type === 'ambiance'));
  // la régie peut en lancer une à la main
  assert.equal(p.commande('ravitaillement', '63'), true);
  assert.equal(p.drain().find((e) => e.type === 'ambiance').equipe, '63');
  assert.equal(p.commande('bombardement'), true);
});
