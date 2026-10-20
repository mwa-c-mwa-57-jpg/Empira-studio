// Dessin des impressions (cartes) sur canvas 2D.
// Une carte est composée sur le fond exact du papier (multiplication) : ce qui est révélé
// pendant l'impression est donc identique, au pixel près, à ce qui reste sur la page.

const avatarCache = new Map();
const GOLD = ['#fbe9a0', '#d9a520', '#9a6b12', '#f3d26b'];

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// ---- photos de profil -------------------------------------------------------------------

function loadImage(src, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('image'));
    };
    img.src = src;
  });
}

function hashHue(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

// Avatar de remplacement : initiale (ou emoji de test) sur un dégradé.
function placeholderAvatar(label, hue, isEmoji = false) {
  const size = 512;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size * 0.35, size * 0.3, size * 0.05, size * 0.5, size * 0.5, size * 0.75);
  g.addColorStop(0, `hsl(${hue}, 85%, 78%)`);
  g.addColorStop(0.55, `hsl(${(hue + 25) % 360}, 70%, 52%)`);
  g.addColorStop(1, `hsl(${(hue + 50) % 360}, 65%, 22%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // quelques formes pour donner du relief au croquis
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(((i * 97) % size) + 30, ((i * 151) % size) + 20, 40 + ((i * 37) % 90), 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#fff' : '#000';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (isEmoji) {
    ctx.font = `${size * 0.56}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.fillText(label, size / 2, size * 0.54);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `${size * 0.5}px Anton, Impact, sans-serif`;
    ctx.fillText(label, size / 2, size * 0.55);
  }
  return c;
}

export async function loadAvatar(user) {
  const key = user.avatar || `ph:${user.id}`;
  if (avatarCache.has(key)) return avatarCache.get(key);
  let result;
  const avatar = user.avatar || '';
  if (avatar.startsWith('test:')) {
    const [, emoji, hue] = avatar.split(':');
    result = placeholderAvatar(emoji, Number(hue) || 0, true);
  } else {
    try {
      if (!/^https:\/\//.test(avatar)) throw new Error('pas de photo');
      result = await loadImage(`/avatar?u=${encodeURIComponent(avatar)}`);
    } catch {
      const name = (user.nickname || user.uniqueId || '?').trim();
      const initial = Array.from(name)[0]?.toUpperCase() || '?';
      result = placeholderAvatar(initial, hashHue(name));
    }
  }
  avatarCache.set(key, result);
  if (avatarCache.size > 200) avatarCache.delete(avatarCache.keys().next().value);
  return result;
}

// Dessine l'image en « cover » dans un carré de taille size.
function coverSquare(img, size) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const s = Math.max(size / iw, size / ih);
  ctx.drawImage(img, (size - iw * s) / 2, (size - ih * s) / 2, iw * s, ih * s);
  return c;
}

// ---- effet crayon ------------------------------------------------------------------------

function boxBlur(src, w, h, radius) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const r = Math.max(1, Math.round(radius));
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc * norm;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc * norm;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

