// Exports: Markdown report, printable report (PDF via the browser) and PNG poster.

import { t, getLang, list } from './i18n.js';
import { faceCount } from './geometry.js';
import { visibleFrames, visibleFindings, currentEdges, edgeHasContent, noteHasContent, tagSymbol } from './state.js';
import { crossMatrix, unread, totals, principalReading } from './analysis.js';
import { PALETTE, frameColor } from './palette.js';

export const SITE_URL = 'https://pahernandezceh.github.io/metacognition/';

export const frameName = (frame, i) => frame.name.trim() || t('frameN', { n: i + 1 });

export const objectName = state => state.object.name.trim() || t('untitled');

const pad2 = n => String(n).padStart(2, '0');

/** "3.2" = second finding of the frame on face 3. Stable while frames keep their faces. */
export function findingLabels(state) {
  const labels = new Map();
  state.frames.forEach((frame, i) => {
    state.findings.filter(f => f.frame === frame.id).forEach((f, k) => labels.set(f.id, `${i + 1}.${k + 1}`));
  });
  return labels;
}

export function slug(text) {
  const s = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return s.slice(0, 60) || 'metacognition';
}

const today = () =>
  new Intl.DateTimeFormat(getLang() === 'es' ? 'es-MX' : 'en-GB', { dateStyle: 'long' }).format(new Date());

const symbols = tags => tags.map(tagSymbol).join(' ');

/** Everything a report needs, in display order. */
export function reportModel(state) {
  const frames = visibleFrames(state);
  const labels = findingLabels(state);
  const findings = visibleFindings(state);
  const nameById = id => {
    const i = state.frames.findIndex(f => f.id === id);
    return i >= 0 ? frameName(state.frames[i], i) : '?';
  };
  const sum = totals(state);
  const pi = frames.findIndex(f => f.id === state.principal);
  let principal = null;
  if (pi >= 0) {
    const r = principalReading(state, pi);
    const names = idx => list(idx.map(j => frameName(frames[j], j)));
    principal = [
      t('syn.p.own', { n: r.ownFindings, m: r.readByOthers }),
      t('syn.p.made', { n: r.rereadsMade }),
      r.notReadingYou.length && r.ownFindings ? t('syn.p.notReadingYou', { list: names(r.notReadingYou) }) : '',
      r.notReadByYou.length ? t('syn.p.notReadByYou', { list: names(r.notReadByYou) }) : '',
    ].filter(Boolean);
  }
  return {
    title: objectName(state),
    description: state.object.description.trim(),
    solid: `${t(`solid.${state.solid}`)} · ${t('nFrames', { n: faceCount(state.solid) })}`,
    totals: t('report.totals', sum),
    stats: [[t('stat.findings'), sum.findings], [t('stat.rereads'), sum.rereads], [t('stat.unread'), sum.unread]],
    frames: frames.map((f, i) => ({
      n: i + 1,
      name: frameName(f, i),
      color: frameColor(f.color),
      principal: i === pi,
      focus: f.focus.trim(),
      question: f.question.trim(),
      findings: findings.filter(x => x.frame === f.id && (noteHasContent(x) || x.rereads.some(noteHasContent))).map(x => ({
        label: labels.get(x.id),
        text: x.text.trim(),
        tags: symbols(x.tags),
        rereads: x.rereads.filter(noteHasContent).map(r => ({ by: nameById(r.frame), tags: symbols(r.tags), text: r.text.trim() })),
      })),
    })),
    edges: currentEdges(state)
      .filter(e => edgeHasContent(state.edges[e.key]))
      .map(e => ({
        a: frameName(frames[e.a], e.a),
        b: frameName(frames[e.b], e.b),
        tension: state.edges[e.key].tension.trim(),
        emerges: state.edges[e.key].emerges.trim(),
      })),
    cross: crossMatrix(state),
    frameHeads: frames.map((f, i) => `${pad2(i + 1)} ${frameName(f, i)}`),
    unread: unread(state).map(x => ({ label: labels.get(x.id), frame: nameById(x.frame), text: x.text.trim() })),
    principal,
    synthesis: state.synthesis.trim(),
    footer: t('report.generated', { date: today() }),
  };
}

const mdText = s => s.replace(/\n+/g, ' ');

