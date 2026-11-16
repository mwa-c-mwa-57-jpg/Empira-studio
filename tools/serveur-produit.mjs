// Outils de développement (jamais livrés à l'acheteur) :
//  - createServeurProduit : imite outils/serveur.ps1 (fichiers, /parler, /voix, /musiques, /licence) pour les tests
//  - createFauxTikFinity  : faux serveur WebSocket au format TikFinity, pour envoyer des événements de test
//
// En ligne de commande : node tools/serveur-produit.mjs [dist/dev]
//   → jeu sur http://localhost:8911, faux TikFinity sur ws://127.0.0.1:21213,
//     POST http://localhost:8911/regie {event, data} pour simuler un événement.

import http from 'node:http';
import crypto from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.txt': 'text/plain; charset=utf-8' };

export function createServeurProduit({ racine, licence = { ok: true }, voix = [{ nom: 'Microsoft Hortense Desktop', genre: 'Female', langue: 'fr-FR' }, { nom: 'Microsoft Paul Desktop', genre: 'Male', langue: 'fr-FR' }], musiques = [], surRegie = () => {} } = {}) {
  const base = path.resolve(racine);
  const etat = { paroles: [], licence: { ...licence } };
  const json = (res, obj, code = 200) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(obj));
  };
  const corps = (req) => new Promise((resolve) => {
    let t = '';
    req.on('data', (c) => (t += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(t));
      } catch {
        resolve(null);
      }
    });
  });
  const serveur = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/parler') {
      etat.paroles.push({ texte: url.searchParams.get('t'), voix: url.searchParams.get('voix') });
      return json(res, { ok: true });
    }
    if (url.pathname === '/voix') return json(res, voix);
    if (url.pathname === '/musiques') return json(res, musiques);
    if (url.pathname === '/etat') return json(res, { ok: true, version: 'dev' });
    if (url.pathname === '/licence') return json(res, etat.licence);
    if (url.pathname === '/licence/activer' && req.method === 'POST') {
      const b = await corps(req);
      if (b?.cle === 'CLE-DE-TEST-VALIDE') etat.licence = { ok: true };
      return json(res, b?.cle === 'CLE-DE-TEST-VALIDE' ? { ok: true } : { ok: false, raison: 'Clé refusée. Vérifiez la clé reçue par e-mail.' });
    }
    if (url.pathname === '/regie' && req.method === 'POST') {
      surRegie(await corps(req));
      return json(res, { ok: true });
    }
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/demarrer.html';
    const fichier = path.resolve(base, `.${path.posix.normalize(rel)}`);
    if (!fichier.startsWith(base + path.sep)) return json(res, { erreur: 'chemin' }, 400);
    const s = await stat(fichier).catch(() => null);
    if (!s?.isFile()) return json(res, { erreur: 'introuvable' }, 404);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream' });
    res.end(await readFile(fichier));
  });
  serveur.etat = etat;
  return serveur;
}

/** Faux TikFinity : serveur WebSocket minimal qui envoie des messages texte aux clients connectés. */
export function createFauxTikFinity() {
  const clients = new Set();
  const serveur = http.createServer((req, res) => {
    res.writeHead(426);
    res.end();
  });
  serveur.on('upgrade', (req, socket) => {
    const cle = req.headers['sec-websocket-key'];
    if (!cle) return socket.destroy();
    const accept = crypto.createHash('sha1').update(`${cle}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    clients.add(socket);
    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
    socket.on('data', () => {}); // les trames du client (ping, fermeture) sont ignorées
  });
  serveur.envoyer = (obj) => {
    const charge = Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj));
    const n = charge.length;
    const tete = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 127, 0, 0, 0, 0]), Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255])]);
    const trame = Buffer.concat([tete, charge]);
    for (const s of clients) s.write(trame);
  };
  serveur.nbClients = () => clients.size;
  serveur.fermerClients = () => {
    for (const s of clients) s.destroy();
    clients.clear();
  };
  return serveur;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const racine = process.argv[2] || 'dist/dev';
  const tik = createFauxTikFinity();
  tik.listen(21213, '127.0.0.1');
  const s = createServeurProduit({ racine, surRegie: (m) => m && tik.envoyer(m) });
  s.listen(8911, '127.0.0.1', () => console.log(`Jeu : http://localhost:8911/  (faux TikFinity sur ws://127.0.0.1:21213, POST /regie pour simuler)`));
}
