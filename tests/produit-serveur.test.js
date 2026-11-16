import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { aplatir } from '../produit/serveur/tiktok.mjs';
import { creerLicence } from '../produit/serveur/licence.mjs';
import { creerServeur } from '../produit/serveur/serveur.mjs';
import { convertirTikFinity } from '../produit/src/tikfinity.js';
import { normalizeEvent } from '../public/src/core/events.js';

// Formes réelles observées sur un live TikTok (schéma v3, tiktok-live-connector 2.4.0), abrégées
const userReel = { nickname: '🐸gizmo☆', displayId: 'sachikokuroda01', id: '6701514161706304513', avatarThumb: { urlList: ['https://p16-sign-va.tiktokcdn.com/a.webp'] }, userAttr: { isAdmin: false } };
const commun = (id) => ({ method: 'x', msgId: id, roomId: '7706493711049493255' });

test('conversion des messages du live (schéma v3 réel) vers le format lu par le jeu', () => {
  const chat = aplatir('chat', { common: commun('7708695467869178625'), user: userReel, content: 'allez le 17 !', userIdentity: { isModeratorOfAnchor: false } });
  assert.deepEqual(chat, { event: 'chat', data: { uniqueId: 'sachikokuroda01', nickname: '🐸gizmo☆', profilePictureUrl: 'https://p16-sign-va.tiktokcdn.com/a.webp', msgId: '7708695467869178625', isModerator: false, comment: 'allez le 17 !' } });
  assert.equal(aplatir('like', { common: commun('1'), user: userReel, count: 15, total: '865108' }).data.likeCount, 15);
  assert.equal(aplatir('chat', { common: commun('2'), user: userReel, content: 'x', userIdentity: { isModeratorOfAnchor: true } }).data.isModerator, true);
  assert.equal(aplatir('social', { common: { msgId: '3', displayText: { key: 'pm_mt_msg_viewer_share' } }, user: userReel, shareType: '1' }).event, 'share');
  assert.equal(aplatir('social', { common: { msgId: '4', displayText: { key: 'pm_main_follow_message_viewer_2' } }, user: userReel, followCount: '1' }).event, 'follow');
  assert.equal(aplatir('social', { common: { msgId: '5' }, user: userReel }), null);
  assert.equal(aplatir('chat', { content: 'sans utilisateur' }), null);
});

test('cadeaux du schéma v3 : nom, prix, série, image ; ancien schéma accepté en repli', () => {
  const g = { common: commun('9'), user: userReel, giftId: '5655', repeatCount: 7, repeatEnd: 1, gift: { id: '5655', name: 'Rose', diamondCount: 1, type: 1, combo: true, image: { urlList: ['https://p19-webcast.tiktokcdn.com/rose.png'] } } };
  const m = aplatir('gift', g);
  assert.deepEqual([m.data.giftName, m.data.diamondCount, m.data.giftType, m.data.repeatCount, m.data.repeatEnd, m.data.giftPictureUrl], ['Rose', 1, 1, 7, true, 'https://p19-webcast.tiktokcdn.com/rose.png']);
  // en cours de série : le jeu l'ignore ; fin de série : comptée une fois
  assert.equal(convertirTikFinity(aplatir('gift', { ...g, repeatEnd: 0 })), null);
  const fin = convertirTikFinity(m).evenement;
  assert.deepEqual(fin.gift, { id: '5655', name: 'Rose', diamonds: 1, count: 7, image: 'https://p19-webcast.tiktokcdn.com/rose.png' });
  assert.equal(normalizeEvent(fin).ok, true);
  const unique = aplatir('gift', { common: commun('10'), user: userReel, giftId: '5000', repeatCount: 1, repeatEnd: 0, gift: { name: 'Galaxie', diamondCount: 1000, type: 2, combo: false } });
  assert.equal(convertirTikFinity(unique).evenement.gift.diamonds, 1000, 'cadeau unique compté sans attendre de fin de série');
  const ancien = aplatir('gift', { user: { uniqueId: 'vieux', nickname: 'V' }, giftId: 1, repeatCount: 2, repeatEnd: true, giftDetails: { giftName: 'Rose', diamondCount: 1, giftType: 1 } });
  assert.equal(ancien.data.giftName, 'Rose');
});

