// PRISM layout — `body`
//
// A dashboard over Soma's OWN body: what ships in the prompt every turn, what is
// read on demand, and what an edit to each slot costs in invalidated cache.
//
// WHY THIS IS NOT `registry` WITH DIFFERENT NOUNS (s01-8ba64e)
// -----------------------------------------------------------
// `registry` browses MANY artifacts and its spine is hierarchy — project/arc/phase
// was already in the paths and was being rendered away. The body has almost no
// hierarchy; it has a LEDGER and a physics:
//
//   · 17 slots in `_mind.md` ship on every request.
//   · ~91 files exist. 7% of those bytes are resident. 93% cost nothing until read.
//   · A slot invalidates every cached byte BELOW it. Same edit, 100x cost swing
//     depending on where the slot sits.
//
// So ORDER is the spine here, and it must survive every view: slot order IS cache
// order. Sorting the ladder by size would destroy the only axis that explains cost
// — the identical mistake `registry` records about flat sortable tables, in a
// different costume. The ladder is never sortable. The file table below it is.
//
// THE THREE POPULATIONS, which a file listing cannot show:
//   resident      — full text in the prompt, every turn. You pay for all of it.
//   summary-only  — `lazy: true`. Its DESCRIPTION ships; the file does not.
//                   `ecosystem.md` is 24,941 bytes on disk and ~870 in the prompt.
//                   Conflating these two makes a lazy file look 28x its real cost.
//   on-demand     — not slotted at all. Zero cost until something reads it.
//
// Source shape:
//   ---
//   type: body
//   data: ./body.json     ← resolved against the SOURCE .md, not the document
//   ---

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const kb = (n) => n >= 1024 ? `${(n / 1024).toFixed(n >= 10240 ? 0 : 1)}K` : `${n}`;
const num = (n) => Number(n || 0).toLocaleString();

// Resolve hrefs against the SOURCE file, mirroring registry.mjs — a nested
// <soma-artifact> resolves relative to the document, not to the data file, so
// every path is made absolute here exactly once.
let BASE = '';
const abs = (h) => { try { return new URL(h, BASE).href; } catch { return h; } };

// ── the ladder ───────────────────────────────────────────────────────────────
// One row per slot, IN TEMPLATE ORDER. The bar is `invalidates_below` as a share
// of the resident total — i.e. the blast radius of editing this slot, not its size.
// A big slot late in the template is cheap; a small slot early is not.
const ladder = (slots, resident) => {
  if (!slots.length) return '';
  return `
  <div class="bd-ladder">
    <div class="bd-ladder-head">
      <span class="bd-h-slot">slot</span>
      <span class="bd-h-src">source</span>
      <span class="bd-h-n">size</span>
      <span class="bd-h-bar">invalidates below &mdash; the cost of editing it</span>
    </div>
    ${slots.map((s) => {
      const pct = Number(s.pct || 0);
      const heat = pct >= 70 ? 'hot' : pct >= 30 ? 'warm' : 'cool';
      const mode = s.mode || 'runtime';
      return `
      <div class="bd-slot bd-${heat}" data-slot="${esc(s.slot)}"
           title="editing ${esc(s.slot)} recompiles ${num(s.invalidates_below)} bytes of cached prompt">
        <span class="bd-h-slot"><code>${esc(s.slot)}</code><span class="bd-line">:${esc(s.line)}</span></span>
        <span class="bd-h-src"><span class="bd-mode bd-mode-${esc(mode)}">${esc(mode)}</span>${esc(s.source || '')}</span>
        <span class="bd-h-n">${s.bytes ? kb(s.bytes) : '&mdash;'}</span>
        <span class="bd-h-bar">
          <span class="bd-bar"><i style="width:${pct}%"></i></span>
          <span class="bd-pct">${pct}%</span>
          <span class="bd-abs">${num(s.invalidates_below)}</span>
        </span>
      </div>`;
    }).join('')}
    <div class="bd-ladder-foot">
      order is cache order &mdash; this list is deliberately not sortable.
      Resident total <b>${num(resident)}</b> bytes.
      A slot's cost is what sits <em>below</em> it, so moving an
      often-edited slot later is the cheapest optimisation available.
    </div>
  </div>`;
};

