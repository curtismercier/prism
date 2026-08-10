// PRISM layout — `registry`
//
// A PROJECT / ARC / PHASE browser over many PRISM artifacts, with click-through that
// renders the selected artifact via a nested <soma-artifact>.
//
// WHY HIERARCHICAL AND NOT A SORTABLE TABLE (Curtis, s01-bbca8a):
//   The first version of this layout was one flat sortable table. That reproduces the
//   exact defect the model exists to fix — a wall of cycles nobody can navigate. The
//   hierarchy was already present in the paths and was being rendered away. Sorting is
//   a lens ON a structure; it is not a substitute for having one.
//
// ── WHAT LIVES WHERE (split 2026-08-05) ──────────────────────────────────────
// This file crossed its own falsifiable gate — 002 §notes: *"if registry.mjs passes
// ~600 lines, split it by concern"* — and reached 961 lines with nothing failing. The
// gate is now the acceptance test, and the concerns are four modules:
//
//   registry.mjs        (this) data fetch · cards · filters · URL-fragment state
//   registry-tree.mjs   grouped project→arc→phase rendering + open/closed + sorting
//   registry-flat.mjs   flat sortable table (split earlier, same reason)
//   registry-detail.mjs the artifact preview pane (Phase e)
//   shell-header.mjs    SHARED across layouts — breadcrumb + cross-dashboard menu
//
// Source shape:
//   ---
//   type: registry
//   data: ./registry.json      ← resolved against the SOURCE .md, not the document
//   ---
//
// Row shape: { project, tree_kind, arc, phase, slug, title, status, bucket,
//              created, claimed, git, age_days, tags, href, error }
//   · project — the .soma tree that owns it (the `cycles/` vs `releases/cycles/` split
//     is deliberately NOT a level; it is carried as `tree_kind`, because that split is
//     a legacy non-tier competing with the arc axis)
//   · arc     — the subject. Stable name, no ordinal.
//   · phase   — ordinal member WITHIN the arc. `null` means this row IS the arc's own
//     entry point (or a singleton — a singleton is not an arc, so it renders as a leaf).
//
// A row whose `error` is set renders VISIBLY BROKEN and is never hidden by default.
// `validate`'s predecessor rendered malformed frontmatter as an em-dash, turning
// *broken* into *invisible* for 18 files. An index that silently drops what it cannot
// parse rebuilds that defect in a prettier form.

// Every sibling module is imported through the SAME query forward render.mjs uses: a
// static `import './x.mjs'` would NOT inherit our ?v=, so a dev edit to a child would
// serve stale from the module cache while this file busts correctly.
const V = new URL(import.meta.url).search;
const load = (f) => import(new URL(f + V, import.meta.url).href);
const { buildFlatTable, attachFlat } = await load('./registry-flat.mjs');
const { esc, abs, blob, pill, setHrefBase, buildTree, attachTree, displayProject } = await load('./registry-tree.mjs');
const { buildDetailPane, attachDetail } = await load('./registry-detail.mjs');
const { renderShellHeader, renderShellBackground, attachShellHeader, loadDashboards } = await load('./shell-header.mjs');

// The registry JSON is a SNAPSHOT, while the drill-in panel nests a live
// <soma-artifact> on the real cycle.md. A stale snapshot therefore makes ONE
// VIEW DISAGREE WITH ITSELF -- the table read `open` while the detail panel
// read `closed`, two hours after the edit (Curtis, s01-593a6d). The page was
// only ever fetched at load, so filtering could never surface a cycle written
// since. Track what we loaded so an interaction can notice it has gone stale.
null

let DATA_SRC = null;
let DATA_GENERATED = null;
let DATA_FETCHED_AT = 0;
const REFRESH_MIN_MS = 15000;      // never poll harder than this, whatever the user does
// ROW 7: maybeRefresh() re-invokes render+attach on a live poll -- a raw
// `document.addEventListener` in attachRegistry would accumulate one listener per
// refresh cycle over a long-lived session. Track the last one and remove it first.
let CMDK_HANDLER = null;

