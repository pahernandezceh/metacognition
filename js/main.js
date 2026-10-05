// Entry point: wires state, 3D view, side panel and actions together.

import { t, tn, setLang, getLang, detectLang, applyI18n } from './i18n.js';
import {
  SOLID_IDS, faceCount, getSolid, worldNormals, windowOfFinding, rotationToWindow, qRotate,
  normalize, add, IDENTITY,
} from './geometry.js';
import {
  createState, ensureFrames, visibleFrames, visibleFindings, isActive, hasContent, currentEdges,
  edgeHasContent, noteHasContent, addFinding, addReread, toJSON, normalizeState, encodeShare,
  decodeShare, saveLocal, loadLocal, readPref, writePref, BACKUP_KEY,
} from './state.js';
import { totals } from './analysis.js';
import { buildExample } from './examples.js';
import { PolyhedronView } from './scene.js';
import { frameColor } from './palette.js';
import { createPanels, h } from './ui.js';
import {
  reportModel, toMarkdown, fillPrintReport, composePoster, download, slug, frameName, objectName, findingLabels,
} from './report.js';

const PREF_LANG = 'metacognition:lang';
const PREF_INTRO = 'metacognition:intro-seen';
const DOCS = {
  es: 'https://github.com/pahernandezceh/metacognition#readme',
  en: 'https://github.com/pahernandezceh/metacognition/blob/main/README.en.md',
};

const $ = id => document.getElementById(id);

const app = {
  state: null,
  selection: null,
  tab: 'object',
  autoRotate: !matchMedia('(prefers-reduced-motion: reduce)').matches,
  view: null,
  panels: null,
  labels: new Map(),
  normals: [],
};

// ── Derived data ─────────────────────────────────────────────────────────

function refreshDerived() {
  app.labels = findingLabels(app.state);
  app.normals = worldNormals(app.state.solid, app.state.view.poly);
}

app.findingLabel = f => app.labels.get(f.id) || '';
app.visibleFindings = () => visibleFindings(app.state);
/** Face (window) through which a finding is seen with the current orientation. */
app.windowOf = f => windowOfFinding(f.pos, app.state.view.object, app.normals);

const findingById = id => app.state.findings.find(f => f.id === id);
const frameIndexOf = id => visibleFrames(app.state).findIndex(f => f.id === id);

const hasWork = s =>
  !!(s.object.name.trim() || s.object.description.trim() || s.synthesis.trim() || s.frames.some(f => hasContent(s, f)));

// ── Update cycle ─────────────────────────────────────────────────────────

function viewModel() {
  const s = app.state;
  const sel = app.selection;
  const focusId = sel?.type === 'finding' ? sel.id : sel?.type === 'frame' ? sel.finding : null;
  const byId = new Map(s.frames.map((f, i) => [f.id, [f, i]]));
  return {
    solid: s.solid,
    frames: visibleFrames(s).map((f, i) => ({
      label: frameName(f, i), color: frameColor(f.color), active: isActive(f), principal: f.id === s.principal,
    })),
    findings: visibleFindings(s).map(f => {
      const [frame, i] = byId.get(f.frame);
      const label = app.labels.get(f.id);
      return {
        id: f.id,
        pos: f.pos,
        color: frameColor(frame.color),
        label,
        aria: t('finding.aria', { label, frame: frameName(frame, i) }),
        rereadColors: [...new Set(f.rereads.filter(noteHasContent).map(r => byId.get(r.frame)?.[0]).filter(Boolean)
          .map(x => frameColor(x.color)))],
        selected: f.id === focusId,
      };
    }),
    edgeNotes: new Set(currentEdges(s).filter(e => edgeHasContent(s.edges[e.key])).map(e => `${e.a}-${e.b}`)),
    selection: sel?.type === 'finding' ? null : sel,
  };
}

let saveTimer = 0;

/**
 * Propagates a state change.
 * @param {{user?: boolean, structural?: boolean}} opts `structural` rebuilds the open panel.
 */
