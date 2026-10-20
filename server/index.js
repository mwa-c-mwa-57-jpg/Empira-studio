// Point d'entrée : serveur local (tableau de bord + overlay) relié au live TikTok.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WebSocketServer } from 'ws';
import { ROOT, loadConfig, saveConfig, sanitize } from './config.js';
import { Engine } from './engine.js';
import { TikTokBridge } from './tiktok.js';

const major = Number(process.versions.node.split('.')[0]);
if (major < 20) {
  console.error(`❌ Node.js ${process.versions.node} est trop ancien. Installez la version LTS (20 ou plus) : https://nodejs.org`);
  process.exit(1);
}

let config = loadConfig();
const engine = new Engine(config);
const tiktok = new TikTokBridge(() => config);

// ---- fichiers statiques -----------------------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
};

// URL publique -> dossier sur le disque (rien d'autre n'est servi).
const MOUNTS = [
  ['/static/', path.join(ROOT, 'public')],
  ['/vendor/three/', path.join(ROOT, 'node_modules', 'three')],
  ['/vendor/fonts/anton/', path.join(ROOT, 'node_modules', '@fontsource', 'anton', 'files')],
  ['/vendor/fonts/caveat/', path.join(ROOT, 'node_modules', '@fontsource', 'caveat', 'files')],
  ['/vendor/fonts/oswald/', path.join(ROOT, 'node_modules', '@fontsource', 'oswald', 'files')],
];

const PAGES = {
  '/': 'dashboard/index.html',
  '/dashboard': 'dashboard/index.html',
  '/overlay': 'overlay/index.html',
};

function sendFile(res, file) {
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return notFound(res);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  });
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Introuvable');
}

function serveStatic(pathname, res) {
  if (PAGES[pathname]) return sendFile(res, path.join(ROOT, 'public', PAGES[pathname])), true;
  for (const [prefix, dir] of MOUNTS) {
    if (!pathname.startsWith(prefix)) continue;
    const file = path.resolve(dir, '.' + path.posix.normalize('/' + pathname.slice(prefix.length)));
    if (!file.startsWith(dir + path.sep)) return notFound(res), true;
    return sendFile(res, file), true;
  }
  return false;
}

// ---- relais des photos de profil (le canvas 3D exige la même origine) ----------------------

const AVATAR_HOSTS = ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com', 'ibyteimg.com', 'byteimg.com', 'muscdn.com', 'tiktok.com'];
const avatarCache = new Map(); // url -> { type, body }
const AVATAR_CACHE_SIZE = 300;
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

function allowedAvatar(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    return AVATAR_HOSTS.some((h) => host === h || host.endsWith('.' + h)) ? url : null;
  } catch {
    return null;
  }
}

async function serveAvatar(searchParams, res) {
  const url = allowedAvatar(searchParams.get('u') || '');
  if (!url) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('URL refusée');
  }
  const key = url.href;
  let entry = avatarCache.get(key);
  if (!entry) {
    try {
      const upstream = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
          Referer: 'https://www.tiktok.com/',
        },
      });
      const type = upstream.headers.get('content-type') || '';
      if (!upstream.ok || !type.startsWith('image/')) throw new Error(`HTTP ${upstream.status}`);
      const body = Buffer.from(await upstream.arrayBuffer());
      if (body.length > AVATAR_MAX_BYTES) throw new Error('image trop lourde');
      entry = { type, body };
      avatarCache.set(key, entry);
      if (avatarCache.size > AVATAR_CACHE_SIZE) avatarCache.delete(avatarCache.keys().next().value);
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      return res.end(`Photo indisponible (${err.message})`);
    }
  }
  res.writeHead(200, { 'Content-Type': entry.type, 'Content-Length': entry.body.length, 'Cache-Control': 'max-age=3600' });
  res.end(entry.body);
}

// ---- HTTP -------------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const { pathname, searchParams } = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }
  if (pathname === '/avatar') return serveAvatar(searchParams, res);
  if (pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(engine.snapshot()));
  }
  if (!serveStatic(pathname, res)) notFound(res);
});

// ---- WebSocket --------------------------------------------------------------------------

const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
const overlays = new Set();
const dashboards = new Set();

function originAllowed(origin) {
  if (!origin || origin === 'null') return true; // OBS / TikTok LIVE Studio peuvent ne pas en envoyer
  try {
    const { hostname, port } = new URL(origin);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(hostname) || hostname === config.host;
    return local && Number(port || 80) === config.port;
  } catch {
    return false;
  }
}

server.on('upgrade', (req, socket, head) => {
  const { pathname, searchParams } = new URL(req.url, 'http://localhost');
  if (pathname !== '/ws' || !originAllowed(req.headers.origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const role = searchParams.get('role') === 'overlay' ? 'overlay' : 'dashboard';
    attach(ws, role);
  });
});

