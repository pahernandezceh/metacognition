// Application state: shape, validation/migration, persistence and share links.
// No DOM access at import time, so it can be tested with `node --test`.
//
// Frames are the faces of the polyhedron. Findings are pinned to the object
// (object-local unit vectors) and belong to the frame that found them.
// Re-readings are notes another frame adds to a finding after looking at it
// through its own window. Edges hold notes about the two frames they join.

import { SOLID_IDS, faceCount, getSolid, normalize, placeFinding, IDENTITY, qNormalize } from './geometry.js';

export const FORMAT = 'metacognition';
export const FORMAT_VERSION = 2;
export const STORAGE_KEY = 'metacognition:v2';
export const BACKUP_KEY = 'metacognition:v2:backup';

const MAX_TEXT = 6000;

/** Symbols that can be attached to findings and re-readings. */
export const TAGS = [
  { id: 'confirms', symbol: '✓' },
  { id: 'nuances', symbol: '≈' },
  { id: 'contradicts', symbol: '✗' },
  { id: 'extends', symbol: '+' },
  { id: 'questions', symbol: '?' },
  { id: 'key', symbol: '!' },
  { id: 'risk', symbol: '⚠' },
];
const TAG_IDS = new Set(TAGS.map(t => t.id));
export const tagSymbol = id => TAGS.find(t => t.id === id)?.symbol || '';

export const uid = () => Math.random().toString(36).slice(2, 10);

/** Lowest colour slot not used yet: colours follow the frame, not its position. */
function freeColour(frames) {
  const used = new Set(frames.map(f => f.color));
  let c = 0;
  while (used.has(c)) c++;
  return c;
}

export const emptyFrame = (frames = []) => ({ id: uid(), name: '', focus: '', question: '', color: freeColour(frames) });

/**
 * @typedef {{id: string, name: string, focus: string, question: string, color: number}} Frame
 * @typedef {{id: string, frame: string, text: string, tags: string[]}} Reread
 * @typedef {{id: string, frame: string, text: string, tags: string[], pos: number[], rereads: Reread[]}} Finding
 * @typedef {{
 *   object: {name: string, description: string},
 *   solid: string,
 *   frames: Frame[], findings: Finding[],
 *   edges: Record<string, {tension: string, emerges: string}>,
 *   principal: string|null, synthesis: string,
 *   view: {object: number[], poly: number[]},
 *   meta: {example: string|null, pristine: boolean}
 * }} State
 */

/** @returns {State} */
export function createState(solid = 'cube') {
  return ensureFrames({
    object: { name: '', description: '' },
    solid,
    frames: [],
    findings: [],
    edges: {},
    principal: null,
    synthesis: '',
    view: { object: [...IDENTITY], poly: [...IDENTITY] },
    meta: { example: null, pristine: false },
  });
}

/** Pads `frames` so every face of the current solid has one. Extra frames are kept. */
export function ensureFrames(state) {
  const n = faceCount(state.solid);
  while (state.frames.length < n) state.frames.push(emptyFrame(state.frames));
  return state;
}

/** Frames placed on the faces of the current solid (the rest wait off-stage). */
export const visibleFrames = state => state.frames.slice(0, faceCount(state.solid));

export const isActive = frame => frame.name.trim() !== '';

export const hasContent = (state, frame) =>
  [frame.name, frame.focus, frame.question].some(s => s.trim()) || state.findings.some(f => f.frame === frame.id);

export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export const noteHasContent = n => !!n && (n.text?.trim() || n.tags?.length);

export const edgeHasContent = e => !!e && !!(e.tension?.trim() || e.emerges?.trim());

/** Edges of the current solid, resolved to frame pairs. */
export function currentEdges(state) {
  const frames = state.frames;
  return getSolid(state.solid).edges.map(({ a, b }) => ({ a, b, key: pairKey(frames[a].id, frames[b].id) }));
}

/** Findings whose frame sits on a face of the current solid. */
export function visibleFindings(state) {
  const ids = new Set(visibleFrames(state).map(f => f.id));
  return state.findings.filter(f => ids.has(f.frame));
}