// Photo -> croquis au graphite (technique du « color dodge » + grain).
export function pencilSketch(img, size) {
  const c = coverSquare(img, size);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, size, size);
  const px = data.data;
  const n = size * size;
  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const g = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    gray[i] = Math.min(255, Math.max(0, (g - 128) * 1.25 + 128));
  }
  const inv = new Float32Array(n);
  for (let i = 0; i < n; i++) inv[i] = 255 - gray[i];
  let blur = boxBlur(inv, size, size, size / 80);
  blur = boxBlur(blur, size, size, size / 80);
  // ombrage doux pour garder les volumes (sinon le croquis devient trop « vide »)
  const shade = boxBlur(boxBlur(gray, size, size, size / 50), size, size, size / 50);
  let seed = 1234567;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const dodge = Math.min(255, (gray[i] * 255) / Math.max(1, 255 - blur[i]));
    const tone = 255 - (255 - shade[i]) * 0.8;
    let v = (dodge * tone) / 255;
    v = 255 * Math.pow(v / 255, 1.5);
    // hachures en diagonale dans les zones sombres + grain du graphite
    const x = i % size;
    const y = (i / size) | 0;
    const hatch = v < 170 && (x + y) % 6 === 0 ? -22 : v < 110 && (x - y + 4000) % 6 === 0 ? -16 : 0;
    v = v + hatch + (rand() - 0.5) * 18;
    v = Math.min(255, Math.max(14, v));
    px[i * 4] = v * 0.97;
    px[i * 4 + 1] = v * 0.97;
    px[i * 4 + 2] = v;
    px[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

// Version « impression couleur » : légèrement désaturée et contrastée.
function colorPrint(img, size) {
  const c = coverSquare(img, size);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, size, size);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    for (let k = 0; k < 3; k++) {
      const v = g + (px[i + k] - g) * 0.92;
      px[i + k] = Math.min(255, Math.max(0, (v - 128) * 1.08 + 132));
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

// ---- petits dessins ----------------------------------------------------------------------

function goldGradient(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, GOLD[0]);
  g.addColorStop(0.35, GOLD[1]);
  g.addColorStop(0.6, GOLD[2]);
  g.addColorStop(1, GOLD[3]);
  return g;
}

function circleImage(ctx, picture, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(picture, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

function ring(ctx, cx, cy, r, width, style) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = width;
  ctx.strokeStyle = style;
  ctx.stroke();
}

function heart(ctx, x, y, s, color = '#e0245e') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 16, s / 16);
  ctx.beginPath();
  ctx.moveTo(8, 15);
  ctx.bezierCurveTo(-6, 6, 1, -3, 8, 3.5);
  ctx.bezierCurveTo(15, -3, 22, 6, 8, 15);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function star(ctx, x, y, r, color, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function sparkle(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fillStyle = color;
  ctx.fill();
}

function fitText(ctx, text, maxWidth, size, family, weight = 700) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    s *= 0.92;
  } while (s > size * 0.35);
  return s;
}

function displayName(job) {
  const name = (job.user.nickname || job.user.uniqueId || 'viewer').replace(/\s+/g, ' ').trim();
  const chars = Array.from(name);
  return chars.length > 22 ? chars.slice(0, 21).join('') + '…' : name;
}

function nameWithHeart(ctx, text, cx, baseline, size, maxWidth, color, heartColor = '#e0245e') {
  const s = fitText(ctx, text, maxWidth - size * 0.6, size, 'Caveat, "Segoe Print", cursive');
  const w = ctx.measureText(text).width;
  const hs = s * 0.42;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const x = cx - (w + hs * 1.2) / 2;
  ctx.fillText(text, x, baseline);
  heart(ctx, x + w + hs * 0.25, baseline - s * 0.42, hs, heartColor);
}

function lantern(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#7a1d12';
  ctx.lineWidth = s * 0.04;
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.1);
  ctx.lineTo(0, -s * 0.55);
  ctx.stroke();
  const body = ctx.createLinearGradient(-s * 0.4, 0, s * 0.4, 0);
  body.addColorStop(0, '#9e1414');
  body.addColorStop(0.45, '#e8322b');
  body.addColorStop(1, '#a01818');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.42, s * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,20,10,0.6)';
  ctx.lineWidth = s * 0.025;
  for (const k of [-0.22, 0, 0.22]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, s * Math.abs(k) + s * 0.03, s * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = goldGradient(ctx, -s * 0.3, 0, s * 0.3, 0);
  ctx.fillRect(-s * 0.26, -s * 0.62, s * 0.52, s * 0.14);
  ctx.fillRect(-s * 0.26, s * 0.48, s * 0.52, s * 0.14);
  ctx.fillStyle = '#e2a72e';
  for (let i = -2; i <= 2; i++) ctx.fillRect(i * s * 0.05 - s * 0.012, s * 0.62, s * 0.024, s * 0.38);
  ctx.restore();
}

