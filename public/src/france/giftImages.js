// Real gift pictures, learned at runtime from the TikTok connection (room gift list and gift events).
// Nothing is stored in the project: pictures are loaded from TikTok's servers while live.
// Without a connection (test mode) the emoji of the configuration is used instead.

import { normalizeKeyword, safeImageUrl } from '../core/events.js';

export class GiftImages {
  constructor() {
    this.byId = new Map();
    this.byName = new Map();
    this.images = new Map();
  }

  /** Learns one gift picture: { id, name, image }. Invalid entries are ignored. */
  learn(gift) {
    const url = safeImageUrl(gift?.image);
    if (!url) return false;
    if (gift.id) this.byId.set(String(gift.id).slice(0, 32), url);
    if (gift.name) this.byName.set(normalizeKeyword(String(gift.name).slice(0, 40)), url);
    return true;
  }

  learnAll(list) {
    if (!Array.isArray(list)) return 0;
    let n = 0;
    for (const g of list.slice(0, 1000)) if (this.learn(g)) n++;
    return n;
  }

  /** URL of the picture of a configured gift (matched by TikTok id, then by any of its names). */
  urlFor(def) {
    if (!def) return null;
    for (const id of def.ids || []) if (this.byId.has(String(id))) return this.byId.get(String(id));
    for (const n of def.names || []) {
      const url = this.byName.get(normalizeKeyword(n));
      if (url) return url;
    }
    return null;
  }

  /** Loaded picture ready to draw, or null (still loading, failed, or unknown → draw the emoji). */
  image(url) {
    if (!url || typeof Image === 'undefined') return null;
    let entry = this.images.get(url);
    if (!entry) {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      entry = { img, ok: false };
      img.onload = () => (entry.ok = true);
      img.src = url;
      this.images.set(url, entry);
    }
    return entry.ok ? entry.img : null;
  }
}
