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

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'section';

// Derive sections from `## ` headings for documents that carry no @section anchors.
// This is a VIEWER affordance, not a spec behaviour: the PRISM parser stays
// anchor-only, so conformance is unchanged. Fenced code is tracked so a `## ` inside
// a shell block cannot open a phantom section.
function deriveSections(md) {
  const sections = new Map();
  const titles = new Map();
  const pre = [];
  let cur = null;
  let fence = false;
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const m = fence ? null : /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      const title = m[1].replace(/\s*#+\s*$/, '').trim();
      const base = slugify(title);
      let name = base;
      let n = 2;
      while (sections.has(name)) name = `${base}-${n++}`;
      cur = name;
      sections.set(name, []);
      titles.set(name, title);
    } else if (cur) {
      sections.get(cur).push(line);
    } else {
      pre.push(line);
    }
  }
  for (const [k, v] of sections) sections.set(k, v.join('\n').trim());
  return { sections, titles, preamble: pre.join('\n').trim() };
}

export function renderCycle({ frontmatter: fm, sections, preamble, trailer }) {
  // A document with no @section anchors parses to zero sections and one giant
  // preamble — the Markdown wall PRISM exists to fix. Fall back to headings so it
  // still gets a TOC, but mark it: a derived anchor is NOT a stable address (it
  // breaks when someone rewords a heading, and cannot be edited surgically).
  // Rendering derived and real identically would hide which documents actually
  // have addressing — the same defect as a badge that conflates two opposite states.
  let derived = false;
  let titles = new Map();
  let effPreamble = preamble;
  if (sections.size === 0 && preamble) {
    const split = deriveSections(preamble);
    if (split.sections.size > 0) {
      sections = split.sections;
      titles = split.titles;
      effPreamble = split.preamble;
      derived = true;
    }
  }

  // Filter out nested anchor names (dot-notation, e.g. 'phases.phase-1') —
  // those render inside their parent section's content.
  const topLevelNames = Array.from(sections.keys()).filter(n => !n.includes('.'));

  // Order: standard sections first (in canonical order), then any custom ones not in standard.
  //
  // DERIVED sections are exempt: they keep document order. Canonical ordering is a
  // promise the author made by writing @section anchors; a document that never opted
  // into the vocabulary must not be resequenced by it. Without this, a heading slugged
  // to `phases` silently jumped above the document's own opening section.
  const ordered = [];
  if (derived) {
    ordered.push(...topLevelNames);
  } else {
    for (const name of STANDARD_ORDER) {
      if (topLevelNames.includes(name)) ordered.push(name);
    }
    for (const name of topLevelNames) {
      if (!STANDARD_ORDER.includes(name)) ordered.push(name);
    }
  }

  // Fall back through the fields an artifact ACTUALLY has before inventing a number.
  // `Cycle ${fm.cycle ?? '?'}` rendered a literal "Cycle ?" on every artifact using the
  // project/arc/phase model, which deliberately dropped `cycle:` numbers -- ordinals are
  // positions WITHIN an arc, never IDs, so most cycles legitimately have no number.
  // A placeholder that fires on correct input is a bug in the placeholder. (s01-bbca8a)
  const title = escape(
    fm.title
    || fm.phase
    || fm.id
    || fm.slug
    || fm.name
    || (fm.cycle != null ? `Cycle ${fm.cycle}` : '')
    || (fm.description ? String(fm.description).split(/[.\u2014\u2013]/)[0].trim() : '')
    || 'Untitled artifact'
  );
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

  // Sidebar TOC. When sections were derived from headings rather than read from
  // @section anchors, the nav is labelled so a reader can tell addressable
  // documents from merely-navigable ones at a glance.
  const toc = ordered.length === 0 ? '' : `<nav class="toc${derived ? ' toc-derived' : ''}" aria-label="Sections">
    ${derived ? '<span class="toc-note" title="Derived from ## headings — not stable anchors. Add @section anchors for addressable, surgically-editable sections.">derived</span>' : ''}
    ${ordered.map(name => `<a href="#section-${escape(name)}" class="toc-item">${escape(titles.get(name) || name)}</a>`).join('')}
  </nav>`;

  // Sections
  const sectionBlocks = ordered.map(name => {
    const content = sections.get(name);
    const hAnchor = `section-${name}`;
    const label = titles.get(name) || name;
    return `<section id="${escape(hAnchor)}" data-section="${escape(name)}"${derived ? ' data-derived="true"' : ''}>
      <header class="section-header"><span class="section-tag">${escape(label)}</span></header>
      <div class="section-body">${renderMd(content)}</div>
    </section>`;
  }).join('\n');

  const preambleBlock = effPreamble ? `<div class="preamble">${renderMd(effPreamble)}</div>` : '';
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