function flower(ctx, x, y, r, petal = '#e0262c', center = '#f2b632', petals = 6) {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < petals; i++) {
    ctx.rotate((Math.PI * 2) / petals);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.3, r * 0.52, 0, 0, Math.PI * 2);
    ctx.fillStyle = petal;
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,10,10,0.35)';
    ctx.lineWidth = r * 0.05;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = center;
  ctx.fill();
  ctx.restore();
}

function leaf(ctx, x, y, r, angle, color = '#3f8f3a') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(r * 0.5, -r * 0.45, r, 0);
  ctx.quadraticCurveTo(r * 0.5, r * 0.45, 0, 0);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function cloudSwirl(ctx, x, y, r, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip, 1);
  ctx.strokeStyle = goldGradient(ctx, -r, 0, r, 0);
  ctx.lineWidth = r * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let t = 0; t < Math.PI * 3.2; t += 0.08) {
    const rr = r * (0.12 + t / (Math.PI * 3.2) * 0.9);
    ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr * 0.7);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.9, 0);
  ctx.bezierCurveTo(r * 1.6, -r * 0.4, r * 2.2, r * 0.3, r * 2.8, 0);
  ctx.stroke();
  ctx.restore();
}

function crown(ctx, cx, cy, w) {
  const h = w * 0.62;
  ctx.save();
  ctx.translate(cx - w / 2, cy - h / 2);
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.25);
  ctx.lineTo(w * 0.25, h * 0.6);
  ctx.lineTo(w * 0.5, 0);
  ctx.lineTo(w * 0.75, h * 0.6);
  ctx.lineTo(w, h * 0.25);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = goldGradient(ctx, 0, 0, w, h);
  ctx.fill();
  ctx.lineWidth = w * 0.03;
  ctx.strokeStyle = '#7a5310';
  ctx.stroke();
  for (const [x, y, c] of [[0, h * 0.25, '#e23b3b'], [w * 0.5, 0, '#2f7de1'], [w, h * 0.25, '#e23b3b']]) {
    ctx.beginPath();
    ctx.arc(x, y, w * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  }
  ctx.fillStyle = '#7a5310';
  ctx.fillRect(w * 0.05, h * 0.78, w * 0.9, h * 0.06);
  ctx.restore();
}

function laurel(ctx, cx, cy, r, side) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(side, 1);
  ctx.strokeStyle = '#8a6a17';
  ctx.lineWidth = r * 0.025;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI * 0.55, Math.PI * 1.3);
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.6 + (i / 9) * Math.PI * 0.68;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    leaf(ctx, x, y, r * 0.2, a + Math.PI * 0.5 + 0.5, i % 2 ? '#b8901f' : '#d9ad35');
    leaf(ctx, x, y, r * 0.18, a - Math.PI * 0.5 - 0.3 + Math.PI, i % 2 ? '#c99d2a' : '#a8821c');
  }
  ctx.restore();
}

