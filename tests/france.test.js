import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEPARTEMENTS } from '../public/src/france/departements.js';
import { FranceGame } from '../public/src/france/game.js';
import { FranceRules, findDepartement } from '../public/src/france/rules.js';
import { createRng } from '../public/src/core/rng.js';

const loadFrance = () => JSON.parse(readFileSync(new URL('../config/france.json', import.meta.url)));
let n = 0;
const ev = (type, userId, extra = {}) => ({ id: `f-${++n}`, type, source: 'test', user: { id: userId, name: userId }, ...extra });

function setup(overrides = {}) {
  const cfg = { ...loadFrance(), ...overrides };
  let now = 1_700_000_000_000;
  const game = new FranceGame(cfg, { seed: 42 });
  const rules = new FranceRules(cfg, game, { now: () => now });
  return { cfg, game, rules, tick: (ms) => (now += ms), run: (sec) => { for (let t = 0; t < sec; t += 0.05) game.update(0.05); } };
}

test('map data: 96 mainland départements + 5 overseas, symmetric neighbours, connected mainland', () => {
  const main = DEPARTEMENTS.filter((d) => !d.overseas);
  assert.equal(main.length, 96);
  assert.deepEqual(DEPARTEMENTS.filter((d) => d.overseas).map((d) => d.code).sort(), ['971', '972', '973', '974', '976']);
  const by = new Map(DEPARTEMENTS.map((d) => [d.code, d]));
  for (const d of main) for (const nb of d.neighbors) assert.ok(by.get(nb).neighbors.includes(d.code), `${d.code}-${nb}`);
  const seen = new Set(['75']);
  const queue = ['75'];
  while (queue.length) for (const nb of by.get(queue.shift()).neighbors) if (!seen.has(nb)) seen.add(nb), queue.push(nb);
  assert.equal(seen.size, 96, 'Corsica is linked by sea, everything is reachable');
  assert.deepEqual(by.get('17').neighbors, ['16', '24', '33', '79', '85']);
  assert.ok(main.every((d) => d.region && d.rings.length && d.center.length === 2));
});

test('finds a département in chat messages', () => {
  assert.equal(findDepartement('17'), '17');
  assert.equal(findDepartement('le 17 !!!'), '17');
  assert.equal(findDepartement('1'), '01');
  assert.equal(findDepartement('2a'), '2A');
  assert.equal(findDepartement('974 represent'), '974');
  assert.equal(findDepartement('Charente-Maritime'), '17');
  assert.equal(findDepartement('allez'), null);
  assert.equal(findDepartement('20'), null);
  assert.equal(findDepartement('975'), null);
});

test('writing a département makes it enter the war with a join bonus', () => {
  const { game, rules, cfg } = setup();
  rules.process(ev('comment', 'nana', { comment: '17' }));
  const team = game.teams.get('17');
  assert.ok(team.active);
  assert.equal(game.owner.get('17'), '17');
  assert.equal(team.soldiers, cfg.economy.joinBonus);
  assert.equal(game.players.get('nana').team, '17');
  const bubbles = game.drainEvents().filter((e) => e.type === 'bubble');
  assert.match(bubbles[0].text, /fait entrer 17 Charente-Maritime en guerre/);
});

test('comments (with cooldown), likes, shares and follows give soldiers', () => {
  const { game, rules, tick, cfg } = setup();
  const eco = cfg.economy;
  rules.process(ev('comment', 'a', { comment: '63' }));
  const s0 = game.teams.get('63').soldiers;
  assert.equal(rules.process(ev('comment', 'a', { comment: 'go' })).ignored, 'cooldown');
  tick(eco.commentCooldownSec * 1000);
  rules.process(ev('comment', 'a', { comment: 'go' }));
  assert.equal(game.teams.get('63').soldiers, s0 + eco.commentSoldiers);
  rules.process(ev('like', 'a', { likeCount: eco.likesPerSoldier * 2 + 5 }));
  assert.equal(game.teams.get('63').soldiers, s0 + eco.commentSoldiers + 2);
  assert.equal(game.players.get('a').likeRemainder, 5);
  rules.process(ev('share', 'a'));
  rules.process(ev('follow', 'a'));
  assert.equal(game.teams.get('63').soldiers, s0 + eco.commentSoldiers + 2 + eco.shareSoldiers + eco.followSoldiers);
  assert.equal(game.likeTotal, eco.likesPerSoldier * 2 + 5);
});

