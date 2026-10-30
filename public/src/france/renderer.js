// Renderer of the "Conquête de France" mode: map of départements, live bubbles, HUD and effects.

import { DEPARTEMENTS, MAP_SIZE } from './departements.js';

export const WIDTH = 1080;
export const HEIGHT = 1920;
const FONT = "'Segoe UI', 'Inter', system-ui, -apple-system, Roboto, sans-serif";
const EMOJI = "'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";

// Map placement on the 1080×1920 canvas
const MAP_SCALE = 0.94;
const MAP_X = 70;
const MAP_Y = 770;
const INSETS = { '971': [70, 1290], '972': [178, 1290], '973': [70, 1395], '974': [178, 1395], '976': [70, 1500] };
const INSET_W = 100;
const INSET_H = 88;
const IDF_BOX = [835, 780, 210, 170];
const IDF = ['75', '77', '78', '91', '92', '93', '94', '95'];

const NEUTRALS = ['#3b2f3c', '#2e3a33', '#3a3428', '#2b3346', '#3b2b2d', '#2d3c3d', '#35304a', '#3c3a2a', '#2a3a2c', '#402f36', '#2f3341', '#373427', '#33293a', '#2c3838'];
const TAB_COLORS = { grossir: '#22c55e', defendre: '#3b82f6', attaquer: '#ef4444', gratuit: '#f5b301' };
const TAB_LABELS = { grossir: '🌱 GROSSIR', defendre: '🛡️ DÉFENDRE', attaquer: '⚔️ ATTAQUER LE 1er', gratuit: '👆 GRATUIT' };
const KIND_ICON = { like: '👆', comment: '💬', share: '📣', follow: '⭐', gift: '🎁', join: '⚔️', pending: '🎁' };
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const plural = (n, word) => `${fmt(n)} ${word}${Math.abs(n) >= 2 ? 's' : ''}`;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function buildPath(rings) {
  const p = new Path2D();
  for (const r of rings) {
    p.moveTo(r[0], r[1]);
    for (let i = 2; i < r.length; i += 2) p.lineTo(r[i], r[i + 1]);
    p.closePath();
  }
  return p;
}

export class FranceRenderer {
  constructor(canvas, game, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.game = game;
    this.config = config;
    this.time = 0;
    this.deps = DEPARTEMENTS.map((d, i) => ({ ...d, path: buildPath(d.rings), neutral: NEUTRALS[i % NEUTRALS.length] }));
    this.byCode = new Map(this.deps.map((d) => [d.code, d]));
    this.idf = this.#bbox(IDF);
    this.cam = { x: MAP_SIZE[0] / 2, y: MAP_SIZE[1] / 2, s: 1, tx: MAP_SIZE[0] / 2, ty: MAP_SIZE[1] / 2, ts: 1, until: 0, cooldown: 0 };
    this.bubbles = [];
    this.combos = [];
    this.particles = [];
    this.rings = [];
    this.floaters = [];
    this.banners = [];
    this.banner = null;
    this.popup = null;
    this.generalLog = null;
    this.avatars = new Map();
    this.tabIndex = 0;
    this.tabTime = 0;
    this.shake = 0;
    this.background = this.#buildBackground();
    this.stripes = this.#buildStripes();
    this.mapCache = document.createElement('canvas');
    this.mapCache.width = MAP_SIZE[0] * 2;
    this.mapCache.height = MAP_SIZE[1] * 2;
    this.mapCacheKey = '';
    this.shadow = this.#buildShadow();
  }