app.commit = ({ user = true, structural = false } = {}) => {
  if (user) app.state.meta.pristine = false;
  refreshDerived();
  app.view.update(viewModel());
  updateStage();
  app.panels.refresh({ structural });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveLocal(app.state), 400);
};

/** Points the camera at what a selection is about. */
function look(sel) {
  const s = app.state;
  let dir = null;
  if (sel.type === 'frame') dir = app.normals[sel.index];
  else if (sel.type === 'edge') dir = normalize(add(app.normals[sel.a], app.normals[sel.b]));
  else if (sel.type === 'finding') {
    const f = findingById(sel.id);
    if (f) dir = qRotate(s.view.object, f.pos);
  }
  if (dir) app.view.animate({ look: dir });
}

app.select = (sel, { fromPanel = false, keepCamera = false } = {}) => {
  if (sel?.type === 'object') sel = null;
  app.selection = sel;
  if (sel) setAutoRotate(false);
  if (sel && !fromPanel) {
    const tab = sel.type === 'edge' ? 'edges' : 'frames';
    if (app.tab !== tab) app.setTab(tab);
    app.panels.reveal(sel);
  }
  if (sel && !keepCamera) look(sel);
  app.view.update(viewModel());
  updateStage();
  app.panels.syncSelection();
};

app.setTab = (tab, focus) => {
  app.tab = tab;
  for (const btn of document.querySelectorAll('[role="tab"]')) {
    const on = btn.dataset.tab === tab;
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
  }
  for (const id of ['object', 'frames', 'edges', 'synthesis']) $(`panel-${id}`).hidden = id !== tab;
  app.panels.render(tab);
  $('panel-scroll').scrollTop = 0;
  const sel = app.selection;
  if (sel && ((tab === 'frames' && sel.type !== 'edge') || (tab === 'edges' && sel.type === 'edge'))) app.panels.reveal(sel);
  if (focus) app.panels.focus(focus);
};

// ── Findings and re-readings ─────────────────────────────────────────────

app.addFinding = faceIndex => {
  const f = addFinding(app.state, faceIndex);
  app.selection = { type: 'frame', index: faceIndex, finding: f.id };
  setAutoRotate(false);
  app.commit({ structural: true });
  look(app.selection);
  app.panels.reveal(app.selection);
  app.panels.focusNote(f.id);
};

app.deleteFinding = id => {
  const s = app.state;
  s.findings = s.findings.filter(f => f.id !== id);
  const sel = app.selection;
  if (sel?.type === 'finding' && sel.id === id) app.selection = null;
  if (sel?.type === 'frame' && sel.finding === id) app.selection = { type: 'frame', index: sel.index };
  app.commit({ structural: true });
};

/** Turns the object so the finding sits in the middle of another frame's window, then opens its re-reading. */
app.rereadFrom = (findingId, faceIndex) => {
  const s = app.state;
  const f = findingById(findingId);
  if (!f) return;
  const reader = visibleFrames(s)[faceIndex];
  const reread = addReread(f, reader.id);
  app.panels.openRereads(f.id);
  app.selection = { type: 'frame', index: faceIndex, finding: f.id };
  setAutoRotate(false);
  if (app.tab !== 'frames') app.setTab('frames');
  app.commit({ structural: true });
  const object = rotationToWindow(f.pos, faceIndex, s.solid, s.view.object, s.view.poly);
  const lookDir = qRotate(s.view.poly, getSolid(s.solid).faces[faceIndex].normal);
  app.view.animate({ object, look: lookDir }, () => {
    app.panels.reveal(app.selection);
    app.panels.focusNote(reread.id, `.frame-card[data-index="${faceIndex}"] .inview[data-finding="${f.id}"]`);
  });
};

