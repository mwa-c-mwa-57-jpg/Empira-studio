import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Theme, lireReglages, pseudoPropre } from '../produit/src/theme.js';
import { Annonceur } from '../produit/src/voix.js';
import { Partie } from '../produit/src/game.js';
import { PALETTE, CONTOURS } from '../produit/src/config.js';
import { createRng } from '../public/src/core/rng.js';

test('réglages lus dans l’adresse, valeurs inconnues remplacées par les valeurs par défaut', () => {
  const r = lireReglages('?couleurs=fixe&graine=1234&unites=vert&contours=violet&voix=homme&hote=@MonLive');
  assert.deepEqual([r.couleurs, r.graine, r.unites, r.contours, r.voix, r.hote], ['fixe', 1234, 'vert', 'violet', 'homme', 'MonLive']);
  const d = lireReglages('?couleurs=n%27importe&unites=jaune');
  assert.deepEqual([d.couleurs, d.unites, d.contours, d.voix], ['aleatoire', 'departement', 'or', 'femme']);
  assert.deepEqual(lireReglages('?palette=ff0000,%2300ff00,zzz').palette, ['#ff0000', '#00ff00']);
});

test('couleurs : 32 couleurs mélangées, même tirage avec la même graine, palette perso, unités et contours', () => {
  const a = new Theme(lireReglages('?couleurs=fixe&graine=99'));
  const b = new Theme(lireReglages('?couleurs=fixe&graine=99'));
  assert.deepEqual(a.palette, b.palette);
  assert.equal(new Set(a.palette).size, 32);
  assert.deepEqual([...a.palette].sort(), [...PALETTE].sort());
  const c = new Theme(lireReglages('?couleurs=fixe&graine=7'));
  assert.notDeepEqual(a.palette, c.palette);
  assert.equal(a.couleur('17'), a.couleur('17'), 'une couleur par département');
  assert.notEqual(a.couleur('17'), a.couleur('63'));
  const perso = new Theme(lireReglages('?couleurs=perso&palette=111111,222222,333333,444444'));
  assert.deepEqual([...perso.palette].sort(), ['#111111', '#222222', '#333333', '#444444']);
  assert.equal(new Theme(lireReglages('?unites=rouge')).couleurUnites('17'), '#d63b3b');
  assert.equal(new Theme(lireReglages('?contours=vert')).contour, CONTOURS.vert);
  const t = new Theme(lireReglages('?unites=departement'));
  assert.equal(t.couleurUnites('17'), t.couleur('17'));
});

test('mots interdits filtrés dans les pseudos', () => {
  assert.equal(pseudoPropre('Nana_17'), 'Nana_17');
  assert.equal(pseudoPropre('gros connard du 93'), 'Un soldat');
  assert.equal(pseudoPropre('PD69'), 'PD69', 'mot court : seulement en mot entier');
  assert.equal(pseudoPropre('le pd du 69'), 'Un soldat');
  assert.equal(pseudoPropre(''), 'Un soldat');
});

test('voix : jamais de « merci », jamais deux fois la même phrase de suite, rappels prioritaires', () => {
  const rng = createRng(3);
  const p = new Partie({ random: rng });
  let t = 0;
  const dites = [];
  const a = new Annonceur(p, { parler: (s) => dites.push(s), maintenant: () => t, random: rng });
  let n = 0;
  const ev = (type, id, extra) => ({ id: `v${++n}`, type, user: { id, name: id }, ...extra });
  const deps = ['17', '63', '21', '08', '13', '59', '75', '974'];
  for (let s = 0; s < 15 * 60 + 5; s += 0.5) {
    p.update(0.5);
    t += 500;
    const u = `j${Math.floor(rng() * 40)}`;
    const r = rng();
    if (r < 0.3) p.traiter(ev('comment', u, { comment: deps[Number(u.slice(1)) % deps.length] }));
    else if (r < 0.9) p.traiter(ev('like', u, { likeCount: 10 }));
    else if (r < 0.95) p.traiter(ev('share', u));
    else p.traiter(ev('gift', u, { gift: { id: 'x', name: rng() < 0.8 ? 'Rose' : rng() < 0.5 ? 'Côte à côte' : 'Galaxie', diamonds: 1, count: 5 } }));
    a.surEvenements(p.drain());
    a.tick();
  }
  for (let i = 0; i < 40; i++) {
    t += 500;
    a.tick();
  }
  assert.ok(dites.length > 30, `${dites.length} phrases`);
  assert.ok(dites.every((d) => !/merci/i.test(d)), 'aucun merci');
  for (let i = 1; i < dites.length; i++) assert.notEqual(dites[i], dites[i - 1]);
  assert.ok(dites.some((d) => d === 'Plus que cinq minutes !'));
  assert.ok(dites.some((d) => /^Victoire /.test(d)));
});

test('voix : arrivée annoncée avec le pseudo (filtré) et l’article du département', () => {
  const p = new Partie({ random: () => 0 });
  const dites = [];
  let t = 0;
  const a = new Annonceur(p, { parler: (s) => dites.push(s), maintenant: () => t, random: () => 0 });
  p.traiter({ id: 'a', type: 'comment', user: { id: 'z', name: 'gros connard' }, comment: '86' });
  a.surEvenements(p.drain());
  for (let i = 0; i < 20; i++) {
    t += 1000;
    a.tick();
  }
  assert.ok(dites.includes('Un soldat rejoint la Vienne !'), dites.join(' | '));
});