function send(ws, message) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function attach(ws, role) {
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  if (role === 'overlay') {
    overlays.add(ws);
    send(ws, engine.overlaySync());
    engine.setOverlayCount(overlays.size);
    ws.on('close', () => {
      overlays.delete(ws);
      engine.setOverlayCount(overlays.size);
    });
    return;
  }
  dashboards.add(ws);
  send(ws, engine.snapshot());
  ws.on('close', () => dashboards.delete(ws));
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    handleCommand(msg).catch((err) => console.error('Commande refusée :', err));
  });
}

// Détecte les connexions mortes (PC en veille, onglet figé…).
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, 20_000).unref();

engine.on('overlay', (message) => {
  for (const ws of overlays) send(ws, message);
});

let changedTimer = null;
engine.on('changed', () => {
  if (changedTimer) return;
  changedTimer = setTimeout(() => {
    changedTimer = null;
    const snap = engine.snapshot();
    for (const ws of dashboards) send(ws, snap);
  }, 80);
});

// ---- commandes du tableau de bord -------------------------------------------------------

async function handleCommand(msg) {
  switch (msg.type) {
    case 'connect': {
      const username = String(msg.username || '').trim();
      if (username && username !== config.tiktok.username) {
        config = sanitize({ ...config, tiktok: { ...config.tiktok, username } });
        saveConfig(config);
        engine.applyConfig(config);
      }
      await tiktok.connect(username || config.tiktok.username);
      break;
    }
    case 'disconnect':
      await tiktok.disconnect();
      break;
    case 'simulate':
      engine.simulate(String(msg.kind), Number(msg.coins) || 0);
      break;
    case 'burst':
      engine.burst(Math.min(30, Math.max(1, Number(msg.count) || 8)));
      break;
    case 'pause':
      engine.setPaused(Boolean(msg.value));
      break;
    case 'feed':
      engine.requestFeed();
      break;
    case 'paper.clear':
      engine.requestClear();
      break;
    case 'queue.remove':
      engine.removeJob(String(msg.id));
      break;
    case 'queue.bump':
      engine.bumpJob(String(msg.id));
      break;
    case 'queue.clear':
      engine.clearQueue();
      break;
    case 'config.save': {
      const incoming = msg.config || {};
      const signApiKey =
        typeof incoming.tiktok?.signApiKey === 'string' && incoming.tiktok.signApiKey !== ''
          ? incoming.tiktok.signApiKey
          : config.tiktok.signApiKey;
      // port et host ne changent qu'au prochain démarrage (on garde ceux en cours).
      const next = sanitize({ ...incoming, tiktok: { ...incoming.tiktok, signApiKey } });
      saveConfig(next);
      config = { ...next, port: config.port, host: config.host };
      engine.applyConfig(config);
      break;
    }
    default:
      break;
  }
}

// ---- TikTok -----------------------------------------------------------------------------

tiktok.on('status', (status) => {
  engine.setTiktokStatus(status);
  const icon = { connected: '🟢', connecting: '🟡', offline: '⚪', error: '🔴', disconnected: '⚫' }[status.state] || '•';
  console.log(`${icon} TikTok : ${status.state}${status.username ? ' @' + status.username : ''}${status.message ? ' — ' + status.message : ''}`);
});
tiktok.on('viewer', (event) => engine.handleViewer(event));

// ---- démarrage --------------------------------------------------------------------------

function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  } catch {
    /* pas de navigateur : l'adresse est affichée dans la console */
  }
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Le port ${config.port} est déjà utilisé : Print Booth est sans doute déjà ouvert.`);
    console.error(`   Ouvrez http://localhost:${config.port} dans votre navigateur, ou fermez l'autre fenêtre.`);
  } else {
    console.error('❌ Erreur serveur :', err.message);
  }
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  const base = `http://localhost:${config.port}`;
  console.log('');
  console.log('  🖨️  PRINT BOOTH LIVE est prêt !');
  console.log(`  ▸ Tableau de bord : ${base}`);
  console.log(`  ▸ Overlay (TikTok LIVE Studio / OBS, 1080×1920) : ${base}/overlay`);
  console.log('  ▸ Laissez cette fenêtre ouverte pendant le live. Ctrl+C pour quitter.');
  console.log('');
  if (process.argv.includes('--open')) openBrowser(base);
  if (config.tiktok.autoConnect && config.tiktok.username) tiktok.connect(config.tiktok.username);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log('\nArrêt…');
    await tiktok.disconnect().catch(() => {});
    process.exit(0);
  });
}
