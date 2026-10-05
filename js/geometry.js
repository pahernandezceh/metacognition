// Geometry of the five Platonic solids, the windows model and quaternion helpers.
//
// The object of study is a unit sphere at the origin. Each frame of
// observation is a FACE of a regular polyhedron around it: a window that only
// shows the part of the object behind it. For a regular polyhedron every face
// is at the same distance from the centre, so the window a point p of the
// sphere is seen through is simply the face whose normal is closest to p
// (argmax of dot(p, n)). The windows tile the object: together they see all
// of it, none of them sees it whole. EDGES are where two frames intersect.
//
// The object and the polyhedron can rotate independently; findings are pinned
// to the object, so rotating it carries one frame's findings in front of
// another frame's window.
//
// Pure module (no DOM, no three.js) so it can be tested with `node --test`.

const PHI = (1 + Math.sqrt(5)) / 2;
const IPHI = 1 / PHI;

/** Ordered by number of frames (faces): 4, 6, 8, 12, 20. */
export const SOLID_IDS = ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron'];

/** Distance from the centre to every window; the object has radius 1. */
export const INRADIUS = 1.12;

const signs = [-1, 1];

const RAW_VERTICES = {
  tetrahedron: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
  cube: signs.flatMap(x => signs.flatMap(y => signs.map(z => [x, y, z]))),
  octahedron: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  dodecahedron: [
    ...signs.flatMap(x => signs.flatMap(y => signs.map(z => [x, y, z]))),
    ...signs.flatMap(a => signs.map(b => [0, a * IPHI, b * PHI])),
    ...signs.flatMap(a => signs.map(b => [a * IPHI, b * PHI, 0])),
    ...signs.flatMap(a => signs.map(b => [a * PHI, 0, b * IPHI])),
  ],
  icosahedron: [
    ...signs.flatMap(a => signs.map(b => [0, a, b * PHI])),
    ...signs.flatMap(a => signs.map(b => [a, b * PHI, 0])),
    ...signs.flatMap(a => signs.map(b => [a * PHI, 0, b])),
  ],
};

// ── Vectors ─────────────────────────────────────────────────────────────────

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export function normalize(v) {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

// ── Quaternions [x, y, z, w] ───────────────────────────────────────────────

export const IDENTITY = [0, 0, 0, 1];

export function qMul(a, b) {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export const qConj = q => [-q[0], -q[1], -q[2], q[3]];

export function qNormalize(q) {
  const len = Math.hypot(...q) || 1;
  return q.map(c => c / len);
}

/** Rotates vector `v` by unit quaternion `q`. */
export function qRotate(q, v) {
  const u = [q[0], q[1], q[2]];
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, q[3])), cross(u, t));
}

/** Shortest rotation taking unit vector `a` onto unit vector `b`. */
export function qFromUnitVectors(a, b) {
  const d = dot(a, b);
  if (d < -0.999999) {
    const axis = normalize(Math.abs(a[0]) > 0.9 ? cross(a, [0, 1, 0]) : cross(a, [1, 0, 0]));
    return [...axis, 0];
  }
  return qNormalize([...cross(a, b), 1 + d]);
}

// ── Solids ──────────────────────────────────────────────────────────────────

const EPS = 1e-9;

/** Faces of the convex hull of `vertices` (unit vectors), with ordered vertex loops. */
function computeFaces(vertices) {
  const n = vertices.length;
  const faces = [];
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      for (let c = b + 1; c < n; c++) {
        let normal = cross(sub(vertices[b], vertices[a]), sub(vertices[c], vertices[a]));
        if (Math.hypot(...normal) < EPS) continue;
        normal = normalize(normal);
        let d = dot(normal, vertices[a]);
        if (d < 0) { normal = scale(normal, -1); d = -d; }
        if (vertices.some(v => dot(normal, v) > d + 1e-7)) continue;
        if (faces.some(f => dot(f.normal, normal) > 1 - 1e-7)) continue;
        const verts = vertices.map((v, i) => i).filter(i => Math.abs(dot(normal, vertices[i]) - d) < 1e-7);
        faces.push({ normal, verts, d });
      }
    }
  }
  for (const f of faces) {
    // Order the loop counter-clockwise seen from outside.
    const centre = normalize(f.verts.reduce((s, i) => add(s, vertices[i]), [0, 0, 0]));
    const u = normalize(sub(vertices[f.verts[0]], scale(f.normal, dot(f.normal, vertices[f.verts[0]]))));
    const w = cross(f.normal, u);
    const angle = i => {
      const p = vertices[i];
      return Math.atan2(dot(p, w), dot(p, u));
    };
    f.verts.sort((i, j) => angle(i) - angle(j));
    f.centre = centre;
  }
  return faces;
}

