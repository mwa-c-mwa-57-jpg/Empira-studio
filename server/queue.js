// File d'impression : priorités, doublons, cumul des cadeaux, anti-spam.
// Logique pure (aucun timer, aucun réseau) pour pouvoir la tester facilement.

// Plus le nombre est petit, plus l'événement est prioritaire (à coins égaux).
export const KIND_PRIORITY = { gift: 0, follow: 1, share: 2, comment: 3, like: 4, join: 5 };

// Palier correspondant à un nombre de coins (0 = palier gratuit).
export function tierFor(coins, config) {
  let tier = { ...config.freeTier, id: 'free', coins: 0 };
  config.tiers.forEach((t, i) => {
    if (coins >= t.coins) tier = { ...t, id: `t${i}` };
  });
  return tier;
}

// Taille en unités « page » (la page fait 1000 × 1400).
export function cardSize(tier) {
  const w = tier.size;
  const ratio = tier.fullPage ? 1.25 : 1.2;
  return { w, h: Math.round(w * ratio) };
}

export class PrintQueue {
  constructor(config, now = () => Date.now()) {
    this.config = config;
    this.now = now;
    this.items = [];
    this.seq = 0;
    this.pinCounter = 0;
    this.lastPrinted = new Map(); // userId -> timestamp du début de sa dernière impression
  }

  setConfig(config) {
    this.config = config;
    for (const job of this.items) job.tier = tierFor(job.coins, config);
    this.sort();
    this.trim();
  }

  compare(a, b) {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.pinned && b.pinned) return b.pinnedAt - a.pinnedAt; // le dernier « maintenant » passe en premier
    if (b.coins !== a.coins) return b.coins - a.coins;
    const pa = KIND_PRIORITY[a.kind] ?? 9;
    const pb = KIND_PRIORITY[b.kind] ?? 9;
    if (pa !== pb) return pa - pb;
    return a.seq - b.seq;
  }

  sort() {
    this.items.sort((a, b) => this.compare(a, b));
  }

  // Retire les entrées les moins prioritaires si la file dépasse la limite.
  trim() {
    const dropped = [];
    while (this.items.length > this.config.maxQueue) dropped.push(this.items.pop());
    return dropped;
  }

  inCooldown(userId) {
    const last = this.lastPrinted.get(userId);
    if (!last) return false;
    return this.now() - last < this.config.cooldownMinutes * 60_000;
  }

  // event : { kind, user: {id, uniqueId, nickname, avatar}, coins?, giftName? }
  // currentUserId : spectateur en cours d'impression (pas de doublon gratuit pour lui).
  add(event, currentUserId = null) {
    const coins = event.kind === 'gift' ? Math.max(1, Math.round(event.coins || 1)) : 0;
    const existing = this.items.find((j) => j.user.id === event.user.id);

    if (existing) {
      if (event.kind !== 'gift') return { status: 'duplicate', job: existing };
      existing.coins += coins;
      existing.kind = 'gift';
      existing.giftName = event.giftName || existing.giftName;
      existing.user = { ...existing.user, ...pickDefined(event.user) };
      existing.tier = tierFor(existing.coins, this.config);
      this.sort();
      return { status: 'upgraded', job: existing };
    }

    if (event.kind !== 'gift') {
      if (currentUserId && currentUserId === event.user.id) return { status: 'duplicate', job: null };
      if (this.inCooldown(event.user.id)) return { status: 'cooldown', job: null };
    }

    const job = {
      id: `${Date.now().toString(36)}-${(++this.seq).toString(36)}`,
      seq: this.seq,
      kind: event.kind,
      user: event.user,
      coins,
      giftName: event.giftName || '',
      tier: tierFor(coins, this.config),
      createdAt: this.now(),
      pinned: false,
      pinnedAt: 0,
    };

    if (this.items.length >= this.config.maxQueue) {
      const worst = this.items[this.items.length - 1];
      if (this.compare(job, worst) >= 0) return { status: 'full', job: null };
      this.items.pop();
    }
    this.items.push(job);
    this.sort();
    return { status: 'added', job };
  }

  // Prochaine impression (la plus prioritaire), retirée de la file.
  next() {
    const job = this.items.shift() || null;
    if (job) this.lastPrinted.set(job.user.id, this.now());
    return job;
  }

  remove(id) {
    const i = this.items.findIndex((j) => j.id === id);
    if (i === -1) return null;
    return this.items.splice(i, 1)[0];
  }

  // « Imprimer maintenant » : passe devant tout le monde.
  bump(id) {
    const job = this.items.find((j) => j.id === id);
    if (!job) return null;
    job.pinned = true;
    job.pinnedAt = ++this.pinCounter;
    this.sort();
    return job;
  }

  clear() {
    const n = this.items.length;
    this.items = [];
    return n;
  }

  get length() {
    return this.items.length;
  }
}

function pickDefined(obj) {
  return Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== undefined && v !== ''));
}