// ---------------------------------------------------------------- licence Lemon Squeezy (faux serveur)

function fauxLemon(reponses) {
  const appels = [];
  const fetchImpl = async (url, opts) => {
    const action = url.split('/').pop();
    appels.push({ action, corps: Object.fromEntries(new URLSearchParams(opts.body)) });
    const r = reponses[action];
    if (r === 'reseau') throw new Error('hors ligne');
    return { json: async () => r };
  };
  return { appels, fetchImpl };
}

test('licence : activation, vérification, limite de 2 PC, tolérance hors ligne, produit vérifié', async () => {
  const dossier = await mkdtemp(path.join(os.tmpdir(), 'licence-'));
  const fichier = path.join(dossier, 'licence.json');
  let t = Date.UTC(2026, 10, 16);
  const ok = { activated: true, instance: { id: 'inst-1' }, meta: { product_id: 42 } };
  const valide = { valid: true, license_key: { status: 'active' }, meta: { product_id: 42 } };
  let lemon = fauxLemon({ activate: ok, validate: valide });
  let l = creerLicence({ fichier, produitId: '42', nomPc: 'PC-LIVE', fetchImpl: lemon.fetchImpl, maintenant: () => t });
  assert.equal((await l.etat()).ok, false, 'pas de clé au départ');
  assert.deepEqual(await l.activer('court'), { ok: false, raison: 'Clé de licence invalide.' });
  assert.equal((await l.activer('ABCD-1234-EFGH-5678')).ok, true);
  assert.deepEqual(lemon.appels.at(-1), { action: 'activate', corps: { license_key: 'ABCD-1234-EFGH-5678', instance_name: 'PC-LIVE' } });
  assert.deepEqual(await l.etat(), { ok: true });

  // 3 jours plus tard, sans Internet : toléré ; 7 jours plus tard : bloqué
  lemon = fauxLemon({ validate: 'reseau' });
  t += 3 * 86400000;
  l = creerLicence({ fichier, produitId: '42', fetchImpl: lemon.fetchImpl, maintenant: () => t });
  assert.deepEqual(await l.etat(), { ok: true, horsLigne: true });
  t += 4 * 86400000;
  l = creerLicence({ fichier, produitId: '42', fetchImpl: lemon.fetchImpl, maintenant: () => t });
  assert.equal((await l.etat()).ok, false);

  // clé d'un autre produit, clé révoquée, limite d'activations atteinte
  l = creerLicence({ fichier, produitId: '42', fetchImpl: fauxLemon({ validate: { ...valide, meta: { product_id: 7 } } }).fetchImpl, maintenant: () => t });
  assert.equal((await l.etat()).ok, false);
  l = creerLicence({ fichier, produitId: '42', fetchImpl: fauxLemon({ validate: { valid: false, license_key: { status: 'disabled' } } }).fetchImpl, maintenant: () => t });
  assert.equal((await l.etat()).ok, false);
  l = creerLicence({ fichier: path.join(dossier, 'autre.json'), fetchImpl: fauxLemon({ activate: { activated: false, error: 'This license key has reached the activation limit.' } }).fetchImpl });
  assert.match((await l.activer('ABCD-1234-EFGH-9999')).raison, /2 PC/);
  await rm(dossier, { recursive: true, force: true });
});

// ---------------------------------------------------------------- serveur du jeu, avec le faux live

