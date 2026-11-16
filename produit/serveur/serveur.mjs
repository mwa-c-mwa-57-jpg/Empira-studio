// Serveur local de « La Guerre des Départements » (Node.js, livré avec node.exe).
//  - sert les fichiers du jeu sur http://localhost:8911
//  - se connecte DIRECTEMENT au live TikTok (sans TikFinity) et relaie les événements au jeu (WebSocket /evenements)
//  - régie : POST /commande relaie une commande (!fin, !vague…) au jeu, depuis la page de démarrage
//  - voix Windows (/parler, /voix), musiques (/musiques), licence Lemon Squeezy (/licence)

import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { serveurWebSocket } from './ws.mjs';
import { creerConnexionTikTok } from './tiktok.mjs';
import { creerVoix, nettoyerTexte } from './voix.mjs';
import { creerLicence } from './licence.mjs';
import { lireCommande } from '../src/tikfinity.js';
import { VERSION } from '../src/config.js';

/* global VENTE */
const VERSION_VENDUE = typeof VENTE !== 'undefined' && VENTE;
const ICI = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };

export function lireArguments(argv) {
  const a = { port: 8911, racine: path.resolve(ICI, '..'), navigateur: true, test: process.env.EMPIRA_TEST === '1' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') a.port = Number(argv[++i]);
    else if (argv[i] === '--racine') a.racine = path.resolve(argv[++i]);
    else if (argv[i] === '--sans-navigateur') a.navigateur = false;
    else if (argv[i] === '--test') a.test = true;
  }
  return a;
}

