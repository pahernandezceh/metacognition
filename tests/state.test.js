import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, ensureFrames, visibleFrames, normalizeState, toJSON, pairKey, swapFrames,
  currentEdges, encodeShare, decodeShare, FORMAT,
} from '../js/state.js';
import { buildExample, EXAMPLE_IDS } from '../js/examples.js';
import { getSolid } from '../js/geometry.js';

test('a new state has one frame per vertex', () => {
  const s = createState('icosahedron');
  assert.equal(s.frames.length, 12);
  assert.equal(new Set(s.frames.map(f => f.id)).size, 12);
});

test('switching to a smaller solid keeps the extra frames off-stage', () => {
  const s = createState('cube');
  s.frames[7].name = 'Kept';
  s.solid = 'tetrahedron';
  ensureFrames(s);
  assert.equal(visibleFrames(s).length, 4);
  assert.equal(s.frames.length, 8);
  assert.equal(toJSON(s).frames.length, 5, 'empty hidden frames are not exported');
  s.solid = 'cube';
  assert.equal(visibleFrames(s)[7].name, 'Kept');
});

test('pair keys are symmetric', () => {
  assert.equal(pairKey('a', 'b'), pairKey('b', 'a'));
});

test('dialogues follow their frames when frames swap vertices', () => {
  const s = buildExample('sustainability', 'es');
  const [e] = currentEdges(s);
  const before = s.dialogues[e.key];
  assert.ok(before, 'edge 0-2 has a dialogue in the example');
  const [idA, idB] = [s.frames[e.a].id, s.frames[e.b].id];
  swapFrames(s, e.a, 1);
  assert.deepEqual(s.dialogues[pairKey(idA, idB)], before);
});

test('normalizeState rejects foreign files and sanitizes input', () => {
  assert.throws(() => normalizeState({ hello: 'world' }));
  assert.throws(() => normalizeState(null));
  const s = normalizeState({
    format: FORMAT,
    solid: 'nonsense',
    distance: 99,
    object: { name: 42 },
    frames: [{ id: 'x', name: 'A' }, { id: 'x', name: 'B' }],
    dialogues: { 'x|ghost': { tension: 'lost' } },
    principal: 'ghost',
  });
  assert.equal(s.solid, 'octahedron');
  assert.equal(s.distance, 3.2);
  assert.equal(s.object.name, '');
  assert.equal(s.frames.length, 6);
  assert.notEqual(s.frames[0].id, s.frames[1].id, 'duplicate ids are replaced');
  assert.deepEqual(s.dialogues, {});
  assert.equal(s.principal, null);
});

test('files from the first prototype are migrated', () => {
  const legacy = {
    object: 'Agua',
    solid: 8,
    vertices: {
      0: { name: 'Hidrológico', notes: 'Puede ver: ciclos.\nNo puede ver: conflictos.\nPregunta clave: ¿Cuánta hay?' },
      1: { name: 'Libre', notes: 'Texto sin estructura' },
    },
  };
  const s = normalizeState(legacy);
  assert.equal(s.solid, 'octahedron');
  assert.equal(s.object.name, 'Agua');
  assert.deepEqual(
    [s.frames[0].name, s.frames[0].sees, s.frames[0].blind, s.frames[0].question],
    ['Hidrológico', 'ciclos.', 'conflictos.', '¿Cuánta hay?'],
  );
  assert.equal(s.frames[1].sees, 'Texto sin estructura');
});

test('share codes round-trip', async () => {
  for (const id of EXAMPLE_IDS) {
    const s = buildExample(id, 'en');
    const back = await decodeShare(await encodeShare(s));
    assert.deepEqual(toJSON(back), toJSON(s));
  }
});

test('examples are complete in both languages and fit their solids', () => {
  for (const id of EXAMPLE_IDS) {
    const es = buildExample(id, 'es');
    const en = buildExample(id, 'en');
    assert.equal(es.frames.length, getSolid(es.solid).vertices.length);
    assert.deepEqual(es.frames.map(f => f.id), en.frames.map(f => f.id));
    assert.deepEqual(Object.keys(es.dialogues), Object.keys(en.dialogues));
    const edgeKeys = new Set(currentEdges(es).map(e => e.key));
    for (const key of Object.keys(es.dialogues)) assert.ok(edgeKeys.has(key), `${id}: ${key} is not an edge`);
    for (const s of [es, en]) {
      for (const f of s.frames) for (const k of ['name', 'sees', 'blind', 'question']) assert.ok(f[k], `${id} ${k}`);
    }
  }
});
