import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GiftImages } from '../public/src/france/giftImages.js';
import { giftImage, mapGiftCatalog, mapTikTokEvent } from '../server/adapters/tiktok-live.js';
import { normalizeEvent } from '../public/src/core/events.js';

const ROSE = 'https://p16-webcast.tiktokcdn.com/img/rose.png';

test('gift pictures are read from every shape the TikTok library may use', () => {
  assert.equal(giftImage({ image: { url_list: [ROSE] } }), ROSE);
  assert.equal(giftImage({ image: { urlList: [ROSE] } }), ROSE);
  assert.equal(giftImage({ giftImage: { giftPictureUrl: ROSE } }), ROSE);
  assert.equal(giftImage({ giftPictureUrl: ROSE }), ROSE);
  assert.equal(giftImage({ image: { url_list: ['http://insecure/rose.png'] } }), undefined);
  assert.equal(giftImage(null), undefined);
});

test('a gift event carries its picture through the adapter and the normaliser', () => {
  const ev = mapTikTokEvent('gift', {
    user: { userId: '1', nickname: 'Nana' },
    giftId: 5655,
    repeatCount: 3,
    repeatEnd: true,
    giftDetails: { giftType: 1, giftName: 'Rose', diamondCount: 1 },
    extendedGiftInfo: { image: { url_list: [ROSE] } },
  });
  assert.equal(ev.gift.image, ROSE);
  assert.equal(normalizeEvent(ev).event.gift.image, ROSE);
  assert.equal(normalizeEvent({ ...ev, gift: { ...ev.gift, image: 'javascript:alert(1)' } }).event.gift.image, undefined);
});

test('the room gift list becomes a catalogue of pictures', () => {
  const list = mapGiftCatalog([
    { id: 5655, name: 'Rose', diamond_count: 1, image: { url_list: [ROSE] } },
    { id: 7, name: 'Sans image', diamond_count: 5 },
    { id: 8, name: 'Pirate', diamond_count: 449, image: { url_list: ['ftp://bad'] } },
  ]);
  assert.deepEqual(list, [{ id: '5655', name: 'Rose', diamonds: 1, image: ROSE }]);
  assert.deepEqual(mapGiftCatalog(undefined), []);
});

test('configured gifts find their real picture by TikTok id or by name (French or English)', () => {
  const images = new GiftImages();
  assert.equal(images.learnAll([{ id: '5655', name: 'Rose', image: ROSE }, { id: '1', name: 'Galaxy', image: 'https://cdn/galaxy.png' }, { id: '2', name: 'x', image: 'data:image/png;base64,AAA' }]), 2);
  assert.equal(images.urlFor({ names: ['Rose'], ids: [] }), ROSE);
  assert.equal(images.urlFor({ names: ['Galaxie', 'Galaxy'], ids: [] }), 'https://cdn/galaxy.png');
  assert.equal(images.urlFor({ names: ['Inconnu'], ids: ['5655'] }), ROSE);
  assert.equal(images.urlFor({ names: ['Cygne'], ids: [] }), null, 'no picture yet → the emoji is drawn');
  assert.equal(images.image(null), null);
});