export function toMarkdown(model) {
  const L = [`# ${model.title}`, ''];
  if (model.description) L.push(...model.description.split('\n').map(l => `> ${l}`), '');
  L.push(`**${t('report.solid')}:** ${model.solid}  `, model.stats.map(([k, v]) => `**${k}:** ${v}`).join(' · '), '');

  L.push(`## ${t('report.frames')}`, '');
  for (const f of model.frames) {
    L.push(`### ${f.n}. ${f.name}${f.principal ? ` ★ _(${t('report.principalTag')})_` : ''}`, '');
    if (f.focus) L.push(`_${t('frame.focus')}:_ ${mdText(f.focus)}  `);
    if (f.question) L.push(`_${t('frame.question')}:_ ${mdText(f.question)}`);
    if (f.focus || f.question) L.push('');
    for (const x of f.findings) {
      L.push(`- **[${x.label}]** ${mdText(x.text) || t('report.empty')}${x.tags ? ` \`${x.tags}\`` : ''}`);
      for (const r of x.rereads) L.push(`  - ↻ _${r.by}_${r.tags ? ` \`${r.tags}\`` : ''}: ${mdText(r.text) || t('report.empty')}`);
    }
    if (f.findings.length) L.push('');
  }

  if (model.edges.length) {
    L.push(`## ${t('report.edges')}`, '');
    for (const e of model.edges) {
      L.push(`### ${e.a} × ${e.b}`, '');
      L.push(`- **${t('edge.tension')}:** ${e.tension ? mdText(e.tension) : t('report.empty')}`);
      L.push(`- **${t('edge.emerges')}:** ${e.emerges ? mdText(e.emerges) : t('report.empty')}`, '');
    }
  }

  L.push(`## ${t('syn.cross')}`, '', t('syn.crossDesc'), '');
  L.push(`| ${t('syn.crossCorner')} | ${model.frameHeads.map((_, j) => pad2(j + 1)).join(' | ')} |`);
  L.push(`|---|${model.frameHeads.map(() => ':-:').join('|')}|`);
  model.cross.forEach((row, i) => {
    L.push(`| ${model.frameHeads[i]} | ${row.map((n, j) => (i === j ? '—' : n || '·')).join(' | ')} |`);
  });
  L.push('');

  L.push(`## ${t('syn.unread')}`, '');
  if (model.unread.length) for (const u of model.unread) L.push(`- **[${u.label}]** ${mdText(u.text)} _(${u.frame})_`);
  else L.push(t('syn.unreadNone'));
  L.push('');

  if (model.principal) L.push(`## ${t('syn.principal')}`, '', ...model.principal.map(p => `${p}  `), '');
  if (model.synthesis) L.push(`## ${t('syn.text')}`, '', model.synthesis, '');
  L.push('---', '', `_${model.footer}_ ${SITE_URL}`, '');
  return L.join('\n');
}

// ── Printable report ───────────────────────────────────────────────────────

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** Fills `container` with a print-ready version of the report. */
export function fillPrintReport(container, model, imageUrl) {
  container.replaceChildren();
  const head = el('header', 'pr-head');
  head.append(el('p', 'pr-kicker', `Metacognition · ${t('tagline')}`), el('h1', null, model.title));
  if (model.description) head.append(el('p', 'pr-desc', model.description));
  head.append(el('p', 'pr-meta', `${model.solid} · ${model.totals}`));
  container.append(head);

  if (imageUrl) {
    const img = el('img', 'pr-figure');
    img.src = imageUrl;
    img.alt = model.title;
    container.append(img);
  }

  container.append(el('h2', null, t('report.frames')));
  for (const f of model.frames) {
    const sec = el('section', 'pr-frame');
    const h3 = el('h3');
    const sw = el('i', 'pr-swatch');
    sw.style.background = f.color;
    h3.append(sw, `${f.n}. ${f.name}${f.principal ? ` ★ (${t('report.principalTag')})` : ''}`);
    sec.append(h3);
    if (f.focus) sec.append(el('p', 'pr-sub', `${t('frame.focus')}: ${f.focus}`));
    if (f.question) sec.append(el('p', 'pr-sub', `${t('frame.question')}: ${f.question}`));
    const ul = el('ul', 'pr-findings');
    for (const x of f.findings) {
      const li = el('li');
      li.append(el('b', null, `[${x.label}] `), `${x.text || t('report.empty')}${x.tags ? `  ${x.tags}` : ''}`);
      if (x.rereads.length) {
        const sub = el('ul');
        for (const r of x.rereads) sub.append(el('li', null, `↻ ${r.by}${r.tags ? ` ${r.tags}` : ''}: ${r.text || t('report.empty')}`));
        li.append(sub);
      }
      ul.append(li);
    }
    if (f.findings.length) sec.append(ul);
    container.append(sec);
  }

  if (model.edges.length) {
    container.append(el('h2', null, t('report.edges')));
    for (const e of model.edges) {
      const sec = el('section', 'pr-frame');
      sec.append(el('h3', null, `${e.a} × ${e.b}`));
      const dl = el('dl');
      dl.append(
        el('dt', null, t('edge.tension')), el('dd', null, e.tension || t('report.empty')),
        el('dt', null, t('edge.emerges')), el('dd', null, e.emerges || t('report.empty')),
      );
      sec.append(dl);
      container.append(sec);
    }
  }

  const cross = el('section', 'pr-block');
  cross.append(el('h2', null, t('syn.cross')), el('p', 'pr-sub', t('syn.crossDesc')));
  const table = el('table', 'pr-cross');
  const tr = el('tr');
  tr.append(el('th', null, t('syn.crossCorner')), ...model.frameHeads.map((_, j) => el('th', null, pad2(j + 1))));
  table.append(tr);
  model.cross.forEach((row, i) => {
    const r = el('tr');
    r.append(el('th', null, model.frameHeads[i]), ...row.map((n, j) => el('td', null, i === j ? '—' : n ? String(n) : '·')));
    table.append(r);
  });
  cross.append(table);
  container.append(cross);

  const pending = el('section', 'pr-block');
  pending.append(el('h2', null, t('syn.unread')));
  if (model.unread.length) {
    const ul = el('ul');
    for (const u of model.unread) ul.append(el('li', null, `[${u.label}] ${u.text} (${u.frame})`));
    pending.append(ul);
  } else {
    pending.append(el('p', null, t('syn.unreadNone')));
  }
  container.append(pending);

  if (model.principal) {
    const sec = el('section', 'pr-block');
    sec.append(el('h2', null, t('syn.principal')), ...model.principal.map(p => el('p', null, p)));
    container.append(sec);
  }
  if (model.synthesis) {
    const sec = el('section', 'pr-block');
    sec.append(el('h2', null, t('syn.text')), el('p', 'pr-synthesis', model.synthesis));
    container.append(sec);
  }
  container.append(el('footer', 'pr-foot', `${model.footer} ${SITE_URL}`));
}

// ── PNG poster ─────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}

/**
 * Composes the 3D view with its labels, title, totals and frame legend.
 * Synchronous on purpose: the WebGL canvas is only valid until the next frame.
 */
export function composePoster({ glCanvas, labels, cssWidth, cssHeight, model }) {
  const scale = 2;
  const pad = 32;
  const headH = 112;
  const footH = 92;
  const W = Math.max(cssWidth, 720);
  const H = cssHeight + headH + footH;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, W, H);
  const ox = (W - cssWidth) / 2;
  ctx.drawImage(glCanvas, ox, headH, cssWidth, cssHeight);

  ctx.fillStyle = PALETTE.muted;
  ctx.font = '400 11px "DM Mono", ui-monospace, monospace';
  ctx.fillText(`METACOGNITION · ${t('tagline').toUpperCase()}`, pad, 40);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = '400 32px "DM Serif Display", Georgia, serif';
  ctx.fillText(fitText(ctx, model.title, W - pad * 2), pad, 80);
  ctx.fillStyle = '#5c5449';
  ctx.font = '300 13px Lato, system-ui, sans-serif';
  ctx.fillText(`${model.solid} · ${model.totals}`, pad, 102);

  // Window labels
  for (const f of labels.faces) {
    ctx.font = '400 12px Lato, system-ui, sans-serif';
    const text = fitText(ctx, f.text, 160);
    const w = ctx.measureText(text).width + 46;
    const x = ox + f.x - w / 2;
    const y = headH + f.y - 11;
    ctx.fillStyle = 'rgba(245,242,236,0.92)';
    roundRect(ctx, x, y, w, 22, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(31,27,23,0.18)';
    ctx.stroke();
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(x + 10, y + 11, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '400 10px "DM Mono", ui-monospace, monospace';
    ctx.fillText(pad2(f.num), x + 18, y + 15);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = '400 12px Lato, system-ui, sans-serif';
    ctx.fillText(text, x + 36, y + 15);
  }
  // Finding chips
  ctx.font = '400 10px "DM Mono", ui-monospace, monospace';
  for (const c of labels.findings) {
    const w = ctx.measureText(c.text).width + 10;
    const x = ox + c.x + 8;
    const y = headH + c.y - 9;
    ctx.globalAlpha = c.dim ? 0.35 : 1;
    ctx.fillStyle = PALETTE.paper;
    roundRect(ctx, x, y, w, 16, 3);
    ctx.fill();
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(c.text, x + 5, y + 12);
  }
  ctx.globalAlpha = 1;

  // Frame legend
  let x = pad;
  let y = headH + cssHeight + 30;
  ctx.font = '300 12px Lato, system-ui, sans-serif';
  for (const f of model.frames) {
    const text = `${pad2(f.n)} ${f.name}`;
    const w = ctx.measureText(text).width + 30;
    if (x + w > W - pad) { x = pad; y += 20; }
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.arc(x + 5, y - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3d3731';
    ctx.fillText(text, x + 15, y);
    x += w;
  }
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '400 10px "DM Mono", ui-monospace, monospace';
  const credit = SITE_URL.replace('https://', '');
  ctx.fillText(credit, W - pad - ctx.measureText(credit).width, H - 16);
  return canvas;
}

export function download(filename, data, type) {
  const url = typeof data === 'string' && data.startsWith('data:')
    ? data
    : URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  if (url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url), 2000);
}
