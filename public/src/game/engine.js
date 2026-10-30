// Game engine: pure simulation of the territorial war. No DOM — renders are done elsewhere
// from `game.territories`, `game.units` and the events returned by `drainEvents()`.

import { createRng } from '../core/rng.js';
import { generateMap, bfsDistances } from './map.js';

const OTHER = { A: 'B', B: 'A' };

export class Game {
  constructor(config, { layout, seed } = {}) {
    this.config = config;
    this.layout = layout || { x: 20, y: 300, width: 1040, height: 1240 };
    this.events = [];
    this.speed = 1;
    this.paused = false;
    this.round = 0;
    this.newRound(seed);
  }

  newRound(seed = this.config.map.seed ?? Math.floor(Math.random() * 2 ** 31)) {
    this.seed = seed;
    this.rng = createRng(seed);
    const map = generateMap(this.config.map, this.rng, this.layout, this.config.economy);
    this.map = map;
    this.territories = map.territories;
    this.radius = map.radius;
    this.units = [];
    this.nextUnitId = 1;
    this.phase = 'countdown';
    this.phaseTime = 0;
    this.elapsed = 0;
    this.winner = null;
    this.winReason = null;
    this.autoSpawnTimers = { A: 0, B: 0 };
    this.spawnAccumulator = { A: 0, B: 0 };
    // Spawn requests and specials survive round changes so no viewer contribution is lost.
    this.spawnQueue = this.spawnQueue || { A: [], B: [] };
    this.deferred = this.deferred || [];
    // a meteor still falling when the previous round ended is replayed in the next one
    for (const s of this.scheduled || []) if (s.cmd) this.deferred.push(s.cmd);
    this.scheduled = [];
    this.round++;
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

  owned(faction) {
    return this.territories.filter((t) => t.owner === faction);
  }

  counts() {
    const c = { A: 0, B: 0, neutral: 0, total: this.territories.length };
    for (const t of this.territories) c[t.owner ?? 'neutral']++;
    return c;
  }

  // ---------------------------------------------------------------- commands

  apply(cmd) {
    if (cmd.type === 'spawn' || cmd.type === 'special') {
      if (this.phase !== 'battle') {
        this.deferred.push(cmd);
        return;
      }
      if (cmd.type === 'spawn') this.enqueueSpawn(cmd.faction, cmd.kind, cmd.count, cmd.user);
      else if (cmd.special === 'meteor') this.castMeteor(cmd.faction, cmd.user);
    } else if (cmd.type === 'banner' || cmd.type === 'feed') {
      this.emit(cmd);
    }
  }

  enqueueSpawn(faction, kind, count = 1, user = null) {
    if (!this.config.units[kind]) return;
    const n = Math.max(0, Math.min(count, 200));
    for (let i = 0; i < n; i++) this.spawnQueue[faction].push({ kind, user });
  }

  frontier(faction) {
    return this.territories.filter((t) => t.owner === faction && t.neighbors.some((n) => this.territories[n].owner !== faction));
  }

  spawnUnit(faction, kind, user) {
    const def = this.config.units[kind];
    const front = this.frontier(faction);
    if (!front.length) return null;
    // heroes appear on the front closest to the enemy capital, soldiers anywhere on the front
    const enemyDist = this.map.distToCapital[OTHER[faction]];
    const base = def.power >= 8
      ? front.reduce((best, t) => (enemyDist.get(t.id) < enemyDist.get(best.id) ? t : best))
      : this.rng.pick(front);

    if (this.units.length >= this.config.economy.maxUnits) {
      // Performance cap: convert the unit into garrison strength instead of a new sprite.
      base.garrison += def.power;
      return null;
    }
    const jitter = this.radius * 0.35;
    const unit = {
      id: this.nextUnitId++,
      faction,
      kind,
      power: def.power,
      maxPower: def.power,
      speed: def.speed,
      scale: def.scale,
      user,
      x: base.x + this.rng.range(-jitter, jitter),
      y: base.y + this.rng.range(-jitter, jitter),
      at: base.id,
      target: null,
      tx: 0,
      ty: 0,
      hops: 0,
      age: 0,
      phase: this.rng() * Math.PI * 2,
    };
    this.units.push(unit);
    this.chooseTarget(unit);
    this.emit({ type: 'spawn', faction, kind, x: unit.x, y: unit.y, user });
    return unit;
  }

  chooseTarget(unit) {
    const here = this.territories[unit.at];
    const f = unit.faction;
    const enemyDist = this.map.distToCapital[OTHER[f]];
    const hostile = here.neighbors.map((n) => this.territories[n]).filter((t) => t.owner !== f);
    let target;
    if (hostile.length) {
      const hero = unit.power >= 8;
      const score = (t) => {
        const defense = t.garrison * (t.capital ? this.config.economy.capitalDefense : 1);
        const enemyBonus = hero && t.owner === OTHER[f] ? -6 : 0;
        return defense + enemyDist.get(t.id) * 1.2 + enemyBonus + this.rng() * 3;
      };
      target = hostile.reduce((best, t) => (score(t) < score(best) ? t : best));
    } else {
      // Interior territory: walk towards the closest front line.
      const dist = bfsDistances(this.territories, here.id);
      let best = null;
      for (const t of this.territories) {
        if (t.owner !== f && (best === null || dist.get(t.id) < dist.get(best.id))) best = t;
      }
      if (!best) return;
      const back = bfsDistances(this.territories, best.id);
      target = here.neighbors.map((n) => this.territories[n]).reduce((a, b) => (back.get(a.id) <= back.get(b.id) ? a : b));
    }
    unit.target = target.id;
    const j = this.radius * 0.3;
    unit.tx = target.x + this.rng.range(-j, j);
    unit.ty = target.y + this.rng.range(-j, j);
  }

  castMeteor(faction, user) {
    const enemy = OTHER[faction];
    const front = this.territories.filter((t) => t.owner !== faction && t.neighbors.some((n) => this.territories[n].owner === faction));
    if (!front.length) return;
    const enemyFront = front.filter((t) => t.owner === enemy);
    const pool = enemyFront.length ? enemyFront : front;
    const target = pool.reduce((best, t) => (t.garrison > best.garrison ? t : best));
    this.emit({ type: 'meteorCast', faction, x: target.x, y: target.y, user });
    this.scheduled.push({ at: this.elapsed + 1.0, run: () => this.meteorImpact(faction, target, user), cmd: { type: 'special', special: 'meteor', faction, user } });
  }

  meteorImpact(faction, target, user) {
    const killRadius = this.radius * 1.4;
    for (const u of this.units) {
      if (u.faction !== faction && Math.hypot(u.x - target.x, u.y - target.y) < killRadius) u.power = 0;
    }
    if (target.owner !== faction) {
      if (target.capital) {
        target.garrison *= 0.4;
      } else {
        this.capture(target, faction, 6, user);
      }
    }
    this.emit({ type: 'meteorImpact', faction, x: target.x, y: target.y });
  }

  capture(t, faction, garrison, user) {
    const previous = t.owner;
    t.owner = faction;
    t.garrison = garrison;
    t.flash = 1;
    t.flashOwner = faction;
    this.emit({ type: 'capture', faction, previous, territory: t.id, x: t.x, y: t.y, capital: t.capital, user });
  }

  // ---------------------------------------------------------------- simulation

  update(dt) {
    if (this.paused) return;
    dt *= this.speed;
    this.phaseTime += dt;
    for (const t of this.territories) if (t.flash > 0) t.flash = Math.max(0, t.flash - dt * 1.2);

    if (this.phase === 'countdown') {
      if (this.phaseTime >= this.config.match.countdownSec) this.startBattle();
      return;
    }
    if (this.phase === 'victory') {
      this.updateUnits(dt); // let the last animations play out
      if (this.config.match.autoRestart && this.phaseTime >= this.config.match.victoryScreenSec) this.newRound();
      return;
    }

    this.elapsed += dt;
    for (const s of this.scheduled.filter((s) => s.at <= this.elapsed)) s.run();
    this.scheduled = this.scheduled.filter((s) => s.at > this.elapsed);

    this.updateAutoSpawn(dt);
    this.drainSpawnQueue(dt);
    this.updateUnits(dt);
    this.resolveClashes();
    this.checkVictory();
  }

  startBattle() {
    this.phase = 'battle';
    this.phaseTime = 0;
    this.emit({ type: 'battleStart' });
    const deferred = this.deferred;
    this.deferred = [];
    for (const cmd of deferred) this.apply(cmd);
  }

  updateAutoSpawn(dt) {
    const c = this.counts();
    const eco = this.config.economy;
    for (const f of ['A', 'B']) {
      const deficit = Math.max(0, (c[OTHER[f]] - c[f]) / c.total);
      const interval = eco.autoSpawnIntervalSec / (1 + eco.underdogBoost * deficit * 4);
      this.autoSpawnTimers[f] += dt;
      while (this.autoSpawnTimers[f] >= interval) {
        this.autoSpawnTimers[f] -= interval;
        this.spawnUnit(f, 'soldier', null);
      }
    }
  }

  drainSpawnQueue(dt) {
    const rate = this.config.economy.spawnRatePerSec;
    for (const f of ['A', 'B']) {
      const q = this.spawnQueue[f];
      if (!q.length) {
        this.spawnAccumulator[f] = 0;
        continue;
      }
      this.spawnAccumulator[f] += dt * rate;
      while (this.spawnAccumulator[f] >= 1 && q.length) {
        this.spawnAccumulator[f] -= 1;
        const { kind, user } = q.shift();
        this.spawnUnit(f, kind, user);
      }
    }
  }

  updateUnits(dt) {
    for (const u of this.units) {
      if (u.power <= 0 || u.target === null) continue;
      u.age += dt;
      const dx = u.tx - u.x;
      const dy = u.ty - u.y;
      const d = Math.hypot(dx, dy);
      const step = u.speed * dt;
      if (d <= step) {
        u.x = u.tx;
        u.y = u.ty;
        if (this.phase === 'battle') this.arrive(u);
      } else {
        u.x += (dx / d) * step;
        u.y += (dy / d) * step;
      }
    }
    this.units = this.units.filter((u) => {
      if (u.power > 0) return true;
      if (!u.absorbed) this.emit({ type: 'death', faction: u.faction, x: u.x, y: u.y, kind: u.kind });
      return false;
    });
  }

  arrive(u) {
    const t = this.territories[u.target];
    if (t.owner === u.faction) {
      u.at = t.id;
      u.hops++;
      if (u.hops > 6) {
        t.garrison += u.power; // tired unit reinforces the garrison
        u.power = 0;
        u.absorbed = true;
        return;
      }
      this.chooseTarget(u);
      return;
    }
    const mult = t.capital ? this.config.economy.capitalDefense : 1;
    const defense = t.garrison * mult;
    this.emit({ type: 'assault', faction: u.faction, x: t.x, y: t.y, power: u.power });
    if (u.power > defense) {
      const remaining = Math.max(1, Math.ceil(u.power - defense));
      const wasCapital = t.capital;
      this.capture(t, u.faction, remaining, u.user);
      if (wasCapital) this.declareWinner(u.faction, 'capital');
    } else {
      t.garrison = Math.max(0, t.garrison - u.power / mult);
    }
    u.power = 0;
    u.absorbed = true;
  }

  resolveClashes() {
    const A = this.units.filter((u) => u.faction === 'A' && u.power > 0);
    const B = this.units.filter((u) => u.faction === 'B' && u.power > 0);
    for (const a of A) {
      for (const b of B) {
        if (a.power <= 0) break;
        if (b.power <= 0) continue;
        const reach = 16 * (a.scale + b.scale);
        const dx = a.x - b.x;
        if (dx > reach || dx < -reach) continue;
        if (Math.hypot(dx, a.y - b.y) > reach) continue;
        const m = Math.min(a.power, b.power);
        a.power -= m;
        b.power -= m;
        this.emit({ type: 'clash', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, power: m });
      }
    }
  }

  checkVictory() {
    if (this.phase !== 'battle') return;
    const c = this.counts();
    const ratio = this.config.match.dominationRatio;
    for (const f of ['A', 'B']) {
      if (c[f] === 0 || this.territories[this.map.capitals[f]].owner !== f) return this.declareWinner(OTHER[f], 'capital');
      if (c[f] / c.total >= ratio) return this.declareWinner(f, 'domination');
    }
    if (this.elapsed >= this.config.match.durationSec) {
      if (c.A !== c.B) return this.declareWinner(c.A > c.B ? 'A' : 'B', 'time');
      const strength = (f) => this.owned(f).reduce((s, t) => s + t.garrison, 0) + this.units.filter((u) => u.faction === f).reduce((s, u) => s + u.power, 0);
      const sa = strength('A');
      const sb = strength('B');
      this.declareWinner(sa === sb ? null : sa > sb ? 'A' : 'B', 'time');
    }
  }

  declareWinner(faction, reason) {
    if (this.phase === 'victory') return;
    this.phase = 'victory';
    this.phaseTime = 0;
    this.winner = faction;
    this.winReason = reason;
    if (faction) {
      // the losing side's remaining units rout
      for (const u of this.units) if (u.faction !== faction) u.power = 0;
    }
    this.emit({ type: 'victory', faction, reason });
  }
}