// ── population chips ─────────────────────────────────────────────────────────
const populations = (c) => `
  <div class="bd-pops">
    <div class="bd-pop bd-pop-res">
      <b>${c.loaded_full}</b><span>resident</span>
      <em>full text, every turn</em>
    </div>
    <div class="bd-pop bd-pop-sum">
      <b>${c.summary_only}</b><span>summary-only</span>
      <em>lazy &mdash; description ships, file does not</em>
    </div>
    <div class="bd-pop bd-pop-dem">
      <b>${c.on_demand}</b><span>on-demand</span>
      <em>zero cost until read</em>
    </div>
    <div class="bd-pop bd-pop-tot">
      <b>${Math.round(100 * c.bytes_resident / Math.max(c.bytes_total, 1))}%</b><span>of the body is resident</span>
      <em>${num(c.bytes_resident)} of ${num(c.bytes_total)} bytes</em>
    </div>
  </div>`;

// ── file table ───────────────────────────────────────────────────────────────
// Sortable, because here size genuinely is the question. A row with broken
// frontmatter renders VISIBLY BROKEN and is never hidden — an index that silently
// drops what it cannot parse rebuilds the defect it exists to prevent.
const fileRow = (r) => {
  const pop = r.loaded ? 'res' : r.summary_only ? 'sum' : 'dem';
  const stale = r.git && r.updated && r.git.slice(0, 10) > String(r.updated).slice(0, 10);
  return `
  <div class="bd-row bd-pop-${pop}${r.error ? ' bd-broken' : ''}"
       data-row data-href="${esc(abs('../' + (r.rel || '')))}"
       data-name="${esc(r.name)}" data-bytes="${r.bytes || 0}"
       data-pop="${pop}" tabindex="0">
    <span class="bd-c-name">
      <code>${esc(r.name)}</code>
      ${r.slot ? `<span class="bd-tag bd-tag-slot">${esc(r.slot)}</span>` : ''}
      ${r.lazy ? '<span class="bd-tag bd-tag-lazy">lazy</span>' : ''}
      ${!r.has_frontmatter ? '<span class="bd-tag bd-tag-nofm">no frontmatter</span>' : ''}
    </span>
    <span class="bd-c-desc">${esc(r.description || '')}</span>
    <span class="bd-c-n">${kb(r.bytes || 0)}</span>
    <span class="bd-c-n">${num(r.lines || 0)}L</span>
    <span class="bd-c-when">
      ${esc(String(r.updated || '').slice(0, 10) || '&mdash;')}
      ${stale ? `<span class="bd-tag bd-tag-drift" title="git touched it ${esc(r.git)} but \`updated:\` still says ${esc(r.updated)}">drift</span>` : ''}
    </span>
    ${r.error ? `<span class="bd-err">${esc(r.error)}</span>` : ''}
  </div>`;
};