/** Re-reads a finding that is already in front of this window. */
app.rereadHere = (findingId, faceIndex) => {
  const f = findingById(findingId);
  if (!f) return;
  const reread = addReread(f, visibleFrames(app.state)[faceIndex].id);
  app.panels.openRereads(f.id);
  app.selection = { type: 'frame', index: faceIndex, finding: f.id };
  app.commit({ structural: true });
  app.panels.focusNote(reread.id, `.frame-card[data-index="${faceIndex}"] .inview[data-finding="${f.id}"]`);
};

const sameQuat = (a, b) => Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]) > 0.999999;

/** The object or the polyhedron finished turning (drag or animation). */
function onOrientation(o) {
  const v = app.state.view;
  const changed = !sameQuat(v.object, o.object) || !sameQuat(v.poly, o.poly);
  if (!changed) return;
  app.state.view = o;
  app.commit({ user: false, structural: app.tab === 'frames' });
}

// ── Stage chrome ─────────────────────────────────────────────────────────

function updateStage() {
  const s = app.state;
  const sel = app.selection;
  const frames = visibleFrames(s);
  const name = i => frameName(frames[i], i);

  $('stage-title').textContent = objectName(s);
  document.title = s.object.name.trim() ? `${s.object.name.trim()} — Metacognition` : t('docTitle');

  let mode;
  if (sel?.type === 'frame') {
    const inWindow = app.visibleFindings().filter(f => app.windowOf(f) === sel.index);
    const own = inWindow.filter(f => f.frame === frames[sel.index].id).length;
    mode = t('mode.frame', { name: name(sel.index), own, others: inWindow.length - own });
  } else if (sel?.type === 'edge') {
    mode = t('mode.edge', { a: name(sel.a), b: name(sel.b) });
  } else if (sel?.type === 'finding') {
    const f = findingById(sel.id);
    const w = f ? app.windowOf(f) : -1;
    mode = f ? t('mode.finding', { origin: name(frameIndexOf(f.frame)), window: w >= 0 ? name(w) : '?' }) : '';
  } else {
    mode = frames.some(isActive) ? t('mode.overview') : t('mode.empty');
  }
  $('stage-mode').textContent = mode;
  $('stage-back').hidden = !sel;

  const sum = totals(s);
  $('stage-stats').replaceChildren(
    ...[['stat.findings', sum.findings, ''], ['stat.rereads', sum.rereads, ''], ['stat.unread', sum.unread, 'is-blind']]
      .map(([key, v, cls]) => h('div', { class: cls || null }, h('dt', {}, t(key)), h('dd', {}, String(v)))),
  );

  const max = 8;
  $('legend').replaceChildren(
    ...frames.slice(0, max).map((f, i) =>
      h('li', { class: isActive(f) ? null : 'is-vacant' },
        h('span', { class: 'swatch', style: `background:${frameColor(f.color)}` }),
        h('span', { class: 'legend-num' }, String(i + 1).padStart(2, '0')),
        frameName(f, i),
      )),
    ...(frames.length > max ? [h('li', { class: 'legend-more' }, `+${frames.length - max}`)] : []),
  );
  $('solid-select').value = s.solid;
}

function setAutoRotate(on) {
  app.autoRotate = on;
  app.view.setAutoRotate(on);
  $('rotate-btn').setAttribute('aria-pressed', String(on));
}

function setDragMode(mode) {
  app.view.setDragMode?.(mode);
  for (const b of document.querySelectorAll('[data-drag]')) b.setAttribute('aria-checked', String(b.dataset.drag === mode));
  if (mode !== 'view') setAutoRotate(false);
}

// ── Tooltip ──────────────────────────────────────────────────────────────

const clip = (text, n = 150) => (text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text);

