// Layout for type:cycle PRISM artifacts.
// Renders: header (title, status, dates, depends-on) + sidebar TOC + sections.
//
// Markdown rendering via marked from jsDelivr — keeps zero-install philosophy.

import { marked } from 'https://cdn.jsdelivr.net/npm/marked@13/+esm';

// Section display order — required sections first, then any custom ones in document order.
const STANDARD_ORDER = [
  'trigger',
  'context',
  'phases',
  'decisions-locked',
  'decisions-to-surface',
  'out-of-scope',
  'outtake',
  'notes',
];

function renderRefs(refs, label) {
  if (!refs || (Array.isArray(refs) && refs.length === 0)) return '';
  const list = Array.isArray(refs) ? refs : [refs];
  return `<span class="ref-group"><span class="ref-label">${label}:</span> ${list.map(r => `<span class="ref">${escape(r)}</span>`).join(' ')}</span>`;
}

function escape(s) {
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function renderMd(md) {
  // Configure marked: tables on, line breaks off (markdown-natural), no mangle.
  return marked.parse(md, { gfm: true, breaks: false });
}

export function renderCycle({ frontmatter: fm, sections, preamble, trailer }) {
  // Filter out nested anchor names (dot-notation, e.g. 'phases.phase-1') —
  // those render inside their parent section's content.
  const topLevelNames = Array.from(sections.keys()).filter(n => !n.includes('.'));

  // Order: standard sections first (in canonical order), then any custom ones not in standard.
  const ordered = [];
  for (const name of STANDARD_ORDER) {
    if (topLevelNames.includes(name)) ordered.push(name);
  }
  for (const name of topLevelNames) {
    if (!STANDARD_ORDER.includes(name)) ordered.push(name);
  }

  const title = escape(fm.title || `Cycle ${fm.cycle ?? '?'}`);
  const cycleNo = fm.cycle != null ? `<span class="cycle-no">#${escape(fm.cycle)}</span>` : '';
  const status = fm.status ? `<span class="status status-${escape(String(fm.status).split(' ')[0])}">${escape(fm.status)}</span>` : '';

  const meta = [];
  if (fm.created) meta.push(`<span class="meta-item"><span class="meta-label">created</span> ${escape(fm.created)}</span>`);
  if (fm.updated && fm.updated !== fm.created) meta.push(`<span class="meta-item"><span class="meta-label">updated</span> ${escape(fm.updated)}</span>`);
  if (fm.author) meta.push(`<span class="meta-item"><span class="meta-label">author</span> ${escape(fm.author)}</span>`);
  if (fm.session) meta.push(`<span class="meta-item"><span class="meta-label">session</span> <code>${escape(fm.session)}</code></span>`);

  const refs = [
    renderRefs(fm.depends_on, 'depends on'),
    renderRefs(fm.companion, 'companion'),
    renderRefs(fm.supersedes, 'supersedes'),
    renderRefs(fm.parent, 'parent'),
  ].filter(Boolean).join(' · ');

  const purposeBlock = fm.purpose ? `<div class="purpose"><div class="purpose-label">Purpose</div>${renderMd(fm.purpose)}</div>` : '';

  // Sidebar TOC
  const toc = `<nav class="toc" aria-label="Sections">
    ${ordered.map(name => `<a href="#section-${escape(name)}" class="toc-item">${escape(name)}</a>`).join('')}
  </nav>`;

  // Sections
  const sectionBlocks = ordered.map(name => {
    const content = sections.get(name);
    const hAnchor = `section-${name}`;
    return `<section id="${escape(hAnchor)}" data-section="${escape(name)}">
      <header class="section-header"><span class="section-tag">${escape(name)}</span></header>
      <div class="section-body">${renderMd(content)}</div>
    </section>`;
  }).join('\n');

  const preambleBlock = preamble ? `<div class="preamble">${renderMd(preamble)}</div>` : '';
  const trailerBlock = trailer ? `<div class="trailer">${renderMd(trailer)}</div>` : '';

  return `<article class="prism prism-cycle" data-type="cycle">
    <header class="cycle-header">
      <div class="cycle-title-row">
        <h1>${title} ${cycleNo}</h1>
        ${status}
      </div>
      ${meta.length ? `<div class="meta-row">${meta.join(' · ')}</div>` : ''}
      ${refs ? `<div class="refs-row">${refs}</div>` : ''}
      ${purposeBlock}
    </header>
    <div class="cycle-body">
      ${toc}
      <main class="cycle-main">
        ${preambleBlock}
        ${sectionBlocks}
        ${trailerBlock}
      </main>
    </div>
  </article>`;
}
