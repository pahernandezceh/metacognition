// Exports: Markdown report, printable report (PDF via the browser) and PNG poster.

import { t, pct, getLang } from './i18n.js';
import { capFraction, vertexCount } from './geometry.js';
import { visibleFrames, currentEdges, dialogueHasContent, isActive } from './state.js';
import { PALETTE } from './scene.js';

export const SITE_URL = 'https://pahernandezceh.github.io/metacognition/';

export const frameName = (frame, i) => frame.name.trim() || t('frameN', { n: i + 1 });

export const objectName = state => state.object.name.trim() || t('untitled');

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

/** Everything a report needs, in display order. */
export function reportModel(state, stats, analysis) {
  const frames = visibleFrames(state);
  const principalIndex = frames.findIndex(f => f.id === state.principal);
  const dialogues = currentEdges(state)
    .map(e => ({ ...e, d: state.dialogues[e.key] }))
    .filter(e => dialogueHasContent(e.d))
    .map(e => ({
      a: frameName(frames[e.a], e.a),
      b: frameName(frames[e.b], e.b),
      tension: e.d.tension.trim(),
      emerges: e.d.emerges.trim(),
    }));
  return {
    title: objectName(state),
    description: state.object.description.trim(),
    solid: `${t(`solid.${state.solid}`)} · ${t('nFrames', { n: vertexCount(state.solid) })}`,
    distance: `${state.distance.toFixed(2)} · ${t('report.capNote', { p: pct(capFraction(state.distance)) })}`,
    stats: [
      [t('stat.covered'), pct(stats.covered)],
      [t('stat.blind'), pct(stats.blind)],
      [t('stat.dialogue'), pct(stats.dialogue)],
    ],
    frames: frames.map((f, i) => ({
      n: i + 1,
      name: frameName(f, i),
      principal: i === principalIndex,
      active: isActive(f),
      fields: [
        [t('frame.sees'), f.sees.trim()],
        [t('frame.blind'), f.blind.trim()],
        [t('frame.question'), f.question.trim()],
      ],
    })),
    dialogues,
    principal:
      principalIndex >= 0 && analysis
        ? {
          seen: t('syn.principalSeen', { name: frameName(frames[principalIndex], principalIndex), p: pct(analysis.seen) }),
          path: analysis.path.map(s => `${frameName(frames[s.index], s.index)}: +${pct(s.gain)} → ${pct(s.total)}`),
          rest: analysis.path.length
            ? analysis.uncovered > 0.0005 ? t('syn.pathRest', { p: pct(analysis.uncovered) }) : t('syn.pathAll')
            : '',
        }
        : null,
    synthesis: state.synthesis.trim(),
    footer: t('report.generated', { date: today() }),
  };
}

const mdText = s => s.replace(/\n+/g, '\n  ');

