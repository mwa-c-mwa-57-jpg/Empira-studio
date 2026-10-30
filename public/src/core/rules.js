// Rules engine: turns normalised live events into game commands according to the configuration.
// Pure logic (no DOM, no timers) so it can run in the browser, on a server, or in tests.

import { normalizeKeyword } from './events.js';
import { EventGuard } from './guard.js';

export const FACTIONS = ['A', 'B'];

export class RulesEngine {
  constructor(config, { now = () => Date.now(), random = Math.random } = {}) {
    this.config = config;
    this.now = now;
    this.random = random;
    this.players = new Map(); // userId -> { id, name, faction, points, lastActionAt }
    this.likePools = { A: 0, B: 0 };
    this.guard = new EventGuard(config.safety, { now });
    this.stats = this.guard.stats;
    this.keywords = {};
    for (const f of FACTIONS) {
      this.keywords[f] = new Set((config.factions[f].keywords || []).map(normalizeKeyword));
    }
  }

  /** Called when a new round starts: teams are kept, round scores and like pools are reset. */
  resetRound() {
    this.likePools = { A: 0, B: 0 };
    for (const p of this.players.values()) p.points = 0;
  }

  teamCounts() {
    const counts = { A: 0, B: 0 };
    for (const p of this.players.values()) if (p.faction) counts[p.faction]++;
    return counts;
  }

  leaderboard(n = 5) {
    return [...this.players.values()]
      .filter((p) => p.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, n)
      .map(({ name, faction, points }) => ({ name, faction, points: Math.floor(points) }));
  }

  credit(userId, points) {
    const p = this.players.get(userId);
    if (p) p.points += points;
  }

  #matchFaction(comment) {
    const norm = normalizeKeyword(comment);
    if (!norm) return null;
    const first = norm.split(' ')[0];
    for (const f of FACTIONS) {
      if (this.keywords[f].has(norm) || this.keywords[f].has(first)) return f;
    }
    return null;
  }

  #weakerTeam() {
    const c = this.teamCounts();
    if (c.A === c.B) return this.random() < 0.5 ? 'A' : 'B';
    return c.A < c.B ? 'A' : 'B';
  }

  #player(user) {
    let p = this.players.get(user.id);
    if (!p) {
      p = { id: user.id, name: user.name, faction: null, points: 0, lastActionAt: -Infinity };
      this.players.set(user.id, p);
    }
    p.name = user.name;
    return p;
  }

  #ensureFaction(p, commands) {
    if (!p.faction) {
      p.faction = this.#weakerTeam();
      commands.push({ type: 'feed', faction: p.faction, text: `${p.name} rejoint ${this.config.factions[p.faction].name}` });
    }
    return p.faction;
  }

  /**
   * Processes one raw event. Returns { accepted, reason?, event?, commands }.
   * Command types:
   *   { type: 'spawn', faction, kind, count, user? }
   *   { type: 'special', special: 'meteor', faction, user }
   *   { type: 'banner', faction, text }
   *   { type: 'feed', faction, text }
   */
  process(raw) {
    const { interactions: ix } = this.config;
    const res = this.guard.check(raw);
    if (!res.ok) return { accepted: false, reason: res.reason, commands: [] };
    const { event: ev, now } = res;

    const commands = [];
    const p = this.#player(ev.user);
    const user = { id: p.id, name: p.name };

    switch (ev.type) {
      case 'comment': {
        const chosen = this.#matchFaction(ev.comment);
        const onCooldown = now - p.lastActionAt < ix.comment.cooldownSec * 1000;
        if (chosen && chosen !== p.faction) {
          p.faction = chosen;
          commands.push({ type: 'feed', faction: chosen, text: `${p.name} rejoint ${this.config.factions[chosen].name}` });
          if (!onCooldown) {
            commands.push({ type: 'spawn', faction: chosen, ...ix.comment.joinSpawn, user });
            p.lastActionAt = now;
          }
        } else if (!p.faction) {
          return { accepted: true, event: ev, commands, ignored: 'no-team' };
        } else if (onCooldown) {
          return { accepted: true, event: ev, commands, ignored: 'cooldown' };
        } else {
          commands.push({ type: 'spawn', faction: p.faction, ...ix.comment.memberCommentSpawn, user });
          p.lastActionAt = now;
        }
        p.points += ix.comment.points;
        break;
      }
      case 'like': {
        const f = this.#ensureFaction(p, commands);
        p.points += ev.likeCount * ix.like.pointsPerLike;
        this.likePools[f] += ev.likeCount;
        while (this.likePools[f] >= ix.like.likesPerCharge) {
          this.likePools[f] -= ix.like.likesPerCharge;
          commands.push({ type: 'spawn', faction: f, ...ix.like.charge });
          commands.push({ type: 'banner', faction: f, text: `CHARGE ${this.config.factions[f].name} !` });
        }
        break;
      }
      case 'gift': {
        const f = this.#ensureFaction(p, commands);
        const { diamonds, count, name } = ev.gift;
        p.points += diamonds * count * ix.gift.pointsPerDiamond;
        const tier = [...ix.gift.tiers].reverse().find((t) => diamonds >= t.minDiamonds);
        if (!tier) break;
        if (tier.special) {
          const n = Math.min(count, 3);
          for (let i = 0; i < n; i++) commands.push({ type: 'special', special: tier.special, faction: f, user });
        } else {
          commands.push({ type: 'spawn', faction: f, kind: tier.kind, count: Math.min(count, ix.gift.maxSpawnPerEvent), user });
        }
        const times = count > 1 ? ` x${count}` : '';
        commands.push({ type: 'banner', faction: f, text: `${p.name} : ${tier.label}${times} !` });
        commands.push({ type: 'feed', faction: f, text: `${p.name} offre ${name}${times}` });
        break;
      }
      case 'follow':
      case 'share': {
        const f = this.#ensureFaction(p, commands);
        const rule = ix[ev.type];
        p.points += rule.points;
        commands.push({ type: 'spawn', faction: f, kind: rule.kind, count: rule.count, user });
        commands.push({ type: 'feed', faction: f, text: `${p.name} ${ev.type === 'follow' ? 's\'abonne' : 'partage le live'}` });
        break;
      }
      default:
        break;
    }
    return { accepted: true, event: ev, commands };
  }
}
