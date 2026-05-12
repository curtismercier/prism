// Default layout — fallback for unknown PRISM artifact types.
// Renders frontmatter as a generic key/value header, then sections in document order.

import { marked } from 'https://cdn.jsdelivr.net/npm/marked@13/+esm';

function escape(s) {
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

function renderMd(md) {
  return marked.parse(md, { gfm: true, breaks: false });
}

export function renderDefault({ frontmatter: fm, sections, preamble, trailer }) {
  const fmEntries = Object.entries(fm).map(([k, v]) => {
    const val = Array.isArray(v) ? v.join(', ') : (typeof v === 'string' && v.includes('\n') ? `<pre>${escape(v)}</pre>` : escape(v));
    return `<dt>${escape(k)}</dt><dd>${val}</dd>`;
  }).join('');

  const sectionBlocks = Array.from(sections.entries()).map(([name, content]) => `
    <section id="section-${escape(name)}" data-section="${escape(name)}">
      <header class="section-header"><span class="section-tag">${escape(name)}</span></header>
      <div class="section-body">${renderMd(content)}</div>
    </section>
  `).join('');

  return `<article class="prism prism-default" data-type="${escape(fm.type || 'unknown')}">
    <header class="cycle-header">
      <h1>${escape(fm.title || 'PRISM artifact')}</h1>
      ${fm.status ? `<span class="status status-${escape(String(fm.status).split(' ')[0])}">${escape(fm.status)}</span>` : ''}
      <dl class="frontmatter-dl">${fmEntries}</dl>
    </header>
    <div class="cycle-body">
      <main class="cycle-main">
        ${preamble ? `<div class="preamble">${renderMd(preamble)}</div>` : ''}
        ${sectionBlocks}
        ${trailer ? `<div class="trailer">${renderMd(trailer)}</div>` : ''}
      </main>
    </div>
  </article>`;
}
