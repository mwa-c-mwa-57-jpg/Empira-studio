import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Announcer, spokenName } from '../public/src/france/voice.js';
import { placeForms } from '../public/src/france/names.js';
import { FranceGame } from '../public/src/france/game.js';
import { FranceRules } from '../public/src/france/rules.js';
import { cleanSpeech } from '../server/voice.js';

const cfg = JSON.parse(readFileSync(new URL('../config/france.json', import.meta.url)));
let n = 0;
const ev = (type, id, extra = {}) => ({ id: `v-${++n}`, type, user: { id, name: id }, ...extra });

function setup() {
  let t = 0;
  const said = [];
  const game = new FranceGame(cfg, { seed: 3 });
  const rules = new FranceRules(cfg, game);
  const announcer = new Announcer(cfg, game, { speak: (s) => said.push(s), now: () => t, random: () => 0 });
  const flush = (ms = 0) => {
    t += ms;
    announcer.handleEvents(game.drainEvents());
    for (let i = 0; i < 40; i++) {
      t += 500;
      announcer.tick();
    }
  };
  return { game, rules, announcer, said, flush };
}

test('names and départements are made pronounceable', () => {
  assert.equal(spokenName('💎Léa_93✨ <b>'), 'Léa 93 b');
  assert.equal(spokenName('x'.repeat(50)).length, 20);
  assert.deepEqual(placeForms('Charente-Maritime'), { the: 'la Charente-Maritime', of: 'de la Charente-Maritime', to: 'à la Charente-Maritime', plural: false });
  assert.equal(placeForms('Nord').of, 'du Nord');
  assert.equal(placeForms('Eure-et-Loir').the, "l'Eure-et-Loir");
  assert.equal(placeForms('Vosges').of, 'des Vosges');
  assert.equal(placeForms('Paris').the, 'Paris');
  assert.equal(placeForms('Haute-Vienne').of, 'de la Haute-Vienne');
  assert.equal(placeForms('Hérault').the, "l'Hérault");
  assert.equal(placeForms('Grand Est').the, 'le Grand Est');
  assert.equal(placeForms('Auvergne-Rhône-Alpes').of, "de l'Auvergne-Rhône-Alpes");
});

test('announces new départements, grouping several joins in one sentence', () => {
  const { rules, said, flush } = setup();
  flush();
  said.length = 0;
  rules.process(ev('comment', 'a', { comment: '17' }));
  rules.process(ev('comment', 'b', { comment: '63' }));
  flush();
  assert.ok(said.some((s) => s === 'Nouveaux fronts : la Charente-Maritime, le Puy-de-Dôme entrent en guerre !'), said.join(' | '));
});

test('verbs agree with plural départements', () => {
  const { game, rules, said, flush } = setup();
  rules.process(ev('comment', 'a', { comment: '13' }));
  rules.process(ev('gift', 'a', { gift: { name: 'Rose', diamonds: 1, count: 60 } }));
  flush();
  assert.ok(said.includes('Les Bouches-du-Rhône atteignent 500 soldats !'), said.join(' | '));
  rules.process(ev('comment', 'b', { comment: '59' }));
  rules.process(ev('gift', 'b', { gift: { name: 'Galaxie', diamonds: 1000, count: 1 } }));
  flush();
  assert.ok(said.includes('Catastrophe ! Les Bouches-du-Rhône retombent à zéro soldat !'), said.join(' | '));
  void game;
});

test('a single new département is announced with the name of its first soldier', () => {
  const { rules, said, flush } = setup();
  flush();
  said.length = 0;
  rules.process(ev('comment', 'Julia', { comment: '87' }));
  flush();
  assert.equal(said[0], 'Les troupes de la Haute-Vienne débarquent, menées par Julia !');
});

