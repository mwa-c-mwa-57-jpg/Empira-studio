import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RulesEngine } from '../public/src/core/rules.js';
import { loadConfig, ev } from './helpers.js';

function setup() {
  let now = 1_700_000_000_000;
  const cfg = loadConfig();
  const rules = new RulesEngine(cfg, { now: () => now, random: () => 0.1 });
  return { cfg, rules, tick: (ms) => (now += ms), now: () => now };
}
const spawns = (res) => res.commands.filter((c) => c.type === 'spawn');

test('comment "1" joins SOLAIRE and spawns a soldier; "Azur !" switches to AZUR', () => {
  const { rules, tick } = setup();
  let res = rules.process(ev('comment', 'bob', { comment: '1' }));
  assert.equal(rules.players.get('bob').faction, 'A');
  assert.deepEqual(spawns(res).map((c) => [c.faction, c.kind, c.count]), [['A', 'soldier', 1]]);
  tick(10_000);
  res = rules.process(ev('comment', 'bob', { comment: 'Azur !' }));
  assert.equal(rules.players.get('bob').faction, 'B');
  assert.equal(spawns(res)[0].faction, 'B');
});

test('comments from a team member spawn units, limited by the per-user cooldown', () => {
  const { rules, tick } = setup();
  rules.process(ev('comment', 'bob', { comment: '2' }));
  assert.equal(rules.process(ev('comment', 'bob', { comment: 'allez' })).ignored, 'cooldown');
  tick(6_000);
  assert.equal(spawns(rules.process(ev('comment', 'bob', { comment: 'allez' }))).length, 1);
});

test('chat without a team and command-like text has no effect', () => {
  const { rules } = setup();
  assert.equal(rules.process(ev('comment', 'eve', { comment: 'bonjour' })).ignored, 'no-team');
  const res = rules.process(ev('comment', 'eve', { comment: '!admin restart; drop table' }));
  assert.equal(res.commands.length, 0);
  assert.equal(rules.players.get('eve').faction, null);
});

test('likes fill the faction gauge and trigger a charge', () => {
  const { rules, cfg } = setup();
  rules.process(ev('comment', 'bob', { comment: '1' }));
  const per = cfg.interactions.like.likesPerCharge;
  assert.equal(spawns(rules.process(ev('like', 'bob', { likeCount: per - 1 }))).length, 0);
  const res = rules.process(ev('like', 'bob', { likeCount: per + 2 }));
  assert.equal(spawns(res).length, 2);
  assert.equal(rules.likePools.A, 1);
});

test('viewers without a team are assigned to the smaller team when they like or gift', () => {
  const { rules } = setup();
  rules.process(ev('comment', 'a1', { comment: '1' }));
  rules.process(ev('comment', 'a2', { comment: '1' }));
  rules.process(ev('like', 'newbie', { likeCount: 1 }));
  assert.equal(rules.players.get('newbie').faction, 'B');
});

test('gift tiers: knight, giant, meteor; streak count is capped', () => {
  const { rules, cfg } = setup();
  rules.process(ev('comment', 'g', { comment: '1' }));
  const gift = (diamonds, count = 1) => rules.process(ev('gift', 'g', { gift: { id: 'x', name: 'X', diamonds, count } }));
  assert.equal(spawns(gift(1))[0].kind, 'knight');
  assert.equal(spawns(gift(30))[0].kind, 'giant');
  const meteor = gift(500).commands.filter((c) => c.type === 'special');
  assert.equal(meteor.length, 1);
  assert.equal(meteor[0].special, 'meteor');
  assert.equal(spawns(gift(1, 999))[0].count, cfg.interactions.gift.maxSpawnPerEvent);
  assert.equal(gift(500, 50).commands.filter((c) => c.type === 'special').length, 3);
});

test('duplicate event ids are applied only once', () => {
  const { rules } = setup();
  const e = ev('gift', 'g', { gift: { diamonds: 1 } });
  assert.equal(rules.process(e).accepted, true);
  assert.equal(rules.process({ ...e }).reason, 'duplicate');
});

test('rate limit drops floods of likes/comments but never gifts', () => {
  const { rules, cfg } = setup();
  const max = cfg.safety.maxEventsPerSec;
  for (let i = 0; i < max; i++) rules.process(ev('like', `u${i}`));
  assert.equal(rules.process(ev('like', 'late')).reason, 'rate-limited');
  assert.equal(rules.process(ev('gift', 'payer', { gift: { diamonds: 1 } })).accepted, true);
});

test('leaderboard ranks round points and resetRound clears them but keeps teams', () => {
  const { rules } = setup();
  rules.process(ev('comment', 'a', { comment: '1' }));
  rules.process(ev('gift', 'b', { gift: { diamonds: 30 } }));
  const lb = rules.leaderboard();
  assert.equal(lb[0].name, 'b');
  rules.resetRound();
  assert.equal(rules.leaderboard().length, 0);
  assert.equal(rules.players.get('a').faction, 'A');
});
