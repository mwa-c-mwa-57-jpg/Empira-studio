import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUser, normalizeGift, TikTokBridge } from '../server/tiktok.js';

test('utilisateur au format TikTok actuel (proto v3)', () => {
  const u = normalizeUser({
    id: '123',
    displayId: 'shinta',
    nickname: 'Shinta 🌸',
    avatarThumb: { urlList: ['https://p16-sign.tiktokcdn.com/a.webp', 'https://p16-sign.tiktokcdn.com/a.jpeg'] },
  });
  assert.deepEqual(u, { id: '123', uniqueId: 'shinta', nickname: 'Shinta 🌸', avatar: 'https://p16-sign.tiktokcdn.com/a.jpeg' });
});

test('utilisateur au format « legacy »', () => {
  const u = normalizeUser({ userId: '9', uniqueId: 'panz_299', profilePictureUrl: 'https://x.tiktokcdn.com/p.jpg' });
  assert.equal(u.id, '9');
  assert.equal(u.nickname, 'panz_299');
  assert.equal(u.avatar, 'https://x.tiktokcdn.com/p.jpg');
});

test('utilisateur vide : pas de plantage', () => {
  const u = normalizeUser(undefined);
  assert.equal(typeof u.id, 'string');
  assert.equal(u.avatar, '');
});

test('cadeau : valeur et combo', () => {
  const g = normalizeGift({ giftId: 5655, repeatCount: 9, repeatEnd: 1, gift: { diamondCount: 1, type: 1, name: 'Rose' } });
  assert.equal(g.unit, 1);
  assert.equal(g.repeatCount, 9);
  assert.equal(g.streakable, true);
  assert.equal(g.repeatEnd, true);
  assert.equal(g.giftName, 'Rose');
});

test('combo : seul le total final est compté', () => {
  const bridge = new TikTokBridge(() => ({ tiktok: {} }));
  const events = [];
  bridge.on('viewer', (e) => events.push(e));
  const user = { id: '1', displayId: 'nhia', nickname: 'Nhia' };
  const gift = { diamondCount: 1, type: 1, name: 'Rose' };
  for (let i = 1; i <= 9; i++) bridge.onGift({ user, giftId: 1, groupId: 7, repeatCount: i, repeatEnd: 0, gift });
  bridge.onGift({ user, giftId: 1, groupId: 7, repeatCount: 9, repeatEnd: 1, gift });
  assert.equal(events.length, 1);
  assert.equal(events[0].coins, 9);
  assert.equal(events[0].kind, 'gift');
  // cadeau non combo (ex. 30 coins) : compté tout de suite
  bridge.onGift({ user, giftId: 2, repeatCount: 1, repeatEnd: 0, gift: { diamondCount: 30, type: 2, name: 'Donut' } });
  assert.equal(events.length, 2);
  assert.equal(events[1].coins, 30);
  bridge.teardown();
});
