import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, normalizeKeyword, sanitizeText } from '../public/src/core/events.js';

const NOW = 1_700_000_000_000;

test('accepts a valid comment and keeps only known fields', () => {
  const r = normalizeEvent({ id: 'x1', type: 'comment', comment: ' 1 ', user: { id: 'u1', name: 'Alice' }, ts: NOW, evil: 'x' }, { now: NOW });
  assert.equal(r.ok, true);
  assert.deepEqual(r.event, { id: 'x1', type: 'comment', source: 'unknown', ts: NOW, user: { id: 'u1', name: 'Alice' }, comment: '1' });
});

test('rejects unknown types, missing users, empty comments and non-objects', () => {
  assert.equal(normalizeEvent({ type: 'admin', user: { id: 'u' } }).reason, 'unknown-type');
  assert.equal(normalizeEvent({ type: 'like' }).reason, 'missing-user');
  assert.equal(normalizeEvent({ type: 'comment', comment: '   ', user: { id: 'u' } }).reason, 'empty-comment');
  assert.equal(normalizeEvent('{"type":"like"}').reason, 'not-an-object');
  assert.equal(normalizeEvent(null).reason, 'not-an-object');
});

test('rejects stale events and clamps future timestamps', () => {
  assert.equal(normalizeEvent({ type: 'like', user: { id: 'u' }, ts: NOW - 10 * 60_000 }, { now: NOW }).reason, 'stale');
  assert.equal(normalizeEvent({ type: 'like', user: { id: 'u' }, ts: NOW + 3_600_000 }, { now: NOW }).event.ts, NOW);
});

test('sanitises names (control / bidi chars, length) and clamps numbers', () => {
  const r = normalizeEvent({ type: 'gift', user: { id: 'u', name: 'A‮B\u0000C' + 'x'.repeat(100) }, gift: { diamonds: -5, count: 1e9 } }, { now: NOW });
  assert.equal(r.event.user.name.startsWith('ABC'), true);
  assert.equal(r.event.user.name.length, 24);
  assert.equal(r.event.gift.diamonds, 0);
  assert.equal(r.event.gift.count, 1000);
  assert.equal(normalizeEvent({ type: 'like', user: { id: 'u' }, likeCount: 'abc' }).event.likeCount, 1);
  assert.equal(normalizeEvent({ type: 'like', user: { id: 'u' }, likeCount: 99999 }).event.likeCount, 1000);
});

test('markup is kept as inert text (rendering uses canvas / textContent only)', () => {
  assert.equal(sanitizeText('<img src=x onerror=alert(1)>', 200), '<img src=x onerror=alert(1)>');
});

test('keyword normalisation strips accents, case and punctuation', () => {
  assert.equal(normalizeKeyword('  SOLÉIL !!! '), 'soleil');
  assert.equal(normalizeKeyword('Azur, go'), 'azur go');
});
