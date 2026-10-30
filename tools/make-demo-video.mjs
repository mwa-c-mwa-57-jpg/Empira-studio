// Records a scripted demo of "Conquête de France" (OBS view, 9:16) and the announcer's phrases.
//
//   node tools/make-demo-video.mjs <outputDir>
//
// Produces <outputDir>/demo-raw.webm (video only) and <outputDir>/phrases.json ([{ t: ms, text }]).
// tools/make-demo-audio.py then turns the phrases into a voice track and muxes the final MP4.
// Requires Playwright + Chromium. All events are simulated: no TikTok connection is involved.

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { createServer } from '../server/server.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = path.resolve(process.argv[2] || 'demo');
mkdirSync(out, { recursive: true });

const phrases = [];
let t0 = 0;
const server = createServer({ log: () => {}, voice: { say: (text) => (phrases.push({ t: Date.now() - t0, text }), true) } });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 720, height: 1280 }, recordVideo: { dir: out, size: { width: 720, height: 1280 } } });
t0 = Date.now();
const page = await context.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${base}/?obs&voice=server`);
await page.waitForFunction(() => window.empira?.game);

// helpers available inside the page
await page.evaluate(() => {
  let n = 0;
  const E = window.empira;
  window.demo = {
    send: (type, name, extra = {}) => E.ingest({ id: `demo-${++n}`, type, source: 'sim', ts: Date.now(), user: { id: `demo-${name}`, name }, ...extra }),
    gift: (name, giftName, coins, count = 1) => window.demo.send('gift', name, { gift: { id: giftName, name: giftName, diamonds: coins, count } }),
    forceEvent(type, seconds) {
      const g = E.game;
      if (g.event) g.endEvent(false);
      const pick = g.rng.pick;
      g.rng.pick = (arr) => (arr.includes(type) ? type : pick(arr));
      g.startEvent();
      g.rng.pick = pick;
      if (g.event) {
        g.event.endsAt = g.elapsed + seconds;
        g.event.duration = seconds;
      }
    },
    crowd(depts) {
      const first = ['Lina', 'Rayan', 'Jade', 'Thomas', 'Sofia', 'Ilyes', 'Emma', 'Lucas', 'Camille', 'Sofiane', 'Louna', 'Enzo', 'Maëlys', 'Bilal', 'Clara', 'Nathan'];
      const viewers = Array.from({ length: 90 }, (_, i) => ({ name: `${first[i % first.length]}${i > 15 ? i : ''}`, dep: depts[Math.floor(Math.pow(Math.random(), 1.4) * depts.length)] }));
      for (const v of viewers) window.demo.send('comment', v.name, { comment: v.dep });
      setInterval(() => {
        for (let k = 0; k < 2; k++) {
          const v = viewers[Math.floor(Math.random() * viewers.length)];
          const r = Math.random();
          if (r < 0.75) window.demo.send('like', v.name, { likeCount: 5 + Math.floor(Math.random() * 25) });
          else if (r < 0.95) window.demo.send('comment', v.name, { comment: ['allez !', 'go go go', 'on lâche rien', 'trop fort'][Math.floor(Math.random() * 4)] });
          else window.demo.gift(v.name, 'Rose', 1, 1 + Math.floor(Math.random() * 5));
        }
      }, 150);
    },
  };
});

const at = async (sec, fn) => {
  const wait = t0 + sec * 1000 - Date.now();
  if (wait > 0) await page.waitForTimeout(wait);
  await page.evaluate(fn);
};

const fighters = [['Nana', '17'], ['Julia', '75'], ['Kenzo', '63'], ['Inès', '13'], ['Yanis', '59'], ['Léa', '21'], ['Malik', '974'], ['Zoé', '2A'], ['Hugo', '29'], ['Sarah', '67'], ['Noah', '33'], ['Chloé', '69']];
for (let i = 0; i < fighters.length; i++) {
  const [name, dep] = fighters[i];
  await at(1.5 + i * 0.6, `window.demo.send('comment', ${JSON.stringify(name)}, { comment: ${JSON.stringify(dep)} })`);
}
await at(9, `window.demo.crowd(['17','63','75','13','59','21','974','2A','29','67','33','69','31','44'])`);
await at(11, `window.demo.gift('Nana', 'Rose', 1, 10)`);
await at(13.5, `window.demo.gift('Kenzo', 'Donut', 30)`);
await at(15.5, `window.demo.send('share', 'Yanis')`);
await at(18, `window.demo.send('follow', 'Sarah')`);
await at(20, `window.demo.forceEvent('duel', 16)`);
await at(24, `window.demo.gift('Inès', 'Cygne', 699)`);
await at(29, `window.demo.gift('Léa', 'Rose', 1, 25)`);
await at(37, `window.demo.forceEvent('revolution', 11)`);
await at(41, `window.demo.gift('Julia', 'Le petit Ourson', 100)`);
await at(45, `window.demo.gift('Malik', 'Galaxie', 1000)`);
await at(51, `window.demo.gift('Kenzo', 'Léon le chaton', 4888)`);
await at(58, `(() => {
  const g = window.empira.game;
  const leader = g.ranking()[0];
  const owned = new Set(g.territoriesOf(leader.code));
  const victim = g.ranking().find((t) => t.code !== leader.code && g.owner.get(t.code) === t.code && !t.shieldUntil
    && [...owned].some((c) => window.empira.renderer.byCode.get(c).neighbors.includes(t.code)));
  if (victim) g.capture(leader.code, victim.code);
})()`);
await at(62, `window.empira.game.emit({ type: 'popup', kind: 'share' })`);
await at(66, `window.empira.game.elapsed = window.empira.game.config.match.durationSec - 12`);
await at(87, '0');

const video = page.video();
await context.close();
await browser.close();
server.close();
const raw = await video.path();
renameSync(raw, path.join(out, 'demo-raw.webm'));
writeFileSync(path.join(out, 'phrases.json'), JSON.stringify(phrases, null, 2));
console.log(`${phrases.length} phrases, vidéo : ${path.join(out, 'demo-raw.webm')}`);
