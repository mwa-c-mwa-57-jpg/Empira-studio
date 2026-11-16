// Test navigateur de « La Guerre des Départements » (dist/), avec un faux TikFinity.
//   node tools/build-produit.mjs && node tests/e2e/produit.mjs [dossierCaptures]

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createServeurProduit, createFauxTikFinity } from '../../tools/serveur-produit.mjs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.log('Playwright non installé : test navigateur ignoré.');
  process.exit(0);
}

const captures = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (captures) mkdirSync(captures, { recursive: true });
const echecs = [];
const verifier = (ok, msg) => {
  console.log(`${ok ? '✔' : '✘'} ${msg}`);
  if (!ok) echecs.push(msg);
};
const ecouter = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const attendre = async (page, f, arg, ms = 5000) => page.waitForFunction(f, arg, { timeout: ms }).then(() => true, () => false);

const tik = createFauxTikFinity();
const portTik = await ecouter(tik);
const dev = createServeurProduit({ racine: 'dist/dev', musiques: [] });
const portDev = await ecouter(dev);
const vente = createServeurProduit({ racine: 'dist/La-Guerre-des-Departements', licence: { ok: false, raison: 'Aucune clé de licence sur ce PC : entrez votre clé sur la page de démarrage.' } });
const portVente = await ecouter(vente);
const navigateur = await chromium.launch();
const erreurs = [];
const surveiller = (p) => {
  p.on('pageerror', (e) => erreurs.push(e.message));
  // le logo personnalisé (images/logo-empira.png) est facultatif : son absence n'est pas une erreur
  p.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && !/WebSocket/.test(m.text()) && erreurs.push(m.text()));
};

let n = 0;
const envoyer = (event, data) => tik.envoyer({ event, data: { msgId: String(++n), ...data } });

