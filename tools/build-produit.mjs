// Assemble « La Guerre des Départements » prête à vendre :
//   dist/La-Guerre-des-Departements/   (version vendue : licence vérifiée, code minifié, node.exe Windows embarqué)
//   dist/dev/                          (version de développement pour les tests, sans licence ni node.exe)
//
// node tools/build-produit.mjs [--sans-node]

import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile, rm, stat, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RACINE, 'produit/src');
const NOM = 'La-Guerre-des-Departements';
const NODE_VERSION = 'v22.22.0';
const SANS_NODE = process.argv.includes('--sans-node');
const crlf = (t) => t.replace(/\r?\n/g, '\r\n');

async function bundle(entree, vente) {
  const r = await build({ entryPoints: [path.join(SRC, entree)], bundle: true, format: 'iife', target: 'chrome100', minify: vente, legalComments: 'none', write: false, define: { VENTE: vente ? 'true' : 'false' } });
  // « </script » ne doit jamais apparaître dans le code inséré dans la page
  return r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
}

async function page(modele, entree, vente) {
  const html = await readFile(path.join(SRC, modele), 'utf8');
  const js = await bundle(entree, vente);
  return html.replace('<!--SCRIPT-->', () => `<script>\n${js}</script>`);
}

/** Serveur Node en un seul fichier, et texte des licences des bibliothèques embarquées. */
async function serveur(vente) {
  // le faux live des tests n'entre jamais dans la version vendue
  const sansFaux = { name: 'sans-faux-live', setup(b) { b.onResolve({ filter: /faux-tiktok\.mjs$/ }, () => (vente ? { path: 'vide', namespace: 'vide' } : undefined)); b.onLoad({ filter: /.*/, namespace: 'vide' }, () => ({ contents: 'export {}' })); } };
  const r = await build({ entryPoints: [path.join(RACINE, 'produit/serveur/serveur.mjs')], bundle: true, platform: 'node', format: 'cjs', target: 'node22', minify: vente, legalComments: 'none', write: false, metafile: true, logLevel: 'error', plugins: [sansFaux], define: { VENTE: vente ? 'true' : 'false' } });
  const paquets = new Set();
  for (const f of Object.keys(r.metafile.inputs)) {
    const m = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(f);
    if (m) paquets.add(m[1]);
  }
  let licences = 'La Guerre des Départements embarque les logiciels libres suivants, sous leurs licences respectives.\n';
  for (const p of [...paquets].sort()) {
    const dossier = path.join(RACINE, 'node_modules', p);
    const pj = JSON.parse(await readFile(path.join(dossier, 'package.json'), 'utf8'));
    const fichier = (await readdir(dossier)).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
    licences += `\n${'='.repeat(70)}\n${pj.name} ${pj.version} — ${pj.license}\n${'='.repeat(70)}\n${fichier ? await readFile(path.join(dossier, fichier), 'utf8') : `Licence ${pj.license} (voir https://www.npmjs.com/package/${pj.name})`}\n`;
  }
  return { code: r.outputFiles[0].text, licences, paquets: [...paquets] };
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

async function assembler(dossier, vente) {
  await rm(dossier, { recursive: true, force: true });
  for (const d of ['outils', 'musique', 'images']) await mkdir(path.join(dossier, d), { recursive: true });
  await writeFile(path.join(dossier, 'guerre-des-departements.html'), await page('page.html', 'main.js', vente));
  await writeFile(path.join(dossier, 'demarrer.html'), await page('demarrer.html', 'demarrer.js', vente));
  const s = await serveur(vente);
  await writeFile(path.join(dossier, 'outils/serveur.cjs'), s.code);
  let licences = s.licences;
  if (vente && !SANS_NODE) {
    const cache = await nodeWindows();
    await copyFile(path.join(cache, 'node.exe'), path.join(dossier, 'outils/node.exe'));
    licences += `\n${'='.repeat(70)}\nNode.js ${NODE_VERSION} (outils/node.exe)\n${'='.repeat(70)}\n${await readFile(path.join(cache, 'LICENSE'), 'utf8')}`;
  }
  await writeFile(path.join(dossier, 'LICENCES-TIERS.txt'), crlf(licences));
  await writeFile(path.join(dossier, 'LANCER LE JEU.bat'), crlf(await readFile(path.join(RACINE, 'produit/outils/LANCER LE JEU.bat'), 'utf8')));
  await writeFile(path.join(dossier, 'musique/LISEZ-MOI.txt'), crlf('Déposez ici vos musiques au format MP3.\nElles sont jouées en boucle, dans un ordre aléatoire, pendant les parties.\nN\'utilisez que des musiques dont vous avez les droits de diffusion en live.\n'));
  await writeFile(path.join(dossier, 'images/LISEZ-MOI.txt'), crlf('Déposez ici logo-empira.png (fond transparent) pour remplacer le logo dessiné par le jeu.\n'));
  await copyFile(path.join(RACINE, 'produit/GUIDE.html'), path.join(dossier, 'GUIDE.html'));
  return s.paquets.length;
}

const n = await assembler(path.join(RACINE, 'dist', NOM), true);
await assembler(path.join(RACINE, 'dist', 'dev'), false);
console.log(`Assemblé : dist/${NOM} (version vendue${SANS_NODE ? ', sans node.exe' : ', avec node.exe'}) et dist/dev — ${n} bibliothèques embarquées dans le serveur`);
