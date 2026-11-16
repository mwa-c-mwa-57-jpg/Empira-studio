import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertirTikFinity, lireCommande } from '../produit/src/tikfinity.js';
import { normalizeEvent } from '../public/src/core/events.js';

const pic = 'https://p16-sign.tiktokcdn.com/a.jpg';

test('messages TikFinity (format TikTok-Live-Connector) → événements du jeu', () => {
  const chat = convertirTikFinity(JSON.stringify({ event: 'chat', data: { uniqueId: 'Nana_17', nickname: 'Nana', comment: '17', msgId: '9', profilePictureUrl: pic } }));
  assert.deepEqual(chat.evenement.user, { id: 'nana_17', name: 'Nana', avatar: pic });
  assert.equal(chat.evenement.type, 'comment');
  assert.equal(chat.evenement.id, 'tf-chat-9');
  assert.equal(convertirTikFinity({ event: 'like', data: { uniqueId: 'a', likeCount: 15 } }).evenement.likeCount, 15);
  assert.equal(convertirTikFinity({ event: 'follow', data: { uniqueId: 'a' } }).evenement.type, 'follow');
  assert.equal(convertirTikFinity({ event: 'share', data: { uniqueId: 'a' } }).evenement.type, 'share');
  assert.equal(convertirTikFinity({ event: 'social', data: { uniqueId: 'a', displayType: 'pm_mt_msg_viewer_share' } }).evenement.type, 'share');
  assert.equal(convertirTikFinity({ event: 'social', data: { uniqueId: 'a', displayType: 'pm_main_follow_message_viewer_2' } }).evenement.type, 'follow');
  for (const m of [chat]) assert.equal(normalizeEvent(m.evenement).ok, true);
});

test('cadeaux : seule la fin d’une série compte, avec le prix, le nombre et l’image', () => {
  const base = { uniqueId: 'a', giftId: 5655, giftName: 'Rose', diamondCount: 1, giftType: 1, giftPictureUrl: 'https://p19-webcast.tiktokcdn.com/rose.png' };
  assert.equal(convertirTikFinity({ event: 'gift', data: { ...base, repeatCount: 4, repeatEnd: false } }), null);
  const fin = convertirTikFinity({ event: 'gift', data: { ...base, repeatCount: 7, repeatEnd: true } }).evenement;
  assert.deepEqual(fin.gift, { id: '5655', name: 'Rose', diamonds: 1, count: 7, image: 'https://p19-webcast.tiktokcdn.com/rose.png' });
  assert.equal(normalizeEvent(fin).event.gift.image, 'https://p19-webcast.tiktokcdn.com/rose.png');
  const unique = convertirTikFinity({ event: 'gift', data: { uniqueId: 'a', giftName: 'Galaxie', diamondCount: 1000, giftType: 2, repeatCount: 1 } }).evenement;
  assert.equal(unique.gift.diamonds, 1000);
});

test('commandes : acceptées de l’hôte et des modérateurs seulement', () => {
  assert.deepEqual(lireCommande('!Durée 10'), { nom: 'duree', arg: '10' });
  assert.deepEqual(lireCommande('!révolution'), { nom: 'revolution', arg: '' });
  assert.equal(lireCommande('!inconnue'), null);
  assert.equal(lireCommande('salut'), null);
  const hote = convertirTikFinity({ event: 'chat', data: { uniqueId: 'MonLive', comment: '!fin' } }, { hote: '@monlive' });
  assert.deepEqual(hote.commande, { nom: 'fin', arg: '' });
  const modo = convertirTikFinity({ event: 'chat', data: { uniqueId: 'modo', comment: '!vague assaut', isModerator: true } });
  assert.deepEqual(modo.commande, { nom: 'vague', arg: 'assaut' });
  const spectateur = convertirTikFinity({ event: 'chat', data: { uniqueId: 'rigolo', comment: '!reset' } }, { hote: 'monlive' });
  assert.equal(spectateur.commande, undefined, 'un spectateur ne peut pas lancer de commande');
  assert.equal(spectateur.evenement.type, 'comment');
});

test('messages invalides ignorés sans erreur', () => {
  assert.equal(convertirTikFinity('pas du json'), null);
  assert.equal(convertirTikFinity({ event: 'chat', data: { comment: 'sans pseudo' } }), null);
  assert.equal(convertirTikFinity({ event: 'roomUser', data: { uniqueId: 'a' } }), null);
  assert.equal(convertirTikFinity(null), null);
});
