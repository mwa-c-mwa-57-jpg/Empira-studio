import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer, parseArgs } from '../server/server.js';

let server;
let base;
const spoken = [];
before(async () => {
  server = createServer({ log: () => {}, voice: { say: (t) => (spoken.push(t), true) } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const rawGet = (path) => new Promise((resolve, reject) => {
  // raw request so the client does not normalise "../" away
  http.get({ host: '127.0.0.1', port: server.address().port, path }, (res) => {
    res.resume();
    resolve(res.statusCode);
  }).on('error', reject);
});

test('serves the game, scripts and configuration', async () => {
  const html = await fetch(`${base}/`);
  assert.equal(html.status, 200);
  assert.match(await html.text(), /<canvas id="game"/);
  assert.match((await fetch(`${base}/src/main.js`)).headers.get('content-type'), /javascript/);
  const cfg = await (await fetch(`${base}/config/default.json`)).json();
  assert.equal(cfg.factions.A.name, 'SOLAIRE');
});

test('blocks path traversal', async () => {
  for (const p of ['/../package.json', '/..%2f..%2fpackage.json', '/config/..%2fserver%2fserver.js', '/%00']) {
    assert.ok([400, 404].includes(await rawGet(p)), p);
  }
});

test('relays injected events to SSE clients', async () => {
  const received = new Promise((resolve) => {
    http.get(`${base}/events`, (res) => {
      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk;
        const line = buf.split('\n').find((l) => l.startsWith('data: ') && l.includes('relay-test'));
        if (line) {
          res.destroy();
          resolve(JSON.parse(line.slice(6)));
        }
      });
    });
  });
  await new Promise((r) => setTimeout(r, 100));
  const res = await fetch(`${base}/api/inject`, { method: 'POST', body: JSON.stringify({ id: 'relay-test', type: 'like', user: { id: 'u' } }) });
  assert.equal(res.status, 200);
  const msg = await received;
  assert.equal(msg.kind, 'event');
  assert.equal(msg.event.id, 'relay-test');
});

test('rejects invalid JSON, oversized bodies, unknown admin actions and GET on the API', async () => {
  assert.equal((await fetch(`${base}/api/inject`, { method: 'POST', body: '{nope' })).status, 400);
  assert.equal((await fetch(`${base}/api/inject`, { method: 'POST', body: 'x'.repeat(70_000) }).catch(() => ({ status: 413 }))).status, 413);
  assert.equal((await fetch(`${base}/api/admin`, { method: 'POST', body: JSON.stringify({ action: 'shutdown' }) })).status, 400);
  assert.equal((await fetch(`${base}/api/inject`)).status, 405);
});

test('parses command line arguments', () => {
  assert.deepEqual(parseArgs(['--port', '4000', '--open', '--tiktok', '@creator']), { port: 4000, host: '127.0.0.1', open: true, tiktok: 'creator', voice: true });
  assert.equal(parseArgs(['--no-voice']).voice, false);
});

test('passes announcer phrases to the local voice', async () => {
  const res = await fetch(`${base}/api/say`, { method: 'POST', body: JSON.stringify({ text: 'Victoire du 17 !' }) });
  assert.equal(res.status, 200);
  assert.deepEqual(spoken, ['Victoire du 17 !']);
});
