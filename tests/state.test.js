import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, ensureFrames, visibleFrames, visibleFindings, normalizeState, toJSON, pairKey,
  currentEdges, addFinding, addReread, encodeShare, decodeShare, FORMAT,
} from '../js/state.js';
import { buildExample, EXAMPLE_IDS } from '../js/examples.js';
import { getSolid, worldNormals, windowOfFinding, qNormalize } from '../js/geometry.js';

test('a new state has one frame per face, each with its own colour', () => {
  const s = createState('dodecahedron');
  assert.equal(s.frames.length, 12);
  assert.equal(new Set(s.frames.map(f => f.id)).size, 12);
  assert.deepEqual(s.frames.map(f => f.color), [...Array(12).keys()]);
});

test('switching to a smaller solid keeps the extra frames and their findings off-stage', () => {
  const s = createState('cube');
  s.frames[5].name = 'Kept';
  addFinding(s, 5).text = 'Still here';
  s.solid = 'tetrahedron';
  ensureFrames(s);
  assert.equal(visibleFrames(s).length, 4);
  assert.equal(visibleFindings(s).length, 0);
  const json = toJSON(s);
  assert.equal(json.frames.length, 5, 'empty hidden frames are not exported');
  assert.equal(json.findings.length, 1);
  s.solid = 'cube';
  assert.equal(visibleFrames(s)[5].name, 'Kept');
  assert.equal(visibleFindings(s).length, 1);
});

test('a finding is pinned where its window looks now, even after turning', () => {
  const s = createState('octahedron');
  s.view.object = qNormalize([0.2, -0.5, 0.1, 0.8]);
  s.view.poly = qNormalize([-0.3, 0.1, 0.4, 0.7]);
  const normals = worldNormals('octahedron', s.view.poly);
  for (let face = 0; face < 8; face++) {
    const f = addFinding(s, face);
    assert.equal(windowOfFinding(f.pos, s.view.object, normals), face);
  }
});

test('re-reading reuses an empty draft from the same frame', () => {
  const s = createState('cube');
  const f = addFinding(s, 0);
  const r1 = addReread(f, s.frames[1].id);
  assert.equal(addReread(f, s.frames[1].id), r1);
  r1.text = 'done';
  assert.notEqual(addReread(f, s.frames[1].id), r1);
  assert.equal(toJSON(s).findings.length, 1, 'kept because it has a re-reading');
  assert.equal(toJSON(s).findings[0].rereads.length, 1, 'empty drafts are not exported');
});

test('pair keys are symmetric', () => {
  assert.equal(pairKey('a', 'b'), pairKey('b', 'a'));
});

test('normalizeState rejects foreign files and sanitizes input', () => {
  assert.throws(() => normalizeState({ hello: 'world' }));
  assert.throws(() => normalizeState(null));
  assert.throws(() => normalizeState({ format: FORMAT, version: 1 }), 'the vertex-based draft format is not accepted');
  const s = normalizeState({
    format: FORMAT,
    version: 2,
    solid: 'nonsense',
    object: { name: 42 },
    frames: [{ id: 'x', name: 'A', color: 3 }, { id: 'x', name: 'B', color: 3 }],
    findings: [
      { id: 'f', frame: 'x', text: 'ok', tags: ['key', 'bogus'], pos: [0, 2, 0], rereads: [
        { frame: 'x', text: 'self' },
        { frame: 'ghost', text: 'lost' },
      ] },
      { id: 'g', frame: 'ghost', text: 'lost' },
    ],
    edges: { 'x|ghost': { tension: 'lost' } },
    principal: 'ghost',
    view: { object: [0, 0, 0, 0], poly: 'nope' },
  });
  assert.equal(s.solid, 'cube');
  assert.equal(s.object.name, '');
  assert.equal(s.frames.length, 6);
  assert.notEqual(s.frames[0].id, s.frames[1].id, 'duplicate ids are replaced');
  assert.notEqual(s.frames[0].color, s.frames[1].color, 'duplicate colours are replaced');
  assert.equal(s.findings.length, 1);
  assert.deepEqual(s.findings[0].tags, ['key']);
  assert.deepEqual(s.findings[0].pos, [0, 1, 0]);
  assert.equal(s.findings[0].rereads.length, 0, 'a frame cannot re-read itself; unknown frames are dropped');
  assert.deepEqual(s.edges, {});
  assert.equal(s.principal, null);
  assert.deepEqual(s.view, { object: [0, 0, 0, 1], poly: [0, 0, 0, 1] });
});

test('files from the first prototype are migrated: frames become faces', () => {
  const legacy = {
    object: 'Agua',
    solid: 8,
    vertices: {
      0: { name: 'Hidrológico', notes: 'Puede ver: ciclos.\nNo puede ver: conflictos.\nPregunta clave: ¿Cuánta hay?' },
      1: { name: 'Libre', notes: 'Texto sin estructura' },
    },
  };
  const s = normalizeState(legacy);
  assert.equal(s.solid, 'cube', 'the old octahedron had six frames');
  assert.equal(s.object.name, 'Agua');
  assert.equal(s.frames[0].name, 'Hidrológico');
  assert.equal(s.frames[0].question, '¿Cuánta hay?');
  assert.equal(s.frames[0].focus, 'No ve: conflictos.');
  assert.deepEqual(s.findings.map(f => f.text), ['ciclos.', 'Texto sin estructura']);
  const normals = worldNormals('cube', s.view.poly);
  assert.equal(windowOfFinding(s.findings[0].pos, s.view.object, normals), 0);
});

test('share codes round-trip', async () => {
  for (const id of EXAMPLE_IDS) {
    const s = buildExample(id, 'en');
    s.view.object = qNormalize([0.1, 0.2, 0.3, 0.9]);
    const back = await decodeShare(await encodeShare(s));
    assert.deepEqual(toJSON(back), toJSON(s));
  }
});

test('examples are complete in both languages and consistent with their solids', () => {
  for (const id of EXAMPLE_IDS) {
    const es = buildExample(id, 'es');
    const en = buildExample(id, 'en');
    assert.equal(es.frames.length, getSolid(es.solid).faces.length);
    for (const key of ['frames', 'findings']) assert.deepEqual(es[key].map(f => f.id), en[key].map(f => f.id));
    assert.deepEqual(Object.keys(es.edges), Object.keys(en.edges));
    const edgeKeys = new Set(currentEdges(es).map(e => e.key));
    for (const key of Object.keys(es.edges)) assert.ok(edgeKeys.has(key), `${id}: ${key} is not an edge`);
    const normals = worldNormals(es.solid, es.view.poly);
    for (const s of [es, en]) {
      for (const f of s.frames) for (const k of ['name', 'focus', 'question']) assert.ok(f[k], `${id} ${k}`);
      for (const f of s.findings) {
        assert.ok(f.text);
        assert.equal(s.frames[windowOfFinding(f.pos, s.view.object, normals)].id, f.frame, 'pinned in its own window');
        for (const r of f.rereads) assert.ok(r.text && r.frame !== f.frame);
      }
    }
    assert.deepEqual(toJSON(normalizeState(toJSON(es))), toJSON(es));
  }
});