test('thanks for shares and follows, without flooding', () => {
  const { rules, said, flush } = setup();
  rules.process(ev('comment', 'Yanis', { comment: '59' }));
  flush();
  said.length = 0;
  rules.process(ev('follow', 'Yanis'));
  rules.process(ev('share', 'Yanis'));
  flush();
  assert.deepEqual(said, ['Yanis rejoint la famille ! 15 soldats pour le Nord !']);
});

test('milestones, capital invasion with a liberation call, melting soldiers and wake-up', () => {
  const { game, rules, said, flush } = setup();
  rules.process(ev('comment', 'a', { comment: '21' }));
  rules.process(ev('gift', 'a', { gift: { name: 'Rose', diamonds: 1, count: 100 } }));
  flush();
  assert.ok(said.includes("La Côte-d'Or atteint 1000 soldats !"), said.join(' | '));
  rules.process(ev('comment', 'b', { comment: '58' }));
  flush();
  said.length = 0;
  game.capture('21', '58');
  flush();
  assert.equal(said[0], "La Nièvre tombe sous le drapeau de la Côte-d'Or ! Soldats de la Nièvre, 40 soldats et vous êtes libres !");
  said.length = 0;
  game.emit({ type: 'awake', team: '72', user: { id: 'z', name: 'Royaume' } });
  flush();
  assert.equal(said[0], 'La Sarthe se réveille, ses soldats arrêtent de fondre ! Merci Royaume !');
});

test('announces big gifts with the viewer name, not small ones', () => {
  const { rules, said, flush } = setup();
  rules.process(ev('comment', 'Nana', { comment: '17' }));
  flush();
  said.length = 0;
  rules.process(ev('gift', 'Nana', { gift: { name: 'Rose', diamonds: 1, count: 3 } }));
  flush();
  assert.equal(said.length, 0);
  rules.process(ev('gift', 'Nana', { gift: { name: 'Cygne', diamonds: 699, count: 1 } }));
  flush();
  assert.match(said.join(' '), /Nana envoie Cygne pour la Charente-Maritime/);
});

test('announces live events and the victory with the king', () => {
  const { game, rules, said, flush } = setup();
  rules.process(ev('comment', 'a', { comment: '17' }));
  rules.process(ev('gift', 'a', { gift: { name: 'Rose', diamonds: 1, count: 20 } }));
  rules.process(ev('comment', 'b', { comment: '08' }));
  rules.process(ev('gift', 'b', { gift: { name: 'Rose', diamonds: 1, count: 10 } }));
  flush();
  game.event = null;
  game.rng.pick = (arr) => arr[0];
  game.startEvent();
  flush();
  assert.ok(said.some((s) => s.startsWith('Duel ! La Charente-Maritime contre les Ardennes')), said.join(' | '));
  game.elapsed = cfg.match.durationSec;
  game.update(0.01);
  flush();
  assert.ok(said.some((s) => /^Victoire de la Charente-Maritime, qui remporte la partie/.test(s) && /Bravo à a, roi du pays/.test(s)), said.join(' | '));
});

test('never queues more than maxQueue phrases and never repeats the same one', () => {
  const { announcer, said } = setup();
  for (let i = 0; i < 10; i++) announcer.say(`phrase ${i}`, 1);
  announcer.say('phrase 0', 1);
  assert.ok(announcer.queue.length <= cfg.voice.maxQueue);
  announcer.say('urgent', 3);
  assert.equal(announcer.queue[0].text, 'urgent');
  announcer.tick();
  assert.deepEqual(said, ['urgent']);
});

test('disabled announcer stays silent', () => {
  const { announcer, rules, said, flush } = setup();
  announcer.enabled = false;
  rules.process(ev('comment', 'a', { comment: '17' }));
  flush();
  assert.equal(said.length, 0);
});

test('server-side speech text is cleaned (no control chars, no leading dash, bounded)', () => {
  assert.equal(cleanSpeech('--rm -rf\n /'), 'rm -rf /');
  assert.equal(cleanSpeech('a\u0007b'), 'a b');
  assert.equal(cleanSpeech('x'.repeat(500)).length, 220);
});
