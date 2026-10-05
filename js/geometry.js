// Geometry of the five Platonic solids and the visibility model.
//
// The object of study is a unit sphere at the origin. Each observation frame
// sits on a vertex of a regular polyhedron whose circumradius is `distance`.
// From a point at distance d of a unit sphere you see a spherical cap of
// angular radius arccos(1/d): close up you see a small patch (in depth),
// far away almost a hemisphere (broad but shallow). Never the whole object.
//
// Pure module (no DOM, no three.js) so it can be tested with `node --test`.

const PHI = (1 + Math.sqrt(5)) / 2;
const IPHI = 1 / PHI;

export const SOLID_IDS = ['tetrahedron', 'octahedron', 'cube', 'icosahedron', 'dodecahedron'];

export const MIN_DISTANCE = 1.15;
export const MAX_DISTANCE = 3.2;
export const DEFAULT_DISTANCE = 1.6;

const signs = [-1, 1];

const RAW_VERTICES = {
  tetrahedron: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
  octahedron: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  cube: signs.flatMap(x => signs.flatMap(y => signs.map(z => [x, y, z]))),
  icosahedron: [
    ...signs.flatMap(a => signs.map(b => [0, a, b * PHI])),
    ...signs.flatMap(a => signs.map(b => [a, b * PHI, 0])),
    ...signs.flatMap(a => signs.map(b => [a * PHI, 0, b])),
  ],
  dodecahedron: [
    ...signs.flatMap(x => signs.flatMap(y => signs.map(z => [x, y, z]))),
    ...signs.flatMap(a => signs.map(b => [0, a * IPHI, b * PHI])),
    ...signs.flatMap(a => signs.map(b => [a * IPHI, b * PHI, 0])),
    ...signs.flatMap(a => signs.map(b => [a * PHI, 0, b * IPHI])),
  ],
};

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

// In a regular polyhedron the edges are exactly the vertex pairs at minimum distance.
function computeEdges(vertices) {
  const pairs = [];
  let min = Infinity;
  for (let a = 0; a < vertices.length; a++) {
    for (let b = a + 1; b < vertices.length; b++) {
      const d = 1 - dot(vertices[a], vertices[b]);
      pairs.push([a, b, d]);
      if (d < min) min = d;
    }
  }
  return pairs.filter(([, , d]) => d - min < 1e-9).map(([a, b]) => [a, b]);
}

const cache = new Map();

/** @returns {{id: string, vertices: number[][], edges: number[][], opposites: number[][]}} */
export function getSolid(id) {
  if (!RAW_VERTICES[id]) throw new Error(`Unknown solid: ${id}`);
  if (!cache.has(id)) {
    const vertices = RAW_VERTICES[id].map(normalize);
    const edges = computeEdges(vertices);
    const opposites = [];
    for (let a = 0; a < vertices.length; a++) {
      for (let b = a + 1; b < vertices.length; b++) {
        if (dot(vertices[a], vertices[b]) < -0.999) opposites.push([a, b]);
      }
    }
    cache.set(id, { id, vertices, edges, opposites });
  }
  return cache.get(id);
}

export const vertexCount = id => RAW_VERTICES[id].length;

/** Cosine of the angular radius of the cap visible from `distance`. */
export const capCos = distance => 1 / distance;

/** Fraction of the sphere's surface a single frame sees from `distance`. */
export const capFraction = distance => (1 - capCos(distance)) / 2;

/** Quasi-uniform points on the unit sphere (Fibonacci lattice). */
export function fibonacciSphere(n) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const t = golden * i;
    pts.push([Math.cos(t) * r, y, Math.sin(t) * r]);
  }
  return pts;
}

const SAMPLES = fibonacciSphere(8000);

/**
 * How the active frames see the object together.
 * @param {number[][]} dirs unit vectors of the frames
 * @param {boolean[]} active which frames take part (named frames)
 * @returns {{covered: number, blind: number, dialogue: number, activeCount: number, maxOverlap: number}}
 *   fractions of the surface seen by >=1 frame, by none, and by >=2 frames,
 *   plus the largest number of frames that see a single point.
 */
export function coverage(dirs, active, distance, samples = SAMPLES) {
  const c = capCos(distance);
  const idx = dirs.map((_, i) => i).filter(i => active[i]);
  let covered = 0;
  let dialogue = 0;
  let maxOverlap = 0;
  for (const p of samples) {
    let n = 0;
    for (const i of idx) if (dot(p, dirs[i]) >= c) n++;
    if (n >= 1) covered++;
    if (n >= 2) dialogue++;
    if (n > maxOverlap) maxOverlap = n;
  }
  const total = samples.length;
  return {
    covered: covered / total,
    blind: 1 - covered / total,
    dialogue: dialogue / total,
    activeCount: idx.length,
    maxOverlap,
  };
}

/**
 * Metacognitive reading for one's own (principal) frame: how much of the
 * object it sees, and a greedy "dialogue path": at each step, the other
 * frame that would reveal the most of what is still unseen.
 * @returns {{seen: number, path: {index: number, gain: number, total: number}[], uncovered: number}}
 *   All values are fractions of the whole surface; `total` is the cumulative
 *   coverage after adding that frame, `uncovered` what nobody sees in the end.
 */
export function principalAnalysis(dirs, active, principal, distance, samples = SAMPLES) {
  const c = capCos(distance);
  const n = samples.length;
  const sees = i => Uint8Array.from(samples, p => (dot(p, dirs[i]) >= c ? 1 : 0));
  const seenBy = new Uint8Array(n);
  const own = sees(principal);
  let covered = 0;
  for (let k = 0; k < n; k++) if (own[k]) { seenBy[k] = 1; covered++; }
  const seen = covered / n;

  const remaining = new Map(
    dirs.map((_, i) => i).filter(i => i !== principal && active[i]).map(i => [i, sees(i)]),
  );
  const path = [];
  while (remaining.size) {
    let best = -1;
    let bestGain = -1;
    for (const [i, mask] of remaining) {
      let gain = 0;
      for (let k = 0; k < n; k++) if (mask[k] && !seenBy[k]) gain++;
      if (gain > bestGain || (gain === bestGain && i < best)) { best = i; bestGain = gain; }
    }
    const mask = remaining.get(best);
    for (let k = 0; k < n; k++) if (mask[k]) seenBy[k] = 1;
    covered += bestGain;
    remaining.delete(best);
    path.push({ index: best, gain: bestGain / n, total: covered / n });
  }
  return { seen, path, uncovered: 1 - covered / n };
}
