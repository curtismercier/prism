// PRISM layout — `registry`
//
// A PROJECT / ARC / PHASE browser over many PRISM artifacts, with click-through that
// renders the selected artifact inline via a nested <soma-artifact>.
//
// WHY HIERARCHICAL AND NOT A SORTABLE TABLE (Curtis, s01-bbca8a):
//   The first version of this layout was one flat sortable table. That reproduces the
//   exact defect the model exists to fix — a wall of cycles nobody can navigate. The
//   hierarchy was already present in the paths and was being rendered away. Sorting is
//   a lens ON a structure; it is not a substitute for having one.
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

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Flat-table mode lives in its own module — split by concern before this file
// crossed the ~700-line mark. The query forward mirrors render.mjs: a static
// `import './registry-flat.mjs'` would NOT inherit our ?v=, so dev edits to the
// child would serve stale from the module cache while this file busts correctly.
const V = new URL(import.meta.url).search;
const { buildFlatTable, attachFlat } = await import(new URL('./registry-flat.mjs' + V, import.meta.url).href);

const BUCKET_CLASS = {
  Broken: 'reg-b-broken', Active: 'reg-b-active', Seeded: 'reg-b-seeded',
  Shipped: 'reg-b-shipped', Closed: 'reg-b-shipped', Done: 'reg-b-shipped',
};

const pill = (r) =>
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