function showTooltip(target, x, y) {
  const tip = $('tooltip');
  if (!target || x == null || matchMedia('(hover: none)').matches) {
    tip.hidden = true;
    return;
  }
  const s = app.state;
  const frames = visibleFrames(s);
  let title;
  let body;
  if (target.type === 'frame') {
    const f = frames[target.index];
    title = frameName(f, target.index);
    const n = s.findings.filter(x2 => x2.frame === f.id && noteHasContent(x2)).length;
    body = [t('tip.findings', { n }), f.focus.trim() && clip(f.focus.trim(), 120)].filter(Boolean).join(' · ');
  } else if (target.type === 'edge') {
    title = `${frameName(frames[target.a], target.a)} × ${frameName(frames[target.b], target.b)}`;
    const e = s.edges[currentEdges(s).find(x2 => x2.a === target.a && x2.b === target.b)?.key];
    body = e?.tension?.trim() ? clip(e.tension.trim()) : t('tip.edge');
  } else if (target.type === 'finding') {
    const f = findingById(target.id);
    if (!f) { tip.hidden = true; return; }
    const i = frameIndexOf(f.frame);
    title = `${app.findingLabel(f)} · ${frameName(frames[i], i)}`;
    body = f.text.trim() ? clip(f.text.trim()) : null;
  } else {
    title = objectName(s);
    body = t('tip.object');
  }
  tip.replaceChildren(h('strong', {}, title), body ? h('span', {}, body) : h('em', {}, t('tip.empty')));
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = `${Math.min(x + 16, innerWidth - r.width - 8)}px`;
  tip.style.top = `${Math.min(y + 16, innerHeight - r.height - 8)}px`;
}

// ── Toast ────────────────────────────────────────────────────────────────

let toastTimer = 0;

function toast(message, { action, onAction, input, duration = 4500 } = {}) {
  const el = $('toast');
  const parts = [h('span', {}, message)];
  if (input) {
    const field = h('input', { type: 'text', readonly: true, value: input, 'aria-label': message });
    parts.push(field);
    requestAnimationFrame(() => field.select());
  }
  if (action) {
    parts.push(h('button', { type: 'button', onclick: () => { el.hidden = true; onAction(); } }, action));
  }
  el.replaceChildren(...parts);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, duration);
}

// ── Actions ──────────────────────────────────────────────────────────────

function replaceState(next, { backup = true } = {}) {
  if (backup && hasWork(app.state) && !app.state.meta.pristine) saveLocal(app.state, BACKUP_KEY);
  app.state = next;
  app.selection = null;
  app.view.setOrientation(next.view);
  app.commit({ user: false, structural: true });
}

function restoreBackup() {
  const prev = loadLocal(BACKUP_KEY);
  if (!prev) return;
  replaceState(prev, { backup: false });
  app.setTab('object');
  toast(t('toast.restored'));
}

function loadExample(id) {
  const s = app.state;
  if (s.meta.pristine && s.meta.example === id) return;
  if (hasWork(s) && !s.meta.pristine && !confirm(t('confirm.example'))) return;
  replaceState(buildExample(id, getLang()));
  app.setTab('object');
}

function startBlank({ ask = true } = {}) {
  const s = app.state;
  if (ask && hasWork(s) && !s.meta.pristine && !confirm(t('confirm.new'))) return;
  replaceState(createState(s.solid));
  app.setTab('object');
  $('object-name')?.focus();
}

function changeSolid(id) {
  const s = app.state;
  s.solid = id;
  ensureFrames(s);
  app.selection = null;
  app.commit({ structural: true });
  const hidden = s.frames.slice(faceCount(id)).filter(f => hasContent(s, f)).length;
  if (hidden) toast(tn('toast.hidden', hidden));
}

function goHome() {
  setAutoRotate(false);
  app.view.animate({ object: [...IDENTITY], poly: [...IDENTITY] });
}

async function share() {
  const code = await encodeShare(app.state);
  const url = `${location.href.split('#')[0]}#s=${code}`;
  const long = url.length > 8000 ? ` ${t('toast.long', { n: url.length })}` : '';
  try {
    await navigator.clipboard.writeText(url);
    toast(t('toast.copied') + long, { duration: long ? 9000 : 4500 });
  } catch {
    toast(t('toast.copyFail'), { input: url, duration: 20000 });
  }
}

