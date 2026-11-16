// Assemble « Empira Conquest » prête à vendre :
//   dist/Empira-Conquest/   version vendue : licence Lemon Squeezy (produit/vente.json), code protégé (obfusqué),
//                           jeu chiffré, node.exe Windows embarqué
//   dist/essai-vente/       copie d'essai pour les tests : identique, mais boutique fictive et adresse Lemon remplaçable
//                           (JAMAIS à livrer)
//   dist/dev/               version de développement, sans licence ni protection
//
// node tools/build-produit.mjs [--sans-node]

import { build } from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';
import crypto from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile, rm, stat, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RACINE, 'produit/src');
const NOM = 'Empira-Conquest';
const NODE_VERSION = 'v22.22.0';
const SANS_NODE = process.argv.includes('--sans-node');
const crlf = (t) => t.replace(/\r?\n/g, '\r\n');
const VENTE = JSON.parse(await readFile(path.join(RACINE, 'produit/vente.json'), 'utf8'));

// Secret d'assemblage (jamais dans git) : il scelle le fichier de licence des acheteurs. Il doit rester LE MÊME pour
// toutes les versions : s'il change, les acheteurs devront ressaisir leur clé. Source : EMPIRA_SECRET_VENTE, sinon
// produit/.secret-vente (créé au premier assemblage : à sauvegarder en lieu sûr).
async function secretVente() {
  if (process.env.EMPIRA_SECRET_VENTE) return process.env.EMPIRA_SECRET_VENTE.trim();
  const f = path.join(RACINE, 'produit/.secret-vente');
  const lu = await readFile(f, 'utf8').then((t) => t.trim(), () => '');
  if (lu) return lu;
  const neuf = crypto.randomBytes(32).toString('hex');
  await writeFile(f, `${neuf}\n`, { mode: 0o600 });
  console.warn('⚠ Nouveau secret de vente créé dans produit/.secret-vente : sauvegardez-le (il n\'est pas dans git).');
  return neuf;
}
const SECRET = await secretVente();
// clé API Euler Stream d'Empira (facultative, jamais dans git) : incluse, protégée, dans la version vendue pour que les
// acheteurs ne dépendent pas de la limite gratuite. Source : EMPIRA_CLE_EULER, sinon produit/.cle-euler.
const CLE_EULER = (process.env.EMPIRA_CLE_EULER || (await readFile(path.join(RACINE, 'produit/.cle-euler'), 'utf8').catch(() => ''))).trim();

// Protection du code : réglages de l'obfuscateur (javascript-obfuscator, licence BSD-2 ; il n'est pas livré)
const PROTECTION = {
  // jeu : l'animation doit rester fluide, donc pas d'aplatissement du flux de contrôle ; ne tourne que servi par ce PC
  jeu: { compact: true, selfDefending: true, stringArray: true, stringArrayEncoding: ['base64'], stringArrayThreshold: 0.75, stringArrayRotate: true, stringArrayShuffle: true, identifierNamesGenerator: 'hexadecimal', domainLock: ['localhost', '127.0.0.1'], domainLockRedirectUrl: 'about:blank', target: 'browser', seed: 0 },
  // serveur (notre code seulement : licence, sources, régie) : protection forte, les performances comptent peu
  serveur: { compact: true, selfDefending: true, controlFlowFlattening: true, controlFlowFlatteningThreshold: 0.6, deadCodeInjection: true, deadCodeInjectionThreshold: 0.25, stringArray: true, stringArrayEncoding: ['rc4'], stringArrayThreshold: 1, stringArrayRotate: true, stringArrayShuffle: true, stringArrayWrappersCount: 2, splitStrings: true, splitStringsChunkLength: 6, numbersToExpressions: true, transformObjectKeys: true, identifierNamesGenerator: 'hexadecimal', target: 'node', seed: 0 },
};
const proteger = (code, reglages) => JavaScriptObfuscator.obfuscate(code, reglages).getObfuscatedCode();

async function bundle(entree, vente) {
  const r = await build({ entryPoints: [path.join(SRC, entree)], bundle: true, format: 'iife', target: 'chrome100', minify: vente, legalComments: 'none', write: false, loader: { '.png': 'dataurl' }, define: { VENTE: vente ? 'true' : 'false' } });
  let js = r.outputFiles[0].text;
  if (vente) js = proteger(js, PROTECTION.jeu);
  // « </script » ne doit jamais apparaître dans le code inséré dans la page
  return js.replace(/<\/script/gi, '<\\/script');
}

