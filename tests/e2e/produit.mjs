// Test navigateur de « Empira Conquest » avec le VRAI serveur assemblé (dist/…/outils/serveur.cjs).
// Le live TikTok est simulé par le faux live intégré au mode test (EMPIRA_TEST=1, absent de la version vendue).
//   node tools/build-produit.mjs --sans-node && node tests/e2e/produit.mjs [dossierCaptures]

import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
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
  // comme sur le PC d'un acheteur : Node lancé sans options (la version vendue refuse NODE_OPTIONS, NODE_EXTRA_CA_CERTS…)
  const propre = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^NODE_/.test(k)));
  const p = spawn(process.execPath, [path.join(dossier, 'outils/serveur.cjs'), '--port', String(port), '--sans-navigateur'], { env: { ...propre, APPDATA: appdata, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
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
    const cle = q.get('license_key');
    lemon.appels.push(cle);
    if (req.url.endsWith('/activate')) {
      if (cle === 'CLE-DE-TEST-VALIDE') return json(200, { activated: true, instance: { id: 'inst-1' }, meta: { store_id: 1, product_id: 1 } });
      if (cle === 'CLE-AUTRE-PRODUIT') return json(200, { activated: true, instance: { id: 'inst-2' }, meta: { store_id: 666, product_id: 1 } });
      return json(404, { activated: false, error: 'license_key not found' });
    }
    if (req.url.endsWith('/deactivate')) return json(200, { deactivated: true });
    if (req.url.endsWith('/validate')) return json(200, { valid: q.get('instance_id') === 'inst-1', license_key: { status: 'active' }, instance: { id: 'inst-1' }, meta: { store_id: 1, product_id: 1 } });
    json(404, {});
  });
});
lemon.appels = [];
lemon.appelsDe = (cle) => lemon.appels.filter((c) => c === cle).length;
await new Promise((r) => lemon.listen(0, '127.0.0.1', r));
const post = (base, chemin, corps) => fetch(`${base}${chemin}`, { method: 'POST', body: JSON.stringify(corps) }).then(async (r) => ({ status: r.status, json: await r.json() }));