const cache = new Map();

/**
 * @returns {{
 *   id: string,
 *   vertices: number[][],      polyhedron corners, scaled so every face lies at INRADIUS
 *   faces: {normal: number[], verts: number[]}[],
 *   edges: {a: number, b: number, verts: number[]}[],   pairs of adjacent faces
 *   opposites: number[][],     pairs of parallel faces
 *   circumradius: number,
 *   windowAngle: number,       angular radius of the circle inscribed in one window
 * }}
 */
export function getSolid(id) {
  if (!RAW_VERTICES[id]) throw new Error(`Unknown solid: ${id}`);
  if (!cache.has(id)) {
    const unit = RAW_VERTICES[id].map(normalize);
    const raw = computeFaces(unit);
    // Stable order: top to bottom, then around.
    raw.sort((p, q) => q.normal[1] - p.normal[1] || Math.atan2(p.normal[2], p.normal[0]) - Math.atan2(q.normal[2], q.normal[0]));
    const k = INRADIUS / raw[0].d;
    const vertices = unit.map(v => scale(v, k));
    const faces = raw.map(f => ({ normal: f.normal, verts: f.verts }));
    const edges = [];
    for (let a = 0; a < faces.length; a++) {
      for (let b = a + 1; b < faces.length; b++) {
        const shared = faces[a].verts.filter(v => faces[b].verts.includes(v));
        if (shared.length === 2) edges.push({ a, b, verts: shared });
      }
    }
    const opposites = [];
    for (let a = 0; a < faces.length; a++) {
      for (let b = a + 1; b < faces.length; b++) {
        if (dot(faces[a].normal, faces[b].normal) < -0.999) opposites.push([a, b]);
      }
    }
    const e = edges[0];
    const windowAngle = Math.acos(Math.min(1, dot(faces[e.a].normal, faces[e.b].normal))) / 2;
    cache.set(id, { id, vertices, faces, edges, opposites, circumradius: k, windowAngle });
  }
  return cache.get(id);
}

export const faceCount = id => getSolid(id).faces.length;

/** Index of the window (face) a unit direction is seen through. */
export function windowOf(p, normals) {
  let best = -1;
  let max = -Infinity;
  normals.forEach((n, i) => {
    const d = dot(p, n);
    if (d > max) { max = d; best = i; }
  });
  return best;
}

/** Face normals of `solidId` after rotating the polyhedron by `polyQ`. */
export const worldNormals = (solidId, polyQ) => getSolid(solidId).faces.map(f => qRotate(polyQ, f.normal));

/** Window through which a point pinned to the object (object-local `pos`) is seen now. */
export function windowOfFinding(pos, objectQ, normals) {
  return windowOf(qRotate(objectQ, pos), normals);
}

/**
 * Where to pin the k-th finding of a window: a Vogel spiral around the centre
 * of the window, kept well inside it. Returns an object-local unit vector.
 */
export function placeFinding(solidId, faceIndex, k, objectQ = IDENTITY, polyQ = IDENTITY) {
  const solid = getSolid(solidId);
  const centre = qRotate(polyQ, solid.faces[faceIndex].normal);
  const tangent = normalize(Math.abs(centre[1]) > 0.9 ? cross(centre, [1, 0, 0]) : cross(centre, [0, 1, 0]));
  const bitangent = cross(centre, tangent);
  const radius = Math.min(solid.windowAngle * 0.62, 0.17 * Math.sqrt(k));
  const azimuth = k * Math.PI * (3 - Math.sqrt(5));
  const offset = add(scale(tangent, Math.cos(azimuth)), scale(bitangent, Math.sin(azimuth)));
  const world = normalize(add(scale(centre, Math.cos(radius)), scale(offset, Math.sin(radius))));
  return qRotate(qConj(objectQ), world);
}

/** Object rotation that brings the object-local point `pos` to the centre of window `faceIndex`. */
export function rotationToWindow(pos, faceIndex, solidId, objectQ, polyQ) {
  const now = qRotate(objectQ, pos);
  const target = qRotate(polyQ, getSolid(solidId).faces[faceIndex].normal);
  return qNormalize(qMul(qFromUnitVectors(normalize(now), target), objectQ));
}