let serveur;
let base;
let donnees;
before(async () => {
  donnees = await mkdtemp(path.join(os.tmpdir(), 'serveur-'));
  serveur = await creerServeur({ racine: 'produit', test: true, donnees, journal: () => {} });
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${serveur.address().port}`;
});
after(async () => {
  serveur.close();
  await rm(donnees, { recursive: true, force: true });
});

const post = (chemin, corps) => fetch(`${base}${chemin}`, { method: 'POST', body: JSON.stringify(corps ?? {}) }).then((r) => r.json());
const brut = (chemin, entetes = {}) => new Promise((resolve) => {
  http.get({ host: '127.0.0.1', port: serveur.address().port, path: chemin, headers: entetes }, (res) => {
    res.resume();
    resolve(res.statusCode);
  });
});
function clientJeu() {
  const ws = new WebSocket(`${base.replace('http', 'ws')}/evenements`);
  const recus = [];
  ws.onmessage = (m) => recus.push(JSON.parse(m.data));
  const attendre = async (f, ms = 3000) => {
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      const x = recus.find(f);
      if (x) return x;
      await new Promise((r) => setTimeout(r, 20));
    }
    return null;
  };
  return { ws, recus, attendre, ouvert: new Promise((r) => (ws.onopen = r)) };
}

test('serveur : connexion au live par la fenêtre de pilotage, événements relayés au jeu, état affiché', async () => {
  const jeu = clientJeu();
  await jeu.ouvert;
  assert.ok(await jeu.attendre((m) => m.statut?.etat === 'deconnecte'), 'le jeu reçoit l’état de la connexion dès son ouverture');
  assert.equal((await post('/tiktok/connecter', { pseudo: 'pseudo invalide !' })).ok, false);
  assert.equal((await post('/tiktok/connecter', { pseudo: '@mon_live' })).ok, true);
  assert.ok(await jeu.attendre((m) => m.statut?.etat === 'connecte'));
  assert.equal((await fetch(`${base}/reglages`).then((r) => r.json())).pseudo, 'mon_live', 'le pseudo est retenu pour le prochain lancement');
  await post('/test/tiktok', { sorte: 'chat', data: { common: { msgId: '77' }, user: userReel, content: '17' } });
  const m = await jeu.attendre((x) => x.event === 'chat');
  assert.equal(m.data.comment, '17');
  assert.equal(m.data.uniqueId, 'sachikokuroda01');
  // perte de connexion : reconnexion automatique annoncée
  await post('/test/couper');
  assert.ok(await jeu.attendre((x) => x.statut?.etat === 'reconnexion'));
  await post('/tiktok/deconnecter');
  assert.ok(await jeu.attendre((x) => x.statut?.etat === 'deconnecte' && x.statut.detail === 'Déconnecté.'));
  jeu.ws.close();
});

test('serveur : live hors ligne signalé clairement', async () => {
  await post('/tiktok/connecter', { pseudo: 'hors_ligne' });
  await new Promise((r) => setTimeout(r, 200));
  const e = await fetch(`${base}/tiktok/etat`).then((r) => r.json());
  assert.equal(e.etat, 'reconnexion');
  assert.match(e.detail, /n'est pas en live/);
  await post('/tiktok/deconnecter');
});

test('serveur : régie — les commandes connues sont relayées au jeu, les autres refusées', async () => {
  const jeu = clientJeu();
  await jeu.ouvert;
  const r = await post('/commande', { nom: 'vague', arg: 'assaut' });
  assert.deepEqual(r, { ok: true, pages: 1 });
  assert.deepEqual((await jeu.attendre((m) => m.commande)).commande, { nom: 'vague', arg: 'assaut' });
  assert.equal((await post('/commande', { nom: 'formater_disque' })).ok, false);
  jeu.ws.close();
});

test('serveur : voix, musiques, fichiers, sécurité', async () => {
  assert.equal((await fetch(`${base}/parler?t=${encodeURIComponent('Bonjour à tous')}&voix=Microsoft%20Paul%20Desktop`).then((r) => r.json())).ok, true);
  assert.deepEqual(await fetch(`${base}/test/paroles`).then((r) => r.json()), [{ texte: 'Bonjour à tous', voix: 'Microsoft Paul Desktop' }]);
  assert.equal((await fetch(`${base}/voix`).then((r) => r.json())).length, 2);
  assert.deepEqual(await fetch(`${base}/musiques`).then((r) => r.json()), []);
  assert.equal(await brut('/GUIDE.html'), 200);
  for (const chemin of ['/../package.json', '/..%2f..%2fpackage.json', '/outils/LANCER%20LE%20JEU.bat', '/serveur/serveur.mjs/../../../package.json']) assert.equal(await brut(chemin), 404, chemin);
  assert.equal(await brut('/etat', { 'Sec-Fetch-Site': 'cross-site' }), 403, 'un autre site ne peut pas piloter le serveur');
  assert.equal((await fetch(`${base}/licence`).then((r) => r.json())).ok, true, 'pas de licence en version de développement');
});
