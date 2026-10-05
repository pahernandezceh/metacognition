// Application state: shape, validation/migration, persistence and share links.
// No DOM access at import time, so it can be tested with `node --test`.

import { SOLID_IDS, vertexCount, getSolid, DEFAULT_DISTANCE, MIN_DISTANCE, MAX_DISTANCE } from './geometry.js';

export const FORMAT = 'metacognition';
export const FORMAT_VERSION = 1;
export const STORAGE_KEY = 'metacognition:v1';
export const BACKUP_KEY = 'metacognition:backup';

const MAX_TEXT = 6000;
const FRAME_FIELDS = ['name', 'sees', 'blind', 'question'];
const DIALOGUE_FIELDS = ['tension', 'emerges'];

export const uid = () => Math.random().toString(36).slice(2, 10);

export const emptyFrame = () => ({ id: uid(), name: '', sees: '', blind: '', question: '' });

/**
 * @typedef {{id: string, name: string, sees: string, blind: string, question: string}} Frame
 * @typedef {{
 *   object: {name: string, description: string},
 *   solid: string, distance: number,
 *   frames: Frame[], dialogues: Record<string, {tension: string, emerges: string}>,
 *   principal: string|null, synthesis: string,
 *   meta: {example: string|null, pristine: boolean}
 * }} State
 */

/** @returns {State} */
export function createState(solid = 'octahedron') {
  return ensureFrames({
    object: { name: '', description: '' },
    solid,
    distance: DEFAULT_DISTANCE,
    frames: [],
    dialogues: {},
    principal: null,
    synthesis: '',
    meta: { example: null, pristine: false },
  });
}

/** Pads `frames` so every vertex of the current solid has one. Extra frames are kept. */
export function ensureFrames(state) {
  const n = vertexCount(state.solid);
  while (state.frames.length < n) state.frames.push(emptyFrame());
  return state;
}

/** Frames placed on the vertices of the current solid (the rest wait off-stage). */
export const visibleFrames = state => state.frames.slice(0, vertexCount(state.solid));

export const isActive = frame => frame.name.trim() !== '';

export const hasContent = frame => FRAME_FIELDS.some(f => frame[f].trim() !== '');

export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function getDialogue(state, idA, idB) {
  return state.dialogues[pairKey(idA, idB)] || { tension: '', emerges: '' };
}

export const dialogueHasContent = d => !!d && DIALOGUE_FIELDS.some(f => (d[f] || '').trim() !== '');

/** Edges of the current solid, resolved to frame pairs. */
export function currentEdges(state) {
  const frames = state.frames;
  return getSolid(state.solid).edges.map(([a, b]) => ({
    a, b, key: pairKey(frames[a].id, frames[b].id),
  }));
}

/** Swaps two frames between vertices; dialogues follow their frames (keyed by id). */
export function swapFrames(state, i, j) {
  [state.frames[i], state.frames[j]] = [state.frames[j], state.frames[i]];
}

/** Snapshot without UI-only metadata, ready to be exported or shared. */
export function toJSON(state) {
  const clean = Object.fromEntries(
    Object.entries(state.dialogues).filter(([, d]) => dialogueHasContent(d)),
  );
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    object: { ...state.object },
    solid: state.solid,
    distance: state.distance,
    frames: state.frames.filter((f, i) => i < vertexCount(state.solid) || hasContent(f)),
    dialogues: clean,
    principal: state.principal,
    synthesis: state.synthesis,
  };
}

const str = v => (typeof v === 'string' ? v.slice(0, MAX_TEXT) : '');

const LEGACY_SOLIDS = { 4: 'tetrahedron', 6: 'cube', 8: 'octahedron', 20: 'icosahedron' };

// The first prototype ("Methachritics") stored free-text notes per vertex,
// usually as "Puede ver: … / No puede ver: … / Pregunta clave: …".
function migrateLegacy(raw) {
  const solid = LEGACY_SOLIDS[raw.solid] || 'octahedron';
  const n = vertexCount(solid);
  const frames = [];
  for (let i = 0; i < n; i++) {
    const v = (raw.vertices && raw.vertices[i]) || {};
    const frame = { ...emptyFrame(), name: str(v.name) };
    const notes = str(v.notes);
    const grab = re => (notes.match(re) || [])[1]?.trim() || '';
    frame.sees = grab(/^\s*puede ver:\s*(.*)$/im);
    frame.blind = grab(/no puede ver:\s*(.*)$/im);
    frame.question = grab(/pregunta clave:\s*(.*)$/im);
    if (!frame.sees && !frame.blind && !frame.question) frame.sees = notes;
    frames.push(frame);
  }
  return { object: { name: str(raw.object), description: '' }, solid, frames };
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
  }
  const solid = SOLID_IDS.includes(src.solid) ? src.solid : 'octahedron';
  const seen = new Set();
  const frames = (Array.isArray(src.frames) ? src.frames : []).slice(0, 40).map(f => {
    const frame = { id: typeof f?.id === 'string' && f.id ? f.id.slice(0, 40) : uid() };
    if (seen.has(frame.id)) frame.id = uid();
    seen.add(frame.id);
    for (const k of FRAME_FIELDS) frame[k] = str(f?.[k]);
    return frame;
  });
  const dialogues = {};
  if (src.dialogues && typeof src.dialogues === 'object') {
    for (const [key, d] of Object.entries(src.dialogues)) {
      const [a, b] = key.split('|');
      if (!seen.has(a) || !seen.has(b) || a === b) continue;
      dialogues[pairKey(a, b)] = { tension: str(d?.tension), emerges: str(d?.emerges) };
    }
  }
  const distance = Number(src.distance);
  return ensureFrames({
    object: { name: str(src.object?.name), description: str(src.object?.description) },
    solid,
    distance: Number.isFinite(distance)
      ? Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, distance))
      : DEFAULT_DISTANCE,
    frames,
    dialogues,
    principal: seen.has(src.principal) ? src.principal : null,
    synthesis: str(src.synthesis),
    meta: { example: null, pristine: false },
  });
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
