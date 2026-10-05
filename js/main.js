// Entry point: wires state, 3D view, side panel and actions together.

import { t, tn, pct, setLang, getLang, detectLang, applyI18n } from './i18n.js';
import { SOLID_IDS, vertexCount, getSolid, coverage, principalAnalysis } from './geometry.js';
import {
  createState, ensureFrames, visibleFrames, isActive, hasContent, currentEdges, dialogueHasContent,
  swapFrames, toJSON, normalizeState, encodeShare, decodeShare, saveLocal, loadLocal,
  readPref, writePref, BACKUP_KEY,
} from './state.js';
import { buildExample } from './examples.js';
import { PolyhedronView, PALETTE } from './scene.js';
import { createPanels, h } from './ui.js';
import {
  reportModel, toMarkdown, fillPrintReport, composePoster, download, slug, frameName, objectName,
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
};

// ── Derived data (memoized: typing notes does not change the geometry) ──────

let statsMemo = { key: '', value: null };
let analysisMemo = { key: '', value: null };

const activeMask = () => visibleFrames(app.state).map(isActive);

app.getStats = () => {
  const s = app.state;
  const mask = activeMask();
  const key = `${s.solid}|${s.distance}|${mask.map(Number).join('')}`;
  if (statsMemo.key !== key) {
    statsMemo = { key, value: coverage(getSolid(s.solid).vertices, mask, s.distance) };
  }
  return statsMemo.value;
};

app.getAnalysis = () => {
  const s = app.state;
  const pi = visibleFrames(s).findIndex(f => f.id === s.principal);
  if (pi < 0) return null;
  const mask = activeMask();
  const key = `${s.solid}|${s.distance}|${mask.map(Number).join('')}|${pi}`;
  if (analysisMemo.key !== key) {
    analysisMemo = { key, value: principalAnalysis(getSolid(s.solid).vertices, mask, pi, s.distance) };
  }
  return analysisMemo.value;
};

const hasWork = s =>
  !!(s.object.name.trim() || s.object.description.trim() || s.synthesis.trim() || s.frames.some(hasContent));

// ── Update cycle ─────────────────────────────────────────────────────────

function viewModel() {
  const s = app.state;
  const sel = app.selection;
  return {
    solid: s.solid,
    distance: s.distance,
    frames: visibleFrames(s).map(f => ({ active: isActive(f), principal: f.id === s.principal })),
    dialogues: new Set(
      currentEdges(s).filter(e => dialogueHasContent(s.dialogues[e.key])).map(e => `${e.a}-${e.b}`),
    ),
    selection: sel?.type === 'pair' ? { type: 'edge', a: sel.a, b: sel.b } : sel,
  };
}

let saveTimer = 0;

/**
 * Propagates a state change.
 * @param {{user?: boolean, structural?: boolean}} opts `structural` rebuilds the open panel.
 */
app.commit = ({ user = true, structural = false } = {}) => {
  if (user) app.state.meta.pristine = false;
  app.view.update(viewModel());
  updateStage();
  app.panels.refresh({ structural });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveLocal(app.state), 400);
};

app.select = (sel, { fromPanel = false } = {}) => {
  if (sel?.type === 'object') {
    sel = null;
    if (!fromPanel) app.setTab('object');
  }
  app.selection = sel;
  if (sel) setAutoRotate(false);
  if (sel && !fromPanel) {
    if (sel.type === 'frame' && app.tab !== 'frames') app.setTab('frames');
    if (sel.type === 'edge' && app.tab !== 'dialogues') app.setTab('dialogues');
    if (sel.type === 'frame' || sel.type === 'edge') app.panels.openCard(sel);
  }
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
  for (const id of ['object', 'frames', 'dialogues', 'synthesis']) $(`panel-${id}`).hidden = id !== tab;
  app.panels.render(tab);
  $('panel-scroll').scrollTop = 0;
  const sel = app.selection;
  if (sel && ((tab === 'frames' && sel.type === 'frame') || (tab === 'dialogues' && sel.type === 'edge'))) {
    app.panels.openCard(sel);
  }
  if (focus) app.panels.focus(focus);
};

app.swap = (i, j) => {
  swapFrames(app.state, i, j);
  app.selection = { type: 'frame', index: j };
  app.commit({ structural: true });
  app.panels.openCard(app.selection);
};

// ── Stage chrome ─────────────────────────────────────────────────────────

function legendItems() {
  const sel = app.selection;
  if (sel?.type === 'frame') {
    return [{ color: PALETTE.lit, label: t('legend.sees') }, { color: 'shadow', label: t('legend.blind') }];
  }
  if (sel?.type === 'edge' || sel?.type === 'pair') {
    return [
      { color: PALETTE.ramp[2], label: t('legend.both') },
      { color: PALETTE.ramp[0], label: t('legend.onlyOne') },
      { color: 'shadow', label: t('legend.none') },
    ];
  }
  const stats = app.getStats();
  if (!stats.activeCount) return [];
  const items = [{ color: 'shadow', label: t('legend.blind') }];
  const max = Math.max(1, Math.min(stats.maxOverlap, 4));
  for (let n = 1; n <= max; n++) {
    items.push({
      color: PALETTE.ramp[n - 1],
      label: n === 1 ? t('legend.count1') : t('legend.countN', { n: n === 4 && stats.maxOverlap > 4 ? '4+' : n }),
    });
  }
  return items;
}

