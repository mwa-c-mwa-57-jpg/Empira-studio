// Builds public/src/france/departements.js from open data (no dependency).
//
// Source: france-geojson (https://github.com/gregoiredavid/france-geojson), derived from
// IGN Admin Express — Licence Ouverte / Etalab. Attribution is kept in the generated file.
//
// Usage: node tools/build-france-map.mjs [mainland.geojson] [with-overseas.geojson]
// Without arguments the two files are downloaded from GitHub.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/';
const OVERSEAS = ['971', '972', '973', '974', '976'];

const REGIONS = {
  'Auvergne-Rhône-Alpes': ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
  'Bourgogne-Franche-Comté': ['21', '25', '39', '58', '70', '71', '89', '90'],
  Bretagne: ['22', '29', '35', '56'],
  'Centre-Val de Loire': ['18', '28', '36', '37', '41', '45'],
  Corse: ['2A', '2B'],
  'Grand Est': ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
  'Hauts-de-France': ['02', '59', '60', '62', '80'],
  'Île-de-France': ['75', '77', '78', '91', '92', '93', '94', '95'],
  Normandie: ['14', '27', '50', '61', '76'],
  'Nouvelle-Aquitaine': ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
  Occitanie: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
  'Pays de la Loire': ['44', '49', '53', '72', '85'],
  "Provence-Alpes-Côte d'Azur": ['04', '05', '06', '13', '83', '84'],
  'Outre-mer': OVERSEAS,
};
const SEA_LINKS = [['2B', '06'], ['2A', '83'], ['2B', '13']];

async function load(fileOrName) {
  if (fileOrName.endsWith('.geojson') && !fileOrName.startsWith('http')) {
    try {
      return JSON.parse(await readFile(fileOrName, 'utf8'));
    } catch {
      /* fall back to download */
    }
  }
  const url = BASE + path.basename(fileOrName);
  console.log(`Téléchargement ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${url}`);
  return res.json();
}

const polygonsOf = (geom) => (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates);

function simplify(points, tolerance) {
  // Douglas-Peucker on a closed ring: split at the vertex farthest from the first one,
  // because first and last points are identical and would make the base segment degenerate.
  if (points.length < 8) return points;
  let far = 1;
  for (let i = 1; i < points.length; i++) {
    if (Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]) > Math.hypot(points[far][0] - points[0][0], points[far][1] - points[0][1])) far = i;
  }
  const first = simplifyOpen(points.slice(0, far + 1), tolerance);
  const second = simplifyOpen(points.slice(far), tolerance);
  const out = first.concat(second.slice(1));
  return out.length >= 4 ? out : points;
}

function simplifyOpen(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let max = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - points[i][1]) - (ax - points[i][0]) * (by - ay)) / len;
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max > tolerance && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ringArea(r) {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return s / 2;
}

function centroid(r) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    a += f;
    cx += (r[j][0] + r[i][0]) * f;
    cy += (r[j][1] + r[i][1]) * f;
  }
  return a ? [cx / (3 * a), cy / (3 * a)] : r[0];
}

function inside([x, y], r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if (r[i][1] > y !== r[j][1] > y && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  }
  return c;
}

/** Projects lon/lat features into a box of the given width, returns rings + bbox. */
function project(features, width, lat0) {
  const k = Math.cos((lat0 * Math.PI) / 180);
  const pts = features.flatMap((f) => polygonsOf(f.geometry).flatMap((p) => p.flat()));
  const xs = pts.map(([lon]) => lon * k);
  const ys = pts.map(([, lat]) => -lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const scale = width / (Math.max(...xs) - minX);
  const height = (Math.max(...ys) - minY) * scale;
  const proj = ([lon, lat]) => [(lon * k - minX) * scale, (-lat - minY) * scale];
  return { proj, height };
}

function shape(feature, proj, tolerance) {
  const polys = polygonsOf(feature.geometry).map((poly) => poly.map((ring) => simplify(ring.map(proj), tolerance)));
  const outer = polys.map((p) => p[0]).sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0];
  let c = centroid(outer);
  if (!inside(c, outer)) c = outer.reduce((s, p) => [s[0] + p[0] / outer.length, s[1] + p[1] / outer.length], [0, 0]);
  const area = polys.reduce((s, p) => s + Math.abs(ringArea(p[0])), 0);
  const round = (v) => Math.round(v * 10) / 10;
  return {
    rings: polys.flatMap((p) => p.map((r) => r.map(([x, y]) => [round(x), round(y)]).flat())),
    center: [round(c[0]), round(c[1])],
    area: Math.round(area),
  };
}