test('gifts give +10 soldiers per coin; gifts before choosing a département are kept, not lost', () => {
  const { game, rules } = setup();
  rules.process(ev('gift', 'b', { gift: { name: 'Rose', diamonds: 1, count: 7 } }));
  assert.equal(game.players.get('b').pendingSoldiers, 70);
  rules.process(ev('comment', 'b', { comment: '21' }));
  assert.equal(game.teams.get('21').soldiers, 5 + 70);
  rules.process(ev('gift', 'b', { gift: { name: 'Unknown gift', diamonds: 3, count: 1 } }));
  assert.equal(game.teams.get('21').soldiers, 75 + 30);
});

test('attack gifts hit the leader (or the 2nd when the leader attacks); shield blocks them', () => {
  const { game, rules } = setup();
  rules.process(ev('comment', 'l', { comment: '17' }));
  rules.process(ev('gift', 'l', { gift: { name: 'Rose', diamonds: 1, count: 100 } })); // 17: 1005
  rules.process(ev('comment', 's', { comment: '08' }));
  rules.process(ev('gift', 's', { gift: { name: 'Rose', diamonds: 1, count: 30 } })); // 08: 305
  rules.process(ev('comment', 'x', { comment: '63' }));
  rules.process(ev('gift', 'x', { gift: { name: 'Swan', diamonds: 699, count: 1 } })); // 63: +6990, hits leader 17 by 12 %
  assert.equal(game.teams.get('17').soldiers, 1005 - Math.round(1005 * 0.12));
  // 63 is now the leader: its own attack targets the 2nd (17)
  const before17 = game.teams.get('17').soldiers;
  rules.process(ev('gift', 'x', { gift: { name: 'Tomato', diamonds: 1, count: 1 } }));
  assert.ok(game.teams.get('17').soldiers < before17);
  // shield on 63, then a Galaxy from 08 is blocked
  rules.process(ev('gift', 'x', { gift: { name: 'Butterfly', diamonds: 88, count: 1 } }));
  const s63 = game.teams.get('63').soldiers;
  rules.process(ev('gift', 's', { gift: { name: 'Galaxy', diamonds: 1000, count: 1 } }));
  assert.equal(game.teams.get('63').soldiers, s63);
});

test('Galaxy resets the leader to zero and its empire then crumbles', () => {
  const { game, rules, run } = setup();
  rules.process(ev('comment', 'l', { comment: '13' }));
  rules.process(ev('gift', 'l', { gift: { name: 'Rose', diamonds: 1, count: 80 } }));
  run(15);
  const before = game.territoryCount('13');
  assert.ok(before >= 3, `13 expanded to ${before}`);
  rules.process(ev('comment', 'z', { comment: '59' }));
  rules.process(ev('gift', 'z', { gift: { name: 'Galaxy', diamonds: 1000, count: 1 } }));
  assert.equal(game.teams.get('13').soldiers, 0);
  run(20);
  assert.ok(game.territoryCount('13') < before);
  assert.equal(game.owner.get('13'), '13', 'the capital stays');
});

test('soldiers fuel conquests of neighbouring départements with animated attacks', () => {
  const { game, rules, run } = setup();
  rules.process(ev('comment', 'a', { comment: '17' }));
  const team = game.teams.get('17');
  assert.ok(['16', '24', '33', '79', '85'].includes(team.target));
  rules.process(ev('gift', 'a', { gift: { name: 'Rose', diamonds: 1, count: 20 } }));
  run(3);
  const evs = game.drainEvents();
  assert.ok(evs.some((e) => e.type === 'attack' && e.team === '17'));
  const captures = evs.filter((e) => e.type === 'capture' && e.team === '17');
  assert.ok(captures.length >= 1);
  for (const c of captures) assert.equal(game.owner.get(c.code), '17');
});

test('overseas départements land on the borders of mainland France', () => {
  const { game, rules, run } = setup();
  rules.process(ev('comment', 'r', { comment: '974' }));
  rules.process(ev('gift', 'r', { gift: { name: 'Rose', diamonds: 1, count: 10 } }));
  run(3);
  const owned = game.territoriesOf('974').filter((c) => c !== '974');
  assert.ok(owned.length >= 1);
  assert.ok(owned.every((c) => DEPARTEMENTS.find((d) => d.code === c).border || DEPARTEMENTS.find((d) => d.code === c).neighbors.some((nb) => owned.includes(nb))));
});

test('boost multiplies gains; revolution doubles everyone except the target', () => {
  const { game, rules } = setup();
  rules.process(ev('comment', 'a', { comment: '75' }));
  rules.process(ev('gift', 'a', { gift: { name: 'Doughnut', diamonds: 30, count: 1 } })); // +300 then x2 boost
  const s = game.teams.get('75').soldiers;
  rules.process(ev('gift', 'a', { gift: { name: 'Rose', diamonds: 1, count: 1 } }));
  assert.equal(game.teams.get('75').soldiers, s + 20);
  rules.process(ev('comment', 'b', { comment: '93' }));
  game.event = { type: 'revolution', target: '75', endsAt: game.elapsed + 60, duration: 60 };
  const s93 = game.teams.get('93').soldiers;
  rules.process(ev('gift', 'b', { gift: { name: 'Rose', diamonds: 1, count: 1 } }));
  assert.equal(game.teams.get('93').soldiers, s93 + 20);
});