function poster(model) {
  const host = $('canvas-host');
  return composePoster({
    glCanvas: app.view.capture(),
    labels: app.view.projectedLabels(),
    cssWidth: host.clientWidth,
    cssHeight: host.clientHeight,
    model,
  });
}

async function exportAs(kind) {
  const s = app.state;
  const model = reportModel(s);
  const base = `metacognition-${slug(objectName(s))}`;
  if (kind === 'json') {
    download(`${base}.json`, `${JSON.stringify(toJSON(s), null, 2)}\n`, 'application/json');
  } else if (kind === 'md') {
    download(`${base}.md`, toMarkdown(model), 'text/markdown;charset=utf-8');
  } else {
    if (document.fonts?.ready) await document.fonts.ready;
    const canvas = poster(model);
    if (kind === 'png') {
      canvas.toBlob(blob => download(`${base}.png`, blob), 'image/png');
    } else {
      fillPrintReport($('print-report'), model, canvas.toDataURL('image/png'));
      const img = $('print-report').querySelector('img');
      if (img?.decode) await img.decode().catch(() => {});
      window.print();
    }
  }
}

async function importFile(file) {
  try {
    const next = normalizeState(JSON.parse(await file.text()));
    replaceState(next);
    app.setTab('object');
    toast(t('toast.imported'), loadLocal(BACKUP_KEY) ? { action: t('toast.restore'), onAction: restoreBackup } : {});
  } catch {
    toast(t('toast.importError'));
  }
}

// ── Language ─────────────────────────────────────────────────────────────

function applyLanguage() {
  applyI18n(document);
  for (const btn of document.querySelectorAll('[data-lang]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === getLang()));
  }
  $('solid-select').replaceChildren(
    ...SOLID_IDS.map(id => h('option', { value: id }, t('solidOption', { name: t(`solid.${id}`), n: faceCount(id) }))),
  );
  $('solid-select').value = app.state.solid;
  $('docs-link').href = DOCS[getLang()];
}

function changeLang(lang) {
  if (lang === getLang()) return;
  setLang(lang);
  writePref(PREF_LANG, lang);
  $('toast').hidden = true;
  const s = app.state;
  if (s.meta.pristine && s.meta.example) {
    const view = s.view;
    app.state = buildExample(s.meta.example, lang);
    app.state.view = view;
  }
  applyLanguage();
  app.commit({ user: false, structural: true });
}

// ── Intro dialog ─────────────────────────────────────────────────────────

function openIntro() {
  const dlg = $('intro');
  dlg.returnValue = '';
  dlg.showModal();
}

function onIntroClose() {
  writePref(PREF_INTRO, '1');
  const choice = $('intro').returnValue;
  if (choice === 'blank') startBlank();
  if (choice === 'example') loadExample('sustainability');
}

/** Stand-in when WebGL is unavailable: the panel, analysis and exports keep working. */
function nullView() {
  const blank = document.createElement('canvas');
  return {
    update() {}, setHover() {}, setAutoRotate() {}, resetView() {}, setDragMode() {}, setOrientation() {},
    animate(_, done) { done?.(); },
    capture: () => blank,
    projectedLabels: () => ({ faces: [], findings: [] }),
  };
}

// ── Wiring ───────────────────────────────────────────────────────────────

function bindChrome() {
  $('solid-select').addEventListener('change', e => changeSolid(e.target.value));
  $('rotate-btn').addEventListener('click', () => setAutoRotate(!app.autoRotate));
  $('reset-btn').addEventListener('click', () => app.view.resetView());
  $('home-btn').addEventListener('click', goHome);
  for (const b of document.querySelectorAll('[data-drag]')) b.addEventListener('click', () => setDragMode(b.dataset.drag));
  $('stage-back').addEventListener('click', () => app.select(null));
  $('help-btn').addEventListener('click', openIntro);
  $('intro').addEventListener('close', onIntroClose);
  for (const btn of document.querySelectorAll('[data-lang]')) {
    btn.addEventListener('click', () => changeLang(btn.dataset.lang));
  }

  const tabs = [...document.querySelectorAll('[role="tab"]')];
  for (const btn of tabs) {
    btn.addEventListener('click', () => app.setTab(btn.dataset.tab));
    btn.addEventListener('keydown', e => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      const next = tabs[(tabs.indexOf(btn) + step + tabs.length) % tabs.length];
      next.focus();
      app.setTab(next.dataset.tab);
    });
  }

  $('share-btn').addEventListener('click', share);
  $('import-btn').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) importFile(file);
  });
  $('new-btn').addEventListener('click', () => startBlank());
  for (const btn of document.querySelectorAll('[data-export]')) {
    btn.addEventListener('click', () => exportAs(btn.dataset.export));
  }
  for (const btn of document.querySelectorAll('[data-example]')) {
    btn.addEventListener('click', () => loadExample(btn.dataset.example));
  }

  // Menus close on outside click, after choosing, and on Escape.
  const menus = [...document.querySelectorAll('details.menu')];
  document.addEventListener('click', e => {
    for (const m of menus) {
      if (m.open && (!m.contains(e.target) || e.target.closest('.menu-list button'))) m.open = false;
    }
  });
  for (const m of menus) {
    m.addEventListener('toggle', () => { if (m.open) for (const o of menus) if (o !== m) o.open = false; });
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || $('intro').open) return;
    const open = menus.find(m => m.open);
    if (open) { open.open = false; open.querySelector('summary').focus(); return; }
    if (app.selection) app.select(null);
  });

  window.addEventListener('beforeprint', () => {
    if ($('print-report').childElementCount) return;
    const model = reportModel(app.state);
    fillPrintReport($('print-report'), model, poster(model).toDataURL('image/png'));
  });
  window.addEventListener('afterprint', () => $('print-report').replaceChildren());
}

