import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SOLID_IDS, getSolid, vertexCount, capCos, capFraction, coverage, principalAnalysis, fibonacciSphere, dot,
  DEFAULT_DISTANCE, MIN_DISTANCE, MAX_DISTANCE,
} from '../js/geometry.js';

const EXPECTED = {
  tetrahedron: { v: 4, e: 6, opposites: 0 },
  octahedron: { v: 6, e: 12, opposites: 3 },
  cube: { v: 8, e: 12, opposites: 4 },
  icosahedron: { v: 12, e: 30, opposites: 6 },
  dodecahedron: { v: 20, e: 30, opposites: 10 },
};

const all = n => Array(n).fill(true);

test('each Platonic solid has the right number of vertices, edges and opposite pairs', () => {
  for (const id of SOLID_IDS) {
    const s = getSolid(id);
    assert.equal(s.vertices.length, EXPECTED[id].v, id);
    assert.equal(vertexCount(id), EXPECTED[id].v, id);
    assert.equal(s.edges.length, EXPECTED[id].e, id);
    assert.equal(s.opposites.length, EXPECTED[id].opposites, id);
  }
});

test('vertices are unit vectors and every vertex has the same degree', () => {
  for (const id of SOLID_IDS) {
    const { vertices, edges } = getSolid(id);
    for (const v of vertices) assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-12, id);
    const degree = vertices.map((_, i) => edges.filter(e => e.includes(i)).length);
    assert.equal(new Set(degree).size, 1, `${id} is not vertex-regular`);
  }
});

test('all edges of a solid have the same length', () => {
  for (const id of SOLID_IDS) {
    const { vertices, edges } = getSolid(id);
    const lengths = edges.map(([a, b]) => 1 - dot(vertices[a], vertices[b]));
    assert.ok(Math.max(...lengths) - Math.min(...lengths) < 1e-9, id);
  }
});

test('the visible cap grows with distance but never reaches a hemisphere', () => {
  assert.equal(capCos(2), 0.5);
  assert.ok(capFraction(MIN_DISTANCE) < capFraction(DEFAULT_DISTANCE));
  assert.ok(capFraction(DEFAULT_DISTANCE) < capFraction(MAX_DISTANCE));
  assert.ok(capFraction(MAX_DISTANCE) < 0.5);
});

test('fibonacci samples lie on the unit sphere and are balanced', () => {
  const pts = fibonacciSphere(2000);
  const mean = [0, 1, 2].map(k => pts.reduce((s, p) => s + p[k], 0) / pts.length);
  for (const p of pts) assert.ok(Math.abs(Math.hypot(...p) - 1) < 1e-12);
  for (const m of mean) assert.ok(Math.abs(m) < 0.01);
});

test('a single frame sees exactly its cap', () => {
  const { vertices } = getSolid('octahedron');
  const mask = [true, false, false, false, false, false];
  const c = coverage(vertices, mask, 2);
  assert.ok(Math.abs(c.covered - capFraction(2)) < 0.01);
  assert.equal(c.dialogue, 0);
  assert.equal(c.maxOverlap, 1);
});

test('without named frames nothing is seen', () => {
  const { vertices } = getSolid('cube');
  const c = coverage(vertices, Array(8).fill(false), DEFAULT_DISTANCE);
  assert.deepEqual([c.covered, c.blind, c.activeCount], [0, 1, 0]);
});

test('four frames leave a collective blind spot; twelve do not', () => {
  const tetra = getSolid('tetrahedron');
  const icosa = getSolid('icosahedron');
  assert.ok(coverage(tetra.vertices, all(4), DEFAULT_DISTANCE).blind > 0.2);
  assert.equal(coverage(icosa.vertices, all(12), DEFAULT_DISTANCE).blind, 0);
});

test('moving the frames away shrinks the blind spot and widens the dialogue zones', () => {
  const { vertices } = getSolid('tetrahedron');
  const near = coverage(vertices, all(4), 1.6);
  const far = coverage(vertices, all(4), 2.4);
  assert.ok(far.blind < near.blind);
  assert.ok(far.dialogue > near.dialogue);
  assert.equal(near.dialogue, 0, 'neighbouring tetrahedron caps do not touch at 1.6');
});

test('the dialogue path starts with the opposite frame and adds up', () => {
  const { vertices } = getSolid('octahedron');
  const a = principalAnalysis(vertices, all(6), 0, DEFAULT_DISTANCE);
  assert.equal(a.path[0].index, 1, 'vertex 1 is antipodal to vertex 0');
  assert.equal(a.path.length, 5);
  for (let i = 1; i < a.path.length; i++) assert.ok(a.path[i].gain <= a.path[i - 1].gain + 1e-12);
  const last = a.path.at(-1).total;
  assert.ok(Math.abs(last + a.uncovered - 1) < 1e-12);
  const c = coverage(vertices, all(6), DEFAULT_DISTANCE);
  assert.ok(Math.abs(last - c.covered) < 1e-12);
});

test('the dialogue path ignores unnamed frames', () => {
  const { vertices } = getSolid('octahedron');
  const mask = [true, false, true, true, false, false];
  const a = principalAnalysis(vertices, mask, 0, DEFAULT_DISTANCE);
  assert.deepEqual(a.path.map(p => p.index).sort(), [2, 3]);
});
