// Metacognitive readings of a state: who has looked at whose findings.
// Pure functions, tested with `node --test`.

import { visibleFrames, visibleFindings, noteHasContent, TAGS } from './state.js';

/** Re-readings that actually say something (text or a symbol). */
const rereadsOf = finding => finding.rereads.filter(noteHasContent);

/**
 * matrix[i][j] = how many findings of frame i have been re-read from frame j
 * (indices are face positions of the current solid).
 */
export function crossMatrix(state) {
  const frames = visibleFrames(state);
  const index = new Map(frames.map((f, i) => [f.id, i]));
  const matrix = frames.map(() => frames.map(() => 0));
  for (const finding of visibleFindings(state)) {
    const i = index.get(finding.frame);
    const readers = new Set(rereadsOf(finding).map(r => r.frame).filter(id => index.has(id)));
    for (const id of readers) matrix[i][index.get(id)]++;
  }
  return matrix;
}

/** Findings with content that no other frame has re-read yet. */
export const unread = state =>
  visibleFindings(state).filter(f => noteHasContent(f) && rereadsOf(f).length === 0);

export function totals(state) {
  const findings = visibleFindings(state).filter(f => noteHasContent(f) || rereadsOf(f).length);
  return {
    findings: findings.length,
    rereads: findings.reduce((n, f) => n + rereadsOf(f).length, 0),
    unread: unread(state).length,
  };
}

/** How often each symbol was used, on findings and re-readings. */
export function tagCounts(state) {
  const counts = Object.fromEntries(TAGS.map(t => [t.id, 0]));
  for (const f of visibleFindings(state)) {
    for (const note of [f, ...rereadsOf(f)]) for (const tag of note.tags) counts[tag]++;
  }
  return counts;
}

/** Findings that some other frame contradicted. */
export const contradicted = state =>
  visibleFindings(state).filter(f => rereadsOf(f).some(r => r.tags.includes('contradicts')));

/** #hashtags written in any note, most used first. */
export function hashtags(state) {
  const counts = new Map();
  const texts = [];
  for (const f of visibleFindings(state)) texts.push(f.text, ...f.rereads.map(r => r.text));
  for (const text of texts) {
    for (const [, tag] of text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]{2,40})/gu)) {
      const key = tag.toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * The view from one's own frame: what it has re-read, who re-read it, and
 * which frames it has not crossed glances with yet (in either direction).
 */
export function principalReading(state, frameIndex) {
  const m = crossMatrix(state);
  const n = m.length;
  const others = [...Array(n).keys()].filter(j => j !== frameIndex);
  const own = visibleFindings(state).filter(f => f.frame === visibleFrames(state)[frameIndex].id && noteHasContent(f));
  return {
    ownFindings: own.length,
    readByOthers: own.filter(f => rereadsOf(f).length).length,
    rereadsMade: others.reduce((s, i) => s + m[i][frameIndex], 0),
    notReadingYou: others.filter(j => m[frameIndex][j] === 0),
    notReadByYou: others.filter(i => m[i][frameIndex] === 0),
  };
}
