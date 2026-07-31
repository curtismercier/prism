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
  return `<span class="reg-stats">${chips}${added}${fresh}</span>`;
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

  return `
<div class="reg" data-reg>
  <div class="reg-counts">
    <span class="reg-k">${c.cycles ?? rows.length}</span> cycles ·
    <span class="reg-k">${byProject.size}</span> projects ·
    <span class="reg-k ${broken ? 'reg-bad' : ''}">${broken}</span> unparseable
    ${d.generated_at ? `<span class="reg-gen">generated ${esc(d.generated_at)}</span>` : ''}
  </div>
  ${preamble ? `<div class="reg-pre">${preamble}</div>` : ''}

  <div class="reg-controls">
    <input type="search" data-reg-q placeholder="filter by slug, arc, title, status, tag…" class="reg-input">
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

  <div class="reg-legend">
    <span class="reg-nm">phase / cycle</span> · status ·
    <span class="reg-d">created</span> <span class="reg-d">claims</span>
    <span class="reg-d">touched</span> <span class="reg-age">age</span>
    <em>— “claims” is the frontmatter’s own <code>updated:</code>; “touched” is the last git commit.</em>
  </div>

  <div class="reg-tree">${body}</div>

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
  const sortSel = wrap.querySelector('[data-reg-sort]');
  const brokenOnly = wrap.querySelector('[data-reg-broken]');
  const collapseBtn = wrap.querySelector('[data-reg-collapse]');

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

  function apply() {
    const term = (q.value || '').trim().toLowerCase();
    const bucket = bucketSel.value, bOnly = brokenOnly.checked;
    let n = 0;

    for (const row of wrap.querySelectorAll('[data-row]')) {
      const ok = (!term || (row.dataset.blob || '').includes(term))
        && (!bucket || row.dataset.bucket === bucket)
        && (!bOnly || row.dataset.broken === '1');
      row.hidden = !ok;
      if (ok) n++;
    }
    // A group with nothing visible inside it is noise — hide the container too, so a
    // filter narrows the TREE rather than leaving empty scaffolding behind.
    for (const arc of wrap.querySelectorAll('[data-arc]')) {
      arc.hidden = ![...arc.querySelectorAll('[data-row]')].some((r) => !r.hidden);
    }
    for (const proj of wrap.querySelectorAll('[data-proj]')) {
      const anyRow = [...proj.querySelectorAll('[data-row]')].some((r) => !r.hidden);
      proj.hidden = !anyRow;
    }
    shown.textContent = `${n} shown`;
  }

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

  [q, bucketSel, brokenOnly].forEach((el) => {
    el.addEventListener('input', apply);
    el.addEventListener('change', apply);
  });
  sortSel.addEventListener('change', sortArcs);

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

  apply();
}
