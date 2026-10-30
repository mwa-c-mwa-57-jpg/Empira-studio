// Event guard shared by every game mode: validation, de-duplication and flood protection.

import { normalizeEvent } from './events.js';

export class EventGuard {
  constructor(safety, { now = () => Date.now() } = {}) {
    this.safety = safety;
    this.now = now;
    this.seenIds = new Set();
    this.seenOrder = [];
    this.windowStart = 0;
    this.windowCount = 0;
    this.stats = { accepted: 0, rejected: {}, total: 0 };
  }

  reject(reason) {
    this.stats.rejected[reason] = (this.stats.rejected[reason] || 0) + 1;
    return { ok: false, reason };
  }

  /** Returns { ok: true, event } or { ok: false, reason }. */
  check(raw) {
    this.stats.total++;
    const now = this.now();
    const res = normalizeEvent(raw, { now, ...this.safety });
    if (!res.ok) return this.reject(res.reason);
    const ev = res.event;
    if (this.seenIds.has(ev.id)) return this.reject('duplicate');
    this.seenIds.add(ev.id);
    this.seenOrder.push(ev.id);
    while (this.seenOrder.length > this.safety.dedupeWindow) this.seenIds.delete(this.seenOrder.shift());
    if (now - this.windowStart >= 1000) {
      this.windowStart = now;
      this.windowCount = 0;
    }
    // Gifts are never rate-limited: a paying viewer's contribution must not be dropped.
    if (ev.type !== 'gift' && ++this.windowCount > this.safety.maxEventsPerSec) return this.reject('rate-limited');
    this.stats.accepted++;
    return { ok: true, event: ev, now };
  }
}
