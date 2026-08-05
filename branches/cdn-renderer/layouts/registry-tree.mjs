// PRISM registry — GROUPED TREE mode (project → arc → phase)
//
// Split out of `registry.mjs` when that file crossed its own falsifiable gate
// (002 §notes line 298: "if registry.mjs passes ~600 lines, split it by concern").
// The flat table already lived in its own module for exactly this reason; the
// grouped tree is its sibling concern, so it lives beside it.
//
// This module owns:
//   · the row/group VOCABULARY (pill, dates, stats chips, artifact chips, leafRow)
//   · buildTree()   — project → arc → phase markup
//   · attachTree()  — open/closed persistence, caret state, arc/project sorting
//
// It does NOT own filtering, cards, the URL hash, or the detail pane. Those stay in
// `registry.mjs` (state) and `registry-detail.mjs` (surface).

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const BUCKET_CLASS = {
  Broken: 'reg-b-broken', Active: 'reg-b-active', Seeded: 'reg-b-seeded',
  Shipped: 'reg-b-shipped', Closed: 'reg-b-shipped', Done: 'reg-b-shipped',
};

export const pill = (r) =>
  `<span class="reg-pill ${BUCKET_CLASS[r.bucket] || 'reg-b-other'}" title="${esc(r.status)}">${esc((r.status || '—').slice(0, 40))}</span>`;

const dates = (r) => {
  const drift = r.claimed && r.git && r.claimed !== r.git;
  return `<span class="reg-meta">
    <span class="reg-d" title="created">${esc(r.created || '—')}</span>
    <span class="reg-d ${drift ? 'reg-drift' : ''}" title="${drift ? 'frontmatter claim disagrees with git' : 'frontmatter updated:'}">${esc(r.claimed || '—')}</span>
    <span class="reg-d" title="last git commit — ground truth">${esc(r.git || '—')}</span>
    <span class="reg-age" title="age on ground truth">${r.age_days == null ? '—' : r.age_days + 'd'}</span>
  </span>`;
};

export const blob = (r) => esc([r.slug, r.title, r.status, r.arc, r.phase, (r.tags || []).join(' '), r.rel]
  .filter(Boolean).join(' ').toLowerCase());

// Aggregate stats for a group header. A bare count is the least useful number
// available: it says how much is here, never what STATE it is in or whether it is
// still moving. Zero-valued buckets are omitted so the chip row stays scannable.
const BUCKET_SHORT = { Active: 'A', Seeded: 'S', Shipped: 'C', Closed: 'C', Done: 'C', Broken: '!', Other: 'O' };

function statsOf(rows) {
  const by = new Map();
  let newestCreated = null, minAge = null, broken = 0;
  for (const r of rows) {
    const k = r.bucket || 'Other';
    by.set(k, (by.get(k) || 0) + 1);
    if (r.error) broken++;
    if (r.created && /^\d{4}-\d{2}-\d{2}$/.test(r.created) && (!newestCreated || r.created > newestCreated)) newestCreated = r.created;
    if (r.age_days != null && (minAge == null || r.age_days < minAge)) minAge = r.age_days;
  }
  return { by, newestCreated, minAge, broken, total: rows.length };
}

function statsHtml(st) {
  // Merge Shipped/Closed/Done into one "C" bucket -- they are the same state wearing
  // three vocabularies, and splitting them would imply a distinction we do not make.
  const merged = new Map();
  for (const [k, n] of st.by) {
    const short = BUCKET_SHORT[k] || 'O';
    merged.set(short, (merged.get(short) || 0) + n);
  }
  const order = ['A', 'S', 'C', 'O', '!'];
  const label = { A: 'active', S: 'seeded', C: 'closed / shipped', O: 'other', '!': 'unparseable' };
  const chips = order.filter((k) => merged.get(k)).map((k) =>
    `<span class="reg-stat reg-stat-${k === '!' ? 'x' : k}" title="${merged.get(k)} ${label[k]}">${merged.get(k)}${k}</span>`).join('');
  const added = st.newestCreated
    ? `<span class="reg-stat-added" title="most recent created: date in this group">+${esc(st.newestCreated)}</span>` : '';
  const fresh = st.minAge != null
    ? `<span class="reg-stat-fresh" title="most recent activity (git) in this group">${st.minAge}d</span>` : '';
  // Group completion from data already shipped -- no emitter change, no body parsing.
  // Deliberately NOT a per-document task bar: only ~20% of documents carry checkboxes,
  // so a per-row percentage would render 0% for a document that simply has no tasks --
  // and "nothing to do" and "nothing done" are opposite claims.
  // Denominator excludes unparseable rows: a row we could not read is not a row we
  // know to be incomplete.
  const measurable = st.total - st.broken;
  const done = merged.get('C') || 0;
  const pct = measurable > 0
    ? `<span class="reg-stat-pct" title="${done} of ${measurable} parseable cycles in this group are closed/shipped${st.broken ? ` (${st.broken} unparseable excluded)` : ''}">${done}/${measurable} · ${Math.round(100 * done / measurable)}%</span>`
    : '';
  return `<span class="reg-stats">${chips}${pct}${added}${fresh}</span>`;
}