const [mainArg = 'departements-version-simplifiee.geojson', overseasArg = 'departements-avec-outre-mer.geojson'] = process.argv.slice(2);
const mainland = (await load(mainArg)).features;
const overseas = (await load(overseasArg)).features.filter((f) => OVERSEAS.includes(f.properties.code));

// Adjacency and outer border from the unsimplified, topologically snapped source.
const vertexOwners = new Map();
const edgeCount = new Map();
for (const f of mainland) {
  const code = f.properties.code;
  for (const poly of polygonsOf(f.geometry)) {
    for (const ring of poly) {
      for (let i = 0; i < ring.length; i++) {
        const key = ring[i].map((v) => v.toFixed(4)).join(',');
        if (!vertexOwners.has(key)) vertexOwners.set(key, new Set());
        vertexOwners.get(key).add(code);
        if (i > 0) {
          const prev = ring[i - 1].map((v) => v.toFixed(4)).join(',');
          const e = prev < key ? `${prev}|${key}` : `${key}|${prev}`;
          if (!edgeCount.has(e)) edgeCount.set(e, { n: 0, code });
          edgeCount.get(e).n++;
        }
      }
    }
  }
}
const neighbors = new Map(mainland.map((f) => [f.properties.code, new Set()]));
for (const owners of vertexOwners.values()) {
  for (const a of owners) for (const b of owners) if (a !== b) neighbors.get(a).add(b);
}
for (const [a, b] of SEA_LINKS) {
  neighbors.get(a).add(b);
  neighbors.get(b).add(a);
}
const borderCodes = new Set([...edgeCount.values()].filter((e) => e.n === 1).map((e) => e.code));

const regionOf = {};
for (const [region, codes] of Object.entries(REGIONS)) for (const c of codes) regionOf[c] = region;

const WIDTH = 1000;
const main = project(mainland, WIDTH, 46.5);
const departements = mainland
  .map((f) => {
    const code = f.properties.code;
    return {
      code,
      name: f.properties.nom,
      region: regionOf[code],
      ...shape(f, main.proj, 1.6),
      neighbors: [...neighbors.get(code)].sort(),
      border: borderCodes.has(code),
      overseas: false,
    };
  })
  .sort((a, b) => a.code.localeCompare(b.code));

for (const f of overseas) {
  const lat = polygonsOf(f.geometry)[0][0][0][1];
  const p = project([f], 100, lat);
  departements.push({ code: f.properties.code, name: f.properties.nom, region: 'Outre-mer', ...shape(f, p.proj, 0.6), box: [100, Math.round(p.height)], neighbors: [], border: false, overseas: true });
}

const missing = Object.keys(regionOf).filter((c) => !departements.some((d) => d.code === c));
if (missing.length) throw new Error(`Départements manquants : ${missing.join(', ')}`);

const points = departements.reduce((s, d) => s + d.rings.reduce((t, r) => t + r.length / 2, 0), 0);
const header = `// GÉNÉRÉ par tools/build-france-map.mjs — ne pas modifier à la main.
// Tracés : IGN Admin Express (via github.com/gregoiredavid/france-geojson), Licence Ouverte / Etalab.
// Coordonnées projetées : métropole dans une boîte ${WIDTH} × ${Math.round(main.height)}, outre-mer dans des boîtes de 100 de large.
`;
const body = `export const MAP_SIZE = [${WIDTH}, ${Math.round(main.height)}];\nexport const DEPARTEMENTS = ${JSON.stringify(departements)};\n`;
const out = path.join(ROOT, 'public/src/france/departements.js');
await writeFile(out, header + body);
console.log(`${departements.length} départements, ${points} points, ${(Buffer.byteLength(body) / 1024).toFixed(0)} Ko → ${path.relative(ROOT, out)}`);
