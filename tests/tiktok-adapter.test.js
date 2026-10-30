import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTikTokEvent } from '../server/adapters/tiktok-live.js';
import { normalizeEvent } from '../public/src/core/events.js';

const user = { userId: '123', uniqueId: 'bob_tt', nickname: 'Bob' };

test('maps chat, like, follow and share to normalised events', () => {
  const chat = mapTikTokEvent('chat', { user, comment: '1', common: { msgId: '42' } });
  assert.deepEqual([chat.type, chat.comment, chat.user.id, chat.user.name, chat.id], ['comment', '1', '123', 'Bob', 'tt-chat-42']);
  assert.equal(mapTikTokEvent('like', { user, likeCount: 15 }).likeCount, 15);
  assert.equal(mapTikTokEvent('follow', { user }).type, 'follow');
  assert.equal(mapTikTokEvent('share', { user }).type, 'share');
  for (const k of ['chat', 'like', 'follow', 'share']) {
    assert.equal(normalizeEvent(mapTikTokEvent(k, { user, comment: 'x', likeCount: 1 })).ok, true, k);
  }
});

test('gift streaks are only counted once, at the end of the streak', () => {
  const base = { user, giftId: 5655, giftDetails: { giftType: 1, giftName: 'Rose', diamondCount: 1 } };
  assert.equal(mapTikTokEvent('gift', { ...base, repeatCount: 3, repeatEnd: false }), null);
  const end = mapTikTokEvent('gift', { ...base, repeatCount: 7, repeatEnd: true });
  assert.deepEqual(end.gift, { id: '5655', name: 'Rose', diamonds: 1, count: 7 });
  const single = mapTikTokEvent('gift', { user, giftId: 1, repeatCount: 1, giftDetails: { giftType: 2, diamondCount: 500 } });
  assert.equal(single.gift.diamonds, 500);
});

test('ignores malformed data', () => {
  assert.equal(mapTikTokEvent('chat', null), null);
  assert.equal(mapTikTokEvent('chat', { comment: 'no user' }), null);
  assert.equal(mapTikTokEvent('unknown', { user }), null);
});