// CONTRACT (fixed s01-8ba64e after somaverse-ui-artist caught it in the served page):
// render.mjs calls `layout(parsed)` — ONE argument — and the layout fetches its own
// `data:` sidecar. The first version of this took four positional args
// (fm, _body, srcUrl, data) and expected the caller to pass the JSON. It passed a
// node unit test where I handed it the object myself, and every stat card rendered
// `undefined` / `NaN%` in the browser because `body.json` was never requested at all.
// Verifying the function is not verifying the executing path.
export async function renderBody({ frontmatter: fm, srcUrl }) {
  BASE = srcUrl || '';
  // Resolve `data:` against the SOURCE .md, not the document — the .md lives in
  // `_browser/` while the page is a directory above, so `./body.json` relative to
  // the document silently resolves to the wrong path.
  const src = fm?.data ? new URL(fm.data, srcUrl || document.baseURI).href : null;
  if (!src) return `<div class="prism-error">Body layout needs <code>data:</code> in frontmatter</div>`;
  let data;
  try {
    const res = await fetch(src, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    data = await res.json();
  } catch (err) {
    // Fail VISIBLY. A body dashboard that renders empty cards when its data is
    // missing reads as "the body is empty", which is the opposite of the truth.
    return `<div class="prism-error"><strong>Body data failed to load</strong><br>
      <small><code>${esc(src)}</code> — ${esc(err.message)}</small><br>
      <small>regenerate with <code>soma-body-registry.py</code></small></div>`;
  }
  const c = data?.counts || {};
  const slots = data?.slots || [];
  const files = data?.files || [];
  return `
  <div class="bd-wrap">
    <header class="bd-head">
      <h1>${esc(fm?.title || 'Soma — body')}</h1>
      <p class="bd-sub">${esc(data?.soma || '')} &middot;
        generated ${esc(String(data?.generated_at || '').replace('T', ' ').slice(0, 16))}</p>
    </header>

    ${populations(c)}

    <h2 class="bd-h2">Cache ladder <span>&mdash; ${slots.length} slots, in template order</span></h2>
    ${ladder(slots, c.bytes_resident || 0)}

    <h2 class="bd-h2">Files <span>&mdash; ${files.length}</span>
      <input class="bd-filter" type="search" placeholder="filter&hellip;" data-filter>
      <span class="bd-shown" data-shown></span>
    </h2>
    <div class="bd-table" data-table>
      <div class="bd-row bd-thead">
        <span class="bd-c-name" data-sort="name">file</span>
        <span class="bd-c-desc">description</span>
        <span class="bd-c-n" data-sort="bytes">size</span>
        <span class="bd-c-n">lines</span>
        <span class="bd-c-when">updated</span>
      </div>
      ${files.map(fileRow).join('')}
    </div>

    <div class="bd-detail reg-detail" hidden>
      <div class="bd-detail-bar reg-detail-bar">
        <strong data-detail-title></strong>
        <button class="bd-close reg-close" data-close>close</button>
      </div>
      <div data-detail-body class="reg-detail-body"></div>
    </div>
  </div>`;
}

// `attach` runs AFTER the HTML is in the DOM — innerHTML never executes <script>,
// so an interactive layout has no other way to bind handlers.
export function attachBody(wrap) {
  const table = wrap.querySelector('[data-table]');
  const filter = wrap.querySelector('[data-filter]');
  const shown = wrap.querySelector('[data-shown]');
  const detail = wrap.querySelector('.bd-detail');
  const dTitle = wrap.querySelector('[data-detail-title]');
  const dBody = wrap.querySelector('[data-detail-body]');
  if (!table) return;
  const rows = [...table.querySelectorAll('[data-row]')];

  const apply = () => {
    const q = (filter?.value || '').toLowerCase().trim();
    let n = 0;
    for (const r of rows) {
      const hit = !q || r.textContent.toLowerCase().includes(q);
      // `hidden` alone is not enough: an author `display:` rule on .bd-row beats
      // the user-agent [hidden] rule regardless of specificity, so the attribute
      // is set correctly and the browser's own hiding never fires. The CSS carries
      // an explicit `.bd-row[hidden]{display:none}` — do not remove it.
      r.hidden = !hit;
      if (hit) n++;
    }
    if (shown) shown.textContent = q ? `${n} shown` : '';
  };
  filter?.addEventListener('input', apply);

  // Sort only the file table. The ladder is never sortable — order is cache order.
  let dir = {};
  table.querySelectorAll('[data-sort]').forEach((h) => {
    h.addEventListener('click', () => {
      const k = h.dataset.sort;
      dir[k] = !dir[k];
      const sorted = [...rows].sort((a, b) => {
        const av = k === 'bytes' ? +a.dataset.bytes : a.dataset.name;
        const bv = k === 'bytes' ? +b.dataset.bytes : b.dataset.name;
        return (av > bv ? 1 : av < bv ? -1 : 0) * (dir[k] ? 1 : -1);
      });
      sorted.forEach((r) => table.appendChild(r));
    });
  });

  const open = (row) => {
    const href = row.dataset.href;
    dTitle.innerHTML = `<span class="bd-detail-kind">body</span> ${esc(row.dataset.name)}`;
    // Nested <soma-artifact>: the file renders through ITS OWN layout, so this
    // dashboard inherits every layout that exists now or later without knowing any.
    dBody.innerHTML = href ? `<soma-artifact src="${esc(href)}"></soma-artifact>`
                           : `<div class="prism-error">no source path</div>`;
    detail.hidden = false;
    // 002 Phase e adoption (s01-c6692e, 2026-08-05): `.reg-detail` docks this panel
    // (position:fixed, own scroll container) instead of the old inline-below-the-list
    // placement -- there is nothing left to scroll the PAGE to. scrollIntoView deleted,
    // not re-tuned, same reasoning as registry-detail.mjs's own note on this defect.
  };
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { detail.hidden = true; return; }
    if (e.target.closest('[data-sort]')) return;
    const row = e.target.closest('[data-row]:not(.bd-thead)');
    if (row) open(row);
  });
  wrap.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest?.('[data-row]:not(.bd-thead)');
    if (row) { e.preventDefault(); open(row); }
  });
  apply();
}
