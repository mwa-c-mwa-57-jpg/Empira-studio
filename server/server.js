// Empira Conquest local server — zero dependencies.
//  - serves the game (public/) and the configuration files (config/)
//  - relays live events to every open game page through Server-Sent Events (/events)
//  - accepts simulated events and admin commands from the control panel (POST /api/inject, /api/admin)
//  - optionally connects a real TikTok LIVE source (--tiktok <username>)
//  - speaks the announcer's phrases with the computer's voices (POST /api/say), for OBS
//
// Usage: node server/server.js [--port 3000] [--host 127.0.0.1] [--open] [--tiktok <username>] [--no-voice]

import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createVoice } from './voice.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CONFIG_DIR = path.join(ROOT, 'config');
const MAX_BODY = 64 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export function parseArgs(argv) {
  const args = { port: Number(process.env.PORT) || 3000, host: '127.0.0.1', open: false, tiktok: null, voice: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port') args.port = Number(argv[++i]);
    else if (a === '--host') args.host = argv[++i];
    else if (a === '--open') args.open = true;
    else if (a === '--tiktok') args.tiktok = (argv[++i] || '').replace(/^@/, '') || null;
    else if (a === '--no-voice') args.voice = false;
  }
  return args;
}

/** Resolves a URL path inside a base directory, refusing anything that escapes it. */
function safeJoin(base, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const full = path.resolve(base, '.' + path.posix.normalize('/' + decoded));
  return full === base || full.startsWith(base + path.sep) ? full : null;
}

function isLocal(req) {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

export function createServer({ log = console.log, voice = null } = {}) {
  const clients = new Set();
  let lastStatus = null;
  let lastGifts = null;

  function broadcast(message) {
    if (message.kind === 'status') lastStatus = message;
    if (message.kind === 'gifts') lastGifts = message;
    const payload = `data: ${JSON.stringify(message)}\n\n`;
    for (const res of clients) res.write(payload);
  }

  const heartbeat = setInterval(() => {
    for (const res of clients) res.write(': ping\n\n');
  }, 15000);
  heartbeat.unref();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const send = (status, body, type = 'application/json; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
      res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };

    try {
      if (url.pathname === '/events' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        res.write('retry: 2000\n\n');
        if (lastStatus) res.write(`data: ${JSON.stringify(lastStatus)}\n\n`);
        if (lastGifts) res.write(`data: ${JSON.stringify(lastGifts)}\n\n`);
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
      }

      if (url.pathname.startsWith('/api/')) {
        if (req.method !== 'POST') return send(405, { error: 'method not allowed' });
        // Control endpoints are only reachable from this computer.
        if (!isLocal(req)) return send(403, { error: 'forbidden' });
        const body = await readJsonBody(req);
        if (url.pathname === '/api/inject') {
          const events = Array.isArray(body) ? body.slice(0, 500) : [body];
          for (const event of events) {
            if (event && typeof event === 'object') broadcast({ kind: 'event', event: { ...event, source: event.source || 'control' } });
          }
          return send(200, { ok: true, relayed: events.length, clients: clients.size });
        }
        if (url.pathname === '/api/say') {
          if (!voice) return send(503, { error: 'voice disabled' });
          const spoken = voice.say(typeof body.text === 'string' ? body.text : '');
          return send(200, { ok: true, spoken });
        }
        if (url.pathname === '/api/admin') {
          const allowed = ['restart', 'pause', 'speed', 'event', 'end'];
          if (!allowed.includes(body.action)) return send(400, { error: 'unknown action' });
          broadcast({ kind: 'admin', action: body.action, value: body.value });
          return send(200, { ok: true });
        }
        return send(404, { error: 'not found' });
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, { error: 'method not allowed' });
      const isConfig = url.pathname.startsWith('/config/');
      const base = isConfig ? CONFIG_DIR : PUBLIC_DIR;
      const rel = isConfig ? url.pathname.slice('/config'.length) : url.pathname === '/' ? '/index.html' : url.pathname;
      const file = safeJoin(base, rel);
      if (!file) return send(400, { error: 'bad path' });
      const info = await stat(file).catch(() => null);
      if (!info || !info.isFile()) return send(404, 'Not found', 'text/plain; charset=utf-8');
      const data = await readFile(file);
      send(200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    } catch (err) {
      if (!res.headersSent) send(err.status || 500, { error: err.status ? err.message : 'internal error' });
      if (!err.status) log('[server] error', err);
    }
  });

  server.broadcast = broadcast;
  server.clientCount = () => clients.size;
  server.on('close', () => {
    clearInterval(heartbeat);
    for (const res of clients) res.end();
  });
  return server;
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    spawn(cmd[0], cmd[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  } catch {
    /* no browser available: the URL is printed anyway */
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const voice = args.voice ? createVoice() : null;
  const server = createServer({ voice });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') console.error(`Le port ${args.port} est déjà utilisé. Fermez l'autre fenêtre du jeu ou lancez avec --port 3001.`);
    else console.error(err);
    process.exit(1);
  });
  server.listen(args.port, args.host, async () => {
    const base = `http://localhost:${args.port}`;
    console.log('');
    console.log('  EMPIRA CONQUEST — serveur local démarré');
    console.log(`  Jeu + panneau de test : ${base}/`);
    console.log(`  Source OBS (sans menu) : ${base}/?obs`);
    console.log(`  Régie à distance       : ${base}/control.html`);
    console.log('  Ctrl+C pour arrêter.');
    console.log('');
    if (args.open) openBrowser(`${base}/`);
    if (args.tiktok) {
      const { startTikTokSource } = await import(pathToFileURL(path.join(ROOT, 'server/adapters/tiktok-live.js')).href);
      startTikTokSource(args.tiktok, {
        onEvent: (event) => server.broadcast({ kind: 'event', event }),
        onGifts: (gifts) => {
          console.log(`  [TikTok] ${gifts.length} cadeaux avec image reçus`);
          server.broadcast({ kind: 'gifts', gifts });
        },
        onStatus: (tiktok) => {
          console.log(`  [TikTok] ${tiktok.state}${tiktok.detail ? ' — ' + tiktok.detail : ''}`);
          server.broadcast({ kind: 'status', tiktok });
        },
      });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
