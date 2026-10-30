// Entry point of the "Conquête de France" mode: sources → rules → game → renderer.

import { FranceGame } from './game.js';
import { FranceRules } from './rules.js';
import { FranceRenderer } from './renderer.js';
import { createFrancePanel } from './devPanel.js';
import { connectServerSource } from '../sources/serverSource.js';
import { Announcer, browserSpeech, serverSpeech } from './voice.js';

export function startFrance(config, { obsMode }) {
  const canvas = document.getElementById('game');
  const game = new FranceGame(config);
  const rules = new FranceRules(config, game);
  const renderer = new FranceRenderer(canvas, game, config);
  const connection = { server: 'offline', tiktok: null };

  const ingest = (raw) => rules.process(raw);

  // Voice: in OBS the local server speaks (browser sources handle speech synthesis poorly);
  // on the test page the browser speaks once the creator clicks "Activer la voix".
  const voiceCfg = config.voice || {};
  const params = new URLSearchParams(location.search);
  let output = params.get('voice') || voiceCfg.output || 'auto';
  if (output === 'auto') output = obsMode ? 'server' : 'browser';
  const speak = output === 'server' ? serverSpeech() : output === 'browser' ? browserSpeech(voiceCfg) : null;
  const announcer = speak && voiceCfg.enabled !== false ? new Announcer(config, game, { speak }) : null;
  if (announcer && output === 'browser') announcer.enabled = false; // browsers require a user gesture first
  function adminAction({ action, value }) {
    if (action === 'restart') game.newRound();
    else if (action === 'pause') game.paused = Boolean(value);
    else if (action === 'speed') game.speed = Math.min(8, Math.max(0.25, Number(value) || 1));
    else if (action === 'event' && game.phase === 'battle') {
      if (game.event) game.endEvent(false);
      game.startEvent();
    } else if (action === 'end' && game.phase === 'battle') game.elapsed = config.match.durationSec;
  }

  connectServerSource({
    onEvent: ingest,
    onAdmin: adminAction,
    onStatus: (s) => {
      if (s.server) connection.server = s.server;
      if (s.tiktok) connection.tiktok = s.tiktok;
    },
  });

  let fps = 60;
  if (!obsMode) {
    createFrancePanel(document.getElementById('panel'), {
      voice: announcer && {
        output,
        isOn: () => announcer.enabled,
        toggle: () => {
          announcer.enabled = !announcer.enabled;
          if (announcer.enabled) announcer.say('La voix du Général est activée !', 3, `on:${Date.now()}`);
          else if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
          return announcer.enabled;
        },
      },
      sink: ingest,
      admin: adminAction,
      gifts: config.gifts,
      getStats: () => {
        const r = rules.stats;
        const rejected = Object.entries(r.rejected).map(([k, v]) => `${k}: ${v}`).join(', ') || 'aucun';
        return [
          `FPS ${fps.toFixed(0)} · départements en guerre ${game.ranking().length} · attaques ${game.attacks.length}`,
          `Événements reçus ${r.total} · acceptés ${r.accepted}`,
          `Rejetés : ${rejected}`,
          `Serveur : ${connection.server} · TikTok : ${connection.tiktok?.state ?? 'non configuré'}`,
          `Partie ${game.round} · ${game.phase} · événement : ${game.event?.type ?? 'aucun'}`,
          `Cadeaux non reconnus : ${[...rules.unknownGifts.values()].sort((a, b) => b.count - a.count).slice(0, 5).map((g) => `${g.name} (id ${g.id}, ${g.diamonds} pièces) ×${g.count}`).join(' · ') || 'aucun'}`,
        ].join('\n');
      },
    });
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'd' && e.target.tagName !== 'INPUT') document.body.classList.toggle('panel-hidden');
    });
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    fps = fps * 0.95 + (1 / Math.max(dt, 0.001)) * 0.05;
    game.update(dt);
    const events = game.drainEvents();
    renderer.handleEvents(events);
    if (announcer) {
      announcer.handleEvents(events);
      announcer.tick();
    }
    const tiktok = connection.tiktok;
    const status = tiktok && tiktok.state !== 'connected' ? { ok: false, text: `TikTok : ${tiktok.state}${tiktok.detail ? ` (${tiktok.detail})` : ''} — le jeu continue` } : null;
    renderer.render(dt, { status });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.empira = { game, rules, ingest, renderer, announcer, mode: 'france' };
}
