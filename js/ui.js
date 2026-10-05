// Side panel: object, frames (with findings and re-readings), intersections and synthesis.
// Panels are rebuilt when shown or on structural changes (keeping open cards
// and scroll position); while typing, only derived bits are refreshed so
// focus is never lost.

import { t, tn, list } from './i18n.js';
import { getSolid } from './geometry.js';
import {
  visibleFrames, currentEdges, edgeHasContent, hasContent, isActive, noteHasContent, TAGS,
} from './state.js';
import { crossMatrix, unread, tagCounts, contradicted, hashtags, principalReading } from './analysis.js';
import { frameColor } from './palette.js';
import { frameName } from './report.js';

/** Minimal DOM builder. Text is always inserted as text, never as HTML. */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'value') el.value = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  }
  if (tag === 'textarea' && props?.value != null) el.value = props.value;
  return el;
}

/** Like replaceChildren, but flattens arrays and skips null/false. */
function fill(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter(c => c != null && c !== false));
}

const pad2 = n => String(n).padStart(2, '0');
const label = text => h('span', { class: 'mono-label' }, text);
const clip = (s, n = 110) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function createPanels(app) {
  const panels = {
    object: document.getElementById('panel-object'),
    frames: document.getElementById('panel-frames'),
    edges: document.getElementById('panel-edges'),
    synthesis: document.getElementById('panel-synthesis'),
  };
  const scroller = document.getElementById('panel-scroll');
  const open = { frames: new Set(), edges: new Set(), rereads: new Set() };
  let guideList = null;
  const live = {};

  const S = () => app.state;
  const frames = () => visibleFrames(S());
  const colorOf = frame => frameColor(frame.color);
  const swatch = (frame, cls = 'swatch') => h('i', { class: cls, style: `background:${colorOf(frame)}`, 'aria-hidden': 'true' });
  const nameOf = id => {
    const i = S().frames.findIndex(f => f.id === id);
    return i >= 0 ? frameName(S().frames[i], i) : '?';
  };

  function textField(key, value, onInput, rows = 2, extra = {}) {
    return h('label', { class: 'field' },
      label(t(key)),
      h('textarea', { rows, value, placeholder: t(`${key}Placeholder`), oninput: e => onInput(e.target.value), ...extra }),
    );
  }

  function setOpen(card, isOpen) {
    card.classList.toggle('is-open', isOpen);
    card.querySelector(':scope > .card-head .chev-btn')?.setAttribute('aria-expanded', String(isOpen));
  }

  /** Scrolls the panel (not the page) so `el` is visible. */
  function reveal(el, center = false) {
    let top = 0;
    for (let n = el; n && n !== scroller; n = n.offsetParent) top += n.offsetTop;
    const bottom = top + el.offsetHeight;
    if (center || top < scroller.scrollTop || bottom > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTo({ top: Math.max(0, top - 16), behavior: 'smooth' });
    }
  }

  // ── Notes: tags and re-readings ─────────────────────────────────────────

  function tagRow(note) {
    return h('div', { class: 'tags', role: 'group', 'aria-label': t('tags.hint'), title: t('tags.hint') },
      TAGS.map(tag => {
        const on = note.tags.includes(tag.id);
        return h('button', {
          type: 'button', class: 'tag', 'aria-pressed': String(on), title: t(`tag.${tag.id}`),
          onclick: e => {
            const now = !note.tags.includes(tag.id);
            note.tags = now ? [...note.tags, tag.id] : note.tags.filter(x => x !== tag.id);
            e.currentTarget.setAttribute('aria-pressed', String(now));
            syncMirrors(note);
            app.commit();
          },
        }, h('span', { 'aria-hidden': 'true' }, tag.symbol), ' ', t(`tag.${tag.id}`));
      }),
    );
  }

  /** The same note can be edited from two cards; keep the other copy in step. */
  function syncMirrors(note, source) {
    for (const el of document.querySelectorAll(`[data-note="${note.id}"]`)) {
      if (el.tagName === 'TEXTAREA' && el !== source) el.value = note.text;
      if (el.classList.contains('tags')) {
        for (const [i, b] of [...el.children].entries()) b.setAttribute('aria-pressed', String(note.tags.includes(TAGS[i].id)));
      }
    }
  }

  function noteText(note, placeholder, rows = 2) {
    return h('textarea', {
      rows, value: note.text, placeholder, 'aria-label': placeholder, dataset: { note: note.id },
      oninput: e => { note.text = e.target.value; syncMirrors(note, e.target); app.commit(); },
    });
  }

  function rereadBlock(finding, reread) {
    const by = S().frames.find(f => f.id === reread.frame);
    const tags = tagRow(reread);
    tags.dataset.note = reread.id;
    return h('div', { class: 'reread', style: `--c:${by ? colorOf(by) : '#999'}`, dataset: { reread: reread.id } },
      h('div', { class: 'reread-head' },
        by ? swatch(by) : null,
        h('span', {}, t('reread.by', { name: nameOf(reread.frame) })),
        h('button', {
          type: 'button', class: 'mini-btn', title: t('reread.delete'), 'aria-label': t('reread.delete'),
          onclick: () => {
            finding.rereads = finding.rereads.filter(r => r !== reread);
            app.commit({ structural: true });
          },
        }, '✕'),
      ),
      noteText(reread, t('reread.placeholder')),
      tags,
    );
  }

  // ── Object ──────────────────────────────────────────────────────────────

  function renderObject() {
    const s = S();
    guideList = h('ol', { class: 'guide' });
    fill(panels.object,
      h('label', { for: 'object-name', class: 'mono-label' }, t('object.label')),
      h('input', {
        id: 'object-name', class: 'object-name', type: 'text', autocomplete: 'off',
        value: s.object.name, placeholder: t('object.placeholder'),
        oninput: e => { s.object.name = e.target.value; app.commit(); },
      }),
      textField('object.desc', s.object.description, v => { s.object.description = v; app.commit(); }, 3),
      h('h3', {}, t('guide.title')),
      guideList,
      h('h3', {}, t('read.title')),
      h('dl', { class: 'reading' },
        ['sphere', 'faces', 'findings', 'rereads', 'edges', 'shadow', 'turn'].map(k => {
          const [term, def] = t(`read.${k}`);
          return [h('dt', {}, term), h('dd', {}, def)];
        }),
      ),
    );
    renderGuide();
  }

  function renderGuide() {
    if (!guideList) return;
    const s = S();
    const fs = frames();
    const n = fs.length;
    const named = fs.filter(isActive).length;
    const findings = app.visibleFindings().filter(noteHasContent);
    const withFindings = fs.filter(f => findings.some(x => x.frame === f.id)).length;
    const reread = findings.filter(f => f.rereads.some(noteHasContent)).length;
    const edges = currentEdges(s);
    const noted = edges.filter(e => edgeHasContent(s.edges[e.key])).length;
    const ratio = (a, b) => (b > 0 && a === b ? 'done' : a > 0 ? 'partial' : 'todo');
    const steps = [
      ['guide.1', s.object.name.trim() ? 'done' : 'todo', '', () => document.getElementById('object-name')?.focus()],
      ['guide.2', 'done', t(`solid.${s.solid}`), () => document.getElementById('solid-select').focus()],
      ['guide.3', ratio(named, n), `${named}/${n}`, () => app.setTab('frames')],
      ['guide.4', ratio(withFindings, n), `${withFindings}/${n}`, () => app.setTab('frames')],
      ['guide.5', ratio(reread, findings.length), `${reread}/${findings.length}`, () => app.setTab('synthesis')],
      ['guide.6', ratio(noted, edges.length), `${noted}/${edges.length}`, () => app.setTab('edges')],
      ['guide.7', fs.some(f => f.id === s.principal) ? 'done' : 'optional', '', () => app.setTab('synthesis', 'principal')],
      ['guide.8', s.synthesis.trim() ? 'done' : 'todo', '', () => app.setTab('synthesis', 'synthesis')],
    ];
    fill(guideList, steps.map(([key, status, detail, go]) =>
      h('li', { class: `is-${status}` },
        h('button', { type: 'button', onclick: go }, h('span', {}, t(key)), detail && h('span', { class: 'guide-detail' }, detail)),
      ),
    ));
  }

  // ── Frames ──────────────────────────────────────────────────────────────

  function findingBlock(finding, frame, all) {
    const here = app.windowOf(finding);
    const others = all.map((f, j) => [f, j]).filter(([f]) => f.id !== frame.id);
    const rereads = finding.rereads;
    const details = h('details', {
      class: 'rereads', open: open.rereads.has(finding.id) || null,
      ontoggle: e => (e.currentTarget.open ? open.rereads.add(finding.id) : open.rereads.delete(finding.id)),
    },
      h('summary', {},
        h('span', {}, `${t('finding.rereads')} (${rereads.filter(noteHasContent).length})`),
        h('span', { class: 'dots', 'aria-hidden': 'true' }, rereads.filter(noteHasContent).map(r => {
          const by = S().frames.find(f => f.id === r.frame);
          return by ? swatch(by, 'dot') : null;
        })),
      ),
      rereads.map(r => rereadBlock(finding, r)),
    );
    const tags = tagRow(finding);
    tags.dataset.note = finding.id;
    const sel = app.selection;
    const isSel = (sel?.type === 'finding' && sel.id === finding.id) || (sel?.type === 'frame' && sel.finding === finding.id);
    return h('div', { class: `finding${isSel ? ' is-selected' : ''}`, style: `--c:${colorOf(frame)}`, dataset: { finding: finding.id } },
      h('div', { class: 'finding-head' },
        h('button', {
          type: 'button', class: 'finding-tag', title: t('finding.locate'),
          onclick: () => app.select({ type: 'finding', id: finding.id }, { fromPanel: true }),
        }, swatch(frame, 'dot'), app.findingLabel(finding)),
        here >= 0 && all[here].id !== frame.id
          ? h('span', { class: 'finding-where' }, t('finding.seenThrough', { name: frameName(all[here], here) }))
          : h('span', { class: 'finding-where' }),
        h('button', {
          type: 'button', class: 'mini-btn', title: t('finding.delete'), 'aria-label': t('finding.delete'),
          onclick: () => {
            if ((noteHasContent(finding) || finding.rereads.some(noteHasContent)) && !confirm(t('confirm.deleteFinding'))) return;
            app.deleteFinding(finding.id);
          },
        }, '✕'),
      ),
      noteText(finding, t('finding.placeholder')),
      tags,
      h('div', { class: 'finding-foot' },
        details,
        others.length
          ? h('select', {
            class: 'reread-select', 'aria-label': t('finding.rereadFrom'),
            onchange: e => {
              const j = Number(e.target.value);
              e.target.value = '-1';
              if (j >= 0) app.rereadFrom(finding.id, j);
            },
          },
            h('option', { value: '-1' }, `↻ ${t('finding.rereadFrom')}`),
            others.map(([f, j]) => h('option', { value: String(j) }, `${pad2(j + 1)} · ${frameName(f, j)}`)),
          )
          : null,
      ),
    );
  }

  /** Another frame's finding seen through this window, with this frame's re-reading. */
  function inViewBlock(finding, frame, frameIdx) {
    const origin = S().frames.find(f => f.id === finding.frame);
    const mine = finding.rereads.filter(r => r.frame === frame.id);
    return h('div', { class: 'inview', style: `--c:${colorOf(origin)}`, dataset: { finding: finding.id } },
      h('div', { class: 'finding-head' },
        h('button', {
          type: 'button', class: 'finding-tag', title: t('finding.locate'),
          onclick: () => app.select({ type: 'finding', id: finding.id }, { fromPanel: true }),
        }, swatch(origin, 'dot'), app.findingLabel(finding)),
        h('span', { class: 'finding-where' }, nameOf(finding.frame)),
      ),
      h('p', { class: 'inview-text' }, finding.text.trim() || t('tip.empty')),
      mine.map(r => rereadBlock(finding, r)),
      mine.length ? null : h('button', {
        type: 'button', class: 'btn btn-small',
        onclick: () => app.rereadHere(finding.id, frameIdx),
      }, `↻ ${t('frame.rereadHere')}`),
    );
  }

  function frameCard(frame, i, all) {
    const s = S();
    const card = h('article', { class: 'card frame-card', style: `--c:${colorOf(frame)}`, dataset: { index: i } });
    const own = s.findings.filter(f => f.frame === frame.id);
    const inView = app.visibleFindings().filter(f => f.frame !== frame.id && app.windowOf(f) === i);
    const opposite = getSolid(s.solid).opposites.find(([a, b]) => a === i || b === i);
    const opp = opposite ? (opposite[0] === i ? opposite[1] : opposite[0]) : -1;

    const head = h('div', {
      class: 'card-head',
      onclick: () => {
        const selected = app.selection?.type === 'frame' && app.selection.index === i;
        if (selected && card.classList.contains('is-open')) { setCardOpen(card, false); return; }
        setCardOpen(card, true);
        app.select({ type: 'frame', index: i }, { fromPanel: true });
      },
    },
      swatch(frame),
      h('span', { class: 'card-num' }, pad2(i + 1)),
      h('input', {
        class: 'card-name', type: 'text', autocomplete: 'off', value: frame.name,
        placeholder: t('frame.namePlaceholder'), 'aria-label': t('frameN', { n: i + 1 }),
        onclick: e => {
          e.stopPropagation();
          if (card.classList.contains('is-open')) return;
          setCardOpen(card, true);
          app.select({ type: 'frame', index: i }, { fromPanel: true });
        },
        oninput: e => { frame.name = e.target.value; app.commit(); },
      }),
      h('span', { class: 'card-count', title: t('tip.findings', { n: own.length }) }, own.length ? String(own.length) : ''),
      h('button', {
        type: 'button', class: 'star-btn',
        onclick: e => {
          e.stopPropagation();
          s.principal = s.principal === frame.id ? null : frame.id;
          app.commit();
        },
      }, '★'),
      h('button', {
        type: 'button', class: 'chev-btn', 'aria-label': t('frame.toggle'), 'aria-expanded': 'false',
        onclick: e => { e.stopPropagation(); setCardOpen(card, !card.classList.contains('is-open')); },
      }, h('span', { 'aria-hidden': 'true' }, '▸')),
    );

    const body = h('div', { class: 'card-body' },
      textField('frame.focus', frame.focus, v => { frame.focus = v; app.commit(); }),
      textField('frame.question', frame.question, v => { frame.question = v; app.commit(); }, 1),
      opp >= 0 ? h('p', { class: 'note' }, t('frame.opposite', { name: frameName(all[opp], opp) })) : null,
      h('h4', {}, t('frame.findings')),
      own.length ? own.map(f => findingBlock(f, frame, all)) : h('p', { class: 'note' }, t('frame.noFindings')),
      h('button', { type: 'button', class: 'btn btn-small add-btn', onclick: () => app.addFinding(i) }, `+ ${t('frame.addFinding')}`),
      h('h4', {}, t('frame.inView')),
      inView.length ? inView.map(f => inViewBlock(f, frame, i)) : h('p', { class: 'note' }, t('frame.inViewEmpty')),
    );
    card.append(head, body);
    if (open.frames.has(frame.id)) setOpen(card, true);
    card.addEventListener('focusin', e => {
      if (e.target.closest('.finding-head, .tags, .card-head')) return;
      const sel = app.selection;
      if (!(sel?.type === 'frame' && sel.index === i)) app.select({ type: 'frame', index: i }, { fromPanel: true, keepCamera: true });
    });
    return card;
  }

  function setCardOpen(card, isOpen) {
    setOpen(card, isOpen);
    const set = card.classList.contains('frame-card') ? open.frames : open.edges;
    const key = card.dataset.id || frames()[Number(card.dataset.index)]?.id;
    if (isOpen) set.add(key); else set.delete(key);
  }

  function renderFrames() {
    const s = S();
    const all = frames();
    const hidden = s.frames.slice(all.length).filter(f => hasContent(s, f)).length;
    fill(panels.frames,
      h('p', { class: 'intro-text' }, t('frames.intro')),
      all.map((f, i) => frameCard(f, i, all)),
      hidden ? h('p', { class: 'note hidden-note' }, tn('frames.hidden', hidden)) : null,
    );
    syncFrames();
  }

  function syncFrames() {
    const s = S();
    const all = frames();
    for (const card of panels.frames.querySelectorAll('.frame-card')) {
      const i = Number(card.dataset.index);
      const f = all[i];
      if (!f) continue;
      card.classList.toggle('is-selected', app.selection?.type === 'frame' && app.selection.index === i);
      const star = card.querySelector('.star-btn');
      const on = s.principal === f.id;
      star.setAttribute('aria-pressed', String(on));
      const text = t(on ? 'frame.unmarkPrincipal' : 'frame.markPrincipal', { name: frameName(f, i) });
      star.setAttribute('aria-label', text);
      star.title = text;
    }
    const sel = app.selection;
    const focusId = sel?.type === 'finding' ? sel.id : sel?.type === 'frame' ? sel.finding : null;
    for (const el of panels.frames.querySelectorAll('.finding')) el.classList.toggle('is-selected', el.dataset.finding === focusId);
  }

  // ── Intersections (edges) ───────────────────────────────────────────────

  function nameSpan(f, i) {
    return h('span', { class: isActive(f) ? null : 'is-vacant' }, frameName(f, i));
  }

  function edgeCard(e, all) {
    const s = S();
    const note = () => (s.edges[e.key] ||= { tension: '', emerges: '' });
    const current = s.edges[e.key] || { tension: '', emerges: '' };
    const dot = h('span', { class: `card-dot${edgeHasContent(current) ? ' is-filled' : ''}`, 'aria-hidden': 'true' });
    const card = h('article', { class: 'card edge-card', dataset: { a: e.a, b: e.b, id: e.key } });
    const sel = { type: 'edge', a: e.a, b: e.b };
    const isSel = () => app.selection?.type === 'edge' && app.selection.a === e.a && app.selection.b === e.b;
    const update = (field, v) => {
      note()[field] = v;
      dot.classList.toggle('is-filled', edgeHasContent(s.edges[e.key]));
      app.commit();
    };
    card.append(
      h('div', {
        class: 'card-head',
        onclick: () => {
          if (isSel() && card.classList.contains('is-open')) { setCardOpen(card, false); return; }
          setCardOpen(card, true);
          app.select(sel, { fromPanel: true });
        },
      },
        dot,
        h('span', { class: 'card-title' },
          swatch(all[e.a]), nameSpan(all[e.a], e.a), h('span', { class: 'arrow' }, '×'), swatch(all[e.b]), nameSpan(all[e.b], e.b)),
        h('button', {
          type: 'button', class: 'chev-btn', 'aria-label': t('frame.toggle'), 'aria-expanded': 'false',
          onclick: ev => { ev.stopPropagation(); setCardOpen(card, !card.classList.contains('is-open')); },
        }, h('span', { 'aria-hidden': 'true' }, '▸')),
      ),
      h('div', { class: 'card-body' },
        textField('edge.tension', current.tension, v => update('tension', v)),
        textField('edge.emerges', current.emerges, v => update('emerges', v)),
      ),
    );
    if (open.edges.has(e.key)) setOpen(card, true);
    card.addEventListener('focusin', () => { if (!isSel()) app.select(sel, { fromPanel: true, keepCamera: true }); });
    return card;
  }

  function renderEdges() {
    const all = frames();
    fill(panels.edges,
      h('p', { class: 'intro-text' }, t('edges.intro')),
      currentEdges(S()).map(e => edgeCard(e, all)),
    );
    syncEdges();
  }

  function syncEdges() {
    for (const card of panels.edges.querySelectorAll('.edge-card')) {
      const a = Number(card.dataset.a);
      const b = Number(card.dataset.b);
      card.classList.toggle('is-selected', app.selection?.type === 'edge' && app.selection.a === a && app.selection.b === b);
    }
  }

  // ── Synthesis ───────────────────────────────────────────────────────────

  function renderSynthesis() {
    const s = S();
    const all = frames();
    for (const k of ['cross', 'unread', 'signals', 'tags', 'principal', 'questions']) live[k] = h('div');
    const select = h('select', {
      id: 'principal-select',
      onchange: e => { s.principal = e.target.value || null; app.commit(); },
    },
      h('option', { value: '' }, t('syn.principalNone')),
      all.map((f, i) => h('option', { value: f.id, selected: f.id === s.principal }, `${pad2(i + 1)} · ${frameName(f, i)}`)),
    );
    fill(panels.synthesis,
      h('h3', {}, t('syn.cross')), h('p', { class: 'note' }, t('syn.crossDesc')), live.cross,
      h('h3', {}, t('syn.unread')), h('p', { class: 'note' }, t('syn.unreadDesc')), live.unread,
      h('h3', {}, t('syn.signals')), live.signals,
      live.tags,
      h('h3', {}, t('syn.principal')),
      h('p', { class: 'intro-text' }, t('syn.principalDesc')),
      h('label', { class: 'select-field' }, label(t('syn.principal')), select),
      live.principal,
      h('h3', {}, t('syn.questions')), live.questions,
      h('h3', {}, t('syn.text')),
      h('label', { class: 'field' },
        h('textarea', {
          id: 'synthesis-text', rows: 6, value: s.synthesis, placeholder: t('syn.textPlaceholder'),
          'aria-label': t('syn.text'),
          oninput: e => { s.synthesis = e.target.value; app.commit(); },
        }),
      ),
    );
    updateSynthesis();
  }

  function findingRow(f) {
    const origin = S().frames.find(x => x.id === f.frame);
    return h('li', {},
      h('button', { type: 'button', onclick: () => app.select({ type: 'finding', id: f.id }) },
        swatch(origin, 'dot'),
        h('span', { class: 'mono-tag' }, app.findingLabel(f)),
        h('span', {}, clip(f.text.trim() || t('tip.empty'))),
      ),
    );
  }

  function updateSynthesis() {
    if (!live.cross) return;
    const s = S();
    const all = frames();

    // Crossed glances: a small heat table (rows: whose finding; columns: who re-read it).
    const m = crossMatrix(s);
    const max = Math.max(1, ...m.flat());
    fill(live.cross, h('div', { class: 'cross-wrap' },
      h('table', { class: 'cross' },
        h('thead', {}, h('tr', {},
          h('th', { scope: 'col', class: 'corner' }, t('syn.crossCorner')),
          all.map((f, j) => h('th', { scope: 'col', title: frameName(f, j) }, swatch(f, 'dot'), pad2(j + 1))),
        )),
        h('tbody', {}, m.map((row, i) => h('tr', {},
          h('th', { scope: 'row', title: frameName(all[i], i) }, swatch(all[i], 'dot'), pad2(i + 1)),
          row.map((n, j) => i === j
            ? h('td', { class: 'self', 'aria-label': '—' }, '—')
            : h('td', {
              class: n ? 'has' : null,
              style: n ? `--w:${(0.18 + 0.82 * (n / max)).toFixed(2)}` : null,
              title: t('syn.cellTitle', { n, a: frameName(all[i], i), b: frameName(all[j], j) }),
            }, n ? String(n) : '·')),
        ))),
      ),
    ));

    const pending = unread(s);
    fill(live.unread, pending.length
      ? h('ul', { class: 'finding-list' }, pending.map(findingRow))
      : h('p', { class: 'note' }, t('syn.unreadNone')));

    const counts = tagCounts(s);
    const against = contradicted(s);
    fill(live.signals,
      h('ul', { class: 'signal-list' }, TAGS.map(tag => h('li', { class: counts[tag.id] ? null : 'is-zero' },
        h('span', { class: 'sym', 'aria-hidden': 'true' }, tag.symbol), t(`tag.${tag.id}`), h('b', {}, String(counts[tag.id])),
      ))),
      against.length ? [label(t('syn.contradicted')), h('ul', { class: 'finding-list' }, against.map(findingRow))] : null,
    );

    const tags = hashtags(s);
    fill(live.tags, tags.length
      ? [h('h3', {}, t('syn.hashtags')), h('ul', { class: 'hashtags' }, tags.map(([tag, n]) => h('li', {}, `#${tag}`, h('b', {}, String(n)))))]
      : null);

    const pi = all.findIndex(f => f.id === s.principal);
    const select = document.getElementById('principal-select');
    if (select && select.value !== (pi >= 0 ? s.principal : '')) select.value = pi >= 0 ? s.principal : '';
    if (pi < 0) {
      fill(live.principal);
    } else {
      const r = principalReading(s, pi);
      const names = idx => list(idx.map(j => frameName(all[j], j)));
      fill(live.principal, h('div', { class: 'analysis' },
        h('p', {}, t('syn.p.own', { n: r.ownFindings, m: r.readByOthers })),
        h('p', {}, t('syn.p.made', { n: r.rereadsMade })),
        r.notReadingYou.length && r.ownFindings ? h('p', { class: 'note is-warning' }, t('syn.p.notReadingYou', { list: names(r.notReadingYou) })) : null,
        r.notReadByYou.length ? h('p', { class: 'note is-warning' }, t('syn.p.notReadByYou', { list: names(r.notReadByYou) })) : null,
        !r.notReadingYou.length && !r.notReadByYou.length ? h('p', { class: 'note' }, t('syn.p.crossed')) : null,
      ));
    }

    const qs = all.map((f, i) => [f, i]).filter(([f]) => f.question.trim());
    fill(live.questions, qs.length
      ? h('ul', { class: 'questions' }, qs.map(([f, i]) => h('li', {}, h('small', {}, swatch(f, 'dot'), frameName(f, i)), f.question.trim())))
      : h('p', { class: 'note' }, t('syn.noQuestions')));
  }

  // ── Shared ──────────────────────────────────────────────────────────────

  function updateCounts() {
    const s = S();
    const all = frames();
    const edges = currentEdges(s);
    document.getElementById('count-frames').textContent = `${all.filter(isActive).length}/${all.length}`;
    document.getElementById('count-edges').textContent =
      `${edges.filter(e => edgeHasContent(s.edges[e.key])).length}/${edges.length}`;
  }

  const renderers = { object: renderObject, frames: renderFrames, edges: renderEdges, synthesis: renderSynthesis };

  return {
    render(tab, { keepScroll = false } = {}) {
      const top = scroller.scrollTop;
      for (const [k, el] of Object.entries(panels)) if (k !== tab) el.replaceChildren();
      guideList = null;
      for (const k of Object.keys(live)) delete live[k];
      renderers[tab]();
      updateCounts();
      if (keepScroll) scroller.scrollTop = top;
    },

    refresh({ structural = false } = {}) {
      updateCounts();
      if (structural) return this.render(app.tab, { keepScroll: true });
      if (app.tab === 'object') renderGuide();
      else if (app.tab === 'frames') syncFrames();
      else if (app.tab === 'edges') syncEdges();
      else updateSynthesis();
    },

    syncSelection() {
      if (app.tab === 'frames') syncFrames();
      else if (app.tab === 'edges') syncEdges();
    },

    /** Opens and reveals what a selection points at. */
    reveal(sel) {
      if (sel.type === 'frame' || sel.type === 'finding') {
        const all = frames();
        const findingId = sel.type === 'finding' ? sel.id : sel.finding;
        const finding = findingId && S().findings.find(f => f.id === findingId);
        const index = sel.type === 'frame' ? sel.index : all.findIndex(f => f.id === finding?.frame);
        const card = panels.frames.querySelector(`.frame-card[data-index="${index}"]`);
        if (!card) return;
        setCardOpen(card, true);
        const target = (findingId && card.querySelector(`[data-finding="${findingId}"]`)) || card;
        requestAnimationFrame(() => reveal(target));
      } else if (sel.type === 'edge') {
        const card = panels.edges.querySelector(`.edge-card[data-a="${sel.a}"][data-b="${sel.b}"]`);
        if (!card) return;
        setCardOpen(card, true);
        requestAnimationFrame(() => reveal(card));
      }
    },

    openRereads(findingId) {
      open.rereads.add(findingId);
    },

    /** Focuses a note's textarea (the copy inside `scopeSelector` if given). */
    focusNote(noteId, scopeSelector) {
      const scope = (scopeSelector && panels.frames.querySelector(scopeSelector)) || panels.frames;
      const el = scope.querySelector(`textarea[data-note="${noteId}"]`);
      if (!el) return;
      reveal(el.closest('.reread, .finding, .inview') || el);
      el.focus({ preventScroll: true });
    },

    focus(target) {
      const el = document.getElementById(target === 'principal' ? 'principal-select' : 'synthesis-text');
      if (!el) return;
      reveal(el.closest('label') || el);
      el.focus({ preventScroll: true });
    },

    forget(frameIds) {
      for (const id of frameIds) open.frames.delete(id);
    },
  };
}