async function page(modele, entree, vente) {
  const html = await readFile(path.join(SRC, modele), 'utf8');
  const js = await bundle(entree, vente);
  return html.replace('<!--SCRIPT-->', () => `<script>\n${js}</script>`);
}

/** Chiffre la page du jeu (AES-256-GCM) : iv (12) | étiquette (16) | données. */
function chiffrer(texte, cle) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', cle, iv);
  const d = Buffer.concat([c.update(texte, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), d]);
}

/** Serveur Node : notre code (protégé) dans serveur.cjs, les bibliothèques libres à part dans bibliotheques.cjs. */
async function serveur(vente, config) {
  // le faux live des tests n'entre jamais dans la version vendue
  const sansFaux = { name: 'sans-faux-live', setup(b) { b.onResolve({ filter: /faux-tiktok\.mjs$/ }, () => (vente ? { path: 'vide', namespace: 'vide' } : undefined)); b.onLoad({ filter: /.*/, namespace: 'vide' }, () => ({ contents: 'export {}' })); } };
  const aPart = { name: 'bibliotheques-a-part', setup(b) { b.onResolve({ filter: /^tiktok-live-connector$/ }, () => ({ path: './bibliotheques.cjs', external: true })); } };
  const commun = { bundle: true, platform: 'node', format: 'cjs', target: 'node22', minify: vente, legalComments: 'none', write: false, logLevel: 'error' };
  // point d'entrée sans exports : rien n'est exposé, et l'obfuscateur peut tout renommer
  const r = await build({ ...commun, stdin: { contents: "import './produit/serveur/serveur.mjs';", resolveDir: RACINE, loader: 'js' }, plugins: [sansFaux, aPart], define: { VENTE: vente ? 'true' : 'false', CONFIG_VENTE: JSON.stringify(config) } });
  let code = r.outputFiles[0].text;
  if (vente) code = proteger(code, PROTECTION.serveur);
  const lib = await build({ ...commun, stdin: { contents: "module.exports = require('tiktok-live-connector');", resolveDir: RACINE, loader: 'js' }, metafile: true });
  const paquets = new Set();
  for (const f of Object.keys(lib.metafile.inputs)) {
    const m = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(f);
    if (m) paquets.add(m[1]);
  }
  let licences = 'Empira Conquest embarque les logiciels libres suivants (outils/bibliotheques.cjs), sous leurs licences respectives.\n';
  for (const p of [...paquets].sort()) {
    const dossier = path.join(RACINE, 'node_modules', p);
    const pj = JSON.parse(await readFile(path.join(dossier, 'package.json'), 'utf8'));
    const fichier = (await readdir(dossier)).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
    licences += `\n${'='.repeat(70)}\n${pj.name} ${pj.version} — ${pj.license}\n${'='.repeat(70)}\n${fichier ? await readFile(path.join(dossier, fichier), 'utf8') : `Licence ${pj.license} (voir https://www.npmjs.com/package/${pj.name})`}\n`;
  }
  return { code, bibliotheques: lib.outputFiles[0].text, licences, paquets: [...paquets] };
}

/** node.exe pour Windows, téléchargé une fois depuis nodejs.org puis gardé en cache. */
async function nodeWindows() {
  const cache = path.join(RACINE, '.cache', `node-${NODE_VERSION}-win-x64`);
  const exe = path.join(cache, 'node.exe');
  if (await stat(exe).then(() => true, () => false)) return cache;
  await mkdir(cache, { recursive: true });
  const zip = path.join(cache, 'node.zip');
  const url = `https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-win-x64.zip`;
  console.log(`Téléchargement de ${url}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement de Node impossible (HTTP ${res.status})`);
  await writeFile(zip, Buffer.from(await res.arrayBuffer()));
  const dossier = `node-${NODE_VERSION}-win-x64`;
  execFileSync('unzip', ['-o', '-j', zip, `${dossier}/node.exe`, `${dossier}/LICENSE`, '-d', cache], { stdio: 'ignore' });
  await rm(zip);
  return cache;
}

async function assembler(dossier, { vente, essai = false, node = vente && !essai && !SANS_NODE }) {
  await rm(dossier, { recursive: true, force: true });
  for (const d of ['outils', 'musique']) await mkdir(path.join(dossier, d), { recursive: true });
  const cleJeu = crypto.randomBytes(32);
  const storeId = essai ? '1' : String(VENTE.storeId || '');
  const produitId = essai ? '1' : String(VENTE.produitId || '');
  // la clé du fichier de licence doit rester la même d'une mise à jour à l'autre (sinon réactivation)
  const config = vente ? { storeId, produitId, achat: essai ? 'https://exemple.invalid/acheter' : String(VENTE.urlAchat || ''), secret: crypto.createHash('sha256').update(`empira-conquest|${essai ? 'essai' : SECRET}|${storeId}|${produitId}`).digest('hex'), cleJeu: cleJeu.toString('hex'), cleEuler: essai ? '' : CLE_EULER, essai } : {};
  const jeu = await page('page.html', 'main.js', vente);
  if (vente) await writeFile(path.join(dossier, 'outils/jeu.bin'), chiffrer(jeu, cleJeu));
  else await writeFile(path.join(dossier, 'empira-conquest.html'), jeu);
  await writeFile(path.join(dossier, 'demarrer.html'), await page('demarrer.html', 'demarrer.js', vente));
  const s = await serveur(vente, config);
  await writeFile(path.join(dossier, 'outils/serveur.cjs'), s.code);
  await writeFile(path.join(dossier, 'outils/bibliotheques.cjs'), s.bibliotheques);
  let licences = s.licences;
  if (node) {
    const cache = await nodeWindows();
    await copyFile(path.join(cache, 'node.exe'), path.join(dossier, 'outils/node.exe'));
    licences += `\n${'='.repeat(70)}\nNode.js ${NODE_VERSION} (outils/node.exe)\n${'='.repeat(70)}\n${await readFile(path.join(cache, 'LICENSE'), 'utf8')}`;
  }
  await writeFile(path.join(dossier, 'LICENCES-TIERS.txt'), crlf(licences));
  await writeFile(path.join(dossier, 'LANCER LE JEU.bat'), crlf(await readFile(path.join(RACINE, 'produit/outils/LANCER LE JEU.bat'), 'utf8')));
  await writeFile(path.join(dossier, 'musique/LISEZ-MOI.txt'), crlf('Déposez ici vos musiques au format MP3.\nElles sont jouées en boucle, dans un ordre aléatoire, pendant les parties.\nN\'utilisez que des musiques dont vous avez les droits de diffusion en live.\n'));
  const logo = (await readFile(path.join(RACINE, 'produit/images/logo-empira-complet.png'))).toString('base64');
  const guide = (await readFile(path.join(RACINE, 'produit/GUIDE.html'), 'utf8')).replace('<!--LOGO-->', `<img src="data:image/png;base64,${logo}" alt="Empira Agency" style="width:260px;margin-bottom:18px">`);
  await writeFile(path.join(dossier, 'GUIDE.html'), guide);
  if (essai) await writeFile(path.join(dossier, 'NE-PAS-LIVRER.txt'), 'Copie d\'essai pour les tests automatisés (boutique fictive). Ne jamais la livrer.\n');
  return s.paquets.length;
}

const n = await assembler(path.join(RACINE, 'dist', NOM), { vente: true });
await assembler(path.join(RACINE, 'dist', 'essai-vente'), { vente: true, essai: true });
await assembler(path.join(RACINE, 'dist', 'dev'), { vente: false });
console.log(`Assemblé : dist/${NOM} (version vendue${SANS_NODE ? ', sans node.exe' : ', avec node.exe'}), dist/essai-vente (tests, à ne pas livrer) et dist/dev — ${n} bibliothèques embarquées`);
if (!VENTE.storeId || !VENTE.produitId) console.warn('\n⚠ produit/vente.json : storeId ou produitId vide. Cette version vendue REFUSERA TOUTES LES CLÉS tant qu\'ils ne sont pas renseignés.');
if (!CLE_EULER) console.warn('ℹ Pas de clé API Euler Stream (produit/.cle-euler) : les acheteurs utiliseront la limite gratuite ou leur propre clé.');
if (!VENTE.urlAchat) console.warn('⚠ produit/vente.json : urlAchat vide, le bouton « Acheter une clé » ne sera pas affiché.');