export async function creerServeur({ racine, test = false, donnees = path.join(process.env.APPDATA || path.join(os.homedir(), '.config'), 'EmpiraGuerreDesDepartements'), lemonUrl = process.env.EMPIRA_LEMON_URL, charger, journal = console.log } = {}) {
  const base = path.resolve(racine);
  const fichierReglages = path.join(donnees, 'reglages.json');
  let reglages = { pseudo: '', cleEuler: '', auto: true };
  try {
    reglages = { ...reglages, ...JSON.parse(await readFile(fichierReglages, 'utf8')) };
  } catch {
    /* premier lancement */
  }
  const sauver = async () => {
    await mkdir(donnees, { recursive: true });
    await writeFile(fichierReglages, JSON.stringify(reglages));
  };

  // mode test (développement uniquement) : un faux live remplace TikTok ; absent de la version vendue
  const faux = !VERSION_VENDUE && test ? await import('./faux-tiktok.mjs') : null;
  const paroles = []; // mode test : phrases demandées à la voix
  const voix = faux ? { parler: (t, v) => (paroles.push({ texte: t, voix: v }), true), liste: () => [{ nom: 'Microsoft Hortense Desktop', genre: 'Female', langue: 'fr-FR' }, { nom: 'Microsoft Paul Desktop', genre: 'Male', langue: 'fr-FR' }], fermer() {} } : creerVoix({ journal });
  const licence = VERSION_VENDUE ? creerLicence({ fichier: path.join(donnees, 'licence.json'), nomPc: os.hostname(), ...(lemonUrl ? { url: lemonUrl } : {}) }) : { etat: async () => ({ ok: true }), activer: async () => ({ ok: true }), desactiver: async () => ({ ok: true }) };

  let hub;
  const tiktok = creerConnexionTikTok({
    cleEuler: reglages.cleEuler,
    charger: charger || (faux ? async () => faux : undefined),
    surMessage: (m) => hub.diffuser(m),
    surEtat: (e) => {
      hub?.diffuser({ statut: e });
      journal(`  [TikTok] ${e.detail}`);
    },
  });

  const json = (res, obj, code = 200) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(obj));
  };
  const lireCorps = (req) => new Promise((resolve) => {
    let t = '';
    let trop = false;
    req.on('data', (c) => {
      t += c;
      if (t.length > 65536) {
        trop = true;
        req.destroy();
      }
    });
    req.on('end', () => {
      if (trop) return resolve(null);
      try {
        resolve(JSON.parse(t));
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });

  const serveur = http.createServer(async (req, res) => {
    try {
      // une page web d'un autre site ne doit pas pouvoir piloter ce serveur
      if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, { ok: false }, 403);
      const url = new URL(req.url, 'http://localhost');
      const p = url.pathname;
      const post = req.method === 'POST';
      if (p === '/etat') return json(res, { ok: true, version: VERSION, tiktok: tiktok.etat() });
      if (p === '/parler') {
        const t = nettoyerTexte(url.searchParams.get('t'));
        if (!t) return json(res, { ok: false }, 400);
        return json(res, { ok: true, dit: voix.parler(t, url.searchParams.get('voix') || '') });
      }
      if (p === '/voix') return json(res, voix.liste());
      if (p === '/musiques') {
        const fichiers = await readdir(path.join(base, 'musique')).catch(() => []);
        return json(res, fichiers.filter((f) => /\.mp3$/i.test(f)).sort().map((f) => `musique/${encodeURIComponent(f)}`));
      }
      if (p === '/licence') return json(res, await licence.etat());
      if (p === '/licence/activer' && post) return json(res, await licence.activer((await lireCorps(req))?.cle));
      if (p === '/licence/desactiver' && post) return json(res, await licence.desactiver());
      if (p === '/reglages') return json(res, { pseudo: reglages.pseudo, auto: reglages.auto, euler: Boolean(reglages.cleEuler) });
      if (p === '/tiktok/etat') return json(res, tiktok.etat());
      if (p === '/tiktok/connecter' && post) {
        const b = (await lireCorps(req)) || {};
        if (typeof b.cleEuler === 'string') reglages.cleEuler = b.cleEuler.trim().slice(0, 200);
        const ok = tiktok.connecter(b.pseudo);
        if (ok) {
          reglages.pseudo = String(b.pseudo).trim().replace(/^@/, '');
          reglages.auto = true;
          await sauver();
        }
        return json(res, { ok, etat: tiktok.etat() });
      }
      if (p === '/tiktok/deconnecter' && post) {
        tiktok.deconnecter();
        reglages.auto = false;
        await sauver();
        return json(res, { ok: true, etat: tiktok.etat() });
      }
      if (p === '/commande' && post) {
        const b = (await lireCorps(req)) || {};
        const cmd = lireCommande(`!${String(b.nom || '')} ${String(b.arg || '')}`);
        if (!cmd) return json(res, { ok: false, raison: 'commande inconnue' }, 400);
        hub.diffuser({ commande: cmd });
        return json(res, { ok: true, pages: hub.nombre() });
      }
      if (faux && p === '/test/tiktok' && post) {
        const b = (await lireCorps(req)) || {};
        return json(res, { ok: true, connexions: faux.emettre(b.sorte, b.data) });
      }
      if (faux && p === '/test/couper' && post) {
        faux.couper();
        return json(res, { ok: true });
      }
      if (faux && p === '/test/paroles') return json(res, paroles);
      if (post) return json(res, { ok: false }, 404);

      // fichiers du jeu
      let rel = decodeURIComponent(p);
      if (rel === '/') rel = '/demarrer.html';
      if (rel.includes('\0') || /(^|\/)outils(\/|$)/i.test(rel)) return json(res, { ok: false }, 404);
      const fichier = path.resolve(base, `.${path.posix.normalize(rel)}`);
      if (!fichier.startsWith(base + path.sep)) return json(res, { ok: false }, 404);
      const s = await stat(fichier).catch(() => null);
      if (!s?.isFile()) return json(res, { ok: false, erreur: 'introuvable' }, 404);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(await readFile(fichier));
    } catch (err) {
      journal(`  [serveur] ${err.message}`);
      if (!res.headersSent) json(res, { ok: false }, 500);
    }
  });

  hub = serveurWebSocket(serveur, '/evenements', { surConnexion: (envoyer) => envoyer({ statut: tiktok.etat() }) });
  serveur.tiktok = tiktok;
  serveur.hub = hub;
  serveur.reglages = reglages;
  serveur.on('close', () => {
    tiktok.deconnecter(true);
    voix.fermer();
    hub.fermerTout();
  });
  return serveur;
}

function ouvrirNavigateur(url) {
  const c = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    spawn(c[0], c[1], { stdio: 'ignore', detached: true, windowsHide: true }).on('error', () => {}).unref();
  } catch {
    /* l'adresse est affichée dans la fenêtre */
  }
}

async function principal() {
  const a = lireArguments(process.argv.slice(2));
  const serveur = await creerServeur({ racine: a.racine, test: a.test });
  const adresse = `http://localhost:${a.port}/`;
  serveur.on('error', async (err) => {
    if (err.code === 'EADDRINUSE') {
      // déjà lancé : on ouvre simplement la page de démarrage
      const ok = await fetch(`${adresse}etat`).then((r) => r.ok, () => false);
      if (ok) {
        if (a.navigateur) ouvrirNavigateur(`${adresse}demarrer.html`);
        process.exit(0);
      }
      console.error(`Le port ${a.port} est occupé par un autre programme. Fermez-le puis relancez le jeu.`);
    } else console.error(err);
    process.exitCode = 1;
  });
  serveur.listen(a.port, '127.0.0.1', () => {
    console.log('');
    console.log('  LA GUERRE DES DÉPARTEMENTS — serveur démarré');
    console.log(`  Fenêtre de pilotage : ${adresse}demarrer.html`);
    console.log('  Laissez cette fenêtre ouverte pendant le live. Fermez-la pour arrêter le jeu.');
    console.log('');
    if (serveur.reglages.pseudo && serveur.reglages.auto) serveur.tiktok.connecter(serveur.reglages.pseudo);
    if (a.navigateur) ouvrirNavigateur(`${adresse}demarrer.html`);
  });
}

const lanceDirectement = typeof require !== 'undefined' ? require.main === module : process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (lanceDirectement) principal();
