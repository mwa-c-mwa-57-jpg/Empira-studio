// "Conquête de France" game engine — free-for-all between départements.
// Pure simulation (no DOM): the renderer reads the state and the events from drainEvents().

import { createRng } from '../core/rng.js';
import { DEPARTEMENTS } from './departements.js';

export const TEAM_COLORS = ['#ff3fb4', '#2ee66b', '#c6f432', '#2ad4ff', '#ffb020', '#ff5a3c', '#9b6bff', '#00e0b0', '#ff7ad9', '#ffe23d',
  '#4d8bff', '#ff9150', '#7cff6b', '#e14bff', '#36f1e8', '#ff4d6d', '#b8ff3d', '#ffd1f0', '#5cffc2', '#ffaa00'];

const byCode = new Map(DEPARTEMENTS.map((d) => [d.code, d]));
export const isDepartement = (code) => byCode.has(code);
export const departement = (code) => byCode.get(code);

export class FranceGame {
  constructor(config, { seed = Date.now() } = {}) {
    this.config = config;
    this.rng = createRng(seed);
    this.events = [];
    this.players = new Map();
    this.speed = 1;
    this.paused = false;
    this.round = 0;
    this.mainlandCount = DEPARTEMENTS.filter((d) => !d.overseas).length;
    this.newRound();
  }

  // ------------------------------------------------------------------ lifecycle

  newRound() {
    this.round++;
    this.phase = 'battle';
    this.elapsed = 0;
    this.phaseTime = 0;
    this.owner = new Map(DEPARTEMENTS.map((d) => [d.code, null]));
    this.flash = new Map();
    this.teams = new Map();
    this.attacks = [];
    this.waves = [];
    this.likeTotal = 0;
    this.likeGoalReached = 0;
    this.event = null;
    this.nextEventAt = this.config.events.firstDelaySec;
    this.nextPopupAt = 20;
    this.revoltTimer = 0;
    this.winner = null;
    for (const p of this.players.values()) p.total = 0;
    this.emit({ type: 'roundStart', round: this.round });
  }

  emit(e) {
    this.events.push(e);
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  get timeLeft() {
    return Math.max(0, this.config.match.durationSec - this.elapsed);
  }

  // ------------------------------------------------------------------ queries

  territoriesOf(code) {
    const out = [];
    for (const [c, o] of this.owner) if (o === code) out.push(c);
    return out;
  }

  territoryCount(code) {
    let n = 0;
    for (const o of this.owner.values()) if (o === code) n++;
    return n;
  }

  ranking() {
    return [...this.teams.values()].filter((t) => t.active).sort((a, b) => b.soldiers - a.soldiers || a.joinedAt - b.joinedAt);
  }

  totalSoldiers() {
    let s = 0;
    for (const t of this.teams.values()) s += t.soldiers;
    return s;
  }

  share(team) {
    const total = this.totalSoldiers();
    return total > 0 ? team.soldiers / total : 0;
  }

  stars(team) {
    return this.config.economy.starThresholds.filter((v) => team.soldiers >= v).length;
  }

  king() {
    let best = null;
    for (const p of this.players.values()) if (p.team && p.total > 0 && (!best || p.total > best.total)) best = p;
    return best;
  }

  topMember(team) {
    let best = null;
    for (const [id, v] of team.contributions) if (!best || v > best.v) best = { id, v };
    return best ? this.players.get(best.id) : null;
  }

  isShielded(code) {
    const t = this.teams.get(code);
    return Boolean(t && t.shieldUntil > this.elapsed);
  }

  // ------------------------------------------------------------------ players and teams

  player(user) {
    let p = this.players.get(user.id);
    if (!p) {
      p = { id: user.id, name: user.name, avatar: user.avatar, team: null, total: 0, likeRemainder: 0, pendingSoldiers: 0 };
      this.players.set(user.id, p);
    }
    p.name = user.name;
    if (user.avatar) p.avatar = user.avatar;
    return p;
  }

  #pickColor(code) {
    const used = new Set([...this.teams.values()].filter((t) => t.active).map((t) => t.color));
    let i = [...code].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % TEAM_COLORS.length;
    for (let k = 0; k < TEAM_COLORS.length && used.has(TEAM_COLORS[i]); k++) i = (i + 1) % TEAM_COLORS.length;
    return TEAM_COLORS[i];
  }

