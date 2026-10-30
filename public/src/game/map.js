// Hexagonal territory map (pointy-top, "odd-r" offset layout).

const SQRT3 = Math.sqrt(3);

const NEIGHBOR_OFFSETS = [
  [[1, 0], [-1, 0], [0, -1], [-1, -1], [0, 1], [-1, 1]], // even rows
  [[1, 0], [-1, 0], [1, -1], [0, -1], [1, 1], [0, 1]], // odd rows
];

function bfsDistances(territories, startId, passable = () => true) {
  const dist = new Map([[startId, 0]]);
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift();
    for (const n of territories[id].neighbors) {
      if (!dist.has(n) && passable(territories[n])) {
        dist.set(n, dist.get(id) + 1);
        queue.push(n);
      }
    }
  }
  return dist;
}

function buildGrid(cols, rows, layout, holeAt) {
  const radius = Math.min(layout.width / (SQRT3 * (cols + 0.5)), layout.height / (1.5 * (rows - 1) + 2));
  const gridW = SQRT3 * radius * (cols + 0.5);
  const gridH = 1.5 * radius * (rows - 1) + 2 * radius;
  const ox = layout.x + (layout.width - gridW) / 2 + (SQRT3 * radius) / 2;
  const oy = layout.y + (layout.height - gridH) / 2 + radius;

  const byCell = new Map();
  const territories = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (holeAt(col, row)) continue;
      const t = {
        id: territories.length,
        col,
        row,
        x: ox + SQRT3 * radius * (col + 0.5 * (row & 1)),
        y: oy + 1.5 * radius * row,
        neighbors: [],
        owner: null,
        garrison: 0,
        capital: false,
      };
      byCell.set(`${col},${row}`, t.id);
      territories.push(t);
    }
  }
  for (const t of territories) {
    for (const [dc, dr] of NEIGHBOR_OFFSETS[t.row & 1]) {
      const n = byCell.get(`${t.col + dc},${t.row + dr}`);
      if (n !== undefined) t.neighbors.push(n);
    }
  }
  return { territories, byCell, radius };
}

/**
 * Generates a symmetric-ish map: capital A at the bottom, capital B at the top,
 * a few "lakes" (holes) for an organic shape, always fully connected.
 */
export function generateMap({ cols, rows, holes }, rng, layout, economy) {
  const midCol = Math.floor(cols / 2);
  const capA = [midCol, rows - 1];
  const capB = [midCol, 0];
  const protectedCell = (c, r) => Math.abs(r - capA[1]) + Math.abs(c - capA[0]) <= 1 || Math.abs(r - capB[1]) + Math.abs(c - capB[0]) <= 1;

  for (let attempt = 0; attempt < 20; attempt++) {
    const holeSet = new Set();
    if (attempt < 19) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!protectedCell(c, r) && rng() < holes) {
            holeSet.add(`${c},${r}`);
            // mirror holes so neither side gets a geographic advantage
            holeSet.add(`${cols - 1 - c},${rows - 1 - r}`);
          }
        }
      }
    }
    const grid = buildGrid(cols, rows, layout, (c, r) => holeSet.has(`${c},${r}`));
    const a = grid.byCell.get(capA.join(','));
    const b = grid.byCell.get(capB.join(','));
    const fromA = bfsDistances(grid.territories, a);
    if (!fromA.has(b) || fromA.size !== grid.territories.length) continue;

    const map = { territories: grid.territories, radius: grid.radius, capitals: { A: a, B: b } };
    resetOwnership(map, rng, economy);
    return map;
  }
  throw new Error('Unable to generate a connected map');
}

export function resetOwnership(map, rng, economy) {
  const { territories, capitals } = map;
  const dA = bfsDistances(territories, capitals.A);
  const dB = bfsDistances(territories, capitals.B);
  for (const t of territories) {
    const da = dA.get(t.id);
    const db = dB.get(t.id);
    t.capital = t.id === capitals.A || t.id === capitals.B;
    t.owner = da <= 2 && da < db ? 'A' : db <= 2 && db < da ? 'B' : null;
    t.garrison = t.owner ? economy.startGarrison : rng.int(economy.neutralGarrison[0], economy.neutralGarrison[1]);
    if (t.capital) t.garrison = economy.capitalGarrison;
    t.flash = 0;
    t.flashOwner = null;
  }
  map.distToCapital = { A: dA, B: dB };
}

export function hexCorners(x, y, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push([x + r * Math.cos(angle), y + r * Math.sin(angle)]);
  }
  return pts;
}

export { bfsDistances };