/** Adds an empty finding to frame `faceIndex`, pinned where its window currently looks. */
export function addFinding(state, faceIndex) {
  const frame = state.frames[faceIndex];
  const k = state.findings.filter(f => f.frame === frame.id).length;
  const finding = {
    id: uid(),
    frame: frame.id,
    text: '',
    tags: [],
    pos: placeFinding(state.solid, faceIndex, k, state.view.object, state.view.poly),
    rereads: [],
  };
  state.findings.push(finding);
  return finding;
}

/** Adds an empty re-reading of `finding` by `frameId`, or returns the one already open. */
export function addReread(finding, frameId) {
  const open = finding.rereads.find(r => r.frame === frameId && !noteHasContent(r));
  if (open) return open;
  const reread = { id: uid(), frame: frameId, text: '', tags: [] };
  finding.rereads.push(reread);
  return reread;
}

/** Snapshot without UI-only metadata or empty notes, ready to be exported or shared. */
export function toJSON(state) {
  const n = faceCount(state.solid);
  const keep = new Set(state.frames.filter((f, i) => i < n || hasContent(state, f)).map(f => f.id));
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    object: { ...state.object },
    solid: state.solid,
    frames: state.frames.filter(f => keep.has(f.id)).map(f => ({ ...f })),
    findings: state.findings
      .filter(f => keep.has(f.frame) && (noteHasContent(f) || f.rereads.some(noteHasContent)))
      .map(f => ({
        ...f,
        tags: [...f.tags],
        pos: f.pos.map(c => +c.toFixed(5)),
        rereads: f.rereads.filter(noteHasContent).map(r => ({ ...r, tags: [...r.tags] })),
      })),
    edges: Object.fromEntries(Object.entries(state.edges).filter(([, e]) => edgeHasContent(e))),
    principal: state.principal,
    synthesis: state.synthesis,
    view: { object: state.view.object.map(c => +c.toFixed(5)), poly: state.view.poly.map(c => +c.toFixed(5)) },
  };
}

const str = v => (typeof v === 'string' ? v.slice(0, MAX_TEXT) : '');
const tags = v => (Array.isArray(v) ? [...new Set(v.filter(t => TAG_IDS.has(t)))] : []);

function quat(v) {
  if (!Array.isArray(v) || v.length !== 4 || !v.every(Number.isFinite) || Math.hypot(...v) < 1e-6) return [...IDENTITY];
  return qNormalize(v);
}

function unitVector(v) {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(Number.isFinite) || Math.hypot(...v) < 1e-6) return null;
  return normalize(v);
}

// The first prototype ("Methachritics") put frames on vertices, with free-text
// notes usually written as "Puede ver: … / No puede ver: … / Pregunta clave: …".
// Each old frame becomes a face; what it could see becomes its first finding.
const LEGACY_SOLIDS = { 4: 'tetrahedron', 6: 'octahedron', 8: 'cube', 20: 'dodecahedron' };

function migrateLegacy(raw) {
  const solid = LEGACY_SOLIDS[raw.solid] || 'cube';
  const n = faceCount(solid);
  const frames = [];
  const findings = [];
  for (let i = 0; i < n; i++) {
    const v = (raw.vertices && raw.vertices[i]) || {};
    const frame = { ...emptyFrame(frames), name: str(v.name) };
    const notes = str(v.notes);
    const grab = re => (notes.match(re) || [])[1]?.trim() || '';
    const sees = grab(/^\s*puede ver:\s*(.*)$/im);
    const blind = grab(/no puede ver:\s*(.*)$/im);
    frame.question = grab(/pregunta clave:\s*(.*)$/im);
    frame.focus = blind ? `No ve: ${blind}` : '';
    const text = sees || (!blind && !frame.question ? notes : '');
    if (text) findings.push({ id: uid(), frame: frame.id, text, tags: [], pos: null, rereads: [] });
    frames.push(frame);
  }
  return { object: { name: str(raw.object), description: '' }, solid, frames, findings };
}

/**
 * Validates untrusted input (imported file, shared link, localStorage) and
 * returns a well-formed state. Throws if it is not a Metacognition file.
 * @returns {State}
 */
