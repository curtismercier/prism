// HTML projection — emits a full standalone HTML document.
// Uses 'marked' for markdown rendering. Inlines styles via <link> to a co-located styles.css.

import { marked } from 'marked';

const STANDARD_ORDER = [
  'trigger', 'context', 'phases', 'decisions-locked', 'decisions-to-surface',
  'out-of-scope', 'outtake', 'notes',
];

const escape = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const renderMd = (md) => marked.parse(md, { gfm: true, breaks: false });

function renderRefs(refs, label) {
  if (!refs || (Array.isArray(refs) && refs.length === 0)) return '';
  const list = Array.isArray(refs) ? refs : [refs];
  return `<span class="ref-group"><span class="ref-label">${label}:</span> ${list.map(r => `<span class="ref">${escape(r)}</span>`).join(' ')}</span>`;
}

function renderCycle({ frontmatter: fm, sections, preamble, trailer }) {
  const topLevelNames = Array.from(sections.keys()).filter(n => !n.includes('.'));
  const ordered = [];
  for (const name of STANDARD_ORDER) if (topLevelNames.includes(name)) ordered.push(name);
  for (const name of topLevelNames) if (!STANDARD_ORDER.includes(name)) ordered.push(name);

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

  const toc = `<nav class="toc" aria-label="Sections">
    ${ordered.map(name => `<a href="#section-${escape(name)}" class="toc-item">${escape(name)}</a>`).join('')}
  </nav>`;

  const sectionBlocks = ordered.map(name => {
    const content = sections.get(name);
    return `<section id="section-${escape(name)}" data-section="${escape(name)}">
      <header class="section-header"><span class="section-tag">${escape(name)}</span></header>
      <div class="section-body">${renderMd(content)}</div>
    </section>`;
  }).join('\n');

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
        ${preamble ? `<div class="preamble">${renderMd(preamble)}</div>` : ''}
        ${sectionBlocks}
        ${trailer ? `<div class="trailer">${renderMd(trailer)}</div>` : ''}
      </main>
    </div>
  </article>`;
}

function renderDefault({ frontmatter: fm, sections, preamble, trailer }) {
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

const LAYOUTS = { cycle: renderCycle };

/**
 * Wrap rendered article in a full HTML document with the styles.css.
 */
export function renderHtmlDocument(parsed, options = {}) {
  const type = parsed.frontmatter?.type || 'unknown';
  const layout = LAYOUTS[type] || renderDefault;
  const article = layout(parsed);
  const title = escape(parsed.frontmatter?.title || 'PRISM artifact');
  const stylesPath = options.stylesPath || './styles.css';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="${escape(stylesPath)}">
</head>
<body>
${article}
</body>
</html>
`;
}
