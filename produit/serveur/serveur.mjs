// Serveur local de « Empira Conquest » (Node.js, livré avec node.exe).
//  - sert les fichiers du jeu sur http://localhost:8911
//  - reçoit le live TikTok (connexion directe, ou TikFinity s'il est ouvert) et relaie les événements au jeu (WebSocket /evenements)
//  - régie : POST /commande relaie une commande (!fin, !vague…) au jeu, depuis la page de démarrage
//  - voix Windows (/parler, /voix), musiques (/musiques), licence Lemon Squeezy (/licence)

import http from 'node:http';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { serveurWebSocket } from './ws.mjs';
import { creerSources, MODES } from './sources.mjs';
import { creerVoix, nettoyerTexte } from './voix.mjs';
import { creerLicence } from './licence.mjs';
import { lireCommande } from '../src/tikfinity.js';
import { VERSION } from '../src/config.js';

/* global VENTE, CONFIG_VENTE */
const VERSION_VENDUE = typeof VENTE !== 'undefined' && VENTE;
// réglages de vente gravés à l'assemblage : boutique et produit Lemon Squeezy, lien d'achat, clés de chiffrement
const CFG = typeof CONFIG_VENTE !== 'undefined' ? CONFIG_VENTE : {};
const PAGE_JEU = '/empira-conquest.html';
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

export async function creerServeur({ racine, test = false, donnees = path.join(process.env.APPDATA || path.join(os.homedir(), '.config'), 'EmpiraConquest'), lemonUrl = process.env.EMPIRA_LEMON_URL, urlTikFinity = process.env.EMPIRA_TIKFINITY_URL, charger, journal = console.log } = {}) {
  const base = path.resolve(racine);
  const fichierReglages = path.join(donnees, 'reglages.json');
  let reglages = { pseudo: '', cleEuler: '', auto: true, source: 'auto' };
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
  // l'adresse de Lemon Squeezy ne peut être remplacée que dans la copie d'essai des tests, jamais dans la version vendue
  const licence = VERSION_VENDUE
    ? creerLicence({ fichier: path.join(donnees, 'licence.dat'), nomPc: os.hostname(), storeId: CFG.storeId, produitId: CFG.produitId, secret: CFG.secret, ...(CFG.essai && lemonUrl ? { url: lemonUrl } : {}) })
    : { etat: async () => ({ ok: true }), activer: async () => ({ ok: true }), desactiver: async () => ({ ok: true }) };
  let licenceOk = !VERSION_VENDUE;
  const etatLicence = async (forcer) => {
    const e = await licence.etat(forcer);
    licenceOk = Boolean(e.ok);
    return e;
  };

  // version vendue : le jeu est stocké chiffré (outils/jeu.bin) et n'est déchiffré, en mémoire, qu'avec une licence valide
  let jeuClair = null;
  const pageJeu = async () => {
    if (jeuClair) return jeuClair;
    const b = await readFile(path.join(base, 'outils', 'jeu.bin'));
    const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(CFG.cleJeu, 'hex'), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    jeuClair = Buffer.concat([d.update(b.subarray(28)), d.final()]);
    return jeuClair;
  };
  const pageVerrou = (raison) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Empira Conquest — licence</title><style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#05060a;color:#f2efe8;font:600 26px/1.4 'Segoe UI',system-ui,sans-serif;text-align:center;padding:40px;box-sizing:border-box}h1{font:700 48px Georgia,serif;color:#f6dc8f}</style></head><body><div><h1>Licence non activée</h1><p>${String(raison || '').replace(/[<>&"]/g, '')}</p><p>Ouvrez la fenêtre de pilotage (LANCER LE JEU) pour entrer votre clé.</p></div><script>setTimeout(()=>location.reload(),30000)</script></body></html>`;

  let hub;
  const tiktok = creerSources({
    // clé Euler Stream : celle de l'acheteur s'il en a mis une, sinon celle d'Empira gravée à l'assemblage (si fournie)
    cleEuler: () => reglages.cleEuler || CFG.cleEuler || '',
    charger: charger || (faux ? async () => faux : undefined),
    ...(!VERSION_VENDUE && urlTikFinity ? { urlTikFinity } : {}),
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
      if (p === '/licence') return json(res, { ...(await etatLicence()), ...(VERSION_VENDUE && CFG.achat ? { achat: CFG.achat } : {}) });
      if (p === '/licence/activer' && post) {
        const r = await licence.activer((await lireCorps(req))?.cle);
        await etatLicence(true);
        return json(res, r);
      }
      if (p === '/licence/desactiver' && post) {
        const r = await licence.desactiver();
        if ((await etatLicence(true)).ok === false) tiktok.deconnecter();
        return json(res, r);
      }
      // sans licence valide, le jeu ne se connecte pas au live et n'accepte aucune commande
      if (VERSION_VENDUE && post && (p === '/tiktok/connecter' || p === '/commande') && !(await etatLicence()).ok) return json(res, { ok: false, raison: 'Licence non activée.' }, 403);
      if (p === '/reglages') return json(res, { pseudo: reglages.pseudo, auto: reglages.auto, source: reglages.source, euler: Boolean(reglages.cleEuler), eulerInclus: Boolean(CFG.cleEuler) });
      if (p === '/tiktok/etat') return json(res, tiktok.etat());
      if (p === '/tiktok/connecter' && post) {
        const b = (await lireCorps(req)) || {};
        // un champ vide garde la clé déjà enregistrée ; « aucune » l'efface
        if (typeof b.cleEuler === 'string' && b.cleEuler.trim()) reglages.cleEuler = b.cleEuler.trim().toLowerCase() === 'aucune' ? '' : b.cleEuler.trim().slice(0, 200);
        if (MODES.includes(b.source)) reglages.source = b.source;
        const ok = tiktok.connecter(b.pseudo, reglages.source);
        if (ok) {
          reglages.pseudo = tiktok.etat().pseudo;
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
      if (VERSION_VENDUE && rel === PAGE_JEU) {
        const e = await etatLicence();
        res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        return res.end(e.ok ? await pageJeu() : pageVerrou(e.raison));
      }
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

  hub = serveurWebSocket(serveur, '/evenements', { autoriser: () => licenceOk, surConnexion: (envoyer) => envoyer({ statut: tiktok.etat() }) });
  // vérification régulière pendant le live : une licence révoquée bloque le jeu
  const verification = VERSION_VENDUE
    ? setInterval(async () => {
      const e = await etatLicence(true);
      if (!e.ok) {
        tiktok.deconnecter();
        hub.diffuser({ licence: e });
      }
    }, 6 * 3600000)
    : null;
  verification?.unref();
  serveur.etatLicence = etatLicence;
  serveur.tiktok = tiktok;
  serveur.hub = hub;
  serveur.reglages = reglages;
  serveur.on('close', () => {
    clearInterval(verification);
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
    console.log('  EMPIRA CONQUEST — serveur démarré');
    console.log(`  Fenêtre de pilotage : ${adresse}demarrer.html`);
    console.log('  Laissez cette fenêtre ouverte pendant le live. Fermez-la pour arrêter le jeu.');
    console.log('');
    serveur.etatLicence().then((e) => {
      if (e.ok && serveur.reglages.pseudo && serveur.reglages.auto) serveur.tiktok.connecter(serveur.reglages.pseudo, serveur.reglages.source);
    });
    if (a.navigateur) ouvrirNavigateur(`${adresse}demarrer.html`);
  });
}

const lanceDirectement = typeof require !== 'undefined' ? require.main === module : process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (lanceDirectement) principal();