// Hrefs in the data are relative to the JSON FILE. A nested <soma-artifact> resolves
// its src against the DOCUMENT. Those two bases differ whenever the .json does not sit
// beside the page -- ours is in `_browser/`, one level down -- so every drill-in 404'd
// while the DOM looked perfect. Absolutise here, against the data URL. (s01-bbca8a:
// the third instance of "relative path resolved against the wrong base" in this file.)
let HREF_BASE = null;
/** Set by renderRegistry the moment the data URL is known. Module-level, because every
 *  href in the tree needs it and threading it through six call sites buys nothing. */
export const setHrefBase = (src) => { HREF_BASE = src; };
export const abs = (h) => { try { return h ? new URL(h, HREF_BASE || document.baseURI).href : ''; } catch { return h || ''; } };

// Sibling artifacts a cycle PRODUCED — a rendered map, a dashboard, a census, briefs.
// Emitted by soma-cycles-registry.py `json` as `artifacts:[{name,href,kind}]`.
//
// These are REAL <a target="_blank">, not row-clicks, and the difference is the point:
// the row opens a nested <soma-artifact> in the detail pane (a PRISM projection of the
// cycle.md), while an artifact is a finished page that wants its own window. Routing a
// rendered dashboard through the detail pane would try to project a page that is
// already a page. `data-artifact` also stops the row handler from firing underneath.
const ART_GLYPH = { view: '▦', note: '✎', img: '🖼', data: '{}' };
// A .md sibling is PROJECTABLE: PRISM can render it through its own layout the same way
// it renders the cycle.md beside it. Anything else is a finished page or a binary and
// keeps its own window. Decided on the EXTENSION, not on `kind`, because `kind` describes
// what the artifact is FOR (view/note/img/data) and this question is only ever "can the
// renderer parse it".
const isProjectable = (href) => /\.mdx?(?:[?#]|$)/i.test(String(href || ''));
const artifactChips = (r) => {
  const list = r.artifacts || [];
  if (!list.length) return '';
  const more = (r.artifact_count || list.length) - list.length;
  return `<span class="reg-arts">` + list.map((a) => {
    const proj = isProjectable(a.href);
    return `<a class="reg-art reg-art-${esc(a.kind)}${proj ? ' reg-art-proj' : ''}" data-artifact
        ${proj ? `data-projectable data-art-name="${esc(a.name)}" data-art-of="${esc(r.slug || '')}"` : ''}
        href="${esc(abs(a.href))}"${proj ? '' : ' target="_blank" rel="noopener"'}
        title="${esc(a.name)} — ${proj ? 'renders here, like a cycle' : 'opens in a new window'}">${ART_GLYPH[a.kind] || '•'} ${esc(
          a.name.length > 26 ? a.name.slice(0, 24) + '…' : a.name)}</a>`;
  }).join('') +
    (more > 0 ? `<span class="reg-art reg-art-more" title="${more} more not listed">+${more}</span>` : '') +
    `</span>`;
};

// ONE definition of the user-facing project string. Curtis (2026-08-05): `meetsoma/releases` is
// its OWN project tier — the shipped harness/agent work + soma.gravicity.ai — not merged under
// `meetsoma` (body/cycles.md:219; the old design comment calling the split a "non-tier" is
// superseded). Keying on tree_kind renders `meetsoma` (ongoing) and `meetsoma/releases` (shipped)
// as two collapsible project folders.
// Display, every data-project attribute, the facet list AND the filter all read THIS function.
// Display and filter comparing different strings is how the 4th silent bug in this seam happened
// (s01-7ca9ab defect report, fixed s01-a134e9) — if you need a raw project value, add a
// data-project-raw attribute; do NOT fork this definition.
export const displayProject = (r) =>
  (r.tree_kind === 'releases' && r.project) ? `${r.project}/releases` : (r.project || '');

function leafRow(r, isPhase) {
  return `<div class="reg-row ${r.error ? 'reg-row-broken' : ''} ${isPhase ? 'reg-row-phase' : ''}"
      data-row data-href="${esc(abs(r.href))}" data-blob="${blob(r)}"
      data-bucket="${esc(r.bucket || '')}" data-broken="${r.error ? '1' : '0'}"
      data-project="${esc(displayProject(r))}" data-scope="${esc(r.tree_kind || '')}"
      data-program="${esc(r.program || '')}"
      data-git="${r.git ? '1' : '0'}"
      data-age="${r.age_days ?? -1}" data-name="${esc(r.phase || r.arc || r.slug)}"
      data-label="${esc(r.phase || r.slug)}">
    <span class="reg-name">
      ${r.error ? '<span class="reg-badge-broken">UNPARSEABLE</span> ' : ''}
      <span class="reg-nm">${esc(r.phase || r.slug)}</span>
      ${r.title ? `<span class="reg-title">${esc(r.title)}</span>` : ''}
      ${r.error ? `<span class="reg-err">${esc(r.error)}</span>` : ''}
      ${!r.error && r.status_note ? `<span class="reg-status-note" title="status_note -- prose split out of status:">${esc(r.status_note)}</span>` : ''}
      ${artifactChips(r)}
    </span>
    ${pill(r)}${dates(r)}
  </div>`;
}

/**
 * project → arc → [rows], rendered as the collapsible tree.
 * @returns {{ html: string, projectCount: number }} — projectCount feeds the census card,
 *   which must count the groups actually rendered rather than re-deriving them.
 */
export function buildTree(rows) {
  const byProject = new Map();
  for (const r of rows) {
    const proj = displayProject(r) || '(unknown)';
    if (!byProject.has(proj)) byProject.set(proj, new Map());
    const arcs = byProject.get(proj);
    const arc = r.arc || '(root)';
    if (!arcs.has(arc)) arcs.set(arc, []);
    arcs.get(arc).push(r);
  }

  const projOrder = [...byProject.keys()].sort((a, b) =>
    byProject.get(b).size - byProject.get(a).size || a.localeCompare(b));

  const html = projOrder.map((proj) => {
    const arcs = byProject.get(proj);
    const allRows = [...arcs.values()].flat();
    const nCycles = allRows.length;
    const nBroken = allRows.filter((r) => r.error).length;
    const projStats = statsOf(allRows);

    const arcOrder = [...arcs.keys()].sort((a, b) => a.localeCompare(b));
    const arcHtml = arcOrder.map((arcName) => {
      const members = arcs.get(arcName);
      const entry = members.find((m) => !m.phase);            // the arc's own cycle.md
      const phases = members.filter((m) => m.phase)
        .sort((a, b) => String(a.phase).localeCompare(String(b.phase)));

      // A singleton is NOT an arc — render it as a leaf, never as a group of one.
      if (!phases.length) {
        return members.map((m) => leafRow(m, false)).join('');
      }

      const ages = members.map((m) => m.age_days).filter((n) => n != null);
      return `<div class="reg-arc" data-arc data-blob="${esc(arcName.toLowerCase())}"
          data-age="${ages.length ? Math.min(...ages) : -1}" data-name="${esc(arcName)}">
        <div class="reg-arc-head" data-arc-toggle tabindex="0" role="button" aria-expanded="true">
          <span class="reg-caret">▾</span>
          <span class="reg-arc-name">${esc(arcName)}</span>
          <span class="reg-arc-n">${phases.length} phase${phases.length === 1 ? '' : 's'}</span>
          ${entry ? pill(entry)
              : (members[0] && members[0].arc_is_kind_folder
                  ? '<span class="reg-pill reg-kindfolder" title="A legacy KIND folder (grouped by how the work was done, not by subject). STACKING-PROPOSAL \u00a72 rules these DISSOLVE as members complete \u2014 do NOT write an arc entry for it; that entrenches the axis being removed.">legacy kind-folder \u2014 dissolve</span>'
                  : '<span class="reg-pill reg-b-other reg-noentry" title="A genuine arc with phases but no cycle.md of its own \u2014 no through-line. This one SHOULD get an arc entry.">no arc entry \u2014 needs one</span>')}
          ${statsHtml(statsOf(phases))}
        </div>
        <div class="reg-arc-body">
          ${entry ? `<div class="reg-entrylink" data-row data-href="${esc(abs(entry.href))}"
              data-blob="${blob(entry)}" data-bucket="${esc(entry.bucket || '')}"
              data-project="${esc(displayProject(entry))}" data-scope="${esc(entry.tree_kind || '')}"
              data-git="${entry.git ? '1' : '0'}"
              data-broken="0" data-age="${entry.age_days ?? -1}" data-label="${esc(entry.slug)}">
              ↳ open the arc (<code>cycle.md</code>)${entry.title ? ` — <span class="reg-title">${esc(entry.title)}</span>` : ''}
            </div>` : ''}
          ${phases.map((p) => leafRow(p, true)).join('')}
        </div>
      </div>`;
    }).join('');

    // data-age = the project's MEDIAN row age, not its minimum. Measured s01-593a6d:
    // `personal/tincture-css` has min 0 / median 93 -- one recently-touched file would
    // rank a dormant project above `meetsoma` (median 1). Min answers "did anything
    // ever happen here"; median answers "is this project live", which is the question
    // a collapsed-by-default view is asking. -1 = no git dates at all, sorts LAST.
    // NOTE: allRows, not the GLOBAL row set -- keying off the global set gave every
    // project the same age (0), silently degenerating the sort into alphabetical.
    const projAges = allRows.map((r) => r.age_days).filter((a) => Number.isFinite(a)).sort((a, b) => a - b);
    const projAge = projAges.length ? projAges[Math.floor(projAges.length / 2)] : -1;

    return `<section class="reg-proj" data-proj data-name="${esc(proj)}" data-age="${projAge}">
      <h3 class="reg-proj-head" data-proj-toggle tabindex="0" role="button" aria-expanded="true">
        <span class="reg-caret">▾</span>
        <span class="reg-proj-name">${esc(proj)}</span>
        <span class="reg-proj-n">${nCycles}</span>
        <span class="reg-proj-arcs" title="arcs in this project (a cycle claimed via frontmatter arc: counts toward the arc it declares)">${arcs.size} arc${arcs.size === 1 ? '' : 's'}</span>
        ${statsHtml(projStats)}
        ${nBroken ? `<span class="reg-badge-broken">${nBroken} broken</span>` : ''}
      </h3>
      <div class="reg-proj-body">${arcHtml}</div>
    </section>`;
  }).join('');

  return { html, projectCount: byProject.size };
}

/**
 * Open/closed persistence, caret state, keyboard toggling, arc + project sorting.
 * @param {Element} wrap      the [data-reg] root
 * @param {Element} collapseBtn  the collapse-all/expand-all control (owned here: its
 *   LABEL is derived from the DOM, and three assignments of one fact is three chances
 *   to diverge)
 * @returns {{ sortArcs(mode:string):void, sortProjects():void, restore():boolean }}
 */
export function attachTree(wrap, collapseBtn) {
  // ── Tree open/closed state ────────────────────────────────────────
  // Tree geometry lives in sessionStorage, NOT the hash — the split is deliberate: the hash is for
  // SHAREABLE state (which rows you are looking at), tree geometry is for THIS TAB.
  // 78 group ids would also make the URL unshareable, which defeats the hash's whole
  // purpose. Refresh is same-tab, so sessionStorage is exactly the right lifetime.
  const TREE_KEY = 'reg-tree-open-v1';
  // Groups carry no id of their own -- `data-arc`/`data-proj` are bare markers. The
  // stable identifiers are one attribute over: data-name on projects, data-blob on arcs.
  const groupId = (el) =>
    (el.hasAttribute('data-proj') ? 'p:' : 'a:') +
    (el.getAttribute('data-name') || el.getAttribute('data-blob') || '');

  let allClosed = false;

  function saveTree() {
    try {
      const open = [...wrap.querySelectorAll('[data-arc],[data-proj]')]
        .filter((el) => !el.classList.contains('reg-closed'))
        .map(groupId).filter((id) => id.length > 2);
      // Store the ARRAY even when empty. "no key" (never visited) and "key holding []"
      // (user closed everything) must stay distinguishable, or a deliberate
      // collapse-all is indistinguishable from a first visit and gets re-applied.
      sessionStorage.setItem(TREE_KEY, JSON.stringify(open));
    } catch { /* private mode / quota -- degrade to the old default, never throw */ }
  }

  // The button's label was assigned in three separate places and they disagreed:
  // after a restore it read "expand all" while a group was visibly open, so the one
  // control that describes tree state was lying about it. Derive it from the DOM in
  // ONE place instead — three assignments of one fact is three chances to diverge.
  function syncCollapseLabel() {
    if (!collapseBtn) return;
    const anyOpen = [...wrap.querySelectorAll('[data-arc],[data-proj]')]
      .some((el) => !el.classList.contains('reg-closed'));
    allClosed = !anyOpen;
    collapseBtn.textContent = anyOpen ? 'collapse all' : 'expand all';
  }

  const setOpen = (el, open) => {
    el.classList.toggle('reg-closed', !open);
    const head = el.querySelector('[data-arc-toggle],[data-proj-toggle]');
    if (head) {
      head.setAttribute('aria-expanded', String(open));
      const caret = head.querySelector('.reg-caret');
      if (caret) caret.textContent = open ? '▾' : '▸';
    }
  };

  /** @returns true if stored state was found and applied. */
  function restoreTree() {
    let stored;
    try { stored = sessionStorage.getItem(TREE_KEY); } catch { return false; }
    if (stored == null) return false;
    let ids;
    try { ids = new Set(JSON.parse(stored)); } catch { return false; }
    for (const el of wrap.querySelectorAll('[data-arc],[data-proj]')) {
      setOpen(el, ids.has(groupId(el)));
    }
    return true;
  }

  wrap.addEventListener('click', (e) => {
    const head = e.target.closest('[data-arc-toggle],[data-proj-toggle]');
    if (!head) return;
    const box = head.closest('[data-arc],[data-proj]');
    setOpen(box, box.classList.contains('reg-closed'));
    saveTree();
    syncCollapseLabel();
  });

  wrap.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const head = e.target.closest('[data-arc-toggle],[data-proj-toggle]');
    if (!head) return;
    e.preventDefault();
    const box = head.closest('[data-arc],[data-proj]');
    setOpen(box, box.classList.contains('reg-closed'));
    saveTree();
    syncCollapseLabel();
  });

  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      allClosed = !allClosed;
      wrap.querySelectorAll('[data-arc],[data-proj]').forEach((el) => setOpen(el, !allClosed));
      saveTree();
      syncCollapseLabel();
    });
  }

  // Projects order by LAST TOUCHED by default (Curtis, s01-593a6d). With every group
  // collapsed, the first thing you see is which projects are live -- alphabetical put
  // `clients/client-a-handoff` on top regardless of whether anyone had opened it in
  // months. Unknown age (-1) sorts LAST, same rule sortArcs uses.
  function sortProjects() {
    const host = wrap.querySelector('[data-reg-tree]') || wrap;
    const projs = [...host.querySelectorAll('[data-proj]')];
    if (projs.length < 2) return;
    const parent = projs[0].parentElement;
    if (!projs.every((p) => p.parentElement === parent)) return;   // don't reparent across containers
    // Projects ALWAYS order by activity. The sort control is labelled "arcs A-Z / arcs by
    // most-recent activity" -- it governs ARCS. Keying projects off it made the default
    // (`name`) sort projects alphabetically, silently undoing this whole feature.
    projs.sort((a, b) => {
      const ax = Number(a.dataset.age ?? -1), bx = Number(b.dataset.age ?? -1);
      if (ax < 0 && bx < 0) return String(a.dataset.name||'').localeCompare(String(b.dataset.name||''));
      if (ax < 0) return 1;
      if (bx < 0) return -1;
      return ax - bx;                                              // most recently touched first
    });
    projs.forEach((p) => parent.appendChild(p));
  }

  function sortArcs(mode) {
    for (const proj of wrap.querySelectorAll('[data-proj-body], .reg-proj-body')) {
      const kids = [...proj.children];
      kids.sort((a, b) => {
        if (mode === 'age') {
          const ax = Number(a.dataset.age ?? -1), bx = Number(b.dataset.age ?? -1);
          const ae = ax < 0, be = bx < 0;              // unknown age sorts LAST, both ways
          if (ae && be) return 0;
          if (ae) return 1;
          if (be) return -1;
          return ax - bx;                              // most recently touched first
        }
        return String(a.dataset.name || '').localeCompare(String(b.dataset.name || ''));
      });
      kids.forEach((k) => proj.appendChild(k));
    }
    sortProjects();
  }

  /** Restore stored geometry, else fall back to the collapsed default. Always leaves
   *  the collapse-all label agreeing with the DOM. */
  function restore() {
    // `!location.hash` is no longer the test -- stored state is. A refresh with filters
    // active kept the filters and threw the tree away; that is the regression this fixes.
    if (!restoreTree()) {
      // First visit in this tab: collapsed, grouped by project. 500+ rows expanded is
      // the exact wall this layout exists to fix.
      wrap.querySelectorAll('[data-arc],[data-proj]').forEach((el) => setOpen(el, false));
      saveTree();
    }
    syncCollapseLabel();
    return true;
  }

  return { sortArcs, sortProjects, restore };
}
