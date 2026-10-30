// Entry point of the game page: wires sources → rules engine → game engine → renderer.

import { RulesEngine } from './core/rules.js';
import { Game } from './game/engine.js';
import { Renderer } from './render/renderer.js';
import { connectServerSource } from './sources/serverSource.js';
import { createDevPanel } from './ui/devPanel.js';

const params = new URLSearchParams(location.search);
const obsMode = params.has('obs');
const configName = (params.get('config') || 'default').replace(/[^a-z0-9_-]/gi, '');

async function loadConfig() {
  const res = await fetch(`config/${configName}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Configuration introuvable : ${configName}`);
  return res.json();
}

function start(config) {
  document.body.classList.toggle('obs', obsMode);

  const canvas = document.getElementById('game');
  const game = new Game(config, { layout: { x: 20, y: 290, width: 1040, height: 1250 } });
  const rules = new RulesEngine(config);
  const renderer = new Renderer(canvas, game, config);
  const connection = { server: 'offline', tiktok: null };

  function ingest(raw) {
    const res = rules.process(raw);
    for (const cmd of res.commands) game.apply(cmd);
    return res;
  }

  function adminAction({ action, value }) {
    if (action === 'restart') game.newRound();
    else if (action === 'pause') game.paused = Boolean(value);
    else if (action === 'speed') game.speed = Math.min(8, Math.max(0.25, Number(value) || 1));
  }

  connectServerSource({
    onEvent: ingest,
    onAdmin: adminAction,
    onStatus: (s) => {
      if (s.server) connection.server = s.server;
      if (s.tiktok) connection.tiktok = s.tiktok;
    },
  });

  const panel = document.getElementById('panel');
  if (!obsMode) {
    createDevPanel(panel, {
      sink: ingest,
      admin: adminAction,
      getStats: () => {
        const r = rules.stats;
        const rejected = Object.entries(r.rejected).map(([k, v]) => `${k}: ${v}`).join(', ') || 'aucun';
        return [
          `FPS ${fps.toFixed(0)} · unités ${game.units.length} · file ${game.spawnQueue.A.length + game.spawnQueue.B.length}`,
          `Événements reçus ${r.total} · appliqués ${r.accepted}`,
          `Rejetés : ${rejected}`,
          `Serveur : ${connection.server} · TikTok : ${connection.tiktok?.state ?? 'non configuré'}`,
          `Manche ${game.round} · seed ${game.seed} · phase ${game.phase}`,
        ].join('\n');
      },
    });
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'd' && e.target.tagName !== 'INPUT') document.body.classList.toggle('panel-hidden');
    });
  }

  let last = performance.now();
  let fps = 60;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    fps = fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
    // fixed sub-steps keep the simulation stable when the frame rate drops
    const steps = Math.ceil(dt / (1 / 60));
    for (let i = 0; i < steps; i++) game.update(dt / steps);
    const events = game.drainEvents();
    for (const e of events) {
      if (e.type === 'roundStart') rules.resetRound();
      if (e.type === 'capture' && e.user) rules.credit(e.user.id, config.interactions.capturePoints);
    }
    renderer.handleEvents(events);
    const tiktok = connection.tiktok;
    const status = tiktok && tiktok.state !== 'connected'
      ? { ok: false, text: `TikTok : ${tiktok.state}${tiktok.detail ? ` (${tiktok.detail})` : ''} — le jeu continue` }
      : null;
    renderer.render(dt, { teams: rules.teamCounts(), likePools: rules.likePools, leaderboard: rules.leaderboard(5), status });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // exposed for debugging and automated browser tests
  window.empira = { game, rules, ingest };
}

loadConfig().then(start).catch((err) => {
  document.body.textContent = `Erreur de démarrage : ${err.message}`;
  console.error(err);
});