test('duel: the side that recruits more steals 10 % of the other', () => {
  const { game, rules } = setup();
  rules.process(ev('comment', 'a', { comment: '17' }));
  rules.process(ev('gift', 'a', { gift: { name: 'Rose', diamonds: 1, count: 50 } }));
  rules.process(ev('comment', 'b', { comment: '08' }));
  rules.process(ev('gift', 'b', { gift: { name: 'Rose', diamonds: 1, count: 40 } }));
  game.rng = () => 0; // first option = duel
  game.rng.pick = (arr) => arr[0];
  game.rng.range = (a) => a;
  game.startEvent();
  assert.equal(game.event.type, 'duel');
  rules.process(ev('gift', 'b', { gift: { name: 'Rose', diamonds: 1, count: 10 } }));
  const a = game.teams.get('17').soldiers;
  const b = game.teams.get('08').soldiers;
  game.endEvent(false);
  assert.equal(game.teams.get('08').soldiers, b + Math.round(a * 0.1));
  assert.equal(game.teams.get('17').soldiers, a - Math.round(a * 0.1));
});

test('mission: teams of the region that reach the goal earn the bonus', () => {
  const { game, rules, cfg } = setup();
  rules.process(ev('comment', 'a', { comment: '63' }));
  game.event = { type: 'mission', region: 'Auvergne-Rhône-Alpes', target: 25, progress: 0, participants: new Set(), endsAt: game.elapsed + 120, duration: 120 };
  rules.process(ev('gift', 'a', { gift: { name: 'Rose', diamonds: 1, count: 3 } }));
  const s = game.teams.get('63').soldiers;
  game.updateEvents();
  assert.equal(game.event, null);
  assert.equal(game.teams.get('63').soldiers, s + cfg.events.mission.rewardPerDepartment);
});

test('round ends at the timer with a podium, teams are reset and players keep their département', () => {
  const cfg = loadFrance();
  cfg.match = { ...cfg.match, durationSec: 20, victoryScreenSec: 3 };
  const { game, rules, run } = setup({ match: cfg.match });
  rules.process(ev('comment', 'a', { comment: '17' }));
  rules.process(ev('gift', 'a', { gift: { name: 'Rose', diamonds: 1, count: 30 } }));
  rules.process(ev('comment', 'b', { comment: '67' }));
  run(21);
  assert.equal(game.phase, 'victory');
  assert.equal(game.winner.code, '17');
  assert.equal(game.podium.length, 2);
  // a gift during the victory screen is kept for the next round
  rules.process(ev('gift', 'b', { gift: { name: 'Rose', diamonds: 1, count: 2 } }));
  run(3.1);
  assert.equal(game.phase, 'battle');
  assert.equal(game.round, 2);
  assert.equal(game.teams.size, 0);
  rules.process(ev('like', 'b', { likeCount: 1 }));
  assert.equal(game.teams.get('67').soldiers, 5 + 20);
});

test('a simulated live of 10 minutes runs to the end without errors', () => {
  const { game, rules, tick, cfg } = setup();
  const rng = createRng(7);
  const deps = ['17', '63', '21', '08', '75', '13', '974', '2A', '29', '67'];
  let t = 0;
  while (game.phase === 'battle' && t < cfg.match.durationSec + 5) {
    game.update(0.1);
    t += 0.1;
    tick(100);
    for (let k = 0; k < 2; k++) {
      const u = `v${rng.int(0, 79)}`;
      const r = rng();
      const raw = r < 0.2 ? ev('comment', u, { comment: deps[Number(u.slice(1)) % deps.length] })
        : r < 0.9 ? ev('like', u, { likeCount: rng.int(1, 15) })
        : r < 0.98 ? ev('share', u)
        : ev('gift', u, { gift: rng.pick([{ name: 'Rose', diamonds: 1, count: 3 }, { name: 'Swan', diamonds: 699, count: 1 }, { name: 'Butterfly', diamonds: 88, count: 1 }]) });
      rules.process(raw);
    }
    game.drainEvents();
  }
  assert.equal(game.phase, 'victory');
  assert.ok(game.winner);
  const owners = [...game.owner.values()].filter(Boolean).length;
  assert.ok(owners > 20, `${owners} départements conquered`);
});