export async function renderRegistry({ frontmatter: fm, preamble, srcUrl }) {
  // Resolve `data:` against the SOURCE .md, not the document. Without this the same
  // artifact renders only when it happens to sit beside the including page.
  const src = fm.data ? new URL(fm.data, srcUrl || document.baseURI).href : null;
  if (!src) return `<div class="prism-error">Registry layout needs <code>data:</code> in frontmatter</div>`;

  let d;
  try {
    const res = await fetch(src, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    d = await res.json();
  } catch (err) {
    return `<div class="prism-error"><strong>Registry data failed to load</strong><br>
      <small><code>${esc(src)}</code> — ${esc(err.message)}</small><br>
      <small>Browsers block <code>file://</code> fetches. Serve it:
      <code>cd ~/Gravicity &amp;&amp; python3 -m http.server 8910</code></small></div>`;
  }

  setHrefBase(src);                    // resolve every row href against the DATA file
  DATA_SRC = src;
  DATA_GENERATED = d.generated_at || null;
  DATA_FETCHED_AT = Date.now();
  const rows = d.cycles || [];
  const c = d.counts || {};
  const broken = rows.filter((r) => r.error).length;

  const { html: body, projectCount } = buildTree(rows);

  const buckets = [...new Set(rows.map((r) => r.bucket).filter(Boolean))].sort();
  const projects = [...new Set(rows.map(displayProject).filter(Boolean))].sort();
  // Programs are DERIVED from the rows, never hand-listed — a curated denominator is
  // always the bug (this corpus learned that at 222/5 vs a real 484/18).
  const programs = [...new Set(rows.map((r) => r.program).filter(Boolean))].sort();
  const scopes = [...new Set(rows.map((r) => r.tree_kind).filter(Boolean))].sort();

  // ── Stat cards ─────────────────────────────────────────────────────────────
  // Cards are ACTIONABLE first: each one should mean "go look at something", not
  // "here is a number". They double as filters (see CARD_TESTS in attach), so the
  // dashboard gains a filter UI without gaining any filter chrome.
  const nStale  = rows.filter((r) => r.bucket === 'Active' && (r.age_days ?? 0) > 60).length;
  const nNoGit  = rows.filter((r) => !r.git).length;
  const nActive = rows.filter((r) => r.bucket === 'Active').length;
  const nSeeded = rows.filter((r) => r.bucket === 'Seeded').length;
  const nClosed = rows.filter((r) => r.bucket === 'Closed').length;

  const card = (id, n, label, title, tone = '') =>
    `<button type="button" class="reg-card ${tone}" data-card="${id}" aria-pressed="false" title="${esc(title)}">
       <span class="reg-card-n">${n}</span><span class="reg-card-l">${esc(label)}</span></button>`;

  const cardsHtml = `<div class="reg-cards">
    <div class="reg-card reg-card-static" title="click a card to filter; click it again to clear">
      <span class="reg-card-n">${c.cycles ?? rows.length}</span><span class="reg-card-l">cycles · ${c.arcs ?? '?'} arcs · ${projectCount} projects${c.programs ? ` · ${c.programs} program${c.programs>1?'s':''}` : ''}</span></div>
    ${card('active', nActive, 'active', 'status resolves to Active', 'reg-card-active')}
    ${card('seeded', nSeeded, 'seeded', 'planned but not started', 'reg-card-seeded')}
    ${card('closed', nClosed, 'closed', 'shipped / done / closed / superseded', 'reg-card-closed')}
    ${card('stale', nStale, 'stale >60d', 'claims Active but nothing has touched it in 60+ days — either the status is a lie or the work is abandoned', nStale ? 'reg-card-warn' : '')}
    ${card('nogit', nNoGit, 'no git date', `${nNoGit} of ${rows.length} rows have NO git history, so they are INVISIBLE to drift and to git-based staleness. Not a defect in the cycle — a blind spot in the measurement.`, nNoGit ? 'reg-card-warn' : '')}
    ${card('broken', broken, 'unparseable', 'frontmatter does not parse — renders blank everywhere else', broken ? 'reg-card-bad' : '')}
  </div>`;

  // ── Shell header (SHARED module) ───────────────────────────────────────────
  // The emitter resolves the brand (from .env) and ships it in the data, because a
  // browser cannot read a .env and this renderer has no build step. The layout stays
  // generic: it renders whatever brand it is handed, and falls back to the artifact's
  // own title. BRAND is who; PRODUCT is what — keeping them separate is what lets
  // someone swap the name without the page claiming to be a different tool.
  const brand = d.brand || {};
  const { entries: dashboards, source: navSource } = await loadDashboards(src, d);
  const header = renderShellHeader({
    brand,
    product: brand.product || fm.title || 'Cycle registry',
    dashboards,
    source: navSource,
    // A dashboard names itself in ITS OWN frontmatter; nothing here enumerates the family.
    current: fm.dashboard_id || fm.id || '',
    // ROW 7 ("cmd-K search hint styling at 12px"): the real search input lives in
    // `.reg-controls` inside `.reg-sticky`, not the header -- `shell-header.mjs` says
    // of itself it must stay registry-agnostic (see its own file header), so a hint
    // pointing at `data-reg-q` is a REGISTRY concern and belongs in this call site's
    // `meta` slot, not baked into the shared module. It focuses the existing input
    // rather than duplicating it -- one search box, one keybinding, styled as a hint.
    meta: `<button type="button" class="shell-search-hint" data-shell-search-hint title="jump to the search box">⌘K</button>
      ${d.generated_at ? `<span class="reg-gen" title="This data is a SNAPSHOT, not live. Regenerate before trusting any number.">generated ${esc(String(d.generated_at).replace('T', ' ').replace(/\+.*$/, ''))}</span>` : ''}
      ${preamble ? `<button type="button" class="reg-btn reg-info" data-reg-help aria-expanded="false" title="How to read this dashboard">ⓘ help</button>` : ''}`,
  });

  // ROW 8 rail counts -- per-project totals for the filter rail. `projects` is
  // already the deduped/sorted list every dropdown uses; this just tallies against
  // it once rather than re-filtering `rows` per row at render time.
  const railCounts = {};
  for (const r of rows) {
    const p = displayProject(r);
    if (p) railCounts[p] = (railCounts[p] || 0) + 1;
  }
  const railHtml = `<aside class="reg-rail" data-reg-rail aria-label="filter by project">
    <div class="reg-rail-head">projects</div>
    <button type="button" class="reg-rail-row is-active" data-reg-rail-row data-reg-rail-project="" aria-pressed="true">
      <span>all projects</span><span class="reg-rail-count">${rows.length}</span>
    </button>
    ${projects.map((p) => `<button type="button" class="reg-rail-row" data-reg-rail-row data-reg-rail-project="${esc(p)}" aria-pressed="false">
      <span>${esc(p)}</span><span class="reg-rail-count">${railCounts[p] || 0}</span>
    </button>`).join('')}
  </aside>`;

  return `
  ${renderShellBackground()}
<div class="reg" data-reg>
  ${header}

  ${preamble ? `<div class="reg-pre" data-reg-helppanel hidden>${preamble}</div>` : ''}

  <div data-reg-sentinel aria-hidden="true"></div>
  <div class="reg-sticky" data-reg-sticky>
  ${cardsHtml}

  <div class="reg-controls">
    <div class="reg-viewtog" role="group" aria-label="view mode">
      <button type="button" class="reg-btn reg-vt-on" data-reg-view="grouped" aria-pressed="true" title="project → arc → phase tree">grouped</button>
      <button type="button" class="reg-btn" data-reg-view="flat" aria-pressed="false" title="one row per cycle — click a column header to sort">flat</button>
    </div>
    <input type="search" data-reg-q placeholder="filter by slug, arc, title, status, tag…" class="reg-input">
    <select data-reg-program class="reg-select" title="A PROGRAM spans projects. Membership is the program: field in a cycle's frontmatter — phases inherit it from their arc. Nothing is moved or symlinked to belong to one."><option value="">any program</option>
      ${programs.map((p) => `<option value="${esc(p)}">▣ ${esc(p)}</option>`).join('')}</select>
    <select data-reg-project class="reg-select"><option value="">any project</option>
      ${projects.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select>
    <select data-reg-scope class="reg-select"><option value="">any scope</option>
      ${scopes.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select>
    <select data-reg-bucket class="reg-select"><option value="">any status</option>
      ${buckets.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join('')}</select>
    <select data-reg-sort class="reg-select">
      <option value="name">arcs A→Z</option>
      <option value="age">arcs by most-recent activity</option>
    </select>
    <label class="reg-chk"><input type="checkbox" data-reg-broken> broken only</label>
    <button type="button" data-reg-collapse class="reg-btn">collapse all</button>
    <span class="reg-shown" data-reg-shown></span>
  </div>
  </div>

  <div class="reg-body">
  ${railHtml}
  <div class="reg-main">
  <div class="reg-legend">
    <span class="reg-nm" title="The phase slug, or the cycle slug when the row is not part of an arc.">phase / cycle</span> ·
    <span title="Normalised bucket — Active / Seeded / Closed / Other. The raw frontmatter status is free text (hundreds of distinct values), so the bucket is what is filterable.">status</span> ·
    <span class="reg-d" title="Frontmatter created: date.">created</span>
    <span class="reg-d" title="The frontmatter's own updated: field — a CLAIM, written by whoever last edited the file.">claims</span>
    <span class="reg-d" title="Last git commit touching the file — GROUND TRUTH. When it disagrees with 'claims', the disagreement is a finding, not a rendering bug.">touched</span>
    <span class="reg-age" title="Days since last activity, ranked on git. Falls back to the claim only when there is no git date — a blank is NOT 'never touched'.">age</span>
  </div>

  <div class="reg-tree">${body}</div>

  ${buildFlatTable(rows, { esc, abs, blob, pill, displayProject })}
  </div>
  </div>

  ${buildDetailPane()}
</div>`;
}

export function attachRegistry(root) {
  const wrap = root.querySelector('[data-reg]');
  if (!wrap) return;
  const shown = wrap.querySelector('[data-reg-shown]');

  const q = wrap.querySelector('[data-reg-q]');
  const bucketSel = wrap.querySelector('[data-reg-bucket]');
  const projSel = wrap.querySelector('[data-reg-project]');
  const progSel = wrap.querySelector('[data-reg-program]');
  const scopeSel = wrap.querySelector('[data-reg-scope]');
  const sortSel = wrap.querySelector('[data-reg-sort]');
  const brokenOnly = wrap.querySelector('[data-reg-broken]');
  const collapseBtn = wrap.querySelector('[data-reg-collapse]');
  let activeCard = '';
  let view = 'grouped';
  const treeBox = wrap.querySelector('.reg-tree');
  const legend = wrap.querySelector('.reg-legend');
  const flatBox = wrap.querySelector('[data-reg-flat]');
  const flat = attachFlat(wrap, () => writeHash());
  const tree = attachTree(wrap, collapseBtn);
  const detail = attachDetail(wrap, esc);

  // The breadcrumb returns you to the LIST — it dismisses the preview pane and leaves
  // the fragment alone, so a shared filter link survives being navigated inside.
  attachShellHeader(wrap, { onHome: () => detail.close() });

  // The toggle only shows/hides — both views stay in the DOM and both stay
  // filtered (see apply()), so switching is instant and loses no state.
  function setView(v) {
    view = v === 'flat' ? 'flat' : 'grouped';
    const isFlat = view === 'flat';
    treeBox.hidden = isFlat;
    if (legend) legend.hidden = isFlat;
    if (flatBox) flatBox.hidden = !isFlat;
    sortSel.hidden = isFlat;        // arc-sort + collapse speak about groups;
    collapseBtn.hidden = isFlat;    // in flat mode they'd be dead controls
    for (const b of wrap.querySelectorAll('[data-reg-view]')) {
      const on = b.dataset.regView === view;
      b.classList.toggle('reg-vt-on', on);
      b.setAttribute('aria-pressed', String(on));
    }
  }

  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-reg-view]');
    if (!btn) return;
    setView(btn.dataset.regView);
    apply();
  });

  // ── View state lives in the URL fragment ────────────────────────────────
  // Shareable, survives reload, and the back button works -- for the price of two
  // small functions and no state library at all.
  function readHash() {
    const h = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    if (h.has('q')) q.value = h.get('q');
    if (h.has('status')) bucketSel.value = h.get('status');
    if (h.has('project') && projSel) projSel.value = h.get('project');
    if (h.has('program') && progSel) progSel.value = h.get('program');
    if (h.has('scope') && scopeSel) scopeSel.value = h.get('scope');
    if (h.has('sort')) sortSel.value = h.get('sort');
    if (h.has('card')) {
      const c = h.get('card');
      // Back-compat: links shared before s01-593a6d encode bucket filters as
      // `card=closed`. Those ids no longer have a CARD_TESTS entry, so without
      // this the old link would open with its filter SILENTLY DROPPED -- the
      // page would look fine and show the wrong rows. Translate to the dropdown.
      if (CARD_BUCKET[c]) bucketSel.value = CARD_BUCKET[c];
      else activeCard = c;
    }
    if (h.get('broken') === '1') brokenOnly.checked = true;
    if (h.get('view') === 'flat') view = 'flat';
    if (h.has('fs')) flat.state = h.get('fs');
  }
  function writeHash() {
    const p = new URLSearchParams();
    if (q.value.trim()) p.set('q', q.value.trim());
    if (bucketSel.value) p.set('status', bucketSel.value);
    if (projSel && projSel.value) p.set('project', projSel.value);
    // Every filter control must round-trip here or it is the one dimension a shared
    // link silently drops. `program` shipped in 13fe015 without its two lines and was
    // invisible because apply() was throwing before writeHash() ran at all. (s01-ac5017)
    if (progSel && progSel.value) p.set('program', progSel.value);
    if (scopeSel && scopeSel.value) p.set('scope', scopeSel.value);
    if (sortSel.value && sortSel.value !== 'name') p.set('sort', sortSel.value);
    if (activeCard) p.set('card', activeCard);
    if (brokenOnly.checked) p.set('broken', '1');
    if (view === 'flat') p.set('view', 'flat');
    if (flat.state) p.set('fs', flat.state);
    const s = p.toString();
    history.replaceState(null, '', s ? `#${s}` : location.pathname + location.search);
  }

  // A card is a saved query, not a separate mechanism. Each returns true/false for a
  // row's dataset -- so cards and dropdowns compose instead of fighting.
  // Three cards test EXACTLY what the status dropdown tests. Keeping both as
  // independent state is why they drifted: clicking `closed` filtered the table
  // while the dropdown still read "any status", so two controls described one
  // filter and disagreed. The fix is to delete the redundant state, not to sync
  // it -- the dropdown OWNS bucket filtering, and those cards are a second way to
  // set it. The other three are genuinely orthogonal (age / missing git / broken
  // frontmatter) and stay card-only. (Curtis, s01-593a6d)
  const CARD_BUCKET = { active: 'Active', seeded: 'Seeded', closed: 'Closed' };

  const CARD_TESTS = {
    stale:   (d) => d.bucket === 'Active' && Number(d.age) > 60,
    nogit:   (d) => d.git === '0',
    broken:  (d) => d.broken === '1',
  };

  function syncCards() {
    for (const el of wrap.querySelectorAll('[data-card]')) {
      const id = el.dataset.card;
      const on = CARD_BUCKET[id]
        ? bucketSel.value === CARD_BUCKET[id]   // derived from the dropdown
        : id === activeCard;                    // orthogonal cards keep their own state
      el.classList.toggle('reg-card-on', on);
      el.setAttribute('aria-pressed', String(on));
    }
    syncRail();
  }

  // ROW 8: same reflect-the-dropdown pattern as syncCards -- `projSel` stays the
  // single source of truth (the rail drives it via `change`, never filters directly),
  // so a shared link or a dropdown pick lights the matching rail row too.
  function syncRail() {
    if (!projSel) return;
    const val = projSel.value || '';
    for (const el of wrap.querySelectorAll('[data-reg-rail-row]')) {
      const on = (el.dataset.regRailProject || '') === val;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-pressed', String(on));
    }
  }

  wrap.addEventListener('click', (e) => {
    const card = e.target.closest('[data-card]');
    if (!card) return;
    const id = card.dataset.card;
    // Toggle: clicking the active card clears it, so a card can never become a filter
    // you cannot get back out of.
    if (CARD_BUCKET[id]) {
      // Drive the dropdown -- it is the single source of truth for bucket, so the
      // toolbar now reads "Closed" instead of contradicting the card.
      bucketSel.value = (bucketSel.value === CARD_BUCKET[id]) ? '' : CARD_BUCKET[id];
    } else {
      activeCard = (activeCard === id) ? '' : id;
    }
    syncCards();
    apply();
    maybeRefresh();   // cards are a filter surface too — without this, a session that only
                      // clicks cards never re-polls and reads a snapshot from page load.
  });

  // ROW 8: the rail is a THIN wrapper around the existing project dropdown, not a
  // second filter mechanism -- it sets `projSel.value` and dispatches the SAME
  // `change` event the dropdown fires, so it inherits URL-hash sync, facet recount
  // and the empty-state message for free, and cannot drift from the dropdown the
  // way the cards once did (see CARD_BUCKET's comment above, s01-593a6d).
  wrap.addEventListener('click', (e) => {
    const row = e.target.closest('[data-reg-rail-row]');
    if (!row || !projSel) return;
    projSel.value = row.dataset.regRailProject || '';
    projSel.dispatchEvent(new Event('change'));
  });

  // ROW 7: ⌘K / Ctrl+K focuses the existing search input -- a hint pointing at real
  // functionality, not a second search box. The header's badge (shell-search-hint)
  // does the same thing on click; both paths converge on one input.
  const focusSearch = () => { q.focus(); q.select(); };
  const searchHint = wrap.querySelector('[data-shell-search-hint]');
  if (searchHint) searchHint.addEventListener('click', focusSearch);
  if (CMDK_HANDLER) document.removeEventListener('keydown', CMDK_HANDLER);
  CMDK_HANDLER = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && wrap.isConnected) {
      e.preventDefault();
      focusSearch();
    }
  };
  document.addEventListener('keydown', CMDK_HANDLER);

  // FACET COUNTS. §decisions-locked says "cards recompute from the filtered set so they
  // compose" — that was locked and never implemented: counts were computed once at render
  // from `rows` and baked into the HTML, so after any filter every card lied about the
  // current view (measured s01-593a6d: filter to Active, seeded card still read 82).
  //
  // Each card counts rows passing every OTHER filter but NOT its own dimension — standard
  // facet semantics. Counting with its own filter applied would zero every card except the
  // one you clicked, which is useless; leaving them global makes them lie. The value is
  // narrowing by project/scope/search and reading that project's real breakdown.
  function recountCards() {
    const term = (q.value || '').trim().toLowerCase();
    const bucket = bucketSel.value, bOnly = brokenOnly.checked;
    const proj = projSel ? projSel.value : '';
    const scope = scopeSel ? scopeSel.value : '';
    const cardTest = CARD_TESTS[activeCard];
    const counts = { active: 0, seeded: 0, closed: 0, stale: 0, nogit: 0, broken: 0 };
    for (const row of wrap.querySelectorAll('[data-row]')) {
      // Tree and flat copies both live in the DOM — count only the view being looked at,
      // same rule the `n` total already uses, or every number doubles.
      if ((view === 'flat') !== Boolean(row.closest('[data-reg-flat]'))) continue;
      const d = row.dataset;
      if (term && !(d.blob || '').includes(term)) continue;
      if (proj && d.project !== proj) continue;
      if (scope && d.scope !== scope) continue;
      if (bOnly && d.broken !== '1') continue;
      // bucket facets: ignore the bucket filter, honour the orthogonal card
      if (!cardTest || cardTest(d)) {
        for (const id in CARD_BUCKET) if (d.bucket === CARD_BUCKET[id]) counts[id]++;
      }
      // orthogonal facets: honour the bucket filter, ignore their own test
      if (!bucket || d.bucket === bucket) {
        for (const id in CARD_TESTS) if (CARD_TESTS[id](d)) counts[id]++;
      }
    }
    for (const id in counts) {
      const el = wrap.querySelector(`[data-card="${id}"] .reg-card-n`);
      if (el) el.textContent = counts[id];
    }
  }

  function apply() {
    const term = (q.value || '').trim().toLowerCase();
    const bucket = bucketSel.value, bOnly = brokenOnly.checked;
    const proj = projSel ? projSel.value : '';
    // 🔴 `prog` was declared ONLY in recountCards() when the program filter landed
    // (13fe015). apply() referenced it undeclared, so every apply() threw a
    // ReferenceError mid-loop. `&&` short-circuits, so rows that FAILED an earlier
    // clause were hidden normally and the throw only fired on the first row that
    // reached this one -- which is why the same bug read as "selects are inert",
    // "cards lie" and "search works" in three different sessions depending on DOM
    // order. writeHash() sits after the loop, so it never ran either: that is the
    // whole of "filters don't survive a refresh". (s01-ac5017)
    const prog = progSel ? progSel.value : '';
    const scope = scopeSel ? scopeSel.value : '';
    const cardTest = CARD_TESTS[activeCard];
    let n = 0;

    for (const row of wrap.querySelectorAll('[data-row]')) {
      const d = row.dataset;
      const ok = (!term || (d.blob || '').includes(term))
        && (!bucket || d.bucket === bucket)
        && (!proj || d.project === proj)
        && (!prog || d.program === prog)
        && (!scope || d.scope === scope)
        && (!cardTest || cardTest(d))
        && (!bOnly || d.broken === '1');
      row.hidden = !ok;
      // Tree and flat rows both live in the DOM and both get filtered (so the
      // view toggle is instant and loses nothing), but the count must speak for
      // the view being looked at — never the sum of both copies.
      if (ok && ((view === 'flat') === Boolean(row.closest('[data-reg-flat]')))) n++;
    }
    writeHash();
    recountCards();
    // A group with nothing visible inside it is noise — hide the container too, so a
    // filter narrows the TREE rather than leaving empty scaffolding behind.
    for (const arc of wrap.querySelectorAll('[data-arc]')) {
      arc.hidden = ![...arc.querySelectorAll('[data-row]')].some((r) => !r.hidden);
    }
    for (const proj of wrap.querySelectorAll('[data-proj]')) {
      const anyRow = [...proj.querySelectorAll('[data-row]')].some((r) => !r.hidden);
      proj.hidden = !anyRow;
    }
    // An empty result must EXPLAIN itself. Filters compose, so a card left active from
    // earlier silently intersects with a new dropdown to zero -- and a bare "0 shown"
    // reads as broken data rather than as a narrow query. Name every active filter and
    // offer the way out.
    const active = [];
    if (term) active.push(`search “${term}”`);
    if (prog) active.push(`program ${prog}`);
    if (proj) active.push(`project ${proj}`);
    if (scope) active.push(`scope ${scope}`);
    if (bucket) active.push(`status ${bucket}`);
    if (activeCard) active.push(`card “${activeCard}”`);
    if (bOnly) active.push('broken only');

    if (n === 0 && active.length) {
      shown.innerHTML = `<span class="reg-empty">0 shown — no cycle matches ${esc(active.join(' + '))}. `
        + `<button type="button" data-reg-clear class="reg-clearbtn">clear filters</button></span>`;
    } else {
      shown.textContent = active.length ? `${n} shown · ${active.length} filter${active.length === 1 ? '' : 's'}` : `${n} shown`;
    }
  }

  // Sticky header: cards + filters travel together, so the numbers stay reachable
  // while scrolling 500 rows. A sentinel above the bar is what detects "stuck" --
  // CSS alone cannot style a sticky element differently once it pins. When stuck the
  // cards compact, because a full-height card row that follows you down the page is
  // a banner, not a dashboard.
  const sentinel = wrap.querySelector('[data-reg-sentinel]');
  const stickyBar = wrap.querySelector('[data-reg-sticky]');
  if (sentinel && stickyBar && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      ([e]) => stickyBar.classList.toggle('is-stuck', !e.isIntersecting),
      { threshold: 0 },
    ).observe(sentinel);
  }

  // Help panel: the narrative belongs behind a button, not above the data. It is
  // documentation, and documentation that occupies the first screen of a dashboard
  // gets scrolled past rather than read.
  const helpBtn = wrap.querySelector('[data-reg-help]');
  const helpPanel = wrap.querySelector('[data-reg-helppanel]');
  if (helpBtn && helpPanel) {
    helpBtn.addEventListener('click', () => {
      const open = helpPanel.hidden;
      helpPanel.hidden = !open;
      helpBtn.setAttribute('aria-expanded', String(open));
      helpBtn.classList.toggle('reg-info-on', open);
    });
  }

  // Delegated so it survives the innerHTML rewrite above.
  wrap.addEventListener('click', (e) => {
    if (!e.target.closest('[data-reg-clear]')) return;
    q.value = '';
    bucketSel.value = '';
    if (projSel) projSel.value = '';
    if (scopeSel) scopeSel.value = '';
    brokenOnly.checked = false;
    activeCard = '';
    syncCards();
    apply();
  });

  // ---- auto-refresh on interaction ------------------------------------------
  // Filtering used to search only what was fetched at page load, so a cycle
  // written since was invisible until a manual reload. On interaction, check
  // whether the snapshot has been regenerated and re-render if so.
  //
  // Re-rendering is safe BECAUSE the view already round-trips through the URL
  // hash: writeHash() persists filters, readHash() restores them on render. So
  // the user keeps their filter, sort and open/closed arcs across the refresh.
  //
  // Never blocks typing: the check is async, rate-limited, and the old data
  // stays interactive until new data actually differs.
  let refreshing = false;
  let retryTimer = null;
  async function maybeRefresh(force = false) {
    if (refreshing || !DATA_SRC) return;
    if (!force && Date.now() - DATA_FETCHED_AT < REFRESH_MIN_MS) return;
    refreshing = true;
    try {
      const res = await fetch(DATA_SRC, { cache: 'no-store' });
      if (!res.ok) return;                    // silent: stale data still works
      const fresh = await res.json();
      DATA_FETCHED_AT = Date.now();

      // The server regenerates in the BACKGROUND and serves the old file
      // meanwhile, so "same generated_at" does not mean "up to date" when this
      // header is set. Retry once rather than concluding nothing changed.
      if (res.headers.get('X-Registry-Refreshing') === '1') {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => maybeRefresh(true), 12000);
      }

      if (!fresh.generated_at || fresh.generated_at === DATA_GENERATED) return;
      writeHash();                            // persist the view BEFORE re-render
      const host = wrap.closest('soma-artifact');
      if (host && typeof host.render === 'function') host.render();
    } catch { /* offline / server down -- keep showing what we have */ }
    finally { refreshing = false; }
  }

  [q, bucketSel, progSel, projSel, scopeSel, brokenOnly].filter(Boolean).forEach((el) => {
    // syncCards() on every change so the reverse direction holds too: picking
    // "Closed" in the toolbar lights the closed card.
    el.addEventListener('input', () => { syncCards(); apply(); maybeRefresh(); });
    el.addEventListener('change', () => { syncCards(); apply(); maybeRefresh(); });
  });
  sortSel.addEventListener('change', () => { tree.sortArcs(sortSel.value); writeHash(); });

  // Restore the view from the URL BEFORE the first apply, so a shared link opens on
  // the view it describes rather than flashing the default and then correcting.
  readHash();
  syncCards();
  setView(view);
  if (sortSel.value && sortSel.value !== 'name') tree.sortArcs(sortSel.value); else tree.sortProjects();

  // DEFAULT VIEW: collapsed, grouped by project (Curtis, s01-593a6d).
  // 500+ rows expanded is the exact wall this layout exists to fix — collapsed by
  // project makes the estate's SHAPE (who owns how much) the first thing you see.
  apply();

  // Stored tree geometry first, collapsed default second. Owned by registry-tree.mjs.
  tree.restore();
}
