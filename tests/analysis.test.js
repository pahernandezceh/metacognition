import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crossMatrix, unread, totals, tagCounts, contradicted, hashtags, principalReading } from '../js/analysis.js';
import { buildExample } from '../js/examples.js';
import { createState, addFinding, addReread } from '../js/state.js';

// Sustainability on the cube, face order:
// 0 Sociocultural · 1 Political-legal · 2 Economic · 3 Technological · 4 Ecological · 5 Philosophical
const S = () => buildExample('sustainability', 'en');


test('crossed glances: rows are whose finding, columns who re-read it', () => {
  const m = crossMatrix(S());
  assert.equal(m[2][4], 1, 'economic finding re-read from ecological');
  assert.equal(m[2][0], 1, 'economic finding re-read from sociocultural');
  assert.equal(m[2][1], 1, 'economic finding re-read from political-legal');
  assert.equal(m[0][2], 1, 'sociocultural finding re-read from economic');
  assert.equal(m[3][4], 1);
  for (let i = 0; i < 6; i++) assert.equal(m[i][i], 0);
});

test('unread findings are the blind spot of the analysis', () => {
  const pending = unread(S()).map(f => f.id);
  assert.deepEqual(pending, ['sustainability-f3', 'sustainability-f5', 'sustainability-f9']);
  assert.deepEqual(totals(S()), { findings: 10, rereads: 10, unread: 3 });
});

test('signals: symbols are counted and contradictions listed', () => {
  const counts = tagCounts(S());
  assert.equal(counts.contradicts, 1);
  assert.equal(counts.extends, 4);
  assert.deepEqual(contradicted(S()).map(f => f.id), ['sustainability-f8']);
});

test('hashtags are collected from findings and re-readings', () => {
  const s = createState('cube');
  const f = addFinding(s, 0);
  f.text = 'Water #agua and #Water again #agua';
  addReread(f, s.frames[1].id).text = 'see #riesgo-hídrico';
  assert.deepEqual(hashtags(s), [['agua', 2], ['riesgo-hídrico', 1], ['water', 1]]);
});

test('the main frame’s reading shows who has not crossed glances yet', () => {
  // AI in education: 0 Pedagogical · 1 Technical · 2 Ethical-political · 3 Epistemological
  const r = principalReading(buildExample('ai', 'en'), 0);
  assert.equal(r.ownFindings, 2);
  assert.equal(r.readByOthers, 1);
  assert.equal(r.rereadsMade, 2);
  assert.deepEqual(r.notReadingYou, [2]);
  assert.deepEqual(r.notReadByYou, [2]);
});
