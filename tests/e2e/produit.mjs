// Test navigateur de « La Guerre des Départements » avec le VRAI serveur assemblé (dist/…/outils/serveur.cjs).
// Le live TikTok est simulé par le faux live intégré au mode test (EMPIRA_TEST=1, absent de la version vendue).
//   node tools/build-produit.mjs --sans-node && node tests/e2e/produit.mjs [dossierCaptures]

import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createFauxTikFinity } from '../../tools/faux-tikfinity.mjs';

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
const portLibre = () => new Promise((r) => {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => {
    const p = s.address().port;
    s.close(() => r(p));
  });
});
const attendre = async (page, f, arg, ms = 6000) => page.waitForFunction(f, arg, { timeout: ms }).then(() => true, () => false);

async function lancerServeur(dossier, env) {
  const port = await portLibre();
  const appdata = mkdtempSync(path.join(os.tmpdir(), 'empira-'));
  const p = spawn(process.execPath, [path.join(dossier, 'outils/serveur.cjs'), '--port', String(port), '--sans-navigateur'], { env: { ...process.env, APPDATA: appdata, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let sortie = '';
  p.stdout.on('data', (c) => (sortie += c));
  p.stderr.on('data', (c) => (sortie += c));
  for (let i = 0; i < 50 && !/démarré/.test(sortie); i++) await new Promise((r) => setTimeout(r, 100));
  return { base: `http://127.0.0.1:${port}`, port, arreter: () => (p.kill(), rmSync(appdata, { recursive: true, force: true })), sortie: () => sortie };
}

// faux Lemon Squeezy pour la licence de la version vendue
const lemon = http.createServer((req, res) => {
  let corps = '';
  req.on('data', (c) => (corps += c));
  req.on('end', () => {
    const q = new URLSearchParams(corps);
    const json = (code, o) => (res.writeHead(code, { 'Content-Type': 'application/json' }), res.end(JSON.stringify(o)));
    if (req.url.endsWith('/activate')) return q.get('license_key') === 'CLE-DE-TEST-VALIDE' ? json(200, { activated: true, instance: { id: 'inst-1' }, meta: { product_id: 1 } }) : json(404, { activated: false, error: 'license_key not found' });
    if (req.url.endsWith('/validate')) return json(200, { valid: q.get('instance_id') === 'inst-1', license_key: { status: 'active' }, meta: { product_id: 1 } });
    json(404, {});
  });
});
await new Promise((r) => lemon.listen(0, '127.0.0.1', r));

const dev = await lancerServeur('dist/dev', { EMPIRA_TEST: '1' });
const vente = await lancerServeur('dist/La-Guerre-des-Departements', { EMPIRA_TEST: '1', EMPIRA_LEMON_URL: `http://127.0.0.1:${lemon.address().port}/v1/licenses` });
const tik = createFauxTikFinity();
await new Promise((r) => tik.listen(0, '127.0.0.1', r));
const navigateur = await chromium.launch();
const erreurs = [];
const surveiller = (p) => {
  p.on('pageerror', (e) => erreurs.push(e.message));
  // le logo personnalisé (images/logo-empira.png) est facultatif ; TikFinity absent n'est pas une erreur
  p.on('console', (m) => m.type() === 'error' && !/404|WebSocket/.test(m.text()) && erreurs.push(m.text()));
};
let n = 0;
const user = (pseudo, extra = {}) => ({ nickname: pseudo, displayId: pseudo.toLowerCase(), avatarThumb: { urlList: [] }, ...extra });
const live = (sorte, data) => fetch(`${dev.base}/test/tiktok`, { method: 'POST', body: JSON.stringify({ sorte, data: { common: { msgId: String(++n) }, ...data } }) }).then((r) => r.json());

try {
  // ---------------------------------------------------------------- fenêtre de pilotage : connexion directe au live
  const pilote = await navigateur.newPage({ viewport: { width: 900, height: 1400 } });
  surveiller(pilote);
  await pilote.goto(`${dev.base}/demarrer.html`);
  await pilote.fill('#pseudo', '@Mon_Live');
  await pilote.click('#connecter');
  verifier(await attendre(pilote, () => document.getElementById('iLive').className === 'ok' && /Connecté au live de @Mon_Live/.test(document.getElementById('sLive').textContent)), 'fenêtre de pilotage : connexion directe au live, sans TikFinity');
  const adresse = await pilote.textContent('#adresse');
  verifier(/hote=Mon_Live/.test(adresse) && !/source=tikfinity/.test(adresse), 'adresse pour LIVE Studio : l’hôte est le pseudo du live, source directe');

  // ---------------------------------------------------------------- jeu branché sur le serveur
  const jeu = await navigateur.newPage({ viewport: { width: 540, height: 960 } });
  surveiller(jeu);
  await jeu.goto(adresse.replace(/^http:\/\/[^/]+/, dev.base));
  await jeu.waitForFunction(() => window.empira?.partie);
  verifier(await attendre(jeu, () => !document.querySelector('.etat').classList.contains('montre')), 'le jeu reçoit le live par le serveur (aucun bandeau d’erreur)');

  await live('chat', { user: user('Nana'), content: '17' });
  await live('chat', { user: user('Kenzo'), content: 'allez le 63 !' });
  await live('like', { user: user('Nana'), count: 40 });
  const rose = { user: user('Kenzo'), giftId: '5655', gift: { name: 'Rose', diamondCount: 1, type: 1, combo: true, image: { urlList: ['https://p19-webcast.tiktokcdn.com/rose.png'] } } };
  await live('gift', { ...rose, repeatCount: 4, repeatEnd: 0 });
  await live('gift', { ...rose, repeatCount: 30, repeatEnd: 1 });
  await live('social', { user: user('Nana'), common: { msgId: String(++n), displayText: { key: 'pm_mt_msg_viewer_share' } }, shareType: '1' });
  verifier(await attendre(jeu, () => window.empira.partie.equipes.get('63')?.soldats === 305 && window.empira.partie.equipes.get('17')?.soldats === 15), 'événements du live (format réel TikTok) : arrivées, likes, série de Roses comptée une fois, partage');
  await live('chat', { user: user('Rigolo'), content: '!fin' });
  await jeu.waitForTimeout(300);
  verifier(await jeu.evaluate(() => window.empira.partie.phase === 'partie'), 'un spectateur ne peut pas lancer de commande');
  await live('chat', { user: user('Modo1'), content: '!duree 10', userIdentity: { isModeratorOfAnchor: true } });
  verifier(await attendre(jeu, () => window.empira.partie.duree === 600), 'commande d’un modérateur depuis le tchat');
  await live('gift', { user: user('Nana'), giftId: '5000', repeatCount: 1, repeatEnd: 0, gift: { name: 'Galaxie', diamondCount: 1000, type: 2, combo: false } });
  verifier(await attendre(jeu, () => window.empira.partie.helicos.length === 1), 'Galaxie (cadeau unique) : hélicoptères en place');

  // ---------------------------------------------------------------- régie par boutons
  await pilote.click('button[data-cmd="vague"][data-arg="assaut"]');
  verifier(await attendre(jeu, () => window.empira.partie.vague?.id === 'assaut'), 'régie : bouton « Assaut final »');
  verifier(await attendre(pilote, () => /Envoyé au jeu \(1 écran\)/.test(document.getElementById('retourRegie').textContent)), 'régie : confirmation de l’envoi');
  await pilote.fill('#texteFixe', 'Abonnez-vous pour votre département !');
  await pilote.click('#btnFixe');
  verifier(await attendre(jeu, () => window.empira.partie.messageFixe === 'Abonnez-vous pour votre département !'), 'régie : message épinglé');
  if (captures) await pilote.screenshot({ path: path.join(captures, 'produit-3-pilotage.png'), fullPage: true });

  // ---------------------------------------------------------------- coupure du live : bandeau puis reconnexion
  await fetch(`${dev.base}/test/couper`, { method: 'POST' });
  verifier(await attendre(jeu, () => /TikTok : Connexion perdue/.test(document.querySelector('.etat').textContent)), 'coupure du live signalée sur le jeu');
  verifier(await attendre(jeu, () => !document.querySelector('.etat').classList.contains('montre'), null, 9000), 'reconnexion automatique au live');
  verifier(await jeu.evaluate(() => window.empira.partie.phase === 'partie'), 'la partie a continué pendant la coupure');
  if (captures) await jeu.screenshot({ path: path.join(captures, 'produit-1-attaques.png') });
  await pilote.click('button[data-cmd="fin"]');
  verifier(await attendre(jeu, () => window.empira.partie.phase === 'podium'), 'régie : bouton « Terminer la partie » → podium');
  await jeu.waitForTimeout(700);
  if (captures) await jeu.screenshot({ path: path.join(captures, 'produit-2-podium.png') });
  const paroles = await fetch(`${dev.base}/test/paroles`).then((r) => r.json());
  verifier(paroles.length >= 2 && paroles.every((p) => !/merci/i.test(p.texte)), `voix lue par le serveur, sans « merci » (${paroles.length} phrases)`);

  // ---------------------------------------------------------------- TikFinity en secours
  const secours = await navigateur.newPage({ viewport: { width: 540, height: 960 } });
  surveiller(secours);
  await secours.goto(`${dev.base}/guerre-des-departements.html?source=tikfinity&tikfinity=ws://127.0.0.1:${tik.address().port}`);
  await secours.waitForFunction(() => window.empira?.partie);
  for (let i = 0; i < 40 && tik.nbClients() === 0; i++) await secours.waitForTimeout(100);
  tik.envoyer({ event: 'chat', data: { uniqueId: 'Zoe', nickname: 'Zoé', comment: '974', msgId: 'z1' } });
  verifier(await attendre(secours, () => window.empira.partie.equipes.has('974')), 'source TikFinity (secours) toujours disponible');

  // ---------------------------------------------------------------- version vendue : licence
  const jv = await navigateur.newPage({ viewport: { width: 540, height: 960 } });
  surveiller(jv);
  await jv.goto(`${vente.base}/guerre-des-departements.html`);
  verifier(await attendre(jv, () => document.getElementById('licence').classList.contains('montre')), 'version vendue sans licence : le jeu est bloqué');
  const dv = await navigateur.newPage({ viewport: { width: 900, height: 1300 } });
  surveiller(dv);
  await dv.goto(`${vente.base}/demarrer.html`);
  verifier(await attendre(dv, () => !document.getElementById('formLicence').hidden), 'fenêtre de pilotage : formulaire de licence');
  await dv.fill('#cle', 'MAUVAISE-CLE-123');
  await dv.click('#activer');
  verifier(await attendre(dv, () => /refusée/.test(document.getElementById('msgLicence').textContent)), 'clé invalide refusée (réponse de Lemon Squeezy)');
  await dv.fill('#cle', 'CLE-DE-TEST-VALIDE');
  await dv.click('#activer');
  verifier(await attendre(dv, () => /active/.test(document.getElementById('etatLicence').textContent)), 'clé valide : licence active');
  await jv.reload();
  verifier(await attendre(jv, () => window.empira?.partie && !document.getElementById('licence').classList.contains('montre')), 'licence activée : le jeu démarre');
  const faux = await fetch(`${vente.base}/test/tiktok`, { method: 'POST', body: '{}' });
  verifier(faux.status === 404, 'version vendue : aucun faux live ni bot, même en mode test');

  verifier(erreurs.length === 0, `aucune erreur JavaScript${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);
} finally {
  await navigateur.close();
  dev.arreter();
  vente.arreter();
  tik.close();
  lemon.close();
}

if (echecs.length) {
  console.error(`\n${echecs.length} vérification(s) en échec`);
  process.exit(1);
}
console.log('\nTest navigateur (produit) : OK');
process.exit(0);
