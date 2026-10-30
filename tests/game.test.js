import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../public/src/game/engine.js';
import { bfsDistances } from '../public/src/game/map.js';
import { RulesEngine } from '../public/src/core/rules.js';
import { createRng } from '../public/src/core/rng.js';
import { loadConfig, ev } from './helpers.js';

const run = (game, seconds, dt = 1 / 30) => {
  for (let t = 0; t < seconds; t += dt) game.update(dt);
};
const toBattle = (game) => run(game, game.config.match.countdownSec + 0.1);

test('maps are connected, symmetric in ownership and have both capitals', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = new Game(loadConfig(), { seed });
    const { A, B } = g.map.capitals;
    assert.equal(bfsDistances(g.territories, A).size, g.territories.length, `seed ${seed} connected`);
    assert.equal(g.territories[A].owner, 'A');
    assert.equal(g.territories[B].owner, 'B');
    const c = g.counts();
    assert.equal(c.A, c.B, `seed ${seed} fair start`);
    for (const t of g.territories) for (const n of t.neighbors) assert.ok(g.territories[n].neighbors.includes(t.id));
  }
});

test('countdown then battle; spawn commands before the battle are deferred, not lost', () => {
  const g = new Game(loadConfig(), { seed: 3 });
  assert.equal(g.phase, 'countdown');
  g.apply({ type: 'spawn', faction: 'A', kind: 'giant', count: 2 });
  assert.equal(g.units.length, 0);
  toBattle(g);
  assert.equal(g.phase, 'battle');
  run(g, 0.5);
  assert.ok(g.units.some((u) => u.kind === 'giant'));
});

test('units capture weak territories', () => {
  const g = new Game(loadConfig(), { seed: 5 });
  toBattle(g);
  g.drainEvents();
  g.enqueueSpawn('A', 'giant', 4);
  run(g, 10);
  const captures = g.drainEvents().filter((e) => e.type === 'capture' && e.faction === 'A');
  assert.ok(captures.length >= 1);
});

test('meteor converts an enemy frontier territory', () => {
  const cfg = loadConfig();
  cfg.match = { ...cfg.match, dominationRatio: 0.95 };
  const g = new Game(cfg, { seed: 7 });
  toBattle(g);
  // bring the fronts into contact by giving B everything that A does not own
  for (const t of g.territories) if (!t.owner) t.owner = 'B';
  const before = g.counts().A;
  g.apply({ type: 'special', special: 'meteor', faction: 'A', user: { id: 'm', name: 'm' } });
  run(g, 1.2);
  assert.ok(g.counts().A >= before + 1);
  assert.ok(g.drainEvents().some((e) => e.type === 'meteorImpact'));
});

test('a meteor still falling when the round ends is replayed next round', () => {
  const cfg = loadConfig();
  cfg.match = { ...cfg.match, victoryScreenSec: 1 };
  const g = new Game(cfg, { seed: 8 });
  toBattle(g);
  g.apply({ type: 'special', special: 'meteor', faction: 'B', user: null });
  g.declareWinner('A', 'capital');
  run(g, 1.1);
  assert.equal(g.round, 2);
  assert.equal(g.deferred.filter((c) => c.special === 'meteor').length, 1);
});

test('unit cap converts extra spawns into garrison strength', () => {
  const cfg = loadConfig();
  cfg.economy = { ...cfg.economy, maxUnits: 5, spawnRatePerSec: 1000 };
  const g = new Game(cfg, { seed: 9 });
  toBattle(g);
  const garrisonBefore = g.owned('A').reduce((s, t) => s + t.garrison, 0);
  g.enqueueSpawn('A', 'soldier', 50);
  g.update(1 / 30);
  assert.ok(g.units.length <= 5);
  assert.ok(g.owned('A').reduce((s, t) => s + t.garrison, 0) > garrisonBefore);
});

test('capturing the enemy capital wins immediately', () => {
  const g = new Game(loadConfig(), { seed: 11 });
  toBattle(g);
  const capB = g.territories[g.map.capitals.B];
  capB.garrison = 0;
  g.capture(capB, 'A', 5, null);
  g.update(1 / 30);
  assert.equal(g.phase, 'victory');
  assert.equal(g.winner, 'A');
  assert.equal(g.winReason, 'capital');
});

test('timer end gives the win to the faction with most territories, then a new round starts', () => {
  const cfg = loadConfig();
  cfg.match = { ...cfg.match, durationSec: 5, victoryScreenSec: 2 };
  const g = new Game(cfg, { seed: 13 });
  toBattle(g);
  g.territories.find((t) => !t.owner).owner = 'B';
  cfg.economy.autoSpawnIntervalSec = 1e9;
  run(g, 5.2);
  assert.equal(g.phase, 'victory');
  assert.equal(g.winner, 'B');
  assert.equal(g.winReason, 'time');
  run(g, 2.1);
  assert.equal(g.round, 2);
  assert.equal(g.phase, 'countdown');
});

test('full matches driven by a simulated crowd always finish, and the favoured side usually wins', () => {
  const cfg = loadConfig();
  let favouredWins = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const rng = createRng(seed * 31);
    let clock = 1e12;
    const g = new Game(cfg, { seed });
    const rules = new RulesEngine(cfg, { now: () => clock, random: rng });
    let t = 0;
    while (g.phase !== 'victory' && t < cfg.match.durationSec + 30) {
      const dt = 1 / 20;
      g.update(dt);
      t += dt;
      clock += dt * 1000;
      if (rng() < 5 * dt) {
        const id = `v${rng.int(0, 59)}`;
        const fav = Number(id.slice(1)) < 40 ? '1' : '2'; // 2/3 of the crowd prefers SOLAIRE
        const roll = rng();
        const raw = roll < 0.5 ? ev('comment', id, { comment: fav }) : ev('like', id, { likeCount: rng.int(1, 15) });
        for (const c of rules.process({ ...raw, ts: clock }).commands) g.apply(c);
      }
      g.drainEvents();
    }
    assert.equal(g.phase, 'victory', `seed ${seed} finished`);
    if (g.winner === 'A') favouredWins++;
  }
  assert.ok(favouredWins >= 6, `favoured side won ${favouredWins}/8`);
});
