import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PrintQueue, tierFor, cardSize } from '../server/queue.js';
import { PageLayout, PAGE } from '../server/layout.js';
import { loadDefaults, sanitize } from '../server/config.js';

const config = () => sanitize(loadDefaults());
const user = (id) => ({ id, uniqueId: id, nickname: id, avatar: '' });

test('palier selon les coins', () => {
  const c = config();
  assert.equal(tierFor(0, c).id, 'free');
  assert.equal(tierFor(1, c).style, 'pencil');
  assert.equal(tierFor(9, c).coins, 1);
  assert.equal(tierFor(10, c).coins, 10);
  assert.equal(tierFor(29, c).style, 'color');
  assert.equal(tierFor(30, c).style, 'festive');
  assert.equal(tierFor(30, c).fullPage, true);
  assert.equal(tierFor(5000, c).style, 'legend');
});

test('les cadeaux passent devant, puis follow > commentaire > arrivée', () => {
  const q = new PrintQueue(config());
  q.add({ kind: 'join', user: user('a') });
  q.add({ kind: 'comment', user: user('b') });
  q.add({ kind: 'follow', user: user('c') });
  q.add({ kind: 'gift', user: user('d'), coins: 1 });
  q.add({ kind: 'gift', user: user('e'), coins: 30 });
  assert.deepEqual(
    q.items.map((j) => j.user.id),
    ['e', 'd', 'c', 'b', 'a']
  );
});

test('pas de doublon, et les cadeaux se cumulent pendant l’attente', () => {
  const q = new PrintQueue(config());
  assert.equal(q.add({ kind: 'follow', user: user('a') }).status, 'added');
  assert.equal(q.add({ kind: 'comment', user: user('a') }).status, 'duplicate');
  assert.equal(q.add({ kind: 'gift', user: user('a'), coins: 5 }).status, 'upgraded');
  const r = q.add({ kind: 'gift', user: user('a'), coins: 4 });
  assert.equal(r.status, 'upgraded');
  assert.equal(q.length, 1);
  assert.equal(r.job.coins, 9);
  assert.equal(r.job.kind, 'gift');
  q.add({ kind: 'gift', user: user('a'), coins: 1 });
  assert.equal(q.items[0].tier.coins, 10);
});

test('anti-spam : un spectateur imprimé ne revient qu’après le délai (sauf cadeau)', () => {
  let now = 1_000_000;
  const c = config();
  c.cooldownMinutes = 10;
  const q = new PrintQueue(c, () => now);
  q.add({ kind: 'follow', user: user('a') });
  assert.equal(q.next().user.id, 'a');
  assert.equal(q.add({ kind: 'comment', user: user('a') }).status, 'cooldown');
  assert.equal(q.add({ kind: 'gift', user: user('a'), coins: 1 }).status, 'added');
  q.clear();
  now += 11 * 60_000;
  assert.equal(q.add({ kind: 'comment', user: user('a') }).status, 'added');
});

test('le spectateur en cours d’impression n’est pas remis dans la file gratuitement', () => {
  const q = new PrintQueue(config());
  assert.equal(q.add({ kind: 'join', user: user('a') }, 'a').status, 'duplicate');
  assert.equal(q.add({ kind: 'gift', user: user('a'), coins: 1 }, 'a').status, 'added');
});

test('file pleine : on retire le moins prioritaire', () => {
  const c = config();
  c.maxQueue = 2;
  const q = new PrintQueue(c);
  q.add({ kind: 'join', user: user('a') });
  q.add({ kind: 'join', user: user('b') });
  assert.equal(q.add({ kind: 'join', user: user('c') }).status, 'full');
  assert.equal(q.add({ kind: 'follow', user: user('d') }).status, 'added');
  assert.deepEqual(
    q.items.map((j) => j.user.id),
    ['d', 'a']
  );
});

test('« imprimer maintenant » met le spectateur en tête', () => {
  const q = new PrintQueue(config());
  q.add({ kind: 'gift', user: user('a'), coins: 100 });
  const { job } = q.add({ kind: 'join', user: user('b') });
  q.bump(job.id);
  assert.equal(q.next().user.id, 'b');
});

test('mise en page : rangées centrées, nouvelle page quand c’est plein', () => {
  const c = config();
  const layout = new PageLayout();
  const { w, h } = cardSize(tierFor(0, c));
  const rects = [];
  let rect;
  while ((rect = layout.place(w, h))) rects.push(rect);
  assert.ok(rects.length >= 4, `au moins 4 petites impressions par page (${rects.length})`);
  for (const r of rects) {
    assert.ok(r.x >= 0 && r.x + r.w <= PAGE.W, 'dans la largeur');
    assert.ok(r.y >= 0 && r.y + r.h <= PAGE.H, 'dans la hauteur');
  }
  // rangée centrée
  const row = rects.filter((r) => r.y === rects[0].y);
  const left = row[0].x;
  const right = PAGE.W - (row.at(-1).x + row.at(-1).w);
  assert.ok(Math.abs(left - right) <= 1, 'rangée centrée');
  // aucun chevauchement
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!overlap, 'pas de chevauchement');
    }
  }
});

test('mise en page : une impression pleine page est seule sur sa page', () => {
  const c = config();
  const layout = new PageLayout();
  const small = cardSize(tierFor(0, c));
  const big = cardSize(tierFor(30, c));
  assert.ok(layout.place(small.w, small.h));
  assert.equal(layout.place(big.w, big.h, true), null, 'page déjà entamée : il faut avancer le papier');
  layout.reset();
  const r = layout.place(big.w, big.h, true);
  assert.ok(r);
  assert.equal(r.x, Math.round((PAGE.W - big.w) / 2));
  assert.equal(layout.place(small.w, small.h), null, 'plus rien après une pleine page');
});

test('tous les paliers par défaut tiennent sur une page', () => {
  const c = config();
  for (const coins of [0, ...c.tiers.map((t) => t.coins)]) {
    const tier = tierFor(coins, c);
    const { w, h } = cardSize(tier);
    const layout = new PageLayout();
    const r = layout.place(w, h, tier.fullPage);
    assert.ok(r && r.y + r.h <= PAGE.H && r.x + r.w <= PAGE.W, `palier ${coins}`);
  }
});

test('réglages : valeurs invalides corrigées', () => {
  const c = sanitize({ maxQueue: -5, speed: 'vite', language: 'de', tiers: [{ coins: 50, style: 'nope', size: 5000 }] });
  assert.equal(c.maxQueue, 1);
  assert.equal(c.speed, loadDefaults().speed);
  assert.equal(c.language, 'fr');
  assert.equal(c.tiers.length, 1);
  assert.equal(c.tiers[0].style, 'pencil');
  assert.equal(c.tiers[0].size, 920);
});