const tik = createFauxTikFinity();
await new Promise((r) => tik.listen(0, '127.0.0.1', r));
const urlLemon = `http://127.0.0.1:${lemon.address().port}/v1/licenses`;
const dev = await lancerServeur('dist/dev', { EMPIRA_TEST: '1' });
// copie d'essai : identique à la version vendue (code protégé, jeu chiffré), mais boutique fictive et faux Lemon Squeezy
const vente = await lancerServeur('dist/essai-vente', { EMPIRA_TEST: '1', EMPIRA_LEMON_URL: urlLemon });
// la vraie version vendue doit ignorer l'adresse de remplacement et le mode test
const livree = await lancerServeur('dist/Empira-Conquest', { EMPIRA_TEST: '1', EMPIRA_LEMON_URL: urlLemon });
const devTik = await lancerServeur('dist/dev', { EMPIRA_TEST: '1', EMPIRA_TIKFINITY_URL: `ws://127.0.0.1:${tik.address().port}` });
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

  // ---------------------------------------------------------------- TikFinity relayé par le serveur (mode automatique)
  const pt = await navigateur.newPage({ viewport: { width: 900, height: 1300 } });
  surveiller(pt);
  await pt.goto(`${devTik.base}/demarrer.html`);
  await pt.fill('#pseudo', 'Mon_Live');
  await pt.selectOption('#source', 'auto');
  await pt.click('#connecter');
  verifier(await attendre(pt, () => /Relié à TikFinity/.test(document.getElementById('sLive').textContent)), 'mode automatique : TikFinity ouvert → le live passe par TikFinity');
  const jt = await navigateur.newPage({ viewport: { width: 540, height: 960 } });
  surveiller(jt);
  await jt.goto((await pt.textContent('#adresse')).replace(/^http:\/\/[^/]+/, devTik.base));
  await jt.waitForFunction(() => window.empira?.partie);
  await jt.waitForTimeout(300);
  tik.envoyer({ event: 'chat', data: { uniqueId: 'Zoe', nickname: 'Zoé', comment: '974', msgId: 'z1' } });
  verifier(await attendre(jt, () => window.empira.partie.equipes.has('974')), 'événement TikFinity relayé par le serveur jusqu’au jeu');
  tik.fermerClients();
  tik.close();
  verifier(await attendre(pt, () => /connexion directe/.test(document.getElementById('sLive').textContent), null, 9000), 'TikFinity fermé → bascule automatique en connexion directe');

  // ---------------------------------------------------------------- version vendue (copie d'essai) : licence
  const jv = await navigateur.newPage({ viewport: { width: 540, height: 960 } });
  surveiller(jv);
  await jv.goto(`${vente.base}/empira-conquest.html`);
  verifier(/Licence non activée/.test(await jv.textContent('body')) && !(await jv.evaluate(() => Boolean(window.empira))), 'version vendue sans licence : le jeu n’est même pas envoyé au navigateur');
  verifier((await post(vente.base, '/tiktok/connecter', { pseudo: 'x_y' })).status === 403 && (await post(vente.base, '/commande', { nom: 'fin' })).status === 403, 'sans licence : connexion au live et régie refusées');
  const dv = await navigateur.newPage({ viewport: { width: 900, height: 1300 } });
  surveiller(dv);
  await dv.goto(`${vente.base}/demarrer.html`);
  verifier(await attendre(dv, () => !document.getElementById('formLicence').hidden), 'fenêtre de pilotage : formulaire de licence');
  verifier(await dv.evaluate(() => !document.getElementById('ligneAcheter').hidden && document.getElementById('acheter').href.startsWith('https://')), 'bouton « Acheter une clé »');
  await dv.fill('#cle', 'MAUVAISE-CLE-123');
  await dv.click('#activer');
  verifier(await attendre(dv, () => /refusée/.test(document.getElementById('msgLicence').textContent)), 'clé invalide refusée (réponse de Lemon Squeezy)');
  await dv.fill('#cle', 'CLE-AUTRE-PRODUIT');
  await dv.click('#activer');
  verifier(await attendre(dv, () => /pas une clé Empira Conquest/.test(document.getElementById('msgLicence').textContent)), 'clé valide mais d’une autre boutique : refusée');
  await dv.fill('#cle', 'CLE-DE-TEST-VALIDE');
  await dv.click('#activer');
  verifier(await attendre(dv, () => /active/.test(document.getElementById('etatLicence').textContent)), 'clé valide : licence active');
  if (captures) await dv.screenshot({ path: path.join(captures, 'produit-4-licence.png') });
  await jv.reload();
  verifier(await attendre(jv, () => window.empira?.partie && !document.getElementById('licence').classList.contains('montre')), 'licence activée : le jeu (protégé, déchiffré par le serveur) démarre');
  const faux = await fetch(`${vente.base}/test/tiktok`, { method: 'POST', body: '{}' });
  verifier(faux.status === 404, 'version vendue : aucun faux live ni bot, même en mode test');

  // ---------------------------------------------------------------- vraie version vendue : rien ne la détourne
  const avant = lemon.appels.length;
  const l = await fetch(`${livree.base}/licence`).then((r) => r.json());
  const a = await post(livree.base, '/licence/activer', { cle: 'CLE-DE-TEST-VALIDE' });
  verifier(!l.ok && !a.json.ok && lemon.appels.length === avant, `version livrée : l’adresse Lemon de remplacement est ignorée (${a.json.raison})`);
  verifier(!existsSync('dist/Empira-Conquest/empira-conquest.html') && !readFileSync('dist/Empira-Conquest/outils/jeu.bin').includes('Empira'), 'version livrée : le jeu n’existe que chiffré sur le disque');
  verifier(!/creerLicence|lemonsqueezy|store_id|Licence invalide|aes-256-gcm/.test(readFileSync('dist/Empira-Conquest/outils/serveur.cjs', 'utf8')), 'version livrée : code du serveur protégé (aucun nom ni texte lisible)');

  verifier(erreurs.length === 0, `aucune erreur JavaScript${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);
} finally {
  await navigateur.close();
  dev.arreter();
  vente.arreter();
  livree.arreter();
  devTik.arreter();
  try {
    tik.close();
  } catch {
    /* déjà fermé */
  }
  lemon.close();
}

if (echecs.length) {
  console.error(`\n${echecs.length} vérification(s) en échec`);
  process.exit(1);
}
console.log('\nTest navigateur (produit) : OK');
process.exit(0);
