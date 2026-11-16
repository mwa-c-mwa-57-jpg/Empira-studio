// Enregistre la vidéo de démo d'« Empira Conquest » (9:16) : fenêtre de pilotage, puis une partie complète.
//
//   node tools/build-produit.mjs --sans-node && node tools/make-demo-produit.mjs <dossier>
//   python3 tools/make-demo-audio.py <dossier> <voix-piper.onnx> <police.ttf>
//
// Le live est SIMULÉ (faux live du mode test) : les événements suivent le format réel de TikTok et passent par le
// vrai serveur du jeu, comme pendant un live. Produit <dossier>/demo-raw.webm, phrases.json et legendes.json.

import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync, renameSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { creerServeur } from '../produit/serveur/serveur.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sortie = path.resolve(process.argv[2] || 'demo-produit');
mkdirSync(sortie, { recursive: true });

const serveur = await creerServeur({ racine: 'dist/dev', test: true, donnees: mkdtempSync(path.join(os.tmpdir(), 'demo-')), journal: () => {} });
await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${serveur.address().port}`;

let t0 = 0;
const phrases = [];
let lues = 0;
const ecoute = setInterval(async () => {
  const p = await fetch(`${base}/test/paroles`).then((r) => r.json()).catch(() => []);
  for (; lues < p.length; lues++) phrases.push({ t: Date.now() - t0, text: p[lues].texte });
}, 120);

let n = 0;
const user = (pseudo) => ({ nickname: pseudo, displayId: pseudo.toLowerCase().normalize('NFD').replace(/[^\w]/g, ''), avatarThumb: { urlList: [] } });
const live = (sorte, pseudo, data = {}) => fetch(`${base}/test/tiktok`, { method: 'POST', body: JSON.stringify({ sorte, data: { common: { msgId: `d${++n}` }, user: user(pseudo), ...data } }) });
const chat = (pseudo, texte) => live('chat', pseudo, { content: texte });
const CAT = { Rose: [1, 1], Donut: [30, 2], 'Cœur dans les mains': [100, 2], Galaxie: [1000, 2], 'Pistolet à argent': [500, 2], 'Léon le chaton': [4888, 2], Papillon: [88, 2], 'Cœur avec les doigts': [5, 1], 'Voiture de sport': [7000, 2] };
async function cadeau(pseudo, nom, fois = 1) {
  const [diamants, type] = CAT[nom];
  const gift = { name: nom, diamondCount: diamants, type, combo: type === 1 };
  if (type === 1) {
    for (let i = 1; i < fois; i += Math.max(1, Math.floor(fois / 4))) await live('gift', pseudo, { giftId: nom, gift, repeatCount: i, repeatEnd: 0 });
    return live('gift', pseudo, { giftId: nom, gift, repeatCount: fois, repeatEnd: 1 });
  }
  return live('gift', pseudo, { giftId: nom, gift, repeatCount: 1, repeatEnd: 0 });
}
const regie = (nom, arg = '') => fetch(`${base}/commande`, { method: 'POST', body: JSON.stringify({ nom, arg }) });

const navigateur = await chromium.launch();
const contexte = await navigateur.newContext({ viewport: { width: 720, height: 1280 }, recordVideo: { dir: sortie, size: { width: 720, height: 1280 } } });
t0 = Date.now();
const page = await contexte.newPage();
page.on('pageerror', (e) => console.error('erreur de page :', e.message));
const a = async (sec, f) => {
  const attente = t0 + sec * 1000 - Date.now();
  if (attente > 0) await new Promise((r) => setTimeout(r, attente));
  await f();
};

// ------------------------------------------------------------------ 1. fenêtre de pilotage
await page.goto(`${base}/demarrer.html`);
await a(1.5, () => page.click('#pseudo'));
await a(1.8, () => page.type('#pseudo', 'empira_live', { delay: 110 }));
await a(3.6, () => page.click('#connecter'));
await a(6.0, () => page.evaluate(() => document.getElementById('regie').closest('section').scrollIntoView({ behavior: 'smooth' })));
const adresse = (await page.textContent('#adresse')).replace(/^http:\/\/[^/]+/, base);

// ------------------------------------------------------------------ 2. la partie
await a(9.5, () => page.goto(adresse));
await page.waitForFunction(() => window.empira?.partie);
const combattants = [['Nana', '17'], ['Kenzo', '63'], ['Julia', '75'], ['Inès', '13'], ['Yanis', '59'], ['Léa', '21'], ['Malik', '974'], ['Zoé', '2A'], ['Hugo', '29'], ['Sarah', '67'], ['Noah', '33'], ['Chloé', '69']];
for (let i = 0; i < combattants.length; i++) await a(11 + i * 0.7, () => chat(...combattants[i]));

// foule : des dizaines de spectateurs qui likent et commentent
let foule = null;
await a(19.5, async () => {
  const prenoms = ['Lina', 'Rayan', 'Jade', 'Thomas', 'Sofia', 'Ilyes', 'Emma', 'Lucas', 'Camille', 'Sofiane', 'Louna', 'Enzo', 'Maëlys', 'Bilal', 'Clara', 'Nathan'];
  const deps = ['17', '63', '75', '13', '59', '21', '974', '2A', '29', '67', '33', '69', '31', '44', '06', '35'];
  const spectateurs = Array.from({ length: 70 }, (_, i) => [`${prenoms[i % prenoms.length]}${i > 15 ? i : ''}`, deps[Math.floor(Math.random() ** 1.5 * deps.length)]]);
  for (const [p, d] of spectateurs) chat(p, d);
  foule = setInterval(() => {
    const [p] = spectateurs[Math.floor(Math.random() * spectateurs.length)];
    const r = Math.random();
    if (r < 0.8) live('like', p, { count: 5 + Math.floor(Math.random() * 25) });
    else if (r < 0.95) chat(p, ['allez !', 'go go go', 'on lâche rien', 'trop fort'][Math.floor(Math.random() * 4)]);
    else cadeau(p, 'Rose', 1 + Math.floor(Math.random() * 4));
  }, 160);
});
await a(23, () => cadeau('Nana', 'Rose', 12));
await a(26.5, () => cadeau('Kenzo', 'Donut'));
await a(29.5, () => live('social', 'Yanis', { common: { msgId: `d${++n}`, displayText: { key: 'pm_mt_msg_viewer_share' } }, shareType: '1' }));
await a(31.5, () => cadeau('Sarah', 'Cœur avec les doigts'));
await a(34, () => regie('duel'));
await a(39, () => cadeau('Inès', 'Cœur dans les mains'));
await a(43, () => regie('vague', 'assaut'));
await a(46, () => cadeau('Malik', 'Galaxie'));
await a(50, () => regie('ravitaillement'));
await a(53, () => cadeau('Julia', 'Voiture de sport'));
await a(62, () => cadeau('Kenzo', 'Léon le chaton'));
await a(71, () => regie('fin'));
await a(86, async () => clearInterval(foule));

const video = page.video();
await contexte.close();
await navigateur.close();
clearInterval(ecoute);
serveur.close();
renameSync(await video.path(), path.join(sortie, 'demo-raw.webm'));
writeFileSync(path.join(sortie, 'phrases.json'), JSON.stringify(phrases, null, 2));
writeFileSync(path.join(sortie, 'legendes.json'), JSON.stringify([
  {"de": 0.5, "a": 9.5, "texte": "Connexion au live en un clic", "bas": true},
  {"de": 10.5, "a": 22.5, "texte": "Chacun écrit son département"},
  {"de": 22.5, "a": 33.5, "texte": "Likes et cadeaux = renforts"},
  {"de": 33.5, "a": 45.5, "texte": "La régie lance duels et vagues"},
  {"de": 45.5, "a": 52.5, "texte": "Hélicos de combat, ravitaillements"},
  {"de": 52.5, "a": 61.5, "texte": "Voiture de sport = porte-avions"},
  {"de": 61.5, "a": 70.5, "texte": "Léon = bombes nucléaires"},
  {"de": 71, "a": 81.5, "texte": "Podium et Roi du pays"},
  {"de": 81.5, "a": 99, "texte": "Empira Conquest", "taille": 46},
  {"de": 81.5, "a": 99, "texte": "Bientôt disponible", "taille": 30, "y": 122}
], null, 2));
console.log(`${phrases.length} phrases → ${sortie}`);
process.exit(0);
