// Canvas renderer: map, animated units, particles and HUD. Everything (HUD included) is drawn
// on the canvas so that an OBS browser source captures exactly what viewers should see.

import { hexCorners } from '../game/map.js';

export const WIDTH = 1080;
export const HEIGHT = 1920;
const FONT = "'Segoe UI', 'Inter', system-ui, -apple-system, Roboto, sans-serif";
const NEUTRAL = '#394054';

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

export class Renderer {
  constructor(canvas, game, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.game = game;
    this.config = config;
    this.particles = [];
    this.rings = [];
    this.floaters = [];
    this.meteors = [];
    this.banners = [];
    this.banner = null;
    this.feed = [];
    this.shake = 0;
    this.time = 0;
    this.background = this.#buildBackground();
  }

  color(f, key = 'color') {
    return f ? this.config.factions[f][key] : NEUTRAL;
  }

  #buildBackground() {
    const c = document.createElement('canvas');
    c.width = WIDTH;
    c.height = HEIGHT;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, '#0d1022');
    grad.addColorStop(0.5, '#141a33');
    grad.addColorStop(1, '#0b0e1c');
    g.fillStyle = grad;
    g.fillRect(0, 0, WIDTH, HEIGHT);
    // faint stars / dust
    for (let i = 0; i < 220; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`;
      g.fillRect(Math.random() * WIDTH, Math.random() * HEIGHT, 2, 2);
    }
    return c;
  }

  // ------------------------------------------------------------- game events → visual effects

  handleEvents(events) {
    for (const e of events) {
      switch (e.type) {
        case 'spawn':
          this.#burst(e.x, e.y, this.color(e.faction, 'light'), e.kind === 'soldier' ? 5 : 16, e.kind === 'soldier' ? 60 : 160);
          if (e.kind !== 'soldier') this.rings.push({ x: e.x, y: e.y, r: 10, max: 90, life: 0.6, t: 0, color: this.color(e.faction, 'light'), width: 6 });
          break;
        case 'clash':
          this.#burst(e.x, e.y, '#fff3c4', Math.min(14, 4 + e.power), 180);
          break;
        case 'death':
          this.#burst(e.x, e.y, 'rgba(200,200,220,0.8)', 4, 40);
          break;
        case 'assault':
          this.#burst(e.x, e.y, this.color(e.faction, 'light'), 6, 120);
          break;
        case 'capture':
          this.rings.push({ x: e.x, y: e.y, r: 20, max: e.capital ? 320 : 130, life: e.capital ? 1.2 : 0.7, t: 0, color: this.color(e.faction, 'light'), width: e.capital ? 14 : 8 });
          this.#burst(e.x, e.y, this.color(e.faction), e.capital ? 60 : 18, e.capital ? 400 : 200);
          if (e.user) this.floaters.push({ x: e.x, y: e.y - 40, text: e.user.name, color: this.color(e.faction, 'light'), life: 1.6, t: 0 });
          break;
        case 'meteorCast':
          this.meteors.push({ sx: e.x + 420, sy: -100, x: e.x, y: e.y, t: 0, dur: 1.0, faction: e.faction });
          break;
        case 'meteorImpact':
          this.shake = 0.6;
          this.rings.push({ x: e.x, y: e.y, r: 20, max: 260, life: 0.9, t: 0, color: '#ffffff', width: 18 });
          this.rings.push({ x: e.x, y: e.y, r: 10, max: 200, life: 1.1, t: 0, color: this.color(e.faction), width: 10 });
          this.#burst(e.x, e.y, '#ff8a3a', 50, 500);
          this.#burst(e.x, e.y, this.color(e.faction, 'light'), 30, 350);
          break;
        case 'banner':
          if (this.banners.length < 6) this.banners.push({ text: e.text, faction: e.faction });
          break;
        case 'feed':
          this.feed.unshift({ text: e.text, faction: e.faction, t: this.time });
          this.feed.length = Math.min(this.feed.length, 4);
          break;
        case 'battleStart':
          this.banners.unshift({ text: 'À L\'ATTAQUE !', faction: null });
          break;
        case 'roundStart':
          this.particles = [];
          this.rings = [];
          this.meteors = [];
          break;
        default:
          break;
      }
    }
  }

  #burst(x, y, color, n, speed) {
    if (this.particles.length > 1200) return; // keep frames smooth under gift storms
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.5, t: 0, color, size: 3 + Math.random() * 4 });
    }
  }

  #step(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt);
    const live = (p) => (p.t += dt) < p.life;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    this.particles = this.particles.filter(live);
    this.rings = this.rings.filter(live);
    this.floaters = this.floaters.filter(live);
    for (const m of this.meteors) m.t += dt;
    this.meteors = this.meteors.filter((m) => m.t < m.dur);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > 2.0) this.banner = null;
    }
    if (!this.banner && this.banners.length) this.banner = { ...this.banners.shift(), t: 0 };
  }

  // ------------------------------------------------------------- frame

  render(dt, hud) {
    this.#step(dt);
    const { ctx, game } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.background, 0, 0);
    if (this.shake > 0) {
      const s = this.shake * 18;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    this.#drawMap();
    this.#drawUnits();
    this.#drawEffects();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.#drawHud(hud);
    if (game.phase === 'countdown') this.#drawCountdown();
    else if (game.phase === 'victory') this.#drawVictory(hud);
    else this.#drawBanner();
    if (hud.status) this.#drawStatus(hud.status);
  }

  #drawMap() {
    const { ctx, game } = this;
    const r = game.radius;
    // territory links ("roads") give the map structure
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    for (const t of game.territories) {
      for (const n of t.neighbors) {
        if (n < t.id) continue;
        const o = game.territories[n];
        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(o.x, o.y);
        ctx.stroke();
      }
    }
    for (const t of game.territories) {
      const pts = hexCorners(t.x, t.y, r * 0.94);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      const base = this.color(t.owner);
      const grad = ctx.createLinearGradient(t.x, t.y - r, t.x, t.y + r);
      if (t.owner) {
        grad.addColorStop(0, rgba(this.color(t.owner, 'light'), 0.75));
        grad.addColorStop(1, rgba(base, 0.75));
      } else {
        grad.addColorStop(0, '#4a5168');
        grad.addColorStop(1, '#2c3142');
      }
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = t.owner ? this.color(t.owner, 'dark') : '#1c2030';
      ctx.stroke();
      if (t.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${t.flash * 0.6})`;
        ctx.fill();
      }
      if (t.capital) this.#drawCastle(t.x, t.y - r * 0.12, r * 0.55, t.owner);
      // garrison
      const g = Math.ceil(t.garrison);
      ctx.font = `800 ${t.capital ? 30 : 34}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      const ty = t.capital ? t.y + r * 0.48 : t.y;
      ctx.strokeText(g, t.x, ty);
      ctx.fillStyle = '#fff';
      ctx.fillText(g, t.x, ty);
    }
  }

  #drawCastle(x, y, s, owner) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = owner ? this.color(owner, 'dark') : '#222';
    ctx.strokeStyle = owner ? this.color(owner, 'light') : '#999';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const w = s;
    const h = s * 0.7;
    ctx.moveTo(-w / 2, h / 2);
    ctx.lineTo(-w / 2, -h / 2);
    for (let i = 0; i < 5; i++) {
      const x0 = -w / 2 + (i * w) / 5;
      ctx.lineTo(x0, -h / 2 - (i % 2 === 0 ? s * 0.18 : 0));
      ctx.lineTo(x0 + w / 5, -h / 2 - (i % 2 === 0 ? s * 0.18 : 0));
    }
    ctx.lineTo(w / 2, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // flag
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 - s * 0.2);
    ctx.lineTo(0, -h / 2 - s * 0.75);
    ctx.stroke();
    ctx.fillStyle = owner ? this.color(owner, 'light') : '#aaa';
    const wave = Math.sin(this.time * 6) * 4;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 - s * 0.75);
    ctx.lineTo(s * 0.4, -h / 2 - s * 0.62 + wave);
    ctx.lineTo(0, -h / 2 - s * 0.48);
    ctx.fill();
    ctx.restore();
  }

  #drawUnits() {
    const units = [...this.game.units].sort((a, b) => a.y - b.y);
    for (const u of units) this.#drawUnit(u);
  }

  #drawUnit(u) {
    const { ctx } = this;
    const s = 19 * u.scale;
    const moving = u.target !== null;
    const step = moving ? Math.sin(this.time * 14 + u.phase) : 0;
    const bob = Math.abs(step) * s * 0.18;
    const dir = u.tx >= u.x ? 1 : -1;
    const main = this.color(u.faction);
    const dark = this.color(u.faction, 'dark');
    const light = this.color(u.faction, 'light');
    const appear = Math.min(1, u.age * 4);

    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.scale(appear * dir, appear);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, s * 1.05, s * 0.8, s * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(0, -bob);
    // legs
    ctx.strokeStyle = dark;
    ctx.lineWidth = s * 0.28;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, s * 0.4);
    ctx.lineTo(-s * 0.2 + step * s * 0.3, s * 1.0);
    ctx.moveTo(s * 0.2, s * 0.4);
    ctx.lineTo(s * 0.2 - step * s * 0.3, s * 1.0);
    ctx.stroke();
    // body
    roundRect(ctx, -s * 0.45, -s * 0.35, s * 0.9, s * 0.85, s * 0.25);
    ctx.fillStyle = main;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = dark;
    ctx.stroke();
    // head + helmet
    ctx.fillStyle = '#f2d4b3';
    ctx.beginPath();
    ctx.arc(0, -s * 0.62, s * 0.33, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(0, -s * 0.68, s * 0.35, Math.PI, 0);
    ctx.fill();

    if (u.kind === 'soldier') {
      // spear
      ctx.strokeStyle = '#d9d2c3';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(s * 0.55, s * 0.6);
      ctx.lineTo(s * 0.55, -s * 1.2);
      ctx.stroke();
      ctx.fillStyle = '#eee';
      ctx.beginPath();
      ctx.moveTo(s * 0.55, -s * 1.45);
      ctx.lineTo(s * 0.42, -s * 1.15);
      ctx.lineTo(s * 0.68, -s * 1.15);
      ctx.fill();
    } else if (u.kind === 'knight') {
      // plume + sword + shield
      ctx.fillStyle = light;
      ctx.beginPath();
      ctx.ellipse(-s * 0.1, -s * 1.08, s * 0.14, s * 0.32, -0.4, 0, Math.PI * 2);
      ctx.fill();
      const swing = Math.sin(this.time * 7 + u.phase) * 0.4;
      ctx.save();
      ctx.translate(s * 0.45, 0);
      ctx.rotate(-0.6 + swing);
      ctx.fillStyle = '#e8eef5';
      ctx.fillRect(-s * 0.06, -s * 1.3, s * 0.12, s * 1.1);
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(-s * 0.22, -s * 0.24, s * 0.44, s * 0.1);
      ctx.restore();
      ctx.fillStyle = light;
      ctx.strokeStyle = dark;
      ctx.beginPath();
      ctx.moveTo(-s * 0.75, -s * 0.25);
      ctx.lineTo(-s * 0.25, -s * 0.25);
      ctx.lineTo(-s * 0.25, s * 0.25);
      ctx.lineTo(-s * 0.5, s * 0.5);
      ctx.lineTo(-s * 0.75, s * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // giant: horns + club
      ctx.fillStyle = '#f5ecd7';
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, -s * 0.85);
      ctx.lineTo(-s * 0.55, -s * 1.2);
      ctx.lineTo(-s * 0.18, -s * 0.95);
      ctx.moveTo(s * 0.3, -s * 0.85);
      ctx.lineTo(s * 0.55, -s * 1.2);
      ctx.lineTo(s * 0.18, -s * 0.95);
      ctx.fill();
      const swing = Math.sin(this.time * 4 + u.phase) * 0.5;
      ctx.save();
      ctx.translate(s * 0.5, -s * 0.1);
      ctx.rotate(-0.3 + swing);
      ctx.fillStyle = '#7a5230';
      roundRect(ctx, -s * 0.12, -s * 1.1, s * 0.24, s * 1.1, s * 0.1);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -s * 1.1, s * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // name tag + strength bar for heroes (not mirrored)
    if (u.kind !== 'soldier' || (u.user && u.age < 1.5)) {
      const label = u.user ? u.user.name : '';
      if (label) {
        ctx.font = `700 ${u.kind === 'soldier' ? 18 : 22}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.strokeText(label, u.x, u.y - s * 1.6 - bob);
        ctx.fillStyle = light;
        ctx.fillText(label, u.x, u.y - s * 1.6 - bob);
      }
      if (u.kind !== 'soldier') {
        const w = s * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(u.x - w / 2, u.y + s * 1.35, w, 6);
        ctx.fillStyle = light;
        ctx.fillRect(u.x - w / 2, u.y + s * 1.35, (w * u.power) / u.maxPower, 6);
      }
    }
  }

  #drawEffects() {
    const { ctx } = this;
    for (const ring of this.rings) {
      const k = ring.t / ring.life;
      ctx.strokeStyle = ring.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = ring.width * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r + (ring.max - ring.r) * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const m of this.meteors) {
      const k = m.t / m.dur;
      const x = m.sx + (m.x - m.sx) * k * k;
      const y = m.sy + (m.y - m.sy) * k * k;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 70);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.3, '#ffb347');
      grad.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,170,60,0.5)';
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (m.sx - m.x) * 0.25, y + (m.sy - m.y) * 0.25);
      ctx.stroke();
      // target marker
      ctx.strokeStyle = `rgba(255,80,40,${0.5 + 0.5 * Math.sin(this.time * 20)})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(m.x, m.y, this.game.radius * (1.4 - k * 0.6), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const f of this.floaters) {
      const k = f.t / f.life;
      ctx.globalAlpha = 1 - k;
      ctx.font = `800 26px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(f.text, f.x, f.y - k * 60);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - k * 60);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------- HUD

  #panel(x, y, w, h) {
    const { ctx } = this;
    roundRect(ctx, x, y, w, h, 22);
    ctx.fillStyle = 'rgba(8,10,24,0.72)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();
  }

  #text(str, x, y, { size = 28, weight = 700, color = '#fff', align = 'left', baseline = 'middle', stroke = false } = {}) {
    const { ctx } = this;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (stroke) {
      ctx.lineWidth = size / 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  #drawHud(hud) {
    const { ctx, game, config } = this;
    const fa = config.factions.A;
    const fb = config.factions.B;
    const c = game.counts();

    // title + timer
    this.#text('EMPIRA', 40, 62, { size: 52, weight: 900, color: '#f4f1ea' });
    this.#text('CONQUEST', 244, 62, { size: 52, weight: 300, color: '#c9b6ff' });
    const tl = Math.ceil(game.phase === 'countdown' ? game.config.match.durationSec : game.timeLeft);
    const mm = String(Math.floor(tl / 60));
    const ss = String(tl % 60).padStart(2, '0');
    this.#panel(840, 22, 200, 80);
    this.#text(`${mm}:${ss}`, 940, 63, { size: 46, weight: 800, align: 'center', color: tl <= 30 && game.phase !== 'countdown' ? '#ff6b6b' : '#fff' });

    // tug-of-war territory bar
    const bx = 40;
    const by = 160;
    const bw = 1000;
    const bh = 54;
    this.#text(`${fa.name}  ${c.A}`, bx, 136, { size: 32, weight: 900, color: fa.color });
    this.#text(`${c.B}  ${fb.name}`, bx + bw, 136, { size: 32, weight: 900, color: fb.color, align: 'right' });
    roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = '#2a2f40';
    ctx.fill();
    ctx.save();
    ctx.clip();
    const wa = (bw * c.A) / c.total;
    const wb = (bw * c.B) / c.total;
    ctx.fillStyle = fa.color;
    ctx.fillRect(bx, by, wa, bh);
    ctx.fillStyle = fb.color;
    ctx.fillRect(bx + bw - wb, by, wb, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(bx, by, bw, bh / 2.4);
    ctx.restore();
    const goal = config.match.dominationRatio;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(bx + bw * goal - 2, by - 6, 4, bh + 12);
    ctx.fillRect(bx + bw * (1 - goal) - 2, by - 6, 4, bh + 12);
    this.#text(`${Math.round((100 * c.A) / c.total)}%`, bx + 24, by + bh / 2 + 1, { size: 26, weight: 800, stroke: true });
    this.#text(`${Math.round((100 * c.B) / c.total)}%`, bx + bw - 24, by + bh / 2 + 1, { size: 26, weight: 800, align: 'right', stroke: true });

    // members + like charge gauges
    const perCharge = config.interactions.like.likesPerCharge;
    const gauge = (x, f, align) => {
      const gw = 380;
      const pct = Math.min(1, (hud.likePools?.[f] ?? 0) / perCharge);
      const gx = align === 'left' ? x : x - gw;
      roundRect(ctx, gx, 250, gw, 16, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      roundRect(ctx, align === 'left' ? gx : gx + gw * (1 - pct), 250, Math.max(16, gw * pct), 16, 8);
      ctx.fillStyle = config.factions[f].light;
      ctx.fill();
      this.#text(`${hud.teams?.[f] ?? 0} joueurs · ♥ charge ${Math.floor(pct * 100)}%`, x, 236, { size: 22, weight: 600, align, color: 'rgba(255,255,255,0.85)' });
    };
    gauge(bx, 'A', 'left');
    gauge(bx + bw, 'B', 'right');

    // feed
    this.feed.forEach((f, i) => {
      const alpha = Math.max(0, 1 - (this.time - f.t) / 12);
      if (alpha <= 0) return;
      ctx.globalAlpha = alpha * (1 - i * 0.18);
      this.#text(f.text, WIDTH / 2, 1572 + i * 34, { size: 26, weight: 700, align: 'center', color: this.color(f.faction, 'light'), stroke: true });
    });
    ctx.globalAlpha = 1;

    // how to play
    const py = 1716;
    this.#panel(30, py, 560, 180);
    this.#text('COMMENT JOUER', 56, py + 34, { size: 24, weight: 900, color: '#c9b6ff' });
    this.#text(`Écris  1  →  ${fa.name}`, 56, py + 72, { size: 28, weight: 800, color: fa.color });
    this.#text(`Écris  2  →  ${fb.name}`, 56, py + 106, { size: 28, weight: 800, color: fb.color });
    this.#text('♥ Likes = charge   ★ Cadeaux = héros', 56, py + 146, { size: 24, weight: 600, color: '#e6e6f0' });

    // leaderboard
    this.#panel(610, py, 440, 180);
    this.#text('TOP SOUTIENS', 636, py + 34, { size: 24, weight: 900, color: '#c9b6ff' });
    const lb = hud.leaderboard || [];
    if (!lb.length) this.#text('Sois le premier !', 636, py + 90, { size: 24, weight: 600, color: 'rgba(255,255,255,0.6)' });
    lb.slice(0, 4).forEach((p, i) => {
      const y = py + 70 + i * 30;
      this.#text(`${i + 1}. ${p.name}`, 636, y, { size: 24, weight: 700, color: this.color(p.faction, 'light') });
      this.#text(String(p.points), 1026, y, { size: 24, weight: 800, align: 'right' });
    });
  }

  #drawBanner() {
    if (!this.banner) return;
    const { ctx } = this;
    const b = this.banner;
    const k = Math.min(1, b.t / 0.35);
    const scale = easeOutBack(k);
    const alpha = b.t > 1.6 ? Math.max(0, 1 - (b.t - 1.6) / 0.4) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(WIDTH / 2, 930);
    ctx.scale(scale, scale);
    roundRect(ctx, -470, -64, 940, 128, 40);
    ctx.fillStyle = b.faction ? rgba(this.color(b.faction, 'dark'), 0.9) : 'rgba(30,20,60,0.9)';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = b.faction ? this.color(b.faction, 'light') : '#c9b6ff';
    ctx.stroke();
    let size = 58;
    ctx.font = `900 ${size}px ${FONT}`;
    while (ctx.measureText(b.text).width > 880 && size > 28) ctx.font = `900 ${(size -= 2)}px ${FONT}`;
    this.#text(b.text, 0, 4, { size, weight: 900, align: 'center', color: '#fff' });
    ctx.restore();
  }

  #drawCountdown() {
    const { ctx, game, config } = this;
    ctx.fillStyle = 'rgba(5,6,15,0.55)';
    ctx.fillRect(0, 290, WIDTH, 1250);
    const left = Math.ceil(config.match.countdownSec - game.phaseTime);
    this.#text('CHOISIS TON CAMP !', WIDTH / 2, 760, { size: 76, weight: 900, align: 'center', stroke: true });
    this.#text(`Écris 1 pour ${config.factions.A.name}`, WIDTH / 2, 870, { size: 48, weight: 800, align: 'center', color: config.factions.A.color, stroke: true });
    this.#text(`Écris 2 pour ${config.factions.B.name}`, WIDTH / 2, 940, { size: 48, weight: 800, align: 'center', color: config.factions.B.color, stroke: true });
    const pulse = 1 + 0.15 * Math.sin(this.time * 8);
    ctx.save();
    ctx.translate(WIDTH / 2, 1120);
    ctx.scale(pulse, pulse);
    this.#text(String(Math.max(1, left)), 0, 0, { size: 180, weight: 900, align: 'center', color: '#c9b6ff', stroke: true });
    ctx.restore();
  }

  #drawVictory(hud) {
    const { ctx, game, config } = this;
    ctx.fillStyle = 'rgba(5,6,15,0.65)';
    ctx.fillRect(0, 290, WIDTH, 1250);
    const f = game.winner;
    const k = easeOutBack(Math.min(1, game.phaseTime / 0.5));
    ctx.save();
    ctx.translate(WIDTH / 2, 760);
    ctx.scale(k, k);
    this.#text(f ? 'VICTOIRE' : 'ÉGALITÉ', 0, -60, { size: 110, weight: 900, align: 'center', color: '#fff', stroke: true });
    if (f) this.#text(config.factions[f].name, 0, 60, { size: 120, weight: 900, align: 'center', color: config.factions[f].color, stroke: true });
    ctx.restore();
    const reasons = { capital: 'Capitale ennemie conquise', domination: 'Domination du territoire', time: 'Fin du temps' };
    this.#text(reasons[game.winReason] || '', WIDTH / 2, 920, { size: 40, weight: 700, align: 'center', color: '#e6e6f0', stroke: true });
    const lb = hud.leaderboard || [];
    if (lb.length) {
      this.#text('HÉROS DE LA PARTIE', WIDTH / 2, 1030, { size: 34, weight: 900, align: 'center', color: '#c9b6ff', stroke: true });
      lb.slice(0, 3).forEach((p, i) => {
        this.#text(`${['①', '②', '③'][i]} ${p.name} — ${p.points}`, WIDTH / 2, 1090 + i * 52, { size: 38, weight: 800, align: 'center', color: this.color(p.faction, 'light'), stroke: true });
      });
    }
    if (config.match.autoRestart) {
      const left = Math.max(0, Math.ceil(config.match.victoryScreenSec - game.phaseTime));
      this.#text(`Nouvelle bataille dans ${left}s`, WIDTH / 2, 1400, { size: 34, weight: 700, align: 'center', color: 'rgba(255,255,255,0.8)', stroke: true });
    }
  }

  #drawStatus(status) {
    // small connection indicator, top-left under the title (hidden when everything is fine in OBS mode)
    this.#text(status.text, 40, 104, { size: 20, weight: 600, color: status.ok ? '#7ee787' : '#ffb4a8' });
  }
}