function ribbon(ctx, cx, cy, w, h, color, edge) {
  ctx.save();
  ctx.fillStyle = edge;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * w * 0.42, cy - h * 0.25);
    ctx.lineTo(cx + s * w * 0.62, cy - h * 0.25);
    ctx.lineTo(cx + s * w * 0.55, cy + h * 0.2);
    ctx.lineTo(cx + s * w * 0.62, cy + h * 0.65);
    ctx.lineTo(cx + s * w * 0.42, cy + h * 0.65);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy - h / 2);
  ctx.quadraticCurveTo(cx, cy - h * 0.8, cx + w / 2, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy + h / 2);
  ctx.quadraticCurveTo(cx, cy + h * 0.2, cx - w / 2, cy + h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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

// ---- styles -----------------------------------------------------------------------------

function drawPencil(ctx, W, H, img, job) {
  const u = W / 100;
  ctx.strokeStyle = '#1d1d1f';
  ctx.lineWidth = 0.75 * u;
  ctx.strokeRect(3 * u, 3 * u, 94 * u, H - 6 * u);
  const r = 35 * u;
  const cy = 3 * u + 44 * u;
  circleImage(ctx, pencilSketch(img, Math.round(r * 2)), 50 * u, cy, r);
  ring(ctx, 50 * u, cy, r, 0.8 * u, '#1d1d1f');
  nameWithHeart(ctx, displayName(job), 50 * u, H - 9 * u, 15 * u, 86 * u, '#1d1d1f');
}

function drawColor(ctx, W, H, img, job) {
  const u = W / 100;
  ctx.strokeStyle = '#1d1d1f';
  ctx.lineWidth = 0.9 * u;
  ctx.strokeRect(3 * u, 3 * u, 94 * u, H - 6 * u);
  ctx.lineWidth = 0.35 * u;
  ctx.strokeRect(5 * u, 5 * u, 90 * u, H - 10 * u);
  const r = 34 * u;
  const cy = 4 * u + 44 * u;
  circleImage(ctx, colorPrint(img, Math.round(r * 2)), 50 * u, cy, r);
  ring(ctx, 50 * u, cy, r, 1 * u, '#1d1d1f');
  ring(ctx, 50 * u, cy, r + 2.2 * u, 0.4 * u, '#e0245e');
  for (const [x, y, s] of [[12, 12, 3.2], [88, 14, 2.6], [14, 84, 2.4], [87, 80, 3]]) sparkle(ctx, x * u, y * u, s * u, '#f2b632');
  nameWithHeart(ctx, displayName(job), 50 * u, H - 9 * u, 15 * u, 84 * u, '#1d1d1f');
}

function drawFestive(ctx, W, H, img, job, t) {
  const u = W / 100;
  const cx = 50 * u;
  const cy = 50 * u;
  const r = 29 * u;
  // nuages dorés derrière le portrait
  cloudSwirl(ctx, 22 * u, 74 * u, 7 * u, 1);
  cloudSwirl(ctx, 80 * u, 70 * u, 6 * u, -1);
  cloudSwirl(ctx, 18 * u, 40 * u, 5 * u, 1);
  // lanternes en haut à gauche
  lantern(ctx, 23 * u, 26 * u, 11 * u);
  lantern(ctx, 34 * u, 16 * u, 9 * u);
  // portrait
  circleImage(ctx, colorPrint(img, Math.round(r * 2)), cx, cy, r);
  ring(ctx, cx, cy, r, 1.6 * u, '#2a1a12');
  ring(ctx, cx, cy, r + 2 * u, 0.9 * u, goldGradient(ctx, cx - r, cy - r, cx + r, cy + r));
  // fleurs et feuilles autour
  const flowers = [
    [76, 28, 9, '#e0262c'], [86, 50, 7.5, '#e0262c'], [70, 16, 5, '#e85a8c'], [80, 78, 6, '#e0262c'],
    [22, 86, 6.5, '#e0262c'], [14, 58, 5, '#e85a8c'], [60, 84, 4.5, '#f08a24'],
  ];
  for (const [x, y, s] of flowers) {
    leaf(ctx, x * u, y * u, s * 1.3 * u, -0.6);
    leaf(ctx, x * u, y * u, s * 1.2 * u, 2.4);
  }
  for (const [x, y, s, c] of flowers) flower(ctx, x * u, y * u, s * u, c);
  for (const [x, y] of [[62, 8], [92, 36], [8, 30], [92, 92], [40, 92]]) sparkle(ctx, x * u, y * u, 2.4 * u, '#e8b02a');
  // bannière avec le pseudo
  ribbon(ctx, cx, 101 * u, 74 * u, 13 * u, '#c81e28', '#8e1219');
  ctx.fillStyle = '#fff6e0';
  const s = fitText(ctx, displayName(job), 62 * u, 11 * u, 'Caveat, cursive');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${s}px Caveat, cursive`;
  ctx.fillText(displayName(job), cx, 100.5 * u);
  ctx.fillStyle = '#9a6b12';
  ctx.font = `${5 * u}px Anton, Impact, sans-serif`;
  ctx.fillText(t('cardThanks', { coins: job.coins }), cx, 115 * u);
}

function drawRoyal(ctx, W, H, img, job, t) {
  const u = W / 100;
  const cx = 50 * u;
  const cy = 54 * u;
  const r = 27 * u;
  ctx.fillStyle = 'rgba(247, 226, 160, 0.35)';
  roundRect(ctx, 4 * u, 4 * u, 92 * u, H - 8 * u, 5 * u);
  ctx.fill();
  ctx.lineWidth = 1.6 * u;
  ctx.strokeStyle = goldGradient(ctx, 0, 0, W, H);
  roundRect(ctx, 3 * u, 3 * u, 94 * u, H - 6 * u, 6 * u);
  ctx.stroke();
  ctx.lineWidth = 0.5 * u;
  roundRect(ctx, 6 * u, 6 * u, 88 * u, H - 12 * u, 4 * u);
  ctx.stroke();
  for (const [x, y] of [[6, 6], [94, 6], [6, H / u - 6], [94, H / u - 6]]) star(ctx, x * u, y * u, 2.6 * u, '#c9971c', 4);
  laurel(ctx, cx, cy, r + 9 * u, 1);
  laurel(ctx, cx, cy, r + 9 * u, -1);
  circleImage(ctx, colorPrint(img, Math.round(r * 2)), cx, cy, r);
  ring(ctx, cx, cy, r, 1.4 * u, '#3a2a10');
  ring(ctx, cx, cy, r + 2 * u, 1.1 * u, goldGradient(ctx, cx - r, cy - r, cx + r, cy + r));
  crown(ctx, cx, 16 * u, 22 * u);
  // plaque
  ctx.fillStyle = goldGradient(ctx, 18 * u, 0, 82 * u, 0);
  roundRect(ctx, 16 * u, 94 * u, 68 * u, 15 * u, 3 * u);
  ctx.fill();
  ctx.fillStyle = '#2b1d08';
  const s = fitText(ctx, displayName(job), 60 * u, 11 * u, 'Caveat, cursive');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${s}px Caveat, cursive`;
  ctx.fillText(displayName(job), cx, 101.5 * u);
  ctx.fillStyle = '#8a6a17';
  ctx.font = `${4.6 * u}px Anton, Impact, sans-serif`;
  ctx.fillText(t('cardRoyal', { coins: job.coins }), cx, 116 * u);
}

function drawLegend(ctx, W, H, img, job, t) {
  const u = W / 100;
  const cx = 50 * u;
  const cy = 55 * u;
  const r = 28 * u;
  // rayons de soleil
  ctx.save();
  roundRect(ctx, 3 * u, 3 * u, 94 * u, H - 6 * u, 5 * u);
  ctx.clip();
  for (let i = 0; i < 28; i++) {
    const a0 = (i / 28) * Math.PI * 2;
    const a1 = a0 + Math.PI / 28;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, W * 1.2, a0, a1);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? 'rgba(242, 196, 64, 0.45)' : 'rgba(255, 236, 170, 0.35)';
    ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = 2.4 * u;
  ctx.strokeStyle = goldGradient(ctx, 0, 0, W, H);
  roundRect(ctx, 3 * u, 3 * u, 94 * u, H - 6 * u, 5 * u);
  ctx.stroke();
  ctx.lineWidth = 0.6 * u;
  ctx.strokeStyle = '#7a5310';
  roundRect(ctx, 6.5 * u, 6.5 * u, 87 * u, H - 13 * u, 3.5 * u);
  ctx.stroke();
  for (const [x, y] of [[6, 6], [94, 6], [6, H / u - 6], [94, H / u - 6]]) {
    ctx.beginPath();
    ctx.arc(x * u, y * u, 2.6 * u, 0, Math.PI * 2);
    ctx.fillStyle = '#d12f5a';
    ctx.fill();
    ring(ctx, x * u, y * u, 2.6 * u, 0.6 * u, '#7a5310');
  }
  for (const [x, y, s] of [[14, 26, 3.5], [86, 24, 4], [12, 70, 2.8], [88, 66, 3.2], [24, 14, 2.2], [76, 12, 2.5], [90, 44, 2.2], [10, 46, 2.4]]) {
    star(ctx, x * u, y * u, s * u, '#e3a514');
  }
  // titre
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${9 * u}px Anton, Impact, sans-serif`;
  ctx.lineWidth = 1.2 * u;
  ctx.strokeStyle = '#5c3b06';
  ctx.strokeText(t('cardLegendTitle'), cx, 13 * u);
  ctx.fillStyle = goldGradient(ctx, cx - 30 * u, 8 * u, cx + 30 * u, 18 * u);
  ctx.fillText(t('cardLegendTitle'), cx, 13 * u);
  crown(ctx, cx, 24.5 * u, 18 * u);
  circleImage(ctx, colorPrint(img, Math.round(r * 2)), cx, cy, r);
  ring(ctx, cx, cy, r, 1.5 * u, '#3a2a10');
  ring(ctx, cx, cy, r + 2.6 * u, 2.2 * u, goldGradient(ctx, cx - r, cy - r, cx + r, cy + r));
  ring(ctx, cx, cy, r + 4.4 * u, 0.5 * u, '#7a5310');
  ribbon(ctx, cx, 99 * u, 80 * u, 14 * u, '#b0172a', '#6f0d19');
  ctx.fillStyle = '#fff3c4';
  const s = fitText(ctx, displayName(job), 66 * u, 11.5 * u, 'Caveat, cursive');
  ctx.font = `700 ${s}px Caveat, cursive`;
  ctx.fillText(displayName(job), cx, 98.5 * u);
  ctx.fillStyle = '#5c3b06';
  ctx.font = `${5 * u}px Anton, Impact, sans-serif`;
  ctx.fillText(t('cardLegendCoins', { coins: job.coins }), cx, 114.5 * u);
}

const STYLES = { pencil: drawPencil, color: drawColor, festive: drawFestive, royal: drawRoyal, legend: drawLegend };

// Construit la carte finale : fond = papier existant, dessin multiplié par-dessus.
export async function renderCard(job, rect, pageCanvas, scale, t) {
  const img = await loadAvatar(job.user);
  const W = Math.round(rect.w * scale);
  const H = Math.round(rect.h * scale);
  const card = makeCanvas(W, H);
  const ctx = card.getContext('2d');
  ctx.drawImage(pageCanvas, Math.round(rect.x * scale), Math.round(rect.y * scale), W, H, 0, 0, W, H);

  const art = makeCanvas(W, H);
  const actx = art.getContext('2d');
  (STYLES[job.tier?.style] || drawPencil)(actx, W, H, img, job, t);

  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(art, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return card;
}

// Papier vierge : crème avec un léger grain et quelques fibres.
export function blankPaper(W, H) {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efe6cf';
  ctx.fillRect(0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H);
  const px = img.data;
  let seed = 42;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < px.length; i += 4) {
    const n = (rand() - 0.5) * 9;
    px[i] += n;
    px[i + 1] += n;
    px[i + 2] += n * 0.9;
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#8a7a58';
  for (let i = 0; i < 260; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const a = rand() * Math.PI;
    const l = 4 + rand() * 14;
    ctx.lineWidth = 0.6 + rand();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return c;
}
