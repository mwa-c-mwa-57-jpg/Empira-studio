// Browser smoke test (optional): requires Playwright + Chromium.
//   node tests/e2e/smoke.mjs [screenshotDir]
// Starts the local server, opens the game, plays a full simulated match and checks for errors.

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createServer } from '../../server/server.js';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.log('Playwright non installé : test navigateur ignoré (npm install -D playwright pour l\'activer).');
  process.exit(0);
}

const shotDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (shotDir) mkdirSync(shotDir, { recursive: true });

const spokenByServer = [];
const server = createServer({ log: () => {}, voice: { say: (t) => (spokenByServer.push(t), true) } });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const failures = [];
const check = (cond, msg) => {
  console.log(`${cond ? '✔' : '✘'} ${msg}`);
  if (!cond) failures.push(msg);
};

try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(`${base}/?mode=factions`);
  await page.waitForFunction(() => window.empira?.game);
  check(await page.locator('#panel button').count() > 10, 'panneau de test affiché');
  if (shotDir) await page.screenshot({ path: path.join(shotDir, '1-compte-a-rebours.png') });

  // Countdown then battle
  await page.evaluate(() => (window.empira.game.speed = 4));
  await page.waitForFunction(() => window.empira.game.phase === 'battle', null, { timeout: 10000 });
  check(true, 'la partie démarre après le compte à rebours');

  // Panel buttons go through the whole pipeline
  await page.fill('[data-id="name"]', 'Testeur');
  await page.click('[data-act="c1"]');
  await page.click('[data-act="gmedium"]');
  await page.click('[data-act="like100"]');
  await page.click('[data-act="like100"]');
  await page.click('[data-act="dup"]');
  const s = await page.evaluate(() => ({
    team: window.empira.rules.players.get('manual-testeur')?.faction,
    dup: window.empira.rules.stats.rejected.duplicate || 0,
    units: window.empira.game.units.length + window.empira.game.spawnQueue.A.length,
  }));
  check(s.team === 'A', 'le commentaire « 1 » fait rejoindre SOLAIRE');
  check(s.dup === 1, 'le doublon est rejeté une fois');
  check(s.units > 0, 'les interactions font apparaître des unités');

  // Simulated crowd favouring SOLAIRE
  await page.check('[data-id="crowd"]');
  await page.$eval('[data-id="rate"]', (el) => { el.value = '30'; el.dispatchEvent(new Event('input')); });
  await page.$eval('[data-id="bias"]', (el) => { el.value = '20'; el.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(2500);
  if (shotDir) await page.screenshot({ path: path.join(shotDir, '2-bataille.png') });
  await page.click('[data-act="gbig"]');
  await page.waitForTimeout(700);
  if (shotDir) await page.screenshot({ path: path.join(shotDir, '3-meteore.png') });

  // Stress: 1000 events at once must not freeze or crash the page
  const t0 = Date.now();
  await page.click('[data-act="storm"]');
  await page.waitForTimeout(500);
  check(Date.now() - t0 < 3000, 'la tempête de 1000 événements est absorbée sans blocage');

  await page.evaluate(() => (window.empira.game.speed = 8));
  await page.waitForFunction(() => window.empira.game.phase === 'victory', null, { timeout: 90000 });
  const v = await page.evaluate(() => ({ winner: window.empira.game.winner, reason: window.empira.game.winReason }));
  check(true, `une faction gagne (${v.winner}, ${v.reason})`);
  await page.waitForTimeout(400);
  if (shotDir) await page.screenshot({ path: path.join(shotDir, '4-victoire.png') });
  await page.waitForFunction(() => window.empira.game.round === 2, null, { timeout: 30000 });
  check(true, 'une nouvelle manche démarre automatiquement');

  // OBS mode + server relay (control panel → server → OBS page)
  const obs = await browser.newPage({ viewport: { width: 540, height: 960 } });
  obs.on('pageerror', (e) => errors.push(e.message));
  await obs.goto(`${base}/?obs&mode=factions`);
  await obs.waitForFunction(() => window.empira?.game);
  check(await obs.locator('#panel').isHidden(), 'mode OBS sans panneau de test');
  await obs.waitForFunction(() => document.querySelector('#game') && window.empira.game.round >= 1);
  await obs.waitForTimeout(500); // let EventSource connect
  const res = await fetch(`${base}/api/inject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'relay-1', type: 'comment', comment: '2', user: { id: 'relay', name: 'Relais' } }) });
  check(res.ok, 'le serveur accepte un événement injecté');
  await obs.waitForFunction(() => window.empira.rules.players.get('relay')?.faction === 'B', null, { timeout: 5000 });
  check(true, 'l\'événement relayé par le serveur arrive dans la page OBS');
  if (shotDir) await obs.screenshot({ path: path.join(shotDir, '5-mode-obs.png') });

  // ---- Conquête de France (default mode)
  const fr = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  fr.on('pageerror', (e) => errors.push(e.message));
  fr.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await fr.goto(`${base}/`);
  await fr.waitForFunction(() => window.empira?.mode === 'france');
  check(true, 'le mode Conquête de France est le mode par défaut');
  await fr.fill('[data-id="name"]', 'Nana');
  await fr.fill('[data-id="dep"]', '17');
  await fr.click('[data-act="join"]');
  await fr.click('[data-act="combo"]');
  check(await fr.evaluate(() => window.empira.game.teams.get('17')?.soldiers) === 105, 'écrire « 17 » fait entrer la Charente-Maritime en guerre, combo ×10 Rose = +100');
  await fr.click('[data-act="voice"]');
  check(await fr.evaluate(() => window.empira.announcer.enabled && window.empira.announcer.lastSaid.size > 0), 'la voix du Général s\'active d\'un clic dans la page de test');
  await fr.check('[data-id="crowd"]');
  await fr.$eval('[data-id="rate"]', (el) => { el.value = '40'; el.dispatchEvent(new Event('input')); });
  await fr.$eval('[data-id="giftRate"]', (el) => { el.value = '8'; el.dispatchEvent(new Event('input')); });
  await fr.waitForTimeout(5000);
  const st = await fr.evaluate(() => ({ teams: window.empira.game.ranking().length, owned: [...window.empira.game.owner.values()].filter(Boolean).length }));
  check(st.teams >= 5 && st.owned > st.teams, `la foule fait entrer des départements en guerre et conquérir (${st.teams} équipes, ${st.owned} départements)`);
  if (shotDir) await fr.screenshot({ path: path.join(shotDir, 'france-1-bataille.png') });
  await fr.click('[data-act="event"]');
  await fr.click('button[data-gift="8"]');
  await fr.waitForTimeout(900);
  check(await fr.evaluate(() => Boolean(window.empira.game.event)), 'un événement en direct démarre (duel, révolution, mission ou prime)');
  if (shotDir) await fr.screenshot({ path: path.join(shotDir, 'france-2-evenement.png') });
  await fr.click('[data-act="storm"]');
  await fr.click('[data-act="end"]');
  await fr.waitForFunction(() => window.empira.game.phase === 'victory', null, { timeout: 5000 });
  await fr.waitForTimeout(800);
  check(Boolean(await fr.evaluate(() => window.empira.game.winner)), 'fin de partie avec podium');
  if (shotDir) await fr.screenshot({ path: path.join(shotDir, 'france-3-victoire.png') });
  const obsFr = await browser.newPage({ viewport: { width: 540, height: 960 } });
  obsFr.on('pageerror', (e) => errors.push(e.message));
  await obsFr.goto(`${base}/?obs`);
  await obsFr.waitForFunction(() => window.empira?.mode === 'france');
  await obsFr.waitForTimeout(500);
  await fetch(`${base}/api/inject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'relay-fr', type: 'comment', comment: '974', user: { id: 'reu', name: 'Réunion' } }) });
  await obsFr.waitForFunction(() => window.empira.game.teams.get('974')?.active, null, { timeout: 5000 });
  check(true, 'mode OBS France : l\'événement relayé par le serveur fait entrer le 974');
  for (let i = 0; i < 24 && !spokenByServer.some((t) => /Réunion/.test(t)); i++) await obsFr.waitForTimeout(500);
  check(spokenByServer.some((t) => t.startsWith('Nouvelle partie')) && spokenByServer.some((t) => /974/.test(t) || /Réunion/.test(t)), `mode OBS : la voix passe par le serveur local (${spokenByServer.length} phrases : « ${spokenByServer.slice(0, 2).join(' » « ')} »)`);
  await obsFr.waitForTimeout(600);
  if (shotDir) await obsFr.screenshot({ path: path.join(shotDir, 'france-4-obs.png') });

  check(errors.length === 0, `aucune erreur JavaScript${errors.length ? ' : ' + errors.join(' | ') : ''}`);
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(`\n${failures.length} vérification(s) en échec`);
  process.exit(1);
}
console.log('\nTest navigateur : OK');
