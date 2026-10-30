// Rules for the "Conquête de France" mode: turns normalised live events into game actions.

import { EventGuard } from '../core/guard.js';
import { normalizeKeyword } from '../core/events.js';
import { DEPARTEMENTS } from './departements.js';

const CODES = new Set(DEPARTEMENTS.map((d) => d.code));
const NAMES = new Map(DEPARTEMENTS.map((d) => [normalizeKeyword(d.name), d.code]));

/** Finds a département in a chat message: "17", "le 17 !!", "2a", "974", "Charente-Maritime". */
export function findDepartement(comment) {
  const norm = normalizeKeyword(comment);
  if (!norm) return null;
  if (NAMES.has(norm)) return NAMES.get(norm);
  const tokens = norm.split(' ').slice(0, 3);
  for (const tok of tokens) {
    let code = null;
    if (/^\d{1,3}$/.test(tok)) code = tok.length === 1 ? `0${tok}` : tok;
    else if (tok === '2a' || tok === '2b') code = tok.toUpperCase();
    if (code && CODES.has(code)) return code;
  }
  return null;
}

export class FranceRules {
  constructor(config, game, { now = () => Date.now() } = {}) {
    this.config = config;
    this.game = game;
    this.guard = new EventGuard(config.safety, { now });
    this.stats = this.guard.stats;
    this.lastComment = new Map();
    this.giftsByName = new Map();
    for (const g of config.gifts) for (const n of g.names) this.giftsByName.set(n.toLowerCase(), g);
  }

  matchGift(gift) {
    return this.giftsByName.get(String(gift.name).toLowerCase()) || this.config.gifts.find((g) => g.id === gift.id) || null;
  }

  /** Makes sure the viewer's team exists in the current round (teams are reset between rounds). */
  #teamOf(p, user) {
    if (!p.team) return null;
    if (!this.game.teams.get(p.team)?.active) this.game.join(user, p.team);
    return p.team;
  }

  process(raw) {
    const res = this.guard.check(raw);
    if (!res.ok) return { accepted: false, reason: res.reason };
    const { event: ev, now } = res;
    const game = this.game;
    const eco = this.config.economy;
    const p = game.player(ev.user);
    if (game.phase !== 'battle') {
      // Victory screen: remember choices and gifts, they apply as soon as the next round starts.
      if (ev.type === 'comment') {
        const code = findDepartement(ev.comment);
        if (code) p.team = code;
      } else if (ev.type === 'gift') {
        p.pendingSoldiers += ev.gift.diamonds * ev.gift.count * eco.soldiersPerDiamond;
        return { accepted: true, pending: true };
      }
      return { accepted: true, ignored: 'between-rounds' };
    }

    switch (ev.type) {
      case 'comment': {
        const code = findDepartement(ev.comment);
        if (code && code !== p.team) {
          game.join(ev.user, code);
          this.lastComment.set(p.id, now);
          return { accepted: true };
        }
        const team = this.#teamOf(p, ev.user);
        if (!team) return { accepted: true, ignored: 'no-team' };
        if (now - (this.lastComment.get(p.id) ?? -Infinity) < eco.commentCooldownSec * 1000) return { accepted: true, ignored: 'cooldown' };
        this.lastComment.set(p.id, now);
        const n = game.addSoldiers(team, eco.commentSoldiers, p, 'comment');
        if (n) game.emit({ type: 'bubble', kind: 'comment', user: p, team, text: `commente pour le ${team}`, amount: n });
        return { accepted: true };
      }
      case 'like': {
        game.addLikes(ev.likeCount);
        const team = this.#teamOf(p, ev.user);
        if (!team) return { accepted: true, ignored: 'no-team' };
        p.likeRemainder += ev.likeCount;
        const soldiers = Math.floor(p.likeRemainder / eco.likesPerSoldier);
        p.likeRemainder -= soldiers * eco.likesPerSoldier;
        const n = game.addSoldiers(team, soldiers, p, 'like');
        game.emit({ type: 'bubble', kind: 'like', user: p, team, text: `tape l'écran pour le ${team}`, amount: n, likes: ev.likeCount });
        return { accepted: true };
      }
      case 'share':
      case 'follow': {
        const team = this.#teamOf(p, ev.user);
        if (!team) return { accepted: true, ignored: 'no-team' };
        const base = ev.type === 'share' ? eco.shareSoldiers : eco.followSoldiers;
        const n = game.addSoldiers(team, base, p, ev.type);
        game.emit({ type: 'bubble', kind: ev.type, user: p, team, text: ev.type === 'share' ? `partage pour le ${team}` : `s'abonne pour le ${team}`, amount: n });
        return { accepted: true };
      }
      case 'gift': {
        const { diamonds, count } = ev.gift;
        const base = diamonds * count * eco.soldiersPerDiamond;
        const def = this.matchGift(ev.gift);
        const team = this.#teamOf(p, ev.user);
        if (!team) {
          // Never lose a gift: it is kept until the viewer picks a département (or the next round starts).
          p.pendingSoldiers += base;
          game.emit({ type: 'bubble', kind: 'pending', user: p, team: null, text: 'écris ton département pour utiliser ton cadeau !', amount: 0 });
          return { accepted: true, pending: true };
        }
        const n = game.addSoldiers(team, base, p, 'gift');
        game.emit({ type: 'gift', user: p, team, gift: def || { icon: '🎁', label: '' }, name: ev.gift.name, count, amount: n, diamonds: diamonds * count });
        game.emit({ type: 'bubble', kind: 'gift', user: p, team, text: `envoie ${ev.gift.name}${count > 1 ? ` ×${count}` : ''} pour le ${team}`, amount: n });
        if (def) game.applyGiftEffect(team, p, def, count);
        return { accepted: true };
      }
      default:
        return { accepted: true, ignored: 'type' };
    }
  }
}