try {
  // ---------------------------------------------------------------- jeu (version de développement)
  const jeu = await navigateur.newPage({ viewport: { width: 540, height: 960 } });
  surveiller(jeu);
  await jeu.goto(`http://127.0.0.1:${portDev}/guerre-des-departements.html?tikfinity=ws://127.0.0.1:${portTik}&hote=monlive&couleurs=fixe&graine=5&contours=bleu`);
  await jeu.waitForFunction(() => window.empira?.partie);
  verifier(await attendre(jeu, () => !document.querySelector('.etat').classList.contains('montre')), 'connexion à TikFinity');
  verifier(await attendre(jeu, () => document.querySelector('.attente').classList.contains('montre')), 'écran d’attente avant la première action');
  verifier(await jeu.evaluate(() => getComputedStyle(document.querySelector('#interface')).getPropertyValue('--contour').trim() === '#3b82f6'), 'contours des fenêtres en bleu (réglage de l’adresse)');

  envoyer('chat', { uniqueId: 'Nana', nickname: 'Nana', comment: '17' });
  envoyer('chat', { uniqueId: 'Kenzo', nickname: 'Kenzo', comment: 'allez le 63 !' });
  envoyer('like', { uniqueId: 'Nana', nickname: 'Nana', likeCount: 40 });
  envoyer('gift', { uniqueId: 'Kenzo', nickname: 'Kenzo', giftName: 'Rose', diamondCount: 1, giftType: 1, repeatCount: 4, repeatEnd: false });
  envoyer('gift', { uniqueId: 'Kenzo', nickname: 'Kenzo', giftName: 'Rose', diamondCount: 1, giftType: 1, repeatCount: 30, repeatEnd: true });
  envoyer('gift', { uniqueId: 'Nana', nickname: 'Nana', giftName: 'Cadeau inconnu', diamondCount: 3, giftType: 2, repeatCount: 1 });
  const etat = await attendre(jeu, () => window.empira.partie.equipes.get('63')?.soldats === 305 && window.empira.partie.equipes.get('17')?.soldats === 37);
  verifier(etat, 'arrivées +5, 40 likes = 2 soldats, série de Roses comptée une seule fois (+300), cadeau inconnu 10/pièce');
  verifier(await jeu.evaluate(() => window.empira.partie.phase === 'partie'), 'la partie démarre à la première action');

  envoyer('chat', { uniqueId: 'rigolo', nickname: 'Rigolo', comment: '!fin' });
  await jeu.waitForTimeout(300);
  verifier(await jeu.evaluate(() => window.empira.partie.phase === 'partie'), 'un spectateur ne peut pas lancer de commande');

  envoyer('gift', { uniqueId: 'Nana', nickname: 'Nana', giftName: 'Pistolet à argent', diamondCount: 500, giftType: 2, repeatCount: 1 });
  envoyer('gift', { uniqueId: 'Kenzo', nickname: 'Kenzo', giftName: 'Galaxie', diamondCount: 1000, giftType: 2, repeatCount: 1 });
  await jeu.waitForTimeout(2500);
  verifier(await jeu.evaluate(() => window.empira.partie.helicos.length === 1), 'Galaxie : hélicoptères en place');
  if (captures) await jeu.screenshot({ path: path.join(captures, 'produit-1-attaques.png') });

  // coupure de TikFinity : le jeu continue et se reconnecte
  tik.fermerClients();
  verifier(await attendre(jeu, () => document.querySelector('.etat').classList.contains('montre'), null, 3000), 'coupure TikFinity signalée à l’écran');
  verifier(await attendre(jeu, () => !document.querySelector('.etat').classList.contains('montre'), null, 6000), 'reconnexion automatique (3 s)');
  verifier(await jeu.evaluate(() => window.empira.partie.phase === 'partie'), 'la partie a continué pendant la coupure');

  envoyer('chat', { uniqueId: 'MonLive', nickname: 'Hôte', comment: '!vague doublon' });
  verifier(await attendre(jeu, () => window.empira.partie.vague?.id === 'doublon'), 'commande !vague de l’hôte');
  envoyer('chat', { uniqueId: 'modo1', nickname: 'Modo', comment: '!fin', isModerator: true });
  verifier(await attendre(jeu, () => window.empira.partie.phase === 'podium' && document.querySelector('.podium').classList.contains('montre')), 'commande !fin d’un modérateur → podium');
  await jeu.waitForTimeout(700);
  if (captures) await jeu.screenshot({ path: path.join(captures, 'produit-2-podium.png') });
  const paroles = dev.etat.paroles.map((p) => p.texte);
  verifier(paroles.length >= 2 && paroles.every((t) => !/merci/i.test(t)), `voix envoyée au serveur, sans « merci » (${paroles.length} phrases)`);

  // ---------------------------------------------------------------- page de démarrage (développement)
  const dem = await navigateur.newPage({ viewport: { width: 900, height: 1300 } });
  surveiller(dem);
  await dem.goto(`http://127.0.0.1:${portDev}/demarrer.html`);
  verifier(await dem.locator('#blocLicence').isHidden(), 'pas de licence demandée en version de développement');
  await dem.fill('#hote', '@MonLive');
  await dem.check('input[name="unites"][value="rouge"]');
  await dem.check('input[name="voix"][value="homme"]');
  await dem.check('input[name="couleurs"][value="fixe"]');
  const adresse = await dem.textContent('#adresse');
  verifier(/hote=MonLive/.test(adresse) && /unites=rouge/.test(adresse) && /voix=homme/.test(adresse) && /couleurs=fixe&graine=\d+/.test(adresse) && /nomvoix=Microsoft\+Paul/.test(adresse), 'adresse pour LIVE Studio avec les réglages choisis');
  if (captures) await dem.screenshot({ path: path.join(captures, 'produit-3-demarrage.png'), fullPage: true });

  // ---------------------------------------------------------------- version vendue : licence
  const jv = await navigateur.newPage({ viewport: { width: 540, height: 960 } });
  surveiller(jv);
  await jv.goto(`http://127.0.0.1:${portVente}/guerre-des-departements.html?tikfinity=ws://127.0.0.1:${portTik}`);
  verifier(await attendre(jv, () => document.getElementById('licence').classList.contains('montre')), 'version vendue sans licence : le jeu est bloqué');
  const dv = await navigateur.newPage({ viewport: { width: 900, height: 1300 } });
  surveiller(dv);
  await dv.goto(`http://127.0.0.1:${portVente}/demarrer.html`);
  verifier(await attendre(dv, () => !document.getElementById('formLicence').hidden), 'page de démarrage : formulaire de licence');
  await dv.fill('#cle', 'MAUVAISE-CLE-123');
  await dv.click('#activer');
  verifier(await attendre(dv, () => /refusée/.test(document.getElementById('msgLicence').textContent)), 'clé invalide refusée');
  await dv.fill('#cle', 'CLE-DE-TEST-VALIDE');
  await dv.click('#activer');
  verifier(await attendre(dv, () => /active/.test(document.getElementById('etatLicence').textContent)), 'clé valide : licence active');
  await jv.reload();
  verifier(await attendre(jv, () => window.empira?.partie && !document.getElementById('licence').classList.contains('montre')), 'licence activée : le jeu démarre');
  verifier(!(await jv.evaluate(() => typeof window.FranceSimulator !== 'undefined' || document.querySelector('#panel') !== null)), 'aucun mode démo ni bot dans la version vendue');

  verifier(erreurs.length === 0, `aucune erreur JavaScript${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);
} finally {
  await navigateur.close();
  tik.close();
  dev.close();
  vente.close();
}

if (echecs.length) {
  console.error(`\n${echecs.length} vérification(s) en échec`);
  process.exit(1);
}
console.log('\nTest navigateur (produit) : OK');
process.exit(0);