export function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('invalid');
  let src = raw;
  if (raw.format !== FORMAT) {
    if (raw.vertices && typeof raw.solid === 'number') src = migrateLegacy(raw);
    else throw new Error('invalid');
  } else if (raw.version !== FORMAT_VERSION) {
    throw new Error('invalid');
  }
  const solid = SOLID_IDS.includes(src.solid) ? src.solid : 'cube';

  const ids = new Set();
  const colours = new Set();
  const frames = [];
  for (const f of (Array.isArray(src.frames) ? src.frames : []).slice(0, 40)) {
    let id = typeof f?.id === 'string' && f.id ? f.id.slice(0, 40) : uid();
    if (ids.has(id)) id = uid();
    ids.add(id);
    let color = Number.isInteger(f?.color) && f.color >= 0 && f.color < 100 ? f.color : null;
    if (color === null || colours.has(color)) color = freeColour(frames);
    colours.add(color);
    frames.push({ id, name: str(f?.name), focus: str(f?.focus), question: str(f?.question), color });
  }

  const view = { object: quat(src.view?.object), poly: quat(src.view?.poly) };
  const state = ensureFrames({
    object: { name: str(src.object?.name), description: str(src.object?.description) },
    solid,
    frames,
    findings: [],
    edges: {},
    principal: ids.has(src.principal) ? src.principal : null,
    synthesis: str(src.synthesis),
    view,
    meta: { example: null, pristine: false },
  });

  const seenFindings = new Set();
  for (const f of (Array.isArray(src.findings) ? src.findings : []).slice(0, 500)) {
    if (!ids.has(f?.frame)) continue;
    let id = typeof f.id === 'string' && f.id ? f.id.slice(0, 40) : uid();
    if (seenFindings.has(id)) id = uid();
    seenFindings.add(id);
    const rereads = (Array.isArray(f.rereads) ? f.rereads : []).slice(0, 100)
      .filter(r => ids.has(r?.frame) && r.frame !== f.frame)
      .map(r => ({ id: typeof r.id === 'string' && r.id ? r.id.slice(0, 40) : uid(), frame: r.frame, text: str(r.text), tags: tags(r.tags) }));
    state.findings.push({ id, frame: f.frame, text: str(f.text), tags: tags(f.tags), pos: unitVector(f.pos), rereads });
  }
  // Findings without a position are pinned to their frame's window (home orientation).
  for (const f of state.findings.filter(x => !x.pos)) {
    const face = state.frames.findIndex(fr => fr.id === f.frame);
    const k = state.findings.filter(x => x.frame === f.frame && x.pos).length;
    f.pos = face < faceCount(solid) ? placeFinding(solid, face, k) : [0, 1, 0];
  }

  if (src.edges && typeof src.edges === 'object') {
    for (const [key, e] of Object.entries(src.edges)) {
      const [a, b] = key.split('|');
      if (!ids.has(a) || !ids.has(b) || a === b) continue;
      state.edges[pairKey(a, b)] = { tension: str(e?.tension), emerges: str(e?.emerges) };
    }
  }
  return state;
}

// ── Share links ─────────────────────────────────────────────────────────────
// The whole configuration travels in the URL fragment (never sent to a server),
// deflate-compressed when the browser supports CompressionStream.

const toB64Url = bytes => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64Url = s => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeShare(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(toJSON(state)));
  if (typeof CompressionStream === 'function') {
    return 'z' + toB64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
  }
  return 'j' + toB64Url(bytes);
}

export async function decodeShare(code) {
  const kind = code[0];
  let bytes = fromB64Url(code.slice(1));
  if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'j') throw new Error('invalid');
  return normalizeState(JSON.parse(new TextDecoder().decode(bytes)));
}

// ── Local persistence (best effort: private mode or blocked storage just skip it) ──

export function saveLocal(state, key = STORAGE_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...toJSON(state), meta: state.meta }));
    return true;
  } catch {
    return false;
  }
}

export function loadLocal(key = STORAGE_KEY) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const state = normalizeState(parsed);
    if (parsed.meta && typeof parsed.meta === 'object') {
      state.meta.example = typeof parsed.meta.example === 'string' ? parsed.meta.example : null;
      state.meta.pristine = parsed.meta.pristine === true;
    }
    return state;
  } catch {
    return null;
  }
}

export function readPref(key, fallback = null) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