async function boot() {
  const params = new URLSearchParams(location.search);
  setLang(detectLang(params.get('lang') || readPref(PREF_LANG), navigator.languages || [navigator.language]));

  let state = null;
  let shared = false;
  if (location.hash.startsWith('#s=')) {
    try {
      state = await decodeShare(location.hash.slice(3));
      shared = true;
    } catch {
      setTimeout(() => toast(t('toast.sharedError')), 300);
    }
    history.replaceState(null, '', location.pathname + location.search);
  }
  const local = loadLocal();
  if (shared && local && hasWork(local) && !local.meta.pristine) saveLocal(local, BACKUP_KEY);
  const firstVisit = !state && !local;
  state ||= local || buildExample(params.get('example') === 'ai' ? 'ai' : 'sustainability', getLang());
  if (state.meta.pristine && state.meta.example) {
    const view = state.view;
    state = buildExample(state.meta.example, getLang());
    state.view = view;
  }
  app.state = state;
  refreshDerived();

  try {
    app.view = new PolyhedronView($('canvas-host'), {
      onSelect: target => app.select(target),
      onHover: (target, x, y) => {
        app.view.setHover(target?.type === 'object' ? null : target);
        showTooltip(target, x, y);
      },
      onUserRotate: () => setAutoRotate(false),
      onOrientation,
    });
  } catch (err) {
    console.warn('3D view unavailable:', err);
    app.view = nullView();
    $('canvas-host').append(h('p', { class: 'no-webgl', 'data-i18n': 'noWebgl' }, t('noWebgl')));
  }
  app.view.setOrientation(state.view);
  app.panels = createPanels(app);
  bindChrome();
  applyLanguage();
  setAutoRotate(app.autoRotate);
  app.commit({ user: false });
  app.setTab('object');
  if (params.has('debug')) window.metacognition = app;

  if (shared) {
    const restorable = loadLocal(BACKUP_KEY);
    toast(t('toast.shared'), restorable ? { action: t('toast.restore'), onAction: restoreBackup, duration: 10000 } : {});
  } else if (firstVisit && readPref(PREF_INTRO) !== '1') {
    openIntro();
  }
}

boot();