function updateStage() {
  const s = app.state;
  const sel = app.selection;
  const frames = visibleFrames(s);
  const stats = app.getStats();
  const name = i => frameName(frames[i], i);

  $('stage-title').textContent = objectName(s);
  document.title = s.object.name.trim() ? `${s.object.name.trim()} — Metacognition` : t('docTitle');

  let mode;
  if (sel?.type === 'frame') mode = t('mode.frame', { name: name(sel.index) });
  else if (sel?.type === 'edge') mode = t('mode.edge', { a: name(sel.a), b: name(sel.b) });
  else if (sel?.type === 'pair') mode = t('mode.pair', { a: name(sel.a), b: name(sel.b) });
  else mode = stats.activeCount ? t('mode.coverage') : t('mode.empty');
  $('stage-mode').textContent = mode;
  $('stage-back').hidden = !sel;

  $('stage-stats').replaceChildren(
    ...[
      ['stat.covered', stats.covered, ''],
      ['stat.blind', stats.blind, 'is-blind'],
      ['stat.dialogue', stats.dialogue, ''],
    ].map(([key, v, cls]) => h('div', { class: cls || null }, h('dt', {}, t(key)), h('dd', {}, pct(v)))),
  );

  $('legend').replaceChildren(
    ...legendItems().map(item =>
      h('li', {},
        h('span', {
          class: item.color === 'shadow' ? 'swatch is-shadow' : 'swatch',
          style: item.color === 'shadow' ? null : `background:${item.color}`,
        }),
        item.label,
      ),
    ),
  );

  const slider = $('distance');
  if (Number(slider.value) !== s.distance) slider.value = String(s.distance);
  $('distance-value').textContent = s.distance.toFixed(2);
  $('solid-select').value = s.solid;
}

/** Stand-in when WebGL is unavailable: the panel, stats and exports keep working. */
function nullView() {
  const blank = document.createElement('canvas');
  return {
    update() {}, setHover() {}, setAutoRotate() {}, resetView() {},
    capture: () => blank,
    projectedFrames: () => [],
  };
}

function setAutoRotate(on) {
  app.autoRotate = on;
  app.view.setAutoRotate(on);
  $('rotate-btn').setAttribute('aria-pressed', String(on));
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
    body = f.sees.trim() ? `${t('tip.sees')}: ${clip(f.sees.trim())}` : null;
  } else if (target.type === 'edge') {
    title = `${frameName(frames[target.a], target.a)} ↔ ${frameName(frames[target.b], target.b)}`;
    const d = s.dialogues[currentEdges(s).find(e => e.a === target.a && e.b === target.b)?.key];
    body = d?.tension?.trim() ? clip(d.tension.trim()) : t('tip.edge');
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
  const hidden = s.frames.slice(vertexCount(id)).filter(hasContent).length;
  if (hidden) toast(tn('toast.hidden', hidden));
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
    points: app.view.projectedFrames(),
    cssWidth: host.clientWidth,
    cssHeight: host.clientHeight,
    model,
    labels: visibleFrames(app.state).map(frameName),
    legend: legendItems().map(i => ({ ...i, color: i.color === 'shadow' ? PALETTE.shadow : i.color })),
  });
}

async function exportAs(kind) {
  const s = app.state;
  const model = reportModel(s, app.getStats(), app.getAnalysis());
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
    ...SOLID_IDS.map(id => h('option', { value: id }, t('solidOption', { name: t(`solid.${id}`), n: vertexCount(id) }))),
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
  if (s.meta.pristine && s.meta.example) app.state = buildExample(s.meta.example, lang);
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

// ── Wiring ───────────────────────────────────────────────────────────────

function bindChrome() {
  $('solid-select').addEventListener('change', e => changeSolid(e.target.value));
  $('distance').addEventListener('input', e => {
    app.state.distance = Number(e.target.value);
    app.commit();
  });
  $('rotate-btn').addEventListener('click', () => setAutoRotate(!app.autoRotate));
  $('reset-btn').addEventListener('click', () => app.view.resetView());
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
    const model = reportModel(app.state, app.getStats(), app.getAnalysis());
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
  if (state.meta.pristine && state.meta.example) state = buildExample(state.meta.example, getLang());
  app.state = state;

  try {
    app.view = new PolyhedronView($('canvas-host'), {
      onSelect: target => app.select(target),
      onHover: (target, x, y) => {
        app.view.setHover(target?.type === 'object' ? null : target);
        showTooltip(target, x, y);
      },
      onUserRotate: () => setAutoRotate(false),
      labelText: i => frameName(visibleFrames(app.state)[i], i),
    });
  } catch (err) {
    console.warn('3D view unavailable:', err);
    app.view = nullView();
    $('canvas-host').append(h('p', { class: 'no-webgl', 'data-i18n': 'noWebgl' }, t('noWebgl')));
  }
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