  activateTeam(code) {
    let team = this.teams.get(code);
    if (team?.active) return team;
    const d = byCode.get(code);
    team = {
      code,
      name: d.name,
      region: d.region,
      color: this.#pickColor(code),
      soldiers: 0,
      progress: 0,
      target: null,
      cost: 0,
      contributions: new Map(),
      boostUntil: 0,
      boostMult: 1,
      shieldUntil: 0,
      joinedAt: this.elapsed,
      active: true,
      inFlight: false,
    };
    this.teams.set(code, team);
    if (this.owner.get(code) === null) {
      this.owner.set(code, code);
      this.flash.set(code, 1);
    }
    this.chooseTarget(team);
    return team;
  }

  /** Viewer chose a département in the chat. */
  join(user, code) {
    const p = this.player(user);
    const wasActive = this.teams.get(code)?.active;
    if (p.team === code && wasActive) return false;
    p.team = code;
    const team = this.activateTeam(code);
    if (!wasActive) {
      const gained = this.addSoldiers(code, this.config.economy.joinBonus, p, 'join');
      this.emit({ type: 'bubble', kind: 'join', user: p, team: code, text: `fait entrer ${code} ${team.name} en guerre !`, amount: gained });
      this.emit({ type: 'join', team: code });
    } else {
      this.emit({ type: 'bubble', kind: 'join', user: p, team: code, text: `rejoint le ${code}`, amount: 0 });
    }
    if (p.pendingSoldiers > 0) {
      const pending = p.pendingSoldiers;
      p.pendingSoldiers = 0;
      const gained = this.addSoldiers(code, pending, p, 'gift');
      this.emit({ type: 'bubble', kind: 'gift', user: p, team: code, text: `débloque ses cadeaux pour le ${code}`, amount: gained });
    }
    return true;
  }

  /** Adds soldiers with every active multiplier; returns the amount actually added. */
  addSoldiers(code, base, p, reason) {
    const team = this.teams.get(code);
    if (!team || base <= 0 || this.phase !== 'battle') return 0;
    let mult = team.boostUntil > this.elapsed ? team.boostMult : 1;
    const ev = this.event;
    if (ev?.type === 'revolution' && ev.target !== code) mult *= this.config.events.revolution.multiplier;
    const amount = Math.round(base * mult);
    team.soldiers += amount;
    team.progress += amount;
    if (p) {
      p.total += amount;
      team.contributions.set(p.id, (team.contributions.get(p.id) || 0) + amount);
    }
    if (ev?.type === 'duel' && ev.scores[code] !== undefined) ev.scores[code] += amount;
    if (ev?.type === 'mission' && team.region === ev.region) {
      ev.progress += amount;
      ev.participants.add(code);
    }
    this.emit({ type: 'soldiers', team: code, amount, reason });
    return amount;
  }

  // ------------------------------------------------------------------ gift effects

  attackTarget(fromCode) {
    const ranking = this.ranking();
    const first = ranking[0];
    if (!first) return null;
    if (first.code !== fromCode) return first;
    return ranking[1] || null;
  }

