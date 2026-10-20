// Chef d'orchestre : reçoit les événements, gère la file, décide quoi imprimer, où et quand,
// et prévient les overlays (rendu 3D) et le tableau de bord.
import { EventEmitter } from 'node:events';
import { PrintQueue, cardSize } from './queue.js';
import { PageLayout } from './layout.js';
import { publicConfig } from './config.js';

const PAGES_KEPT = 3; // pages visibles dans la scène (sous l'imprimante + 2 déjà sorties)
const GAP_AFTER_PRINT_MS = 500;
const LOG_SIZE = 80;
const HISTORY_SIZE = 30;

const TEST_NAMES = [
  'Shinta', 'panz_299', 'Nhia', 'KING of ARTUR', 'valeria', 'Mohammed', 'Jose', 'Gracie',
  'Joshua Garcia', 'sofica', 'Andres', 'Eiraa', 'Cesar', 'Monii', 'Y.J.A.S', 'Lina', 'Hugo', 'Inès',
];
const TEST_EMOJIS = ['🦊', '🐻', '🐱', '🐼', '🦁', '🐸', '😎', '👑', '🌸', '🎧', '🐯', '🦄', '🐵', '🌻', '💀', '🤠'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function publicJob(job) {
  return {
    id: job.id,
    kind: job.kind,
    user: job.user,
    coins: job.coins,
    giftName: job.giftName,
    tier: job.tier,
    pinned: job.pinned,
  };
}

export class Engine extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.queue = new PrintQueue(config);
    this.layout = new PageLayout();
    this.pages = Array.from({ length: PAGES_KEPT }, () => []);
    this.current = null;
    this.feeding = null;
    this.busy = false;
    this.paused = false;
    this.pendingFeed = false;
    this.pendingClear = false;
    this.overlays = 0;
    this.history = [];
    this.log = [];
    this.likeBuckets = new Map();
    this.idleTimer = null;
    this.tiktok = { state: 'disconnected' };
  }

  // ---- diffusion -------------------------------------------------------------------------

  toOverlays(message) {
    this.emit('overlay', message);
  }

  changed() {
    this.emit('changed');
  }

  snapshot() {
    return {
      type: 'state',
      tiktok: this.tiktok,
      paused: this.paused,
      overlays: this.overlays,
      busy: this.busy,
      feeding: Boolean(this.feeding),
      current: this.current && { ...publicJob(this.current), duration: this.current.duration, startedAt: this.current.startedAt },
      queue: this.queue.items.map(publicJob),
      history: this.history.slice(0, 15),
      log: this.log.slice(0, 50),
      config: publicConfig(this.config),
    };
  }

  // État complet pour un overlay qui (re)démarre : il redessine le papier tel quel.
  overlaySync() {
    const now = Date.now();
    return {
      type: 'sync',
      config: publicConfig(this.config),
      pages: this.pages,
      current: this.current && { ...this.current, elapsed: (now - this.current.startedAt) / 1000 },
      feeding: this.feeding && { duration: this.feeding.duration, elapsed: (now - this.feeding.startedAt) / 1000 },
      queueLength: this.queue.length,
    };
  }

  addLog(entry) {
    this.log.unshift({ at: Date.now(), ...entry });
    if (this.log.length > LOG_SIZE) this.log.length = LOG_SIZE;
  }

  setTiktokStatus(status) {
    this.tiktok = { ...status };
    this.changed();
  }

  // ---- réglages --------------------------------------------------------------------------

  applyConfig(config) {
    this.config = config;
    this.queue.setConfig(config);
    this.toOverlays({ type: 'config', config: publicConfig(config) });
    this.changed();
    this.schedule();
  }

  // ---- événements du live ----------------------------------------------------------------

  handleViewer(event) {
    const { config } = this;
    const name = event.user.nickname || event.user.uniqueId;
    if (!config.events[event.kind]) return;

    if (event.kind === 'comment' && config.commentKeyword) {
      const wanted = fold(config.commentKeyword);
      if (!fold(event.comment || '').includes(wanted)) return;
    }

    if (event.kind === 'like') {
      // Une impression à chaque fois que le spectateur franchit un multiple du seuil.
      const bucket = Math.floor((event.likeTotal || 0) / config.likeThreshold);
      if (bucket < 1 || bucket <= (this.likeBuckets.get(event.user.id) || 0)) return;
      this.likeBuckets.set(event.user.id, bucket);
    }

    const result = this.queue.add(event, this.current?.user.id);
    if (event.kind !== 'join' || result.status === 'added') {
      this.addLog({ kind: event.kind, name, coins: event.coins || 0, comment: event.comment || '', status: result.status });
    }
    if (result.status === 'added' || result.status === 'upgraded') {
      this.toOverlays({
        type: 'toast',
        kind: result.job.kind,
        name,
        coins: result.job.coins,
        upgraded: result.status === 'upgraded',
        queueLength: this.queue.length,
      });
    }
    this.changed();
    this.schedule();
  }

  simulate(kind, coins = 0) {
    const name = TEST_NAMES[Math.floor(Math.random() * TEST_NAMES.length)];
    const emoji = TEST_EMOJIS[Math.floor(Math.random() * TEST_EMOJIS.length)];
    const hue = Math.floor(Math.random() * 360);
    const id = `test-${Math.random().toString(36).slice(2, 9)}`;
    const user = { id, uniqueId: name.replace(/\s+/g, '_').toLowerCase(), nickname: name, avatar: `test:${emoji}:${hue}` };
    const event = { kind, user };
    if (kind === 'gift') Object.assign(event, { coins: Math.max(1, Number(coins) || 1), giftName: 'Test' });
    if (kind === 'comment') event.comment = this.config.commentKeyword || 'yo';
    if (kind === 'like') event.likeTotal = this.config.likeThreshold;
    // Le test passe même si le type d'événement est désactivé dans les réglages.
    const saved = this.config.events[kind];
    this.config.events[kind] = true;
    try {
      this.handleViewer(event);
    } finally {
      this.config.events[kind] = saved;
    }
  }

  burst(count = 8) {
    const kinds = ['join', 'join', 'follow', 'comment', 'comment', 'share', 'gift'];
    for (let i = 0; i < count; i++) {
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      const coins = [1, 1, 5, 10, 30][Math.floor(Math.random() * 5)];
      setTimeout(() => this.simulate(kind, coins), i * 350);
    }
  }

  // ---- commandes du tableau de bord ------------------------------------------------------

  setOverlayCount(n) {
    this.overlays = Math.max(0, n);
    this.changed();
    this.schedule();
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    this.changed();
    this.schedule();
  }

  removeJob(id) {
    if (this.queue.remove(id)) this.changed();
  }

  bumpJob(id) {
    if (this.queue.bump(id)) this.changed();
  }

  clearQueue() {
    const n = this.queue.clear();
    this.addLog({ kind: 'system', name: '', status: `file vidée (${n})` });
    this.changed();
  }

  requestFeed() {
    this.pendingFeed = true;
    this.schedule();
  }

  requestClear() {
    this.pendingClear = true;
    this.schedule();
  }

  // ---- boucle d'impression ---------------------------------------------------------------

  schedule() {
    if (this.busy || this.overlays === 0) return;

    if (this.pendingClear) {
      this.pendingClear = false;
      this.pages = Array.from({ length: PAGES_KEPT }, () => []);
      this.layout.reset();
      this.toOverlays({ type: 'clear' });
      this.changed();
    }
    if (this.pendingFeed) {
      this.pendingFeed = false;
      this.runTask(() => this.feed());
      return;
    }
    if (this.paused) return;

    const job = this.queue.next();
    if (!job) {
      this.armIdleFeed();
      return;
    }
    this.runTask(() => this.print(job));
  }

  runTask(task) {
    clearTimeout(this.idleTimer);
    this.idleTimer = null;
    this.busy = true;
    this.changed();
    Promise.resolve()
      .then(task)
      .catch((err) => console.error('Erreur pendant l’impression :', err))
      .finally(() => {
        this.busy = false;
        this.changed();
        this.schedule();
      });
  }

  armIdleFeed() {
    const seconds = this.config.autoFeedIdleSeconds;
    if (!seconds || this.layout.isEmpty || this.idleTimer) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (!this.busy && this.queue.length === 0 && !this.layout.isEmpty) this.requestFeed();
    }, seconds * 1000);
  }

  async feed() {
    const duration = this.config.feedSeconds;
    this.feeding = { startedAt: Date.now(), duration };
    this.toOverlays({ type: 'feed', duration });
    this.changed();
    await sleep(duration * 1000);
    this.pages.unshift([]);
    this.pages.length = PAGES_KEPT;
    this.layout.reset();
    this.feeding = null;
  }

  async print(job) {
    const { tier } = job;
    const { w, h } = cardSize(tier);
    let rect = this.layout.place(w, h, tier.fullPage);
    if (!rect) {
      await this.feed();
      rect = this.layout.place(w, h, tier.fullPage);
    }
    const duration = Math.max(2, tier.seconds / this.config.speed);
    this.current = { ...publicJob(job), rect, duration, startedAt: Date.now() };
    this.addLog({ kind: 'print', name: job.user.nickname, coins: job.coins, status: 'impression' });
    this.toOverlays({ type: 'print', job: this.current, queueLength: this.queue.length });
    this.changed();

    await sleep(duration * 1000 + GAP_AFTER_PRINT_MS);

    const done = { ...publicJob(job), rect };
    this.pages[0].push(done);
    this.history.unshift({ ...done, at: Date.now() });
    if (this.history.length > HISTORY_SIZE) this.history.length = HISTORY_SIZE;
    this.current = null;
  }
}

// Comparaison insensible aux accents et à la casse.
function fold(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
