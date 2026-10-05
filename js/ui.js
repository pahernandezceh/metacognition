// Side panel: object, frames, dialogues and synthesis tabs.
// Panels are rebuilt when shown or on structural changes; while typing, only
// derived bits (counts, guide, live stats) are refreshed so focus is never lost.

import { t, tn, pct } from './i18n.js';
import { getSolid, capFraction, capCos, dot } from './geometry.js';
import { visibleFrames, currentEdges, dialogueHasContent, hasContent, isActive } from './state.js';
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

export function createPanels(app) {
  const panels = {
    object: document.getElementById('panel-object'),
    frames: document.getElementById('panel-frames'),
    dialogues: document.getElementById('panel-dialogues'),
    synthesis: document.getElementById('panel-synthesis'),
  };
  const scroller = document.getElementById('panel-scroll');
  let guideList = null;
  let overlapNote = null;
  const live = {};

  const S = () => app.state;
  const frames = () => visibleFrames(S());

  function textField(key, value, onInput, rows = 2) {
    return h('label', { class: 'field' },
      label(t(key)),
      h('textarea', { rows, value, placeholder: t(`${key}Placeholder`), oninput: e => onInput(e.target.value) }),
    );
  }

  // ── Object ───────────────────────────────────────────────────────────────

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
        ['sphere', 'vertices', 'light', 'shadow', 'edges', 'opposites', 'distance'].map(k => {
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
    const described = fs.filter(f => f.sees.trim() && f.blind.trim()).length;
    const edges = currentEdges(s);
    const talked = edges.filter(e => dialogueHasContent(s.dialogues[e.key])).length;
    const ratio = (a, b) => (b > 0 && a === b ? 'done' : a > 0 ? 'partial' : 'todo');
    const steps = [
      ['guide.1', s.object.name.trim() ? 'done' : 'todo', '', () => document.getElementById('object-name')?.focus()],
      ['guide.2', 'done', t(`solid.${s.solid}`), () => document.getElementById('solid-select').focus()],
      ['guide.3', ratio(named, n), `${named}/${n}`, () => app.setTab('frames')],
      ['guide.4', ratio(described, n), `${described}/${n}`, () => app.setTab('frames')],
      ['guide.5', ratio(talked, edges.length), `${talked}/${edges.length}`, () => app.setTab('dialogues')],
      ['guide.6', fs.some(f => f.id === s.principal) ? 'done' : 'optional', '', () => app.setTab('synthesis', 'principal')],
      ['guide.7', s.synthesis.trim() ? 'done' : 'todo', '', () => app.setTab('synthesis', 'synthesis')],
    ];
    fill(guideList, ...steps.map(([key, status, detail, go]) =>
      h('li', { class: `is-${status}` },
        h('button', { type: 'button', onclick: go }, h('span', {}, t(key)), detail && h('span', { class: 'guide-detail' }, detail)),
      ),
    ));
  }

  // ── Frames ───────────────────────────────────────────────────────────────

  function oppositeOf(i) {
    const pair = getSolid(S().solid).opposites.find(([a, b]) => a === i || b === i);
    return pair ? (pair[0] === i ? pair[1] : pair[0]) : -1;
  }

  function frameCard(f, i, all) {
    const s = S();
    const card = h('article', { class: 'card frame-card', dataset: { index: i } });
    const star = h('button', {
      type: 'button', class: 'star-btn',
      onclick: e => {
        e.stopPropagation();
        s.principal = s.principal === f.id ? null : f.id;
        app.commit();
      },
    }, '★');
    const chev = h('button', {
      type: 'button', class: 'chev-btn', 'aria-label': t('frame.toggle'), 'aria-expanded': 'false',
      onclick: e => { e.stopPropagation(); setOpen(card, !card.classList.contains('is-open')); },
    }, h('span', { 'aria-hidden': 'true' }, '▸'));
    const head = h('div', {
      class: 'card-head',
      onclick: () => {
        const selected = app.selection?.type === 'frame' && app.selection.index === i;
        if (selected && card.classList.contains('is-open')) { setOpen(card, false); return; }
        setOpen(card, true);
        app.select({ type: 'frame', index: i }, { fromPanel: true });
      },
    },
      h('span', { class: 'card-num' }, pad2(i + 1)),
      h('input', {
        class: 'card-name', type: 'text', autocomplete: 'off', value: f.name,
        placeholder: t('frame.namePlaceholder'), 'aria-label': t('frameN', { n: i + 1 }),
        onclick: e => e.stopPropagation(),
        oninput: e => { f.name = e.target.value; app.commit(); },
      }),
      star, chev,
    );

    const opp = oppositeOf(i);
    const body = h('div', { class: 'card-body' },
      textField('frame.sees', f.sees, v => { f.sees = v; app.commit(); }),
      textField('frame.blind', f.blind, v => { f.blind = v; app.commit(); }),
      textField('frame.question', f.question, v => { f.question = v; app.commit(); }, 1),
      h('div', { class: 'card-meta' },
        opp >= 0 ? h('p', { class: 'note' }, t('frame.opposite', { name: frameName(all[opp], opp) })) : null,
        h('select', {
          'aria-label': t('frame.swap'),
          onchange: e => { const j = Number(e.target.value); if (j >= 0) app.swap(i, j); },
        },
          h('option', { value: '-1' }, t('frame.swap')),
          all.map((g, j) => (j === i ? null : h('option', { value: String(j) }, `${pad2(j + 1)} · ${frameName(g, j)}`))),
        ),
      ),
    );
    card.append(head, body);
    card.addEventListener('focusin', () => {
      if (!(app.selection?.type === 'frame' && app.selection.index === i)) {
        app.select({ type: 'frame', index: i }, { fromPanel: true });
      }
    });
    return card;
  }

  function renderFrames() {
    const s = S();
    const all = frames();
    const hidden = s.frames.slice(all.length).filter(hasContent).length;
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
  }

  // ── Dialogues ────────────────────────────────────────────────────────────

  function nameSpan(f, i) {
    return h('span', { class: isActive(f) ? null : 'is-vacant' }, frameName(f, i));
  }

  function dialogueCard(e, all) {
    const s = S();
    const d = () => (s.dialogues[e.key] ||= { tension: '', emerges: '' });
    const current = s.dialogues[e.key] || { tension: '', emerges: '' };
    const dotEl = h('span', { class: 'card-dot', 'aria-hidden': 'true' });
    const card = h('article', { class: 'card dialogue-card', dataset: { a: e.a, b: e.b } });
    const sel = { type: 'edge', a: e.a, b: e.b };
    const isSel = () => app.selection?.type === 'edge' && app.selection.a === e.a && app.selection.b === e.b;
    const update = (field, v) => {
      d()[field] = v;
      dotEl.classList.toggle('is-filled', dialogueHasContent(s.dialogues[e.key]));
      app.commit();
    };
    dotEl.classList.toggle('is-filled', dialogueHasContent(current));
    card.append(
      h('div', {
        class: 'card-head',
        onclick: () => {
          if (isSel() && card.classList.contains('is-open')) { setOpen(card, false); return; }
          setOpen(card, true);
          app.select(sel, { fromPanel: true });
        },
      },
        dotEl,
        h('span', { class: 'card-title' }, nameSpan(all[e.a], e.a), h('span', { class: 'arrow' }, '↔'), nameSpan(all[e.b], e.b)),
        h('button', {
          type: 'button', class: 'chev-btn', 'aria-label': t('frame.toggle'), 'aria-expanded': 'false',
          onclick: ev => { ev.stopPropagation(); setOpen(card, !card.classList.contains('is-open')); },
        }, h('span', { 'aria-hidden': 'true' }, '▸')),
      ),
      h('div', { class: 'card-body' },
        textField('dialogue.tension', current.tension, v => update('tension', v)),
        textField('dialogue.emerges', current.emerges, v => update('emerges', v)),
      ),
    );
    card.addEventListener('focusin', () => { if (!isSel()) app.select(sel, { fromPanel: true }); });
    return card;
  }

  function renderDialogues() {
    const all = frames();
    overlapNote = h('p', { class: 'note is-warning' }, t('dialogue.noOverlap'));
    fill(panels.dialogues,
      h('p', { class: 'intro-text' }, t('dialogues.intro')),
      overlapNote,
      currentEdges(S()).map(e => dialogueCard(e, all)),
    );
    syncDialogues();
  }

  /** Neighbouring caps overlap only if the edge's angle is below twice the cap radius. */
  function edgesOverlap() {
    const s = S();
    const { vertices, edges } = getSolid(s.solid);
    const c = capCos(s.distance);
    return dot(vertices[edges[0][0]], vertices[edges[0][1]]) > 2 * c * c - 1;
  }

  function syncDialogues() {
    if (overlapNote) overlapNote.hidden = edgesOverlap();
    for (const card of panels.dialogues.querySelectorAll('.dialogue-card')) {
      const a = Number(card.dataset.a);
      const b = Number(card.dataset.b);
      card.classList.toggle('is-selected', app.selection?.type === 'edge' && app.selection.a === a && app.selection.b === b);
    }
  }

  // ── Synthesis ────────────────────────────────────────────────────────────

  function renderSynthesis() {
    const s = S();
    const all = frames();
    live.stats = h('div');
    live.pairs = h('div');
    live.analysis = h('div', { class: 'analysis' });
    live.questions = h('div');
    const select = h('select', {
      id: 'principal-select',
      onchange: e => { s.principal = e.target.value || null; app.commit(); },
    },
      h('option', { value: '' }, t('syn.principalNone')),
      all.map((f, i) => h('option', { value: f.id, selected: f.id === s.principal }, `${pad2(i + 1)} · ${frameName(f, i)}`)),
    );
    fill(panels.synthesis,
      h('h3', {}, t('syn.together')), live.stats,
      h('h3', {}, t('syn.opposites')), live.pairs,
      h('h3', {}, t('syn.principal')),
      h('p', { class: 'intro-text' }, t('syn.principalDesc')),
      h('label', { class: 'select-field' }, label(t('syn.principal')), select),
      live.analysis,
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

  function updateSynthesis() {
    if (!live.stats) return;
    const s = S();
    const all = frames();
    const stats = app.getStats();
    const vacant = all.length - stats.activeCount;
    fill(live.stats,
      h('div', { class: 'bigstats' },
        h('div', {}, h('strong', {}, pct(stats.covered)), h('span', {}, t('syn.covered'))),
        h('div', { class: 'is-blind' }, h('strong', {}, pct(stats.blind)), h('span', {}, t('syn.blind'))),
        h('div', {}, h('strong', {}, pct(stats.dialogue)), h('span', {}, t('syn.dialogue'))),
      ),
      h('p', { class: 'note' }, t('syn.capNote', { p: pct(capFraction(s.distance)) })),
      vacant ? h('p', { class: 'note is-warning' }, tn('syn.vacant', vacant)) : null,
    );

    const opposites = getSolid(s.solid).opposites;
    fill(live.pairs,
      opposites.length
        ? [
          h('p', { class: 'note' }, t('syn.oppositesDesc')),
          h('ul', { class: 'pairs' }, opposites.map(([a, b]) => {
            const isSel = app.selection?.type === 'pair' && app.selection.a === a && app.selection.b === b;
            return h('li', {},
              h('button', {
                type: 'button', class: isSel ? 'is-selected' : null,
                onclick: () => app.select(isSel ? null : { type: 'pair', a, b }, { fromPanel: true }),
              }, nameSpan(all[a], a), h('span', { class: 'arrow' }, '⟷'), nameSpan(all[b], b)),
            );
          })),
        ]
        : h('p', { class: 'note' }, t('syn.noOpposites')),
    );

    const pi = all.findIndex(f => f.id === s.principal);
    const select = document.getElementById('principal-select');
    if (select && select.value !== (s.principal || '')) select.value = pi >= 0 ? s.principal : '';
    const an = app.getAnalysis();
    if (pi < 0 || !an) {
      fill(live.analysis);
    } else {
      const p = all[pi];
      fill(live.analysis,
        h('p', {}, t('syn.principalSeen', { name: frameName(p, pi), p: pct(an.seen) })),
        an.path.length
          ? [
            h('p', { class: 'note' }, t('syn.path')),
            h('ol', { class: 'path' }, an.path.map(step => h('li', {},
              h('button', { type: 'button', onclick: () => app.select({ type: 'frame', index: step.index }, { fromPanel: true }) },
                h('span', { class: 'path-name' }, frameName(all[step.index], step.index)),
                h('span', { class: 'path-gain' }, `+${pct(step.gain)} → ${pct(step.total)}`),
                h('span', { class: 'path-bar', 'aria-hidden': 'true' },
                  h('i', { class: 'prev', style: `width:${((step.total - step.gain) * 100).toFixed(1)}%` }),
                  h('i', { class: 'gain', style: `width:${(step.gain * 100).toFixed(1)}%` }),
                ),
              ),
            ))),
            h('p', { class: 'note' }, an.uncovered > 0.0005 ? t('syn.pathRest', { p: pct(an.uncovered) }) : t('syn.pathAll')),
          ]
          : h('p', { class: 'note' }, t('syn.pathNone')),
        p.blind.trim() ? [label(t('syn.yourBlind')), h('p', { class: 'blockquote' }, p.blind.trim())] : null,
      );
    }

    const qs = all.map((f, i) => [f, i]).filter(([f]) => f.question.trim());
    fill(live.questions,
      qs.length
        ? h('ul', { class: 'questions' }, qs.map(([f, i]) => h('li', {}, h('small', {}, frameName(f, i)), f.question.trim())))
        : h('p', { class: 'note' }, t('syn.noQuestions')),
    );
  }

  // ── Shared ───────────────────────────────────────────────────────────────

  function setOpen(card, open) {
    card.classList.toggle('is-open', open);
    card.querySelector('.chev-btn')?.setAttribute('aria-expanded', String(open));
  }

  /** Scrolls the panel (not the page) so `el` is visible. */
  function reveal(el) {
    const top = el.offsetTop;
    if (top < scroller.scrollTop || top + el.offsetHeight > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTo({ top: Math.max(0, top - 12), behavior: 'smooth' });
    }
  }

  function updateCounts() {
    const s = S();
    const all = frames();
    const edges = currentEdges(s);
    document.getElementById('count-frames').textContent = `${all.filter(isActive).length}/${all.length}`;
    document.getElementById('count-dialogues').textContent =
      `${edges.filter(e => dialogueHasContent(s.dialogues[e.key])).length}/${edges.length}`;
  }

  const renderers = { object: renderObject, frames: renderFrames, dialogues: renderDialogues, synthesis: renderSynthesis };

  return {
    render(tab) {
      for (const [k, el] of Object.entries(panels)) if (k !== tab) el.replaceChildren();
      guideList = null;
      overlapNote = null;
      for (const k of Object.keys(live)) delete live[k];
      renderers[tab]();
      updateCounts();
    },

    refresh({ structural = false } = {}) {
      updateCounts();
      if (structural) return this.render(app.tab);
      if (app.tab === 'object') renderGuide();
      else if (app.tab === 'frames') syncFrames();
      else if (app.tab === 'dialogues') syncDialogues();
      else updateSynthesis();
    },

    syncSelection() {
      if (app.tab === 'frames') syncFrames();
      else if (app.tab === 'dialogues') syncDialogues();
      else if (app.tab === 'synthesis') updateSynthesis();
    },

    /** Opens and reveals the card for a selection made in the 3D view. */
    openCard(sel) {
      const card = sel.type === 'frame'
        ? panels.frames.querySelector(`.frame-card[data-index="${sel.index}"]`)
        : panels.dialogues.querySelector(`.dialogue-card[data-a="${sel.a}"][data-b="${sel.b}"]`);
      if (!card) return;
      setOpen(card, true);
      requestAnimationFrame(() => reveal(card));
    },

    focus(target) {
      const el = document.getElementById(target === 'principal' ? 'principal-select' : 'synthesis-text');
      if (!el) return;
      reveal(el.closest('label') || el);
      el.focus({ preventScroll: true });
    },
  };
}