  applyGiftEffect(code, p, gift, count) {
    const effect = gift.effect || { type: 'none' };
    const team = this.teams.get(code);
    if (!team) return;
    switch (effect.type) {
      case 'boost':
        team.boostMult = Math.max(team.boostUntil > this.elapsed ? team.boostMult : 1, effect.multiplier);
        team.boostUntil = Math.max(team.boostUntil, this.elapsed) + effect.durationSec * Math.min(count, 4);
        this.emit({ type: 'banner', team: code, text: `${code} ${team.name} : ×${String(effect.multiplier).replace('.', ',')} pendant ${Math.round(team.boostUntil - this.elapsed)} s !` });
        break;
      case 'shield':
        team.shieldUntil = Math.max(team.shieldUntil, this.elapsed) + effect.durationSec * Math.min(count, 4);
        this.emit({ type: 'banner', team: code, text: `🛡 Bouclier sur le ${code} !` });
        break;
      case 'hit':
      case 'steal':
      case 'reset': {
        const victim = this.attackTarget(code);
        if (!victim) break;
        if (victim.shieldUntil > this.elapsed) {
          this.emit({ type: 'banner', team: victim.code, text: `🛡 Le ${victim.code} bloque l'attaque !` });
          break;
        }
        let lost;
        if (effect.type === 'reset') lost = victim.soldiers;
        else {
          const n = Math.min(count, effect.type === 'steal' ? 3 : 10);
          lost = Math.round(victim.soldiers * (1 - Math.pow(1 - effect.percent / 100, n)));
        }
        victim.soldiers = Math.max(0, victim.soldiers - lost);
        if (effect.type === 'steal') {
          team.soldiers += lost;
          team.progress += lost;
        }
        this.emit({ type: 'hit', from: code, team: victim.code, amount: lost, user: p, effect: effect.type });
        if (effect.type === 'reset') this.emit({ type: 'banner', team: code, text: `${p.name} remet le ${victim.code} à zéro !` });
        break;
      }
      case 'conquest':
        this.waves.push({ team: code, left: effect.territories, timer: 0 });
        this.emit({ type: 'banner', team: code, text: `${p.name} : le ${code} déferle sur la France !` });
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------ conquest

  candidates(team) {
    const owned = this.territoriesOf(team.code);
    const set = new Set();
    // exiled team: its first goal is to take its home back
    if (this.owner.get(team.code) !== team.code) return [team.code].filter((c) => !this.isShielded(this.owner.get(c)));
    let mainlandOwned = false;
    for (const c of owned) {
      const d = byCode.get(c);
      if (!d.overseas) mainlandOwned = true;
      for (const n of d.neighbors) if (this.owner.get(n) !== team.code) set.add(n);
    }
    // overseas départements land on the coasts and borders of mainland France
    if (!mainlandOwned) for (const d of DEPARTEMENTS) if (d.border && this.owner.get(d.code) !== team.code) set.add(d.code);
    return [...set].filter((c) => !this.isShielded(this.owner.get(c)));
  }

  conquestCost(team, code) {
    const eco = this.config.economy;
    let cost = eco.conquestBaseCost + eco.conquestCostPerTerritory * Math.max(0, this.territoryCount(team.code) - 1);
    const o = this.owner.get(code);
    if (o && o !== team.code) {
      const defender = this.teams.get(o);
      const n = Math.max(1, this.territoryCount(o));
      cost += eco.enemyCostFactor * (defender ? defender.soldiers / n : 0);
      if (o === code) cost *= 2; // a capital is harder to take
    }
    return Math.round(cost);
  }

  chooseTarget(team) {
    const cands = this.candidates(team);
    if (!cands.length) {
      team.target = null;
      return;
    }
    let best = null;
    for (const c of cands) {
      const cost = this.conquestCost(team, c) + this.rng() * 5;
      if (!best || cost < best.cost) best = { code: c, cost };
    }
    team.target = best.code;
    team.cost = this.conquestCost(team, best.code);
  }

  launchAttack(team, target, free = false) {
    const fromList = this.territoriesOf(team.code);
    const t = byCode.get(target);
    // depart from the closest owned territory (overseas teams fly from their island)
    let from = fromList[0];
    let bestD = Infinity;
    for (const c of fromList) {
      const d = byCode.get(c);
      if (d.overseas) continue;
      const dist = Math.hypot(d.center[0] - t.center[0], d.center[1] - t.center[1]);
      if (dist < bestD) {
        bestD = dist;
        from = c;
      }
    }
    team.inFlight = true;
    const dur = free ? 0.45 : this.config.economy.attackFlightSec;
    this.attacks.push({ team: team.code, from, to: target, t: 0, dur });
    this.emit({ type: 'attack', team: team.code, from, to: target });
  }

  capture(teamCode, code) {
    const previous = this.owner.get(code);
    this.owner.set(code, teamCode);
    this.flash.set(code, 1);
    const team = this.teams.get(teamCode);
    const capital = previous && previous === code;
    this.emit({ type: 'capture', team: teamCode, code, previous, capital });
    if (capital) this.emit({ type: 'banner', team: teamCode, text: `${teamCode} ${team.name} envahit la capitale du ${code} !` });
  }

  updateConquest(dt) {
    for (const a of this.attacks) a.t += dt;
    const landed = this.attacks.filter((a) => a.t >= a.dur);
    this.attacks = this.attacks.filter((a) => a.t < a.dur);
    for (const a of landed) {
      const team = this.teams.get(a.team);
      team.inFlight = false;
      const o = this.owner.get(a.to);
      if (o !== a.team && !this.isShielded(o)) this.capture(a.team, a.to);
      this.chooseTarget(team);
    }

    for (const w of this.waves) {
      w.timer -= dt;
      if (w.timer > 0 || w.left <= 0) continue;
      const team = this.teams.get(w.team);
      const cands = team ? this.candidates(team) : [];
      if (!cands.length) {
        w.left = 0;
        continue;
      }
      this.launchAttack(team, this.rng.pick(cands), true);
      w.left--;
      w.timer = 0.18;
    }
    this.waves = this.waves.filter((w) => w.left > 0);

    for (const team of this.teams.values()) {
      if (!team.active || team.inFlight) continue;
      if (team.target === null || this.owner.get(team.target) === team.code || this.isShielded(this.owner.get(team.target))) this.chooseTarget(team);
      if (team.target === null) continue;
      team.cost = this.conquestCost(team, team.target);
      if (team.progress >= team.cost) {
        team.progress -= team.cost;
        this.launchAttack(team, team.target);
      }
    }

    // Over-extended empires (after attacks on the leader) lose their outer territories.
    this.revoltTimer += dt;
    if (this.revoltTimer >= 3) {
      this.revoltTimer = 0;
      const min = this.config.economy.minSoldiersPerTerritory;
      for (const team of this.teams.values()) {
        const owned = this.territoriesOf(team.code).filter((c) => c !== team.code);
        if (!owned.length || team.soldiers >= min * (owned.length + 1)) continue;
        const lost = owned.reduce((a, b) => (this.#foreignNeighbors(a, team.code) >= this.#foreignNeighbors(b, team.code) ? a : b));
        this.owner.set(lost, null);
        this.flash.set(lost, 1);
        this.emit({ type: 'revolt', team: team.code, code: lost });
      }
    }
  }

  #foreignNeighbors(code, team) {
    return byCode.get(code).neighbors.filter((n) => this.owner.get(n) !== team).length;
  }

  // ------------------------------------------------------------------ live events

  startEvent() {
    const ranking = this.ranking().filter((t) => t.soldiers > 0);
    const ev = this.config.events;
    const options = [];
    if (ranking.length >= 2) options.push('duel', 'revolution', 'bounty');
    options.push('mission');
    const type = this.rng.pick(options);
    const now = this.elapsed;
    if (type === 'duel') {
      const [a, b] = ranking;
      this.event = { type, a: a.code, b: b.code, scores: { [a.code]: 0, [b.code]: 0 }, endsAt: now + ev.duel.durationSec, duration: ev.duel.durationSec };
    } else if (type === 'revolution') {
      this.event = { type, target: ranking[0].code, endsAt: now + ev.revolution.durationSec, duration: ev.revolution.durationSec };
    } else if (type === 'bounty') {
      this.event = { type, target: ranking[0].code, endsAt: now + ev.bounty.durationSec, duration: ev.bounty.durationSec };
    } else {
      const activeRegions = [...new Set(ranking.map((t) => t.region))].filter((r) => r !== 'Outre-mer');
      const allRegions = [...new Set(DEPARTEMENTS.map((d) => d.region))].filter((r) => r !== 'Outre-mer');
      const region = this.rng.pick(activeRegions.length && this.rng() < 0.7 ? activeRegions : allRegions);
      const teamsInRegion = ranking.filter((t) => t.region === region).length;
      this.event = {
        type,
        region,
        target: ev.mission.targetPerTeam * Math.max(1, teamsInRegion),
        progress: 0,
        participants: new Set(),
        endsAt: now + ev.mission.durationSec,
        duration: ev.mission.durationSec,
      };
    }
    this.emit({ type: 'eventStart', event: this.event });
  }

  endEvent(success) {
    const e = this.event;
    this.event = null;
    const ev = this.config.events;
    let text = null;
    if (e.type === 'duel') {
      const sa = e.scores[e.a];
      const sb = e.scores[e.b];
      if (sa !== sb) {
        const [w, l] = sa > sb ? [e.a, e.b] : [e.b, e.a];
        const loser = this.teams.get(l);
        const winner = this.teams.get(w);
        const stolen = Math.round(loser.soldiers * (ev.duel.stealPercent / 100));
        loser.soldiers -= stolen;
        winner.soldiers += stolen;
        winner.progress += stolen;
        text = `${w} ${winner.name} gagne le duel et vole ${stolen} soldats au ${l} !`;
        this.emit({ type: 'hit', from: w, team: l, amount: stolen, effect: 'duel' });
      } else text = 'Duel nul : personne ne vole personne.';
    } else if (e.type === 'mission') {
      if (e.progress >= e.target) {
        for (const code of e.participants) {
          const team = this.teams.get(code);
          team.soldiers += ev.mission.rewardPerDepartment;
          team.progress += ev.mission.rewardPerDepartment;
        }
        text = `Mission réussie : +${ev.mission.rewardPerDepartment} pour ${e.participants.size} département(s) de ${e.region} !`;
      } else text = `Mission échouée pour la région ${e.region}…`;
    } else if (e.type === 'revolution') {
      text = 'Fin de la révolution. Le calme revient… pour l\'instant.';
    } else if (e.type === 'bounty') {
      text = success ? `${success.code} ${success.name} dépasse le ${e.target} et touche la prime de ${ev.bounty.reward} soldats !` : `Personne n'a dépassé le ${e.target}.`;
    }
    this.emit({ type: 'eventEnd', event: e, text });
    const [min, max] = ev.intervalSec;
    this.nextEventAt = this.elapsed + this.rng.range(min, max);
  }

  updateEvents() {
    const e = this.event;
    if (!e) {
      if (this.elapsed >= this.nextEventAt) this.startEvent();
    } else if (e.type === 'mission' && e.progress >= e.target) {
      this.endEvent(true);
    } else if (e.type === 'bounty') {
      const leader = this.teams.get(e.target);
      const passer = this.ranking().find((t) => t.code !== e.target && t.soldiers > (leader?.soldiers ?? 0));
      if (passer) {
        passer.soldiers += this.config.events.bounty.reward;
        passer.progress += this.config.events.bounty.reward;
        this.endEvent(passer);
      } else if (this.elapsed >= e.endsAt) this.endEvent(null);
    } else if (this.elapsed >= e.endsAt) {
      this.endEvent(false);
    }
    if (this.elapsed >= this.nextPopupAt) {
      this.nextPopupAt = this.elapsed + this.config.events.generalPopupEverySec;
      this.emit({ type: 'popup', kind: this.rng.pick(['share', 'join', 'follow', 'gift']) });
    }
  }

  addLikes(n) {
    this.likeTotal += n;
    const goal = this.config.economy.likeGoal;
    while (this.likeTotal >= goal * (this.likeGoalReached + 1)) {
      this.likeGoalReached++;
      for (const t of this.teams.values()) if (t.active) this.addSoldiers(t.code, this.config.economy.likeGoalReward, null, 'goal');
      this.emit({ type: 'banner', team: null, text: `Objectif de likes atteint : +${this.config.economy.likeGoalReward} pour tous les départements !` });
    }
  }

  // ------------------------------------------------------------------ main loop

  update(dt) {
    if (this.paused) return;
    dt *= this.speed;
    this.phaseTime += dt;
    for (const [c, f] of this.flash) {
      if (f <= dt) this.flash.delete(c);
      else this.flash.set(c, f - dt * 1.5);
    }
    if (this.phase === 'victory') {
      if (this.phaseTime >= this.config.match.victoryScreenSec) this.newRound();
      return;
    }
    this.elapsed += dt;
    this.updateConquest(dt);
    this.updateEvents();
    this.checkVictory();
  }

  checkVictory() {
    const ranking = [...this.teams.values()].filter((t) => t.active);
    const byLand = ranking.map((t) => ({ t, n: this.territoryCount(t.code) })).sort((a, b) => b.n - a.n || b.t.soldiers - a.t.soldiers);
    const leader = byLand[0];
    const dominates = leader && leader.n >= this.config.match.instantWinRatio * this.mainlandCount;
    if (!dominates && this.elapsed < this.config.match.durationSec) return;
    this.phase = 'victory';
    this.phaseTime = 0;
    this.attacks = [];
    this.waves = [];
    if (this.event) this.event = null;
    this.winner = leader ? { code: leader.t.code, name: leader.t.name, color: leader.t.color, territories: leader.n, soldiers: leader.t.soldiers } : null;
    this.podium = byLand.slice(0, 3).map(({ t, n }) => ({ code: t.code, name: t.name, color: t.color, territories: n, soldiers: t.soldiers, top: this.topMember(t) }));
    const king = this.king();
    this.finalKing = king ? { id: king.id, name: king.name, avatar: king.avatar, team: king.team, total: king.total } : null;
    this.emit({ type: 'victory', winner: this.winner, reason: dominates ? 'domination' : 'time' });
  }
}
