import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SOLID_IDS, INRADIUS, getSolid, faceCount, windowOf, worldNormals, windowOfFinding, placeFinding,
  rotationToWindow, qRotate, qMul, qConj, qNormalize, qFromUnitVectors, dot, normalize, IDENTITY,
} from '../js/geometry.js';

const EXPECTED = {
  tetrahedron: { faces: 4, edges: 6, opposites: 0, sides: 3 },
  cube: { faces: 6, edges: 12, opposites: 3, sides: 4 },
  octahedron: { faces: 8, edges: 12, opposites: 4, sides: 3 },
  dodecahedron: { faces: 12, edges: 30, opposites: 6, sides: 5 },
  icosahedron: { faces: 20, edges: 30, opposites: 10, sides: 3 },
};

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

function fibonacciSphere(n) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    return [Math.cos(golden * i) * r, y, Math.sin(golden * i) * r];
  });
}

const randomQuat = seed => {
  let x = seed;
  const rnd = () => ((x = (x * 16807) % 2147483647) / 2147483647) * 2 - 1;
  return qNormalize([rnd(), rnd(), rnd(), rnd()]);
};

test('each solid has the right faces (frames), edges (intersections) and opposite faces', () => {
  for (const id of SOLID_IDS) {
    const s = getSolid(id);
    const e = EXPECTED[id];
    assert.equal(s.faces.length, e.faces, id);
    assert.equal(faceCount(id), e.faces, id);
    assert.equal(s.edges.length, e.edges, id);
    assert.equal(s.opposites.length, e.opposites, id);
    for (const f of s.faces) assert.equal(f.verts.length, e.sides, id);
    assert.equal(s.vertices.length - s.edges.length + s.faces.length, 2, `${id}: Euler characteristic`);
  }
});

test('every window lies at the same distance in front of the object', () => {
  for (const id of SOLID_IDS) {
    const { faces, vertices } = getSolid(id);
    for (const f of faces) {
      assert.ok(close(Math.hypot(...f.normal), 1), id);
      for (const v of f.verts) assert.ok(close(dot(f.normal, vertices[v]), INRADIUS, 1e-7), id);
      for (const v of vertices) assert.ok(dot(f.normal, v) <= INRADIUS + 1e-7, `${id}: convex`);
    }
  }
});

test('face loops are ordered: consecutive corners are joined by an edge', () => {
  for (const id of SOLID_IDS) {
    const { faces, vertices } = getSolid(id);
    const len = (a, b) => Math.hypot(...vertices[a].map((c, k) => c - vertices[b][k]));
    const edge = len(faces[0].verts[0], faces[0].verts[1]);
    for (const f of faces) {
      f.verts.forEach((v, k) => assert.ok(close(len(v, f.verts[(k + 1) % f.verts.length]), edge, 1e-7), id));
    }
  }
});

test('edges join faces that share a side', () => {
  for (const id of SOLID_IDS) {
    const { faces, edges } = getSolid(id);
    for (const e of edges) {
      for (const v of e.verts) assert.ok(faces[e.a].verts.includes(v) && faces[e.b].verts.includes(v), id);
    }
  }
});

test('the windows tile the object: each shows the same share and none shows it whole', () => {
  const pts = fibonacciSphere(12000);
  for (const id of SOLID_IDS) {
    const normals = getSolid(id).faces.map(f => f.normal);
    const counts = new Array(normals.length).fill(0);
    for (const p of pts) counts[windowOf(p, normals)]++;
    const share = 1 / normals.length;
    for (const c of counts) assert.ok(Math.abs(c / pts.length - share) < 0.01, `${id}: ${c / pts.length}`);
  }
});

test('quaternion helpers', () => {
  const q = randomQuat(7);
  const v = normalize([0.3, -0.4, 0.8]);
  assert.deepEqual(qRotate(IDENTITY, v), v);
  const back = qRotate(qConj(q), qRotate(q, v));
  v.forEach((c, k) => assert.ok(close(c, back[k], 1e-12)));
  const id = qMul(q, qConj(q));
  [0, 0, 0, 1].forEach((c, k) => assert.ok(close(Math.abs(id[k]), c, 1e-12)));
  for (const b of [normalize([1, 2, 3]), v.map(c => -c)]) {
    const r = qRotate(qFromUnitVectors(v, b), v);
    b.forEach((c, k) => assert.ok(close(c, r[k], 1e-9)));
  }
});

test('a new finding is pinned inside the window it was found through, whatever the rotation', () => {
  for (const id of SOLID_IDS) {
    for (let seed = 1; seed < 4; seed++) {
      const objectQ = randomQuat(seed);
      const polyQ = randomQuat(seed + 10);
      const normals = worldNormals(id, polyQ);
      for (let face = 0; face < faceCount(id); face++) {
        for (let k = 0; k < 12; k++) {
          const pos = placeFinding(id, face, k, objectQ, polyQ);
          assert.ok(close(Math.hypot(...pos), 1, 1e-9));
          assert.equal(windowOfFinding(pos, objectQ, normals), face, `${id} face ${face} k ${k}`);
        }
      }
    }
  }
});

test('turning the object can bring any finding to the centre of any other window', () => {
  for (const id of SOLID_IDS) {
    const objectQ = randomQuat(3);
    const polyQ = randomQuat(5);
    const normals = worldNormals(id, polyQ);
    const pos = placeFinding(id, 0, 3, objectQ, polyQ);
    for (let target = 0; target < faceCount(id); target++) {
      const turned = rotationToWindow(pos, target, id, objectQ, polyQ);
      assert.equal(windowOfFinding(pos, turned, normals), target, id);
      assert.ok(dot(qRotate(turned, pos), normals[target]) > 1 - 1e-9, id);
    }
  }
});