const blob = (r) => esc([r.slug, r.title, r.status, r.arc, r.phase, (r.tags || []).join(' '), r.rel]
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
const abs = (h) => { try { return h ? new URL(h, HREF_BASE || document.baseURI).href : ''; } catch { return h || ''; } };

function leafRow(r, isPhase) {
  return `<div class="reg-row ${r.error ? 'reg-row-broken' : ''} ${isPhase ? 'reg-row-phase' : ''}"
      data-row data-href="${esc(abs(r.href))}" data-blob="${blob(r)}"
      data-bucket="${esc(r.bucket || '')}" data-broken="${r.error ? '1' : '0'}"
      data-project="${esc(r.project || '')}" data-scope="${esc(r.tree_kind || '')}"
      data-git="${r.git ? '1' : '0'}"
      data-age="${r.age_days ?? -1}" data-name="${esc(r.phase || r.arc || r.slug)}"
      data-label="${esc(r.phase || r.slug)}">
    <span class="reg-name">
      ${r.error ? '<span class="reg-badge-broken">UNPARSEABLE</span> ' : ''}
      <span class="reg-nm">${esc(r.phase || r.slug)}</span>
      ${r.title ? `<span class="reg-title">${esc(r.title)}</span>` : ''}
      ${r.error ? `<span class="reg-err">${esc(r.error)}</span>` : ''}
    </span>
    ${pill(r)}${dates(r)}
  </div>`;
}

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

  HREF_BASE = src;                     // resolve every row href against the DATA file
  const rows = d.cycles || [];
  const c = d.counts || {};
  const broken = rows.filter((r) => r.error).length;

  // project → arc → [rows]
  const byProject = new Map();
  for (const r of rows) {
    const proj = r.project || '(unknown)';
    if (!byProject.has(proj)) byProject.set(proj, new Map());
    const arcs = byProject.get(proj);
    const arc = r.arc || '(root)';
    if (!arcs.has(arc)) arcs.set(arc, []);
    arcs.get(arc).push(r);
  }

  const projOrder = [...byProject.keys()].sort((a, b) =>
    byProject.get(b).size - byProject.get(a).size || a.localeCompare(b));

  const body = projOrder.map((proj) => {
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
              data-project="${esc(entry.project || '')}" data-scope="${esc(entry.tree_kind || '')}"
              data-git="${entry.git ? '1' : '0'}"
              data-broken="0" data-age="${entry.age_days ?? -1}" data-label="${esc(entry.slug)}">
              ↳ open the arc (<code>cycle.md</code>)${entry.title ? ` — <span class="reg-title">${esc(entry.title)}</span>` : ''}
            </div>` : ''}
          ${phases.map((p) => leafRow(p, true)).join('')}
        </div>
      </div>`;
    }).join('');

    return `<section class="reg-proj" data-proj data-name="${esc(proj)}">
      <h3 class="reg-proj-head" data-proj-toggle tabindex="0" role="button" aria-expanded="true">
        <span class="reg-caret">▾</span>
        <span class="reg-proj-name">${esc(proj)}</span>
        <span class="reg-proj-n">${nCycles}</span>
        ${statsHtml(projStats)}
        ${nBroken ? `<span class="reg-badge-broken">${nBroken} broken</span>` : ''}
      </h3>
      <div class="reg-proj-body">${arcHtml}</div>
    </section>`;
  }).join('');

  const buckets = [...new Set(rows.map((r) => r.bucket).filter(Boolean))].sort();
  const projects = [...new Set(rows.map((r) => r.project).filter(Boolean))].sort();
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

  // ── Branding ──────────────────────────────────────────────────────────────
  // The emitter resolves this (from .env) and ships it in the data, because a browser
  // cannot read a .env and this renderer has no build step. The layout stays generic:
  // it renders whatever brand it is handed, and falls back to the artifact's own title.
  // BRAND is who; PRODUCT is what — keeping them separate is what lets someone swap
  // the name without the page claiming to be a different tool.
  const b = d.brand || {};
  const bName = b.name || '';
  const bProduct = b.product || fm.title || 'Cycle registry';

  // The canonical lockup is a SWAP, not a prefix: the first `o` in the brand name is
  // replaced by the symbol, coloured, with the rest of the word left alone -- Sσma.
  // Reads as name/symbol/name (white-gold-white) rather than bolting a glyph on the
  // front. Generic by construction: "Acme Robotics" becomes "Acme Rσbotics".
  // No `o` in the name => render it plain. A brand with nowhere to put the mark must
  // not get a stray one.
  function lockup(name, symbol) {
    if (!name) return '';
    const i = symbol ? name.search(/o/i) : -1;
    if (i < 0) return `<span class="reg-brand-name">${esc(name)}</span>`;
    return `<span class="reg-brand-name">${esc(name.slice(0, i))}`
      + `<span class="reg-brand-sigma" aria-hidden="true">${esc(symbol)}</span>`
      + `${esc(name.slice(i + 1))}</span>`;
  }
  const brandInner = lockup(bName, b.symbol);
  // Host-supplied colour arrives as a CSS custom property rather than an inline colour,
  // so the stylesheet keeps ownership of WHERE the brand colour is used and the host
  // only says WHAT it is. Sanitised: a colour is a short token, never arbitrary CSS.
  // TWO colours, because a brand colour is surface-dependent. The stylesheet's
  // prefers-color-scheme block picks; the host only declares. Setting one hex for both
  // surfaces is how a mark ends up at 1.5:1 on light and nobody notices, because it
  // looks perfect on whichever theme the author happens to use.
  const okColor = (v) => (/^[#a-zA-Z0-9(),.%\s-]{0,40}$/.test(v || '') ? (v || '') : '');
  const cDark = okColor(b.color);
  const cLight = okColor(b.color_light) || cDark;
  const brandStyle = cDark || cLight
    ? ` style="--prism-brand-dark:${esc(cDark)};--prism-brand-light:${esc(cLight)};--prism-brand-glow:${esc(cDark)}33"`
    : '';

  const brandHtml = brandInner
    ? `${b.url ? `<a class="reg-brand" href="${esc(b.url)}">${brandInner}</a>` : `<span class="reg-brand">${brandInner}</span>`}
       <span class="reg-brand-sep" aria-hidden="true">∕</span>
       <span class="reg-product">${esc(bProduct)}</span>`
    : `<span class="reg-product">${esc(bProduct)}</span>`;

  const cardsHtml = `<div class="reg-cards">
    <div class="reg-card reg-card-static" title="click a card to filter; click it again to clear">
      <span class="reg-card-n">${c.cycles ?? rows.length}</span><span class="reg-card-l">cycles · ${byProject.size} projects</span></div>
    ${card('active', nActive, 'active', 'status resolves to Active')}
    ${card('seeded', nSeeded, 'seeded', 'planned but not started')}
    ${card('closed', nClosed, 'closed', 'shipped / done / closed / superseded')}
    ${card('stale', nStale, 'stale >60d', 'claims Active but nothing has touched it in 60+ days — either the status is a lie or the work is abandoned', nStale ? 'reg-card-warn' : '')}
    ${card('nogit', nNoGit, 'no git date', `${nNoGit} of ${rows.length} rows have NO git history, so they are INVISIBLE to drift and to git-based staleness. Not a defect in the cycle — a blind spot in the measurement.`, nNoGit ? 'reg-card-warn' : '')}
    ${card('broken', broken, 'unparseable', 'frontmatter does not parse — renders blank everywhere else', broken ? 'reg-card-bad' : '')}
  </div>`;

  return `
<div class="reg" data-reg>
  <div class="reg-topbar"${brandStyle}>
    <h2 class="reg-title">${brandHtml}</h2>
    <div class="reg-topmeta">
      ${d.generated_at ? `<span class="reg-gen" title="This data is a SNAPSHOT, not live. Regenerate before trusting any number.">generated ${esc(String(d.generated_at).replace('T', ' ').replace(/\+.*$/, ''))}</span>` : ''}
      ${preamble ? `<button type="button" class="reg-btn reg-info" data-reg-help aria-expanded="false" title="How to read this dashboard">ⓘ help</button>` : ''}
    </div>
  </div>

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

  <div class="reg-legend">
    <span class="reg-nm" title="The phase slug, or the cycle slug when the row is not part of an arc.">phase / cycle</span> ·
    <span title="Normalised bucket — Active / Seeded / Closed / Other. The raw frontmatter status is free text (hundreds of distinct values), so the bucket is what is filterable.">status</span> ·
    <span class="reg-d" title="Frontmatter created: date.">created</span>
    <span class="reg-d" title="The frontmatter's own updated: field — a CLAIM, written by whoever last edited the file.">claims</span>
    <span class="reg-d" title="Last git commit touching the file — GROUND TRUTH. When it disagrees with 'claims', the disagreement is a finding, not a rendering bug.">touched</span>
    <span class="reg-age" title="Days since last activity, ranked on git. Falls back to the claim only when there is no git date — a blank is NOT 'never touched'.">age</span>
  </div>

  <div class="reg-tree">${body}</div>

  ${buildFlatTable(rows, { esc, abs, blob, pill })}

  <div class="reg-detail" data-reg-detail hidden>
    <div class="reg-detail-bar">
      <strong data-reg-detail-title></strong>
      <button type="button" data-reg-close class="reg-close">close ✕</button>
    </div>
    <div data-reg-detail-body></div>
  </div>
</div>`;
}

export function attachRegistry(root) {
  const wrap = root.querySelector('[data-reg]');
  if (!wrap) return;
  const detail = wrap.querySelector('[data-reg-detail]');
  const detailBody = wrap.querySelector('[data-reg-detail-body]');
  const detailTitle = wrap.querySelector('[data-reg-detail-title]');
  const shown = wrap.querySelector('[data-reg-shown]');

  const q = wrap.querySelector('[data-reg-q]');
  const bucketSel = wrap.querySelector('[data-reg-bucket]');
  const projSel = wrap.querySelector('[data-reg-project]');
  const scopeSel = wrap.querySelector('[data-reg-scope]');
  const sortSel = wrap.querySelector('[data-reg-sort]');
  const brokenOnly = wrap.querySelector('[data-reg-broken]');
  const collapseBtn = wrap.querySelector('[data-reg-collapse]');
  let activeCard = '';
  let view = 'grouped';
  const tree = wrap.querySelector('.reg-tree');
  const legend = wrap.querySelector('.reg-legend');
  const flatBox = wrap.querySelector('[data-reg-flat]');
  const flat = attachFlat(wrap, () => writeHash());

  // The toggle only shows/hides — both views stay in the DOM and both stay
  // filtered (see apply()), so switching is instant and loses no state.
  function setView(v) {
    view = v === 'flat' ? 'flat' : 'grouped';
    const isFlat = view === 'flat';
    tree.hidden = isFlat;
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

  const setOpen = (el, open) => {
    el.classList.toggle('reg-closed', !open);
    const head = el.querySelector('[data-arc-toggle],[data-proj-toggle]');
    if (head) {
      head.setAttribute('aria-expanded', String(open));
      const caret = head.querySelector('.reg-caret');
      if (caret) caret.textContent = open ? '▾' : '▸';
    }
  };

  wrap.addEventListener('click', (e) => {
    const head = e.target.closest('[data-arc-toggle],[data-proj-toggle]');
    if (head) {
      const box = head.closest('[data-arc],[data-proj]');
      setOpen(box, box.classList.contains('reg-closed'));
      return;
    }
    const row = e.target.closest('[data-row]');
    if (!row) return;
    const href = row.dataset.href;
    detailTitle.textContent = row.dataset.label || 'artifact';
    if (!href) {
      detailBody.innerHTML = `<div class="prism-error">This artifact has unparseable frontmatter,
        so there is nothing to project. Fix the source, then regenerate.</div>`;
    } else {
      // Nested <soma-artifact>: the selected artifact renders through ITS OWN layout
      // (cycle / arc / map / …), so this index inherits every layout that exists now
      // or later without knowing any of them.
      detailBody.innerHTML = `<soma-artifact src="${href}"></soma-artifact>`;
    }
    detail.hidden = false;
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  wrap.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const head = e.target.closest('[data-arc-toggle],[data-proj-toggle]');
    if (!head) return;
    e.preventDefault();
    const box = head.closest('[data-arc],[data-proj]');
    setOpen(box, box.classList.contains('reg-closed'));
  });

  // ── View state lives in the URL fragment ────────────────────────────────
  // Shareable, survives reload, and the back button works -- for the price of two
  // small functions and no state library at all.
  function readHash() {
    const h = new URLSearchParams((location.hash || '').replace(/^#/, ''));
    if (h.has('q')) q.value = h.get('q');
    if (h.has('status')) bucketSel.value = h.get('status');
    if (h.has('project') && projSel) projSel.value = h.get('project');
    if (h.has('scope') && scopeSel) scopeSel.value = h.get('scope');
    if (h.has('sort')) sortSel.value = h.get('sort');
    if (h.has('card')) activeCard = h.get('card');
    if (h.get('broken') === '1') brokenOnly.checked = true;
    if (h.get('view') === 'flat') view = 'flat';
    if (h.has('fs')) flat.state = h.get('fs');
  }
  function writeHash() {
    const p = new URLSearchParams();
    if (q.value.trim()) p.set('q', q.value.trim());
    if (bucketSel.value) p.set('status', bucketSel.value);
    if (projSel && projSel.value) p.set('project', projSel.value);
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
  const CARD_TESTS = {
    active:  (d) => d.bucket === 'Active',
    seeded:  (d) => d.bucket === 'Seeded',
    closed:  (d) => d.bucket === 'Closed',
    stale:   (d) => d.bucket === 'Active' && Number(d.age) > 60,
    nogit:   (d) => d.git === '0',
    broken:  (d) => d.broken === '1',
  };

  function syncCards() {
    for (const el of wrap.querySelectorAll('[data-card]')) {
      el.classList.toggle('reg-card-on', el.dataset.card === activeCard);
      el.setAttribute('aria-pressed', String(el.dataset.card === activeCard));
    }
  }

  wrap.addEventListener('click', (e) => {
    const card = e.target.closest('[data-card]');
    if (!card) return;
    // Toggle: clicking the active card clears it, so a card can never become a filter
    // you cannot get back out of.
    activeCard = (activeCard === card.dataset.card) ? '' : card.dataset.card;
    syncCards();
    apply();
  });

  function apply() {
    const term = (q.value || '').trim().toLowerCase();
    const bucket = bucketSel.value, bOnly = brokenOnly.checked;
    const proj = projSel ? projSel.value : '';
    const scope = scopeSel ? scopeSel.value : '';
    const cardTest = CARD_TESTS[activeCard];
    let n = 0;

    for (const row of wrap.querySelectorAll('[data-row]')) {
      const d = row.dataset;
      const ok = (!term || (d.blob || '').includes(term))
        && (!bucket || d.bucket === bucket)
        && (!proj || d.project === proj)
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

  function sortArcs() {
    const mode = sortSel.value;
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
  }

  [q, bucketSel, projSel, scopeSel, brokenOnly].filter(Boolean).forEach((el) => {
    el.addEventListener('input', apply);
    el.addEventListener('change', apply);
  });
  sortSel.addEventListener('change', () => { sortArcs(); writeHash(); });

  let allClosed = false;
  collapseBtn.addEventListener('click', () => {
    allClosed = !allClosed;
    wrap.querySelectorAll('[data-arc],[data-proj]').forEach((el) => setOpen(el, !allClosed));
    collapseBtn.textContent = allClosed ? 'expand all' : 'collapse all';
  });

  wrap.querySelector('[data-reg-close]').addEventListener('click', () => {
    detail.hidden = true;
    detailBody.innerHTML = '';
  });

  // Restore the view from the URL BEFORE the first apply, so a shared link opens on
  // the view it describes rather than flashing the default and then correcting.
  readHash();
  syncCards();
  setView(view);
  if (sortSel.value && sortSel.value !== 'name') sortArcs();
  apply();
}
