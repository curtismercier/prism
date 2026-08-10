// PRISM registry — CHROME: the project filter rail (S5 row 8) and the ⌘K search hint (row 7).
//
// WHY THIS FILE EXISTS — two reasons, and the second is the load-bearing one.
//
// 1. `registry.mjs` had grown to 618 lines against its own 600-line gate (that gate is the
//    whole point of the decomposition; see registry-decompose.test.mjs G1). This is the 80
//    lines that pushed it over.
//
// 2. 🔑 THE PORTABILITY LEAK. Every other registry sub-module is PURE — `registry-detail.mjs`
//    even takes `esc` as an argument rather than importing it, so it has zero imports and can
//    be hosted by anything with a DOM. The ⌘K binding broke that: it reaches `document`
//    directly, and it keeps MODULE-LEVEL state (the handler, so a re-render can remove the
//    previous one). Left inside `registry.mjs`, that document-level coupling sat in the middle
//    of the orchestrator where nothing declared it. Isolated here, the registry's one
//    non-portable dependency is named, in one file, with one export that owns its teardown.
//
// ⛔ This is REGISTRY chrome, deliberately not `shell-header.mjs`. That module states it must
//    stay registry-agnostic; a hint bound to `data-reg-q` is a registry concern by construction.
//    The generic half (the scroll sentinel, the observer) lives there; the specific half is here.
//
// CONTRACT: pure builders + one `attach`. No imports. Dependencies arrive as arguments, so this
// module makes no assumption about which interface hosts it — a page, a desktop pane, a
// somaverse pane. `document` is touched in exactly one place, and it is documented below.

/**
 * Per-project totals for the filter rail.
 *
 * `projects` is already the deduped/sorted list every dropdown uses; this tallies against it
 * once rather than re-filtering `rows` per row at render time.
 *
 * @param {Array}    rows            every registry row
 * @param {string[]} projects        the deduped project list
 * @param {Function} displayProject  row → project label (from registry-tree.mjs)
 * @param {Function} esc             HTML escaper — a manifest is data, and data is never markup
 */
export function buildRail({ rows, projects, displayProject, esc }) {
  const counts = {};
  for (const r of rows) {
    const p = displayProject(r);
    if (p) counts[p] = (counts[p] || 0) + 1;
  }
  return `<aside class="reg-rail" data-reg-rail aria-label="filter by project">
    <div class="reg-rail-head">projects</div>
    <button type="button" class="reg-rail-row is-active" data-reg-rail-row data-reg-rail-project="" aria-pressed="true">
      <span class="reg-rail-label">all projects</span><span class="reg-rail-count">${rows.length}</span>
    </button>
    ${projects.map((p) => `<button type="button" class="reg-rail-row" data-reg-rail-row data-reg-rail-project="${esc(p)}" aria-pressed="false" title="${esc(p)}">
      <span class="reg-rail-label">${esc(p)}</span><span class="reg-rail-count">${counts[p] || 0}</span>
    </button>`).join('')}
  </aside>`;
}

/**
 * The ⌘K badge for the shell header's `meta` slot. A hint pointing at real functionality —
 * it focuses the existing input rather than duplicating it. One search box, one keybinding.
 */
export function buildSearchHint() {
  return `<button type="button" class="shell-search-hint" data-shell-search-hint title="jump to the search box">⌘K</button>`;
}

/**
 * The single ⌘K listener. Module-level ON PURPOSE: `maybeRefresh()` re-invokes render+attach on
 * a live poll, and a fresh `document.addEventListener` per refresh would accumulate one listener
 * per cycle over a long-lived session. Tracking the last one is what makes re-attach idempotent.
 */
let CMDK_HANDLER = null;

/**
 * Wire the chrome. Returns `{ syncRail }` so the caller can re-run it from its own sync pass.
 *
 * The rail is a THIN wrapper around the existing project dropdown, not a second filter
 * mechanism: it sets `projSel.value` and dispatches the SAME `change` event the dropdown fires,
 * so it inherits URL-hash sync, facet recount and the empty-state message for free, and cannot
 * drift from the dropdown the way the cards once did.
 *
 * @param {HTMLElement} wrap           the registry root
 * @param {object}      deps
 * @param {HTMLSelectElement} deps.projSel      the project dropdown — the source of truth
 * @param {HTMLInputElement}  deps.searchInput  the real search box
 * @returns {{syncRail: Function, destroy: Function}}
 */
export function attachChrome(wrap, { projSel, searchInput }) {
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
    const row = e.target.closest('[data-reg-rail-row]');
    if (!row || !projSel) return;
    projSel.value = row.dataset.regRailProject || '';
    projSel.dispatchEvent(new Event('change'));
  });

  const focusSearch = () => {
    if (!searchInput) return;
    searchInput.focus();
    searchInput.select();
  };

  const hint = wrap.querySelector('[data-shell-search-hint]');
  if (hint) hint.addEventListener('click', focusSearch);

  // ⚠ THE ONE `document` TOUCH IN THE REGISTRY. A keybinding has no element to bind to —
  // it is inherently document-scoped. `wrap.isConnected` keeps a detached (replaced) render
  // from stealing the key, which is what makes this safe to re-attach.
  if (CMDK_HANDLER) document.removeEventListener('keydown', CMDK_HANDLER);
  CMDK_HANDLER = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && wrap.isConnected) {
      e.preventDefault();
      focusSearch();
    }
  };
  document.addEventListener('keydown', CMDK_HANDLER);

  /** Explicit teardown for a host that unmounts rather than replaces (a pane, not a page). */
  function destroy() {
    if (CMDK_HANDLER) document.removeEventListener('keydown', CMDK_HANDLER);
    CMDK_HANDLER = null;
  }

  return { syncRail, destroy };
}
