// Overlay : reçoit les ordres du serveur local et les joue dans la scène 3D.
import { Booth } from './scene.js';
import { setLanguage, t } from './i18n.js';
import * as ui from './ui.js';
import * as sound from './sound.js';

let currentJob = null;
let queueLength = 0;

// Les polices doivent être prêtes avant de dessiner les pseudos sur le papier.
await Promise.race([
  Promise.all(['700 40px Caveat', '40px Anton', '600 40px Oswald'].map((f) => document.fonts.load(f))),
  new Promise((resolve) => setTimeout(resolve, 3000)),
]).catch(() => {});

const booth = new Booth(document.getElementById('scene'), {
  t,
  onPass: (seconds) => sound.pass(seconds),
  onFeed: (seconds) => sound.feed(seconds),
  onPrintEnd: () => {
    sound.done();
    currentJob = null;
    ui.hideStatus();
    ui.highlightTier(null);
  },
});

function applyConfig(config) {
  setLanguage(config.language);
  sound.setSoundEnabled(config.sound && !new URLSearchParams(location.search).has('mute'));
  ui.applyBranding(config);
  ui.renderLegend(config);
}

function startPrint(job, elapsed = 0) {
  booth.startPrint(job, elapsed); // termine d'abord l'impression précédente s'il y en a une
  currentJob = job;
  ui.showStatus(job, queueLength);
  ui.highlightTier(job.tier?.id && job.tier.id !== 'free' ? job.tier.id : null);
}

function handle(msg) {
  switch (msg.type) {
    case 'sync': {
      applyConfig(msg.config);
      queueLength = msg.queueLength || 0;
      // pendant une avance papier, on affiche directement l'état d'après
      const pages = msg.feeding ? [[], ...(msg.pages || []).slice(0, 2)] : msg.pages || [];
      booth.restore(pages);
      if (msg.current) startPrint(msg.current, msg.current.elapsed);
      break;
    }
    case 'config':
      applyConfig(msg.config);
      break;
    case 'toast':
      queueLength = msg.queueLength ?? queueLength;
      ui.toast(msg);
      ui.updateQueueCount(currentJob, queueLength);
      break;
    case 'print':
      queueLength = msg.queueLength ?? queueLength;
      startPrint(msg.job);
      break;
    case 'feed':
      booth.startFeed(msg.duration);
      break;
    case 'clear':
      booth.clearAll();
      break;
    default:
      break;
  }
}

let offlineTimer = null;

function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?role=overlay`);
  ws.onopen = () => {
    clearTimeout(offlineTimer);
    ui.setOffline(false);
  };
  ws.onmessage = (event) => {
    try {
      handle(JSON.parse(event.data));
    } catch (err) {
      console.error(err);
    }
  };
  ws.onclose = () => {
    clearTimeout(offlineTimer);
    offlineTimer = setTimeout(() => ui.setOffline(true), 3000);
    setTimeout(connect, 1500);
  };
}

connect();