export function toMarkdown(model) {
  const L = [`# ${model.title}`, ''];
  if (model.description) L.push(...model.description.split('\n').map(l => `> ${l}`), '');
  L.push(`**${t('report.solid')}:** ${model.solid}  `);
  L.push(`**${t('report.distance')}:** ${model.distance}  `);
  L.push(model.stats.map(([k, v]) => `**${k}:** ${v}`).join(' · '), '');

  L.push(`## ${t('report.frames')}`, '');
  for (const f of model.frames) {
    L.push(`### ${f.n}. ${f.name}${f.principal ? ` ★ _(${t('report.principalTag')})_` : ''}`, '');
    for (const [k, v] of f.fields) L.push(`- **${k}:** ${v ? mdText(v) : t('report.empty')}`);
    L.push('');
  }

  if (model.dialogues.length) {
    L.push(`## ${t('report.dialogues')}`, '');
    for (const d of model.dialogues) {
      L.push(`### ${d.a} ↔ ${d.b}`, '');
      L.push(`- **${t('dialogue.tension')}:** ${d.tension ? mdText(d.tension) : t('report.empty')}`);
      L.push(`- **${t('dialogue.emerges')}:** ${d.emerges ? mdText(d.emerges) : t('report.empty')}`, '');
    }
  }

  if (model.principal) {
    L.push(`## ${t('syn.principal')}`, '', model.principal.seen, '');
    if (model.principal.path.length) {
      L.push(`${t('syn.path')}`, '');
      model.principal.path.forEach((p, i) => L.push(`${i + 1}. ${p}`));
      L.push('', model.principal.rest, '');
    }
  }

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
  container.append(head);

  if (imageUrl) {
    const img = el('img', 'pr-figure');
    img.src = imageUrl;
    img.alt = model.title;
    container.append(img);
  }

  const meta = el('dl', 'pr-meta');
  for (const [k, v] of [[t('report.solid'), model.solid], [t('report.distance'), model.distance], ...model.stats]) {
    meta.append(el('dt', null, k), el('dd', null, v));
  }
  container.append(meta);

  container.append(el('h2', null, t('report.frames')));
  for (const f of model.frames) {
    const sec = el('section', 'pr-frame');
    sec.append(el('h3', null, `${f.n}. ${f.name}${f.principal ? ` ★ (${t('report.principalTag')})` : ''}`));
    const dl = el('dl');
    for (const [k, v] of f.fields) dl.append(el('dt', null, k), el('dd', null, v || t('report.empty')));
    sec.append(dl);
    container.append(sec);
  }

  if (model.dialogues.length) {
    container.append(el('h2', null, t('report.dialogues')));
    for (const d of model.dialogues) {
      const sec = el('section', 'pr-frame');
      sec.append(el('h3', null, `${d.a} ↔ ${d.b}`));
      const dl = el('dl');
      dl.append(
        el('dt', null, t('dialogue.tension')), el('dd', null, d.tension || t('report.empty')),
        el('dt', null, t('dialogue.emerges')), el('dd', null, d.emerges || t('report.empty')),
      );
      sec.append(dl);
      container.append(sec);
    }
  }

  if (model.principal) {
    const sec = el('section', 'pr-block');
    sec.append(el('h2', null, t('syn.principal')), el('p', null, model.principal.seen));
    if (model.principal.path.length) {
      sec.append(el('p', null, t('syn.path')));
      const ol = el('ol');
      for (const p of model.principal.path) ol.append(el('li', null, p));
      sec.append(ol, el('p', null, model.principal.rest));
    }
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
 * Composes the 3D view with labels, title, stats and legend into one image.
 * Synchronous on purpose: the WebGL canvas is only valid until the next frame.
 * @param {HTMLCanvasElement} glCanvas freshly rendered WebGL canvas
 * @param {{x: number, y: number, behind: boolean, left: boolean}[]} points CSS-pixel vertex positions
 */
export function composePoster({ glCanvas, points, cssWidth, cssHeight, model, labels, legend }) {
  const scale = 2;
  const pad = 32;
  const headH = 112;
  const footH = 84;
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

  // Header
  ctx.fillStyle = '#8a8070';
  ctx.font = '400 11px "DM Mono", ui-monospace, monospace';
  ctx.fillText(`METACOGNITION · ${t('tagline').toUpperCase()}`, pad, 40);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = '400 32px "DM Serif Display", Georgia, serif';
  ctx.fillText(fitText(ctx, model.title, W - pad * 2), pad, 80);
  ctx.fillStyle = '#5c5449';
  ctx.font = '300 13px Lato, system-ui, sans-serif';
  ctx.fillText(model.solid, pad, 102);

  // Vertex labels
  ctx.font = '400 12px Lato, system-ui, sans-serif';
  points.forEach((p, i) => {
    const text = fitText(ctx, labels[i], 170);
    const w = ctx.measureText(text).width + 34;
    const x = ox + (p.left ? p.x - 12 - w : p.x + 12);
    const y = headH + p.y - 11;
    ctx.globalAlpha = p.behind ? 0.35 : 0.95;
    ctx.fillStyle = PALETTE.paper;
    roundRect(ctx, x, y, w, 22, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(31,27,23,0.18)';
    ctx.stroke();
    ctx.fillStyle = '#8a8070';
    ctx.font = '400 10px "DM Mono", ui-monospace, monospace';
    ctx.fillText(String(i + 1).padStart(2, '0'), x + 7, y + 15);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = '400 12px Lato, system-ui, sans-serif';
    ctx.fillText(text, x + 27, y + 15);
  });
  ctx.globalAlpha = 1;

  // Footer: stats, legend, credit
  const fy = headH + cssHeight + 30;
  ctx.font = '400 11px "DM Mono", ui-monospace, monospace';
  let x = pad;
  for (const [k, v] of model.stats) {
    ctx.fillStyle = '#8a8070';
    const label = `${k.toUpperCase()} `;
    ctx.fillText(label, x, fy);
    x += ctx.measureText(label).width;
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(v, x, fy);
    x += ctx.measureText(v).width + 22;
  }
  x = pad;
  ctx.font = '300 12px Lato, system-ui, sans-serif';
  for (const item of legend) {
    ctx.fillStyle = item.color;
    ctx.fillRect(x, fy + 16, 12, 12);
    ctx.strokeStyle = 'rgba(31,27,23,0.25)';
    ctx.strokeRect(x + 0.5, fy + 16.5, 11, 11);
    ctx.fillStyle = '#3d3731';
    ctx.fillText(item.label, x + 18, fy + 26);
    x += ctx.measureText(item.label).width + 36;
  }
  ctx.fillStyle = '#8a8070';
  ctx.font = '400 10px "DM Mono", ui-monospace, monospace';
  const credit = SITE_URL.replace('https://', '');
  ctx.fillText(credit, W - pad - ctx.measureText(credit).width, H - 18);

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
