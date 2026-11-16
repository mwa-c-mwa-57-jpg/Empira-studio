// Assemble « La Guerre des Départements » prête à vendre :
//   dist/La-Guerre-des-Departements/   (version vendue : licence vérifiée, code minifié)
//   dist/dev/                          (version de développement pour les tests, sans licence)
//
// node tools/build-produit.mjs

import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(RACINE, 'produit/src');
const NOM = 'La-Guerre-des-Departements';

async function bundle(entree, vente) {
  const r = await build({
    entryPoints: [path.join(SRC, entree)],
    bundle: true,
    format: 'iife',
    target: 'chrome100',
    minify: vente,
    legalComments: 'none',
    write: false,
    define: { VENTE: vente ? 'true' : 'false' },
  });
  // « </script » ne doit jamais apparaître dans le code inséré dans la page
  return r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
}

async function page(modele, entree, vente) {
  const html = await readFile(path.join(SRC, modele), 'utf8');
  const js = await bundle(entree, vente);
  return html.replace('<!--SCRIPT-->', () => `<script>\n${js}</script>`);
}

async function assembler(dossier, vente) {
  await rm(dossier, { recursive: true, force: true });
  await mkdir(path.join(dossier, 'outils'), { recursive: true });
  await mkdir(path.join(dossier, 'musique'), { recursive: true });
  await mkdir(path.join(dossier, 'images'), { recursive: true });
  await writeFile(path.join(dossier, 'guerre-des-departements.html'), await page('page.html', 'main.js', vente));
  await writeFile(path.join(dossier, 'demarrer.html'), await page('demarrer.html', 'demarrer.js', vente));
  // PowerShell 5.1 lit un script sans BOM comme du Windows-1252 : le BOM UTF-8 garde les accents intacts
  const ps1 = (await readFile(path.join(RACINE, 'produit/outils/serveur.ps1'), 'utf8')).replace(/^\uFEFF/, '').replace(/\r?\n/g, '\r\n');
  await writeFile(path.join(dossier, 'outils/serveur.ps1'), `\uFEFF${ps1}`);
  const crlf = (t) => t.replace(/\r?\n/g, '\r\n');
  await writeFile(path.join(dossier, 'LANCER LE JEU.bat'), crlf(await readFile(path.join(RACINE, 'produit/outils/LANCER LE JEU.bat'), 'utf8')));
  await writeFile(path.join(dossier, 'musique/LISEZ-MOI.txt'), crlf('Déposez ici vos musiques au format MP3.\nElles sont jouées en boucle, dans un ordre aléatoire, pendant les parties.\nN\'utilisez que des musiques dont vous avez les droits de diffusion en live.\n'));
  await writeFile(path.join(dossier, 'images/LISEZ-MOI.txt'), crlf('Déposez ici logo-empira.png (fond transparent) pour remplacer le logo dessiné par le jeu.\n'));
  await copyFile(path.join(RACINE, 'produit/GUIDE.html'), path.join(dossier, 'GUIDE.html'));
}

await assembler(path.join(RACINE, 'dist', NOM), true);
await assembler(path.join(RACINE, 'dist', 'dev'), false);
console.log(`Assemblé : dist/${NOM} (version vendue) et dist/dev (tests)`);