  #buildStripes() {
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(-6, 6);
    g.lineTo(6, -6);
    g.moveTo(-6, 30);
    g.lineTo(30, -6);
    g.moveTo(18, 30);
    g.lineTo(30, 18);
    g.stroke();
    return this.ctx.createPattern(c, 'repeat');
  }

  /** Blurred silhouette of mainland France, computed once (shadowBlur is too slow per frame). */
  #buildShadow() {
    const pad = 60;
    const c = document.createElement('canvas');
    c.width = MAP_SIZE[0] + pad * 2;
    c.height = MAP_SIZE[1] + pad * 2;
    const g = c.getContext('2d');
    g.translate(pad, pad);
    g.shadowColor = 'rgba(80,110,255,0.55)';
    g.shadowBlur = 40;
    g.fillStyle = '#20253f';
    for (const d of this.deps) if (!d.overseas) g.fill(d.path);
    return { canvas: c, pad };
  }

  #bbox(codes) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of codes) {
      for (const r of this.byCode.get(c).rings) {
        for (let i = 0; i < r.length; i += 2) {
          minX = Math.min(minX, r[i]);
          maxX = Math.max(maxX, r[i]);
          minY = Math.min(minY, r[i + 1]);
          maxY = Math.max(maxY, r[i + 1]);
        }
      }
    }
    return { minX, minY, maxX, maxY };
  }

  #buildBackground() {
    const c = document.createElement('canvas');
    c.width = WIDTH;
    c.height = HEIGHT;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, HEIGHT);
    grad.addColorStop(0, '#0e0b26');
    grad.addColorStop(0.45, '#151a3d');
    grad.addColorStop(1, '#0a0c1d');
    g.fillStyle = grad;
    g.fillRect(0, 0, WIDTH, HEIGHT);
    const glow = g.createRadialGradient(560, 1200, 50, 560, 1200, 700);
    glow.addColorStop(0, 'rgba(90,110,255,0.20)');
    glow.addColorStop(1, 'rgba(90,110,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, WIDTH, HEIGHT);
    g.strokeStyle = 'rgba(140,160,255,0.06)';
    g.lineWidth = 2;
    for (let r = 200; r < 1400; r += 160) {
      g.beginPath();
      g.arc(560, 1200, r, 0, Math.PI * 2);
      g.stroke();
    }
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`;
      g.fillRect(Math.random() * WIDTH, Math.random() * HEIGHT, 2, 2);
    }
    return c;
  }

  // ------------------------------------------------------------------ helpers

  color(code) {
    return this.game.teams.get(code)?.color || '#8890b0';
  }

  /** Map coordinates → screen coordinates (through the camera). Overseas codes use their inset. */
  project(code) {
    const d = this.byCode.get(code);
    if (d.overseas) {
      const [ix, iy] = INSETS[code];
      const k = Math.min(INSET_W / d.box[0], (INSET_H - 18) / d.box[1]);
      return [ix + (INSET_W - d.box[0] * k) / 2 + d.center[0] * k, iy + 4 + d.center[1] * k];
    }
    return this.toScreen(d.center[0], d.center[1]);
  }

  toScreen(mx, my) {
    const { cam } = this;
    return [WIDTH / 2 + (mx - cam.x) * cam.s * MAP_SCALE + (MAP_X + (MAP_SIZE[0] * MAP_SCALE) / 2 - WIDTH / 2), MAP_Y + (MAP_SIZE[1] * MAP_SCALE) / 2 + (my - cam.y) * cam.s * MAP_SCALE];
  }

  avatar(p, size = 96) {
    const key = String(p?.id ?? p?.name ?? 'none');
    let entry = this.avatars.get(key);
    if (!entry) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const hue = [...key].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 17);
      const grad = g.createLinearGradient(0, 0, 128, 128);
      grad.addColorStop(0, `hsl(${hue},70%,55%)`);
      grad.addColorStop(1, `hsl(${(hue + 50) % 360},70%,35%)`);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(64, 64, 64, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.font = `800 58px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText((p?.name || '?').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?', 64, 68);
      entry = { canvas: c };
      this.avatars.set(key, entry);
      if (p?.avatar) {
        const img = new Image();
        img.referrerPolicy = 'no-referrer';
        img.onload = () => {
          g.save();
          g.beginPath();
          g.arc(64, 64, 64, 0, Math.PI * 2);
          g.clip();
          g.drawImage(img, 0, 0, 128, 128);
          g.restore();
        };
        img.src = p.avatar;
      }
      if (this.avatars.size > 600) this.avatars.delete(this.avatars.keys().next().value);
    }
    return entry.canvas;
  }

  #drawAvatar(p, x, y, r, ring) {
    const { ctx } = this;
    ctx.drawImage(this.avatar(p), x - r, y - r, r * 2, r * 2);
    if (ring) {
      ctx.lineWidth = Math.max(3, r * 0.12);
      ctx.strokeStyle = ring;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  #text(str, x, y, { size = 26, weight = 700, color = '#fff', align = 'left', baseline = 'middle', stroke = null, strokeWidth, font = FONT, maxWidth } = {}) {
    const { ctx } = this;
    ctx.font = `${weight} ${size}px ${font}, ${EMOJI}`;
    if (maxWidth) {
      let s = size;
      while (ctx.measureText(str).width > maxWidth && s > 10) ctx.font = `${weight} ${(s -= 1)}px ${font}, ${EMOJI}`;
    }
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (stroke) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = strokeWidth ?? size / 4;
      ctx.strokeStyle = stroke;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    return ctx.measureText(str).width;
  }

  #wrap(str, maxWidth, size, weight = 700) {
    const { ctx } = this;
    ctx.font = `${weight} ${size}px ${FONT}, ${EMOJI}`;
    const words = str.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  #panel(x, y, w, h, { border = 'rgba(255,255,255,0.10)', fill = 'rgba(14,16,40,0.86)', radius = 22, lineWidth = 2 } = {}) {
    const { ctx } = this;
    roundRect(ctx, x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = border;
    ctx.stroke();
  }

  // ------------------------------------------------------------------ events → effects

  handleEvents(events) {
    for (const e of events) {
      switch (e.type) {
        case 'bubble':
          this.#pushBubble(e);
          break;
        case 'capture': {
          const [x, y] = this.project(e.code);
          const col = this.color(e.team);
          this.rings.push({ x, y, r: 10, max: e.capital ? 200 : 80, life: e.capital ? 1.1 : 0.7, t: 0, color: col, width: e.capital ? 12 : 7 });
          this.#burst(x, y, col, e.capital ? 40 : 12, e.capital ? 320 : 160);
          if (e.capital) this.#focus(e.code, 2.2, 2.6, true);
          break;
        }
        case 'revolt': {
          const [x, y] = this.project(e.code);
          this.#burst(x, y, 'rgba(200,200,220,0.8)', 8, 90);
          break;
        }
        case 'attack':
          break;
        case 'gift': {
          this.combos.push({ team: e.team, icon: e.gift.icon || '🎁', count: e.count, amount: e.amount, t: 0, life: 2.0, color: this.color(e.team) });
          if (this.combos.length > 4) this.combos.shift();
          if (e.diamonds >= 100) this.#focus(e.team, 2.0, 2.8);
          break;
        }
        case 'hit': {
          const [x, y] = this.project(e.team);
          this.floaters.push({ x, y: y - 30, text: `−${fmt(e.amount)}`, color: '#ff5c5c', size: 44, t: 0, life: 1.6 });
          this.rings.push({ x, y, r: 10, max: 140, life: 0.8, t: 0, color: '#ff5c5c', width: 10 });
          this.#burst(x, y, '#ff7a5c', 24, 260);
          this.shake = Math.max(this.shake, e.effect === 'reset' ? 0.6 : 0.3);
          break;
        }
        case 'banner':
          if (this.banners.length < 5) this.banners.push({ text: e.text, color: e.team ? this.color(e.team) : '#c9b6ff' });
          break;
        case 'popup':
          this.popup = { kind: e.kind, t: 0 };
          break;
        case 'eventEnd':
          if (e.text) this.banners.push({ text: e.text, color: '#ffd166' });
          break;
        case 'join': {
          const [x, y] = this.project(e.team);
          this.rings.push({ x, y, r: 8, max: 110, life: 0.9, t: 0, color: this.color(e.team), width: 8 });
          break;
        }
        case 'roundStart':
          this.bubbles = [];
          this.combos = [];
          this.particles = [];
          this.cam.ts = 1;
          this.cam.tx = MAP_SIZE[0] / 2;
          this.cam.ty = MAP_SIZE[1] / 2;
          break;
        default:
          break;
      }
    }
  }

  #pushBubble(e) {
    const key = `${e.user?.id}:${e.kind}:${e.team}`;
    const existing = this.bubbles.find((b) => b.key === key && this.time - b.born < 3);
    if (existing && e.kind !== 'join') {
      existing.amount += e.amount;
      existing.likes = (existing.likes || 0) + (e.likes || 0);
      existing.updated = this.time;
      existing.text = e.text;
      return;
    }
    if (e.kind === 'like' && !e.amount && this.bubbles.length >= 3) return; // taps without effect only fill gaps
    this.bubbles.push({ key, user: e.user, team: e.team, kind: e.kind, text: e.text, amount: e.amount, likes: e.likes || 0, born: this.time, updated: this.time });
    while (this.bubbles.length > 4) this.bubbles.shift();
  }

  #focus(code, scale, duration, force = false) {
    const d = this.byCode.get(code);
    if (!d || d.overseas) return;
    if (!force && this.time < this.cam.cooldown) return;
    this.cam.tx = d.center[0];
    this.cam.ty = d.center[1];
    this.cam.ts = scale;
    this.cam.until = this.time + duration;
    this.cam.cooldown = this.time + duration + 5;
  }

  #burst(x, y, color, n, speed) {
    if (this.particles.length > 900) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.4 + Math.random() * 0.5, color, size: 3 + Math.random() * 4 });
    }
  }

  #step(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt);
    const cam = this.cam;
    if (this.time > cam.until) {
      cam.ts = 1;
      cam.tx = MAP_SIZE[0] / 2;
      cam.ty = MAP_SIZE[1] / 2;
    }
    const k = 1 - Math.exp(-dt * 3.5);
    cam.x += (cam.tx - cam.x) * k;
    cam.y += (cam.ty - cam.y) * k;
    cam.s += (cam.ts - cam.s) * k;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
    }
    const live = (o) => (o.t += dt) < o.life;
    this.particles = this.particles.filter(live);
    this.rings = this.rings.filter(live);
    this.floaters = this.floaters.filter(live);
    this.combos = this.combos.filter(live);
    this.bubbles = this.bubbles.filter((b) => this.time - b.updated < 5);
    if (this.banner && (this.banner.t += dt) > 2.6) this.banner = null;
    if (!this.banner && this.banners.length) this.banner = { ...this.banners.shift(), t: 0 };
    if (this.popup && (this.popup.t += dt) > 4.2) this.popup = null;
    this.tabTime += dt;
    if (this.tabTime > 6) {
      this.tabTime = 0;
      this.tabIndex = (this.tabIndex + 1) % 4;
    }
  }

  // ------------------------------------------------------------------ frame

  render(dt, hud = {}) {
    this.#step(dt);
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.background, 0, 0);
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake * 20, (Math.random() - 0.5) * this.shake * 20);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 690, WIDTH, HEIGHT - 690);
    ctx.clip();
    this.#drawMap();
    const insetAlpha = clamp01((1.25 - this.cam.s) / 0.25);
    if (insetAlpha > 0) {
      ctx.globalAlpha = insetAlpha;
      this.#drawInsets();
      ctx.globalAlpha = 1;
    }
    this.#drawMapLabels();
    this.#drawAttacks();
    this.#drawEffects();
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.#drawHeader();
    this.#drawGeneral();
    this.#drawTabs();
    this.#drawPodium();
    this.#drawKing();
    this.#drawEventCard();
    this.#drawBubbles();
    this.#drawCombos();
    this.#drawBanner();
    this.#drawPopup();
    if (this.game.phase === 'victory') this.#drawVictory();
    if (hud.status) this.#text(hud.status.text, 30, 1906, { size: 18, weight: 600, color: hud.status.ok ? '#7ee787' : '#ffb4a8', baseline: 'bottom' });
  }

  #fillDept(d, scaleForStroke, live = true) {
    const { ctx, game } = this;
    const owner = game.owner.get(d.code);
    const team = owner ? game.teams.get(owner) : null;
    ctx.fillStyle = team ? team.color : d.neutral;
    ctx.fill(d.path);
    if (team && owner === d.code) {
      // capitals get diagonal stripes so the home of each département stands out
      ctx.fillStyle = this.stripes;
      ctx.fill(d.path);
    }
    ctx.lineWidth = 1.4 / scaleForStroke;
    ctx.strokeStyle = 'rgba(5,6,16,0.85)';
    ctx.stroke(d.path);
    if (team) {
      ctx.lineWidth = 3.2 / scaleForStroke;
      ctx.strokeStyle = hexA(team.color, 0.95);
      ctx.stroke(d.path);
    }
    if (live) this.#liveOverlay(d, scaleForStroke);
  }

  /** Per-frame overlays (capture flash, shield pulse) drawn above the cached map. */
  #liveOverlay(d, scaleForStroke) {
    const { ctx, game } = this;
    const f = game.flash.get(d.code);
    if (f) {
      ctx.fillStyle = `rgba(255,255,255,${f * 0.7})`;
      ctx.fill(d.path);
    }
    const owner = game.owner.get(d.code);
    if (owner && game.isShielded(owner)) {
      ctx.lineWidth = 4 / scaleForStroke;
      ctx.strokeStyle = `rgba(120,230,255,${0.6 + 0.4 * Math.sin(this.time * 8)})`;
      ctx.stroke(d.path);
    }
  }

  #renderMapCache() {
    const { game } = this;
    let key = '';
    for (const d of this.deps) {
      if (d.overseas) continue;
      const o = game.owner.get(d.code);
      key += `${o ?? '-'}${o ? game.teams.get(o)?.color : ''}|`;
    }
    if (key === this.mapCacheKey) return;
    this.mapCacheKey = key;
    const g = this.mapCache.getContext('2d');
    const saved = this.ctx;
    this.ctx = g; // reuse the drawing helpers on the cache canvas
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.mapCache.width, this.mapCache.height);
    g.setTransform(2, 0, 0, 2, 0, 0);
    for (const d of this.deps) if (!d.overseas) this.#fillDept(d, 1.4, false);
    // static labels of non-capital départements
    for (const d of this.deps) {
      if (d.overseas || ['75', '92', '93', '94'].includes(d.code)) continue;
      const o = game.owner.get(d.code);
      if (o && o === d.code) continue;
      this.#text(d.code, d.center[0], d.center[1], {
        size: (o ? 21 : 18) / MAP_SCALE,
        weight: 800,
        align: 'center',
        color: o ? '#fff' : 'rgba(255,255,255,0.42)',
        stroke: o ? 'rgba(0,0,0,0.55)' : null,
        strokeWidth: 4,
      });
    }
    this.ctx = saved;
  }

  #drawMap() {
    const { ctx, cam } = this;
    this.#renderMapCache();
    ctx.save();
    const [ox, oy] = this.toScreen(0, 0);
    const s = cam.s * MAP_SCALE;
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    const { canvas: sh, pad } = this.shadow;
    ctx.drawImage(sh, -pad, -pad);
    ctx.drawImage(this.mapCache, 0, 0, MAP_SIZE[0], MAP_SIZE[1]);
    for (const code of this.game.flash.keys()) {
      const d = this.byCode.get(code);
      if (!d.overseas) this.#liveOverlay(d, s);
    }
    for (const t of this.game.teams.values()) {
      if (!this.game.isShielded(t.code)) continue;
      for (const c of this.game.territoriesOf(t.code)) if (!this.byCode.get(c).overseas) this.#liveOverlay(this.byCode.get(c), s);
    }
    // sea links to Corsica
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2 / s;
    ctx.strokeStyle = 'rgba(180,190,255,0.25)';
    for (const d of this.deps) {
      if (d.code !== '2A' && d.code !== '2B') continue;
      for (const n of d.neighbors) {
        if (n === '2A' || n === '2B') continue;
        const o = this.byCode.get(n);
        ctx.beginPath();
        ctx.moveTo(d.center[0], d.center[1]);
        ctx.lineTo(o.center[0], o.center[1]);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  #drawInsets() {
    const { ctx } = this;
    for (const [code, [ix, iy]] of Object.entries(INSETS)) {
      const d = this.byCode.get(code);
      this.#panel(ix - 4, iy - 4, INSET_W + 8, INSET_H + 8, { radius: 12, fill: 'rgba(12,14,34,0.82)' });
      const k = Math.min(INSET_W / d.box[0], (INSET_H - 18) / d.box[1]);
      ctx.save();
      ctx.translate(ix + (INSET_W - d.box[0] * k) / 2, iy + 4);
      ctx.scale(k, k);
      this.#fillDept(d, k);
      ctx.restore();
      this.#text(`${code} ${d.name}`, ix + INSET_W / 2, iy + INSET_H - 4, { size: 12, weight: 700, align: 'center', baseline: 'bottom', color: 'rgba(255,255,255,0.75)', maxWidth: INSET_W });
    }
    // Île-de-France zoom
    const [bx, by, bw, bh] = IDF_BOX;
    this.#panel(bx, by, bw, bh, { radius: 16, fill: 'rgba(12,14,34,0.82)' });
    this.#text('Île-de-France', bx + 12, by + 16, { size: 14, weight: 800, color: 'rgba(255,255,255,0.75)' });
    const { minX, minY, maxX, maxY } = this.idf;
    const k = Math.min((bw - 20) / (maxX - minX), (bh - 34) / (maxY - minY));
    const ox = bx + (bw - (maxX - minX) * k) / 2 - minX * k;
    const oy = by + 28 + (bh - 34 - (maxY - minY) * k) / 2 - minY * k;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    for (const c of IDF) this.#fillDept(this.byCode.get(c), k);
    ctx.restore();
    for (const c of IDF) {
      const d = this.byCode.get(c);
      this.#text(c, ox + d.center[0] * k, oy + d.center[1] * k, { size: c === '75' ? 12 : 15, weight: 800, align: 'center', stroke: 'rgba(0,0,0,0.6)', strokeWidth: 3 });
    }
  }

  #drawMapLabels() {
    const { game } = this;
    const zoom = Math.sqrt(this.cam.s);
    const homes = [];
    for (const d of this.deps) {
      const owner = game.owner.get(d.code);
      if (owner && owner === d.code) homes.push(d);
    }
    // lock badges: progress of the top teams towards their next conquest
    const ranking = game.ranking();
    for (const team of ranking.slice(0, 5)) {
      if (!team.target || team.inFlight) continue;
      const [x, y] = this.project(team.target);
      const label = `🔒 ${fmt(Math.min(team.progress, team.cost))}/${fmt(team.cost)}`;
      this.ctx.font = `800 ${15 * zoom}px ${FONT}, ${EMOJI}`;
      const w = this.ctx.measureText(label).width + 16;
      this.#panel(x - w / 2, y + 12 * zoom, w, 24 * zoom, { radius: 12 * zoom, fill: 'rgba(10,10,24,0.85)', border: hexA(team.color, 0.9), lineWidth: 2 });
      this.#text(label, x, y + 24.5 * zoom, { size: 15 * zoom, weight: 800, align: 'center', color: '#ffd166' });
    }
    // capitals of active départements: avatar of their best soldier, big number, stars, share
    homes.sort((a, b) => (game.teams.get(a.code)?.soldiers ?? 0) - (game.teams.get(b.code)?.soldiers ?? 0));
    const top3 = new Set(ranking.slice(0, 3).map((t) => t.code));
    for (const d of homes) {
      const team = game.teams.get(d.code);
      if (!team) continue;
      if (d.overseas && this.cam.s > 1.25) continue;
      const [x, y] = this.project(d.code);
      if (y < 700) continue;
      const big = top3.has(d.code);
      const s = (big ? 1.25 : 0.9) * zoom * (d.overseas ? 0.7 : 1);
      const top = game.topMember(team);
      this.#drawAvatar(top, x - 26 * s, y - 6 * s, 20 * s, team.color);
      this.#text(d.code, x + 14 * s, y, { size: 38 * s, weight: 900, align: 'center', stroke: team.color, strokeWidth: 7 * s, color: '#fff' });
      const stars = game.stars(team);
      if (stars) this.#text('★'.repeat(stars), x + 6 * s, y - 34 * s, { size: 20 * s, weight: 900, align: 'center', color: '#ffd23d', stroke: 'rgba(0,0,0,0.6)', strokeWidth: 4 });
      // inactive département: its soldiers are melting
      if (team.asleep) this.#text('💤', x + 44 * s, y - 26 * s + Math.sin(this.time * 3) * 3, { size: 22 * s, align: 'center', font: EMOJI });
      if (big) {
        this.#text(d.name, x, y + 30 * s, { size: 15 * s, weight: 800, align: 'center', stroke: 'rgba(0,0,0,0.7)', strokeWidth: 4 });
        this.#text(`${(game.share(team) * 100).toFixed(1).replace('.', ',')} %`, x, y + 48 * s, { size: 14 * s, weight: 800, align: 'center', color: '#ffd166', stroke: 'rgba(0,0,0,0.7)', strokeWidth: 4 });
      }
    }
  }

  #drawAttacks() {
    const { ctx, game } = this;
    for (const a of game.attacks) {
      const [x0, y0] = this.project(a.from);
      const [x1, y1] = this.project(a.to);
      const k = clamp01(a.t / a.dur);
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2 - Math.max(40, Math.hypot(x1 - x0, y1 - y0) * 0.3);
      const x = (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * mx + k * k * x1;
      const y = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * my + k * k * y1;
      const col = this.color(a.team);
      ctx.strokeStyle = hexA(col, 0.35);
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(mx, my, x1, y1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      this.#text('⚔️', x, y + 1, { size: 16, align: 'center', font: EMOJI });
      if (Math.random() < 0.5) this.particles.push({ x, y, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, t: 0, life: 0.4, color: col, size: 4 });
    }
  }

  #drawEffects() {
    const { ctx } = this;
    for (const r of this.rings) {
      const k = r.t / r.life;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + (r.max - r.r) * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const f of this.floaters) {
      const k = f.t / f.life;
      ctx.globalAlpha = 1 - k * k;
      this.#text(f.text, f.x, f.y - k * 70, { size: f.size, weight: 900, align: 'center', color: f.color, stroke: 'rgba(0,0,0,0.75)', strokeWidth: 8 });
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ HUD

  #drawHeader() {
    const { game, config } = this;
    this.#text(config.title, 34, 52, { size: 54, weight: 900, color: '#fff' });
    this.#text(config.subtitle, 248, 54, { size: 30, weight: 800, color: '#ffd166', maxWidth: 420 });
    this.#text(config.tagline, 36, 92, { size: 19, weight: 600, color: 'rgba(255,255,255,0.65)', maxWidth: 680 });
    this.#panel(740, 14, 140, 86, { radius: 18 });
    this.#text('SOLDATS', 810, 36, { size: 15, weight: 800, align: 'center', color: 'rgba(255,255,255,0.6)' });
    this.#text(fmt(game.totalSoldiers()), 810, 70, { size: 30, weight: 900, align: 'center', maxWidth: 126 });
    this.#panel(894, 14, 156, 86, { radius: 18 });
    this.#text(`PARTIE ${game.round}`, 972, 36, { size: 15, weight: 800, align: 'center', color: 'rgba(255,255,255,0.6)' });
    const tl = Math.ceil(game.timeLeft);
    this.#text(`${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`, 972, 70, { size: 34, weight: 900, align: 'center', color: tl <= 30 ? '#ff6b6b' : '#fff' });
    // collective like goal
    const goal = config.economy.likeGoal;
    const inGoal = game.likeTotal - game.likeGoalReached * goal;
    const { ctx } = this;
    roundRect(ctx, 36, 116, 640, 10, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    roundRect(ctx, 36, 116, Math.max(10, 640 * clamp01(inGoal / goal)), 10, 5);
    ctx.fillStyle = '#ff4d8d';
    ctx.fill();
    this.#text(`♥ ${fmt(inGoal)} / ${fmt(goal)} likes → +${config.economy.likeGoalReward} pour tous`, 1050, 121, { size: 17, weight: 800, align: 'right', color: '#ff9cc0', maxWidth: 360 });
  }

  #generalMessage() {
    const { game, config } = this;
    const e = game.event;
    const ev = config.events;
    if (e) {
      const t = game.teams;
      const name = (c) => `${c} ${t.get(c)?.name ?? ''}`;
      if (e.type === 'duel') return { label: 'DUEL', icon: '⚔️', color: '#a855f7', text: `${name(e.a)} contre ${name(e.b)} : celui qui recrute le plus vole ${ev.duel.stealPercent} % à l'autre !` };
      if (e.type === 'revolution') return { label: 'RÉVOLUTION !', icon: '✊', color: '#ef4444', text: `Tout le monde contre le ${e.target} : ×${ev.revolution.multiplier} pour les autres pendant ${ev.revolution.durationSec} s !` };
      if (e.type === 'mission') return { label: 'MISSION', icon: '🎯', color: '#22c55e', text: `La région ${e.region} doit recruter ${fmt(e.target)} soldats !` };
      if (e.type === 'bounty') return { label: 'TÊTE MISE À PRIX', icon: '💰', color: '#f5b301', text: `${ev.bounty.reward} soldats pour le département qui dépassera le ${e.target} !` };
    }
    const leader = game.ranking()[0];
    const tips = [
      config.tagline + ' !',
      `Tout cadeau = +${config.economy.soldiersPerDiamond} soldats par pièce`,
      `Partage le live : +${config.economy.shareSoldiers} soldats pour ton département`,
      'Les cadeaux d\'attaque font perdre des soldats au 1er !',
    ];
    if (leader) tips.push(`Le ${leader.code} ${leader.name} mène avec ${fmt(leader.soldiers)} soldats : qui va l'arrêter ?`);
    return { label: 'LE GÉNÉRAL', icon: '🎖️', color: '#f5b301', text: tips[Math.floor(this.time / 7) % tips.length] };
  }

  #drawGeneral() {
    const m = this.#generalMessage();
    const e = this.game.event;
    this.#panel(30, 138, 1020, 88, { border: m.color, lineWidth: 3, fill: 'rgba(28,20,40,0.9)' });
    this.#text(m.icon, 72, 182, { size: 38, align: 'center', font: EMOJI });
    this.#text(m.label, 112, 160, { size: 16, weight: 900, color: m.color });
    const lines = this.#wrap(m.text, e ? 700 : 900, 23, 800).slice(0, 2);
    lines.forEach((l, i) => this.#text(l, 112, 186 + i * 26 - (lines.length - 1) * 4, { size: 23, weight: 800 }));
    if (e) {
      const left = Math.max(0, Math.ceil(e.endsAt - this.game.elapsed));
      this.#panel(860, 164, 172, 38, { radius: 12, fill: m.color, border: 'rgba(255,255,255,0.3)' });
      this.#text(`⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, 946, 184, { size: 20, weight: 900, align: 'center' });
    }
  }

  #drawTabs() {
    const tabs = ['grossir', 'defendre', 'attaquer', 'gratuit'];
    const active = tabs[this.tabIndex];
    this.#panel(30, 236, 1020, 242, { radius: 22 });
    const tw = 1000 / 4;
    tabs.forEach((tab, i) => {
      const x = 40 + i * tw;
      const on = tab === active;
      this.#panel(x + 4, 246, tw - 8, 42, { radius: 12, fill: on ? TAB_COLORS[tab] : 'rgba(255,255,255,0.05)', border: on ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.06)' });
      this.#text(TAB_LABELS[tab], x + tw / 2, 268, { size: 17, weight: 900, align: 'center', color: on ? '#fff' : 'rgba(255,255,255,0.55)', maxWidth: tw - 20 });
    });
    const eco = this.config.economy;
    const cards = active === 'gratuit'
      ? [
          { icon: '👆', name: "Taper l'écran", label: `+1 / ${eco.likesPerSoldier} likes` },
          { icon: '💬', name: 'Commenter', label: `+${eco.commentSoldiers} / message` },
          { icon: '📣', name: 'Partager le live', label: `+${eco.shareSoldiers}` },
          { icon: '⭐', name: "S'abonner", label: `+${eco.followSoldiers}` },
          { icon: '🎁', name: 'Tout cadeau', label: `+${eco.soldiersPerDiamond} / pièce` },
        ]
      : this.config.gifts.filter((g) => g.tab === active).map((g) => ({ icon: g.icon, name: g.names[0], label: g.label, cost: g.diamonds }));
    const n = Math.min(5, cards.length);
    const cw = 186;
    const x0 = 540 - (n * cw + (n - 1) * 10) / 2;
    const appear = easeOutBack(clamp01(this.tabTime / 0.4));
    cards.slice(0, 5).forEach((c, i) => {
      const x = x0 + i * (cw + 10);
      const y = 300 + (1 - appear) * 30;
      this.ctx.globalAlpha = clamp01(this.tabTime / 0.3);
      this.#panel(x, y, cw, 166, { radius: 16, fill: 'rgba(255,255,255,0.05)' });
      if (c.cost) this.#text(`🪙 ${fmt(c.cost)}`, x + 12, y + 20, { size: 15, weight: 800, color: '#ffd166' });
      const bob = Math.sin(this.time * 3 + i) * 4;
      this.#text(c.icon, x + cw / 2, y + 66 + bob, { size: 50, align: 'center', font: EMOJI });
      this.#text(c.name, x + cw / 2, y + 116, { size: 17, weight: 800, align: 'center', maxWidth: cw - 14 });
      this.#text(c.label, x + cw / 2, y + 142, { size: 16, weight: 900, align: 'center', color: TAB_COLORS[active] === '#f5b301' ? '#ffd166' : TAB_COLORS[active], maxWidth: cw - 14 });
      this.ctx.globalAlpha = 1;
    });
  }

  #drawPodium() {
    const { game } = this;
    const ranking = game.ranking();
    const medals = ['🥇', '🥈', '🥉'];
    for (let i = 0; i < 3; i++) {
      const x = 30 + i * 345;
      const y = 488;
      const team = ranking[i];
      this.#panel(x, y, 330, 98, { radius: 18, border: team ? hexA(team.color, i === 0 ? 1 : 0.6) : 'rgba(255,255,255,0.08)', lineWidth: i === 0 ? 3 : 2, fill: i === 0 ? 'rgba(60,40,10,0.85)' : 'rgba(14,16,40,0.86)' });
      if (!team) {
        this.#text(i === 0 ? 'Écris ton département !' : '—', x + 165, y + 49, { size: 20, weight: 700, align: 'center', color: 'rgba(255,255,255,0.4)' });
        continue;
      }
      this.#drawAvatar(game.topMember(team), x + 46, y + 49, 32, team.color);
      this.#text(team.code, x + 90, y + 34, { size: 36, weight: 900, color: team.color });
      this.ctx.font = `900 36px ${FONT}`;
      const cw = this.ctx.measureText(team.code).width;
      this.#text(team.name, x + 100 + cw, y + 36, { size: 19, weight: 800, maxWidth: 300 - 100 - cw - 30 });
      this.#text(medals[i], x + 306, y + 24, { size: 24, align: 'center', font: EMOJI });
      const share = game.share(team);
      roundRect(this.ctx, x + 90, y + 58, 220, 8, 4);
      this.ctx.fillStyle = 'rgba(255,255,255,0.1)';
      this.ctx.fill();
      roundRect(this.ctx, x + 90, y + 58, Math.max(8, 220 * share), 8, 4);
      this.ctx.fillStyle = team.color;
      this.ctx.fill();
      this.#text(`${fmt(team.soldiers)} soldats`, x + 90, y + 82, { size: 15, weight: 700, color: 'rgba(255,255,255,0.75)' });
      this.#text(`${(share * 100).toFixed(1).replace('.', ',')} % · ${game.territoryCount(team.code)} 🗺️`, x + 312, y + 82, { size: 15, weight: 700, align: 'right', color: 'rgba(255,255,255,0.75)' });
    }
  }

  #drawKing() {
    const king = this.game.king();
    const x = 30;
    const y = 598;
    this.#panel(x, y, 360, 76, { radius: 38, border: '#f5b301', lineWidth: 3, fill: 'rgba(50,34,8,0.88)' });
    if (!king) {
      this.#text('👑 ROI DU PAYS : la place est libre !', x + 180, y + 38, { size: 18, weight: 800, align: 'center', color: '#ffd166', maxWidth: 330 });
      return;
    }
    this.#drawAvatar(king, x + 40, y + 38, 28, '#f5b301');
    this.#text('👑', x + 40, y + 6, { size: 22, align: 'center', font: EMOJI });
    this.#text('ROI DU PAYS', x + 80, y + 20, { size: 14, weight: 900, color: '#ffd166' });
    this.#text(king.name, x + 80, y + 43, { size: 22, weight: 900, maxWidth: 270 });
    const t = this.game.teams.get(king.team);
    this.#text(`${fmt(king.total)} soldats · ${king.team} ${t?.name ?? ''}`, x + 80, y + 63, { size: 13, weight: 700, color: 'rgba(255,255,255,0.7)', maxWidth: 270 });
  }

  #drawEventCard() {
    const { game, config } = this;
    const e = game.event;
    if (!e) return;
    const m = this.#generalMessage();
    const x = 410;
    const y = 598;
    const w = 640;
    const h = 150;
    const pop = easeOutBack(clamp01((game.elapsed - (e.endsAt - e.duration)) / 0.5));
    const { ctx } = this;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-(x + w / 2), -(y + h / 2));
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, hexA(m.color, 0.95));
    grad.addColorStop(1, 'rgba(30,14,60,0.95)');
    this.#panel(x, y, w, h, { radius: 20, fill: grad, border: 'rgba(255,255,255,0.35)' });
    this.#text(`${m.icon} ${m.label}`, x + 20, y + 28, { size: 26, weight: 900 });
    const left = Math.max(0, Math.ceil(e.endsAt - game.elapsed));
    this.#text(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, x + w - 20, y + 28, { size: 26, weight: 900, align: 'right', color: '#ffd166' });
    const barY = y + 92;
    if (e.type === 'duel') {
      const a = e.scores[e.a];
      const b = e.scores[e.b];
      const ca = this.color(e.a);
      const cb = this.color(e.b);
      this.#text(`${e.a} contre ${e.b} : le plus fort vole ${config.events.duel.stealPercent} % à l'autre`, x + 20, y + 60, { size: 18, weight: 700, maxWidth: w - 40 });
      const ratio = a + b > 0 ? a / (a + b) : 0.5;
      roundRect(ctx, x + 70, barY - 10, w - 140, 20, 10);
      ctx.fillStyle = cb;
      ctx.fill();
      roundRect(ctx, x + 70, barY - 10, Math.max(20, (w - 140) * ratio), 20, 10);
      ctx.fillStyle = ca;
      ctx.fill();
      this.#text(e.a, x + 20, barY, { size: 22, weight: 900, color: ca });
      this.#text(e.b, x + w - 20, barY, { size: 22, weight: 900, color: cb, align: 'right' });
      this.#text(`+${fmt(a)} contre +${fmt(b)}`, x + 20, barY + 30, { size: 18, weight: 800, color: '#ffd166' });
    } else if (e.type === 'mission') {
      this.#text(`La région ${e.region} doit recruter ${fmt(e.target)} soldats`, x + 20, y + 60, { size: 18, weight: 700, maxWidth: w - 40 });
      roundRect(ctx, x + 20, barY - 10, w - 40, 20, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
      roundRect(ctx, x + 20, barY - 10, Math.max(20, (w - 40) * clamp01(e.progress / e.target)), 20, 10);
      ctx.fillStyle = '#7cff6b';
      ctx.fill();
      this.#text(`${fmt(Math.min(e.progress, e.target))} / ${fmt(e.target)} soldats`, x + w / 2, barY, { size: 15, weight: 900, align: 'center', stroke: 'rgba(0,0,0,0.5)', strokeWidth: 3 });
      this.#text(`Prime : +${config.events.mission.rewardPerDepartment} pour chaque département qui participe`, x + 20, barY + 30, { size: 16, weight: 700, color: 'rgba(255,255,255,0.85)' });
    } else {
      const target = game.teams.get(e.target);
      this.#text(e.type === 'revolution' ? `Tout le monde contre le ${e.target} : ×${config.events.revolution.multiplier} pour les autres !` : `${config.events.bounty.reward} soldats pour qui dépassera le ${e.target} !`, x + 20, y + 62, { size: 19, weight: 800, maxWidth: w - 40 });
      if (target) {
        this.#drawAvatar(game.topMember(target), x + 44, barY + 14, 22, target.color);
        this.#text(`${target.code} ${target.name} · ${fmt(target.soldiers)} soldats`, x + 78, barY + 14, { size: 21, weight: 900, color: '#fff', stroke: 'rgba(0,0,0,0.55)', strokeWidth: 5, maxWidth: w - 110 });
      }
    }
    roundRect(ctx, x + 20, y + h - 10, w - 40, 5, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();
    roundRect(ctx, x + 20, y + h - 10, (w - 40) * clamp01(left / e.duration), 5, 3);
    ctx.fillStyle = '#ffd166';
    ctx.fill();
    ctx.restore();
  }

  #drawBubbles() {
    const { ctx } = this;
    const n = this.bubbles.length;
    this.bubbles.forEach((b, i) => {
      const slot = n - 1 - i;
      const age = this.time - b.born;
      const fade = clamp01((5 - (this.time - b.updated)) / 0.6);
      const enter = easeOutBack(clamp01(age / 0.35));
      const pulse = 1 + 0.08 * Math.max(0, 1 - (this.time - b.updated) * 4);
      const y = 1872 - slot * 70 + (1 - enter) * 60;
      const col = b.team ? this.color(b.team) : '#c9b6ff';
      const name = b.user?.name ?? '';
      ctx.font = `800 23px ${FONT}, ${EMOJI}`;
      const nameW = ctx.measureText(name).width;
      ctx.font = `700 21px ${FONT}, ${EMOJI}`;
      const textW = ctx.measureText(b.text).width;
      ctx.font = `900 26px ${FONT}`;
      const amountW = b.amount > 0 ? ctx.measureText(`+${fmt(b.amount)}`).width + 24 : 10;
      const w = Math.min(900, Math.max(380, 96 + Math.min(nameW, 220) + textW + amountW + 20));
      const x = 560 - w / 2;
      ctx.save();
      ctx.globalAlpha = fade * clamp01(age / 0.2);
      ctx.translate(560, y);
      ctx.scale(pulse, pulse);
      ctx.translate(-560, -y);
      this.#panel(x, y - 30, w, 60, { radius: 30, fill: 'rgba(10,12,30,0.88)', border: col, lineWidth: 3 });
      this.#drawAvatar(b.user, x + 32, y, 24, col);
      this.#text(KIND_ICON[b.kind] || '•', x + 70, y - 8, { size: 20, align: 'center', font: EMOJI });
      this.#text(name, x + 88, y - 8, { size: 23, weight: 800, color: col, maxWidth: 220 });
      this.#text(b.text, x + 96 + Math.min(nameW, 220), y - 8, { size: 21, weight: 700, maxWidth: w - 96 - Math.min(nameW, 220) - amountW - 16 });
      const p = b.user && this.game.players.get(b.user.id);
      const sub = b.kind === 'like' && b.likes ? `${fmt(b.likes)} ♥ · total ${fmt(p?.total ?? 0)}` : `total ${fmt(p?.total ?? 0)}`;
      this.#text(sub, x + 88, y + 17, { size: 15, weight: 600, color: 'rgba(255,255,255,0.55)' });
      if (b.amount > 0) this.#text(`+${fmt(b.amount)}`, x + w - 20, y, { size: 26, weight: 900, align: 'right', color: '#5cff8a' });
      ctx.restore();
    });
  }

  #drawCombos() {
    for (const c of this.combos) {
      const [hx, hy] = this.project(c.team);
      const k = c.t / c.life;
      const s = easeOutBack(clamp01(c.t / 0.3));
      const alpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      const x = Math.min(980, Math.max(100, hx));
      const y = Math.min(1500, Math.max(820, hy - 60 - k * 40));
      const { ctx } = this;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.scale(s, s);
      this.#text(c.icon, -40, 0, { size: 84, align: 'center', font: EMOJI });
      if (c.count > 1) this.#text(`×${c.count}`, 30, 6, { size: 86, weight: 900, align: 'left', color: '#fff', stroke: c.color, strokeWidth: 12 });
      this.#text(`+${fmt(c.amount)}`, c.count > 1 ? 40 : 30, c.count > 1 ? 70 : 6, { size: c.count > 1 ? 40 : 56, weight: 900, color: '#5cff8a', stroke: 'rgba(0,0,0,0.8)', strokeWidth: 8 });
      ctx.restore();
    }
  }

  #drawBanner() {
    const b = this.banner;
    if (!b || this.game.phase === 'victory') return;
    const { ctx } = this;
    const s = easeOutBack(clamp01(b.t / 0.35));
    const alpha = b.t > 2.2 ? 1 - (b.t - 2.2) / 0.4 : 1;
    const lines = this.#wrap(b.text, 860, 34, 900).slice(0, 2);
    const h = 40 + lines.length * 42;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(540, 1150);
    ctx.scale(s, s);
    this.#panel(-470, -h / 2, 940, h, { radius: 28, fill: 'rgba(14,10,36,0.92)', border: b.color, lineWidth: 4 });
    lines.forEach((l, i) => this.#text(l, 0, -((lines.length - 1) * 42) / 2 + i * 42 + 2, { size: 34, weight: 900, align: 'center' }));
    ctx.restore();
  }

  #drawPopup() {
    const p = this.popup;
    if (!p || this.game.phase !== 'battle') return;
    const eco = this.config.economy;
    const content = {
      share: ['📣', 'PARTAGE LE LIVE', `Chaque partage rapporte +${eco.shareSoldiers} soldats à ton département.`],
      join: ['🗺️', 'ENTRE EN GUERRE', 'Écris le numéro de ton département dans le tchat !'],
      follow: ['⭐', 'ABONNE-TOI', `Chaque abonnement rapporte +${eco.followSoldiers} soldats à ton département.`],
      gift: ['🎁', 'ENVOIE DES RENFORTS', `Chaque pièce offerte = +${eco.soldiersPerDiamond} soldats pour ton département.`],
    }[p.kind];
    const { ctx } = this;
    const s = easeOutBack(clamp01(p.t / 0.4));
    const alpha = p.t > 3.7 ? 1 - (p.t - 3.7) / 0.5 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(540, 1060);
    ctx.scale(s, s);
    this.#panel(-430, -140, 860, 280, { radius: 28, fill: 'rgba(10,14,40,0.94)', border: '#38bdf8', lineWidth: 4 });
    this.#panel(-110, -162, 220, 44, { radius: 22, fill: '#0ea5e9', border: 'rgba(255,255,255,0.4)' });
    this.#text('LE GÉNÉRAL', 0, -140, { size: 20, weight: 900, align: 'center' });
    this.#text(content[0], 0, -64 + Math.sin(this.time * 5) * 5, { size: 64, align: 'center', font: EMOJI });
    this.#text(content[1], 0, 22, { size: 56, weight: 900, align: 'center', stroke: 'rgba(56,189,248,0.4)', strokeWidth: 10 });
    this.#wrap(content[2], 760, 26, 700).slice(0, 2).forEach((l, i) => this.#text(l, 0, 80 + i * 32, { size: 26, weight: 700, align: 'center', color: 'rgba(255,255,255,0.9)' }));
    ctx.restore();
  }

  #drawVictory() {
    const { ctx, game, config } = this;
    ctx.fillStyle = 'rgba(5,6,18,0.78)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const w = game.winner;
    const k = easeOutBack(clamp01(game.phaseTime / 0.6));
    ctx.save();
    ctx.translate(540, 520);
    ctx.scale(k, k);
    this.#text('VICTOIRE', 0, -70, { size: 110, weight: 900, align: 'center', stroke: 'rgba(0,0,0,0.6)', strokeWidth: 12 });
    if (w) {
      this.#text(w.code, 0, 70, { size: 170, weight: 900, align: 'center', color: '#fff', stroke: w.color, strokeWidth: 16 });
      this.#text(w.name, 0, 180, { size: 56, weight: 900, align: 'center', color: w.color, stroke: 'rgba(0,0,0,0.6)', strokeWidth: 8 });
      this.#text(`${plural(w.territories, 'département')} · ${plural(w.soldiers, 'soldat')}`, 0, 240, { size: 30, weight: 700, align: 'center', color: 'rgba(255,255,255,0.85)' });
    } else {
      this.#text('Aucun département en guerre', 0, 80, { size: 40, weight: 800, align: 'center' });
    }
    ctx.restore();
    const podium = game.podium || [];
    const medals = ['🥇', '🥈', '🥉'];
    podium.forEach((t, i) => {
      const y = 860 + i * 120;
      this.#panel(140, y, 800, 100, { radius: 24, border: t.color, lineWidth: 3 });
      this.#text(medals[i], 190, y + 50, { size: 44, align: 'center', font: EMOJI });
      this.#drawAvatar(t.top, 270, y + 50, 34, t.color);
      this.#text(`${t.code} ${t.name}`, 320, y + 36, { size: 30, weight: 900, color: t.color, maxWidth: 560 });
      this.#text(`${plural(t.territories, 'département')} · ${plural(t.soldiers, 'soldat')}${t.top ? ` · héros : ${t.top.name}` : ''}`, 320, y + 70, { size: 20, weight: 700, color: 'rgba(255,255,255,0.8)', maxWidth: 600 });
    });
    const king = game.finalKing;
    if (king) {
      this.#panel(240, 1250, 600, 110, { radius: 55, border: '#f5b301', lineWidth: 4, fill: 'rgba(50,34,8,0.9)' });
      this.#drawAvatar(king, 300, 1305, 38, '#f5b301');
      this.#text('👑 ROI DU PAYS', 360, 1282, { size: 22, weight: 900, color: '#ffd166' });
      this.#text(`${king.name} — ${fmt(king.total)} soldats`, 360, 1322, { size: 28, weight: 900, maxWidth: 460 });
    }
    const left = Math.max(0, Math.ceil(config.match.victoryScreenSec - game.phaseTime));
    this.#text(`Nouvelle partie dans ${left} s — écris ton département pour être prêt !`, 540, 1440, { size: 28, weight: 700, align: 'center', color: 'rgba(255,255,255,0.85)' });
  }
}
