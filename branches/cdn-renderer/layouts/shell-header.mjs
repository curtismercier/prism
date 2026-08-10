// PRISM — SHARED dashboard shell header (breadcrumb + cross-dashboard menu)
//
// 🔴 SHARED ON PURPOSE. The audit that preceded this module proposed a
// `registry-header.mjs`; that was corrected before building. Every layout renders its
// own chrome today (`body.mjs`, `default.mjs`, `pipeline.mjs`, `cycle.mjs` each carry
// their own `<h1>` construct, and `registry.mjs` carried none), so a registry-private
// header can only ever give the REGISTRY a breadcrumb — while the whole point of the
// cross-dashboard menu is federation:
//
//   "so the dashboards become a navigable family, not islands" (002 §Phase g.3)
//
// A private header cannot federate anything. This module is importable by any layout;
// `registry.mjs` is simply the first adopter. Other layouts adopt it in a later pass —
// nothing here is registry-specific.
//
// It delivers:
//   g.1  breadcrumb — the brand/product lockup is a link back to the dashboard root
//   g.3  cross-dashboard menu — DERIVED, never hardcoded
//
// ── The rule that governs the menu ────────────────────────────────────────────
// A hardcoded list of dashboards is the exact defect class this estate spends its time
// removing: a hand-maintained enumeration bound to no traversal, which drifts silently
// and fails nothing when it does. So the entries are DERIVED, and the acceptance test
// is behavioural: **adding a dashboard must require zero edits to this file.**
//
//   AVAILABLE (its source is missing)  → HIDE.  Absence is a fact about the world.
//   USED      (never visited / no data) → SORT or DIM, **NEVER HIDE.**
//
// Hiding-by-unused is self-reinforcing: never shown → never visited → never "used" →
// never shown. A filter that can only shrink buries the NEWEST dashboards precisely
// because they are newest. That is the same shape as a check that cannot fail.
//
//   EMPTY ≠ ABSENT. A dashboard with no data renders LISTED AND MARKED EMPTY.
//   "nothing here yet" is navigational information; silence is not.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// ── Brand lockup ─────────────────────────────────────────────────────────────
// The canonical lockup is a SWAP, not a prefix: the first `o` in the brand name is
// replaced by the symbol, coloured, with the rest of the word left alone -- Sσma.
// Reads as name/symbol/name (white-gold-white) rather than bolting a glyph on the
// front. Generic by construction: "Acme Robotics" becomes "Acme Rσbotics".
// No `o` in the name => render it plain. A brand with nowhere to put the mark must
// not get a stray one.
export function lockup(name, symbol) {
  if (!name) return '';
  const i = symbol ? name.search(/o/i) : -1;
  if (i < 0) return `<span class="shell-brand-name">${esc(name)}</span>`;
  return `<span class="shell-brand-name">${esc(name.slice(0, i))}`
    + `<span class="shell-brand-sigma" aria-hidden="true">${esc(symbol)}</span>`
    + `${esc(name.slice(i + 1))}</span>`;
}

// Host-supplied colour arrives as a CSS custom property rather than an inline colour,
// so the stylesheet keeps ownership of WHERE the brand colour is used and the host
// only says WHAT it is. Sanitised: a colour is a short token, never arbitrary CSS.
// TWO colours, because a brand colour is surface-dependent. The stylesheet's
// prefers-color-scheme block picks; the host only declares. Setting one hex for both
// surfaces is how a mark ends up at 1.5:1 on light and nobody notices, because it
// looks perfect on whichever theme the author happens to use.
const okColor = (v) => (/^[#a-zA-Z0-9(),.%\s-]{0,40}$/.test(v || '') ? (v || '') : '');
export function brandStyle(brand = {}) {
  const cDark = okColor(brand.color);
  const cLight = okColor(brand.color_light) || cDark;
  return cDark || cLight
    ? ` style="--prism-brand-dark:${esc(cDark)};--prism-brand-light:${esc(cLight)};--prism-brand-glow:${esc(cDark)}33"`
    : '';
}

// ── The menu ─────────────────────────────────────────────────────────────────

/**
 * Normalise + filter + order raw manifest entries. PURE — this is the rule engine,
 * and it is exported separately from the markup precisely so the two branches nobody
 * exercises in a browser (an ABSENT dashboard, an EMPTY one) are testable without a DOM.
 *
 * @param {Array} entries raw manifest entries
 * @param {{current?: string}} opts
 * @returns {Array<{id,label,href,order,empty,current}>}
 */
export function selectDashboards(entries, { current = '' } = {}) {
  const out = [];
  for (const e of entries || []) {
    if (!e) continue;
    const id = String(e.id || e.slug || e.label || '').trim();
    if (!id) continue;
    // AVAILABILITY — the only signal allowed to hide. `present:false` is an explicit
    // "the manifest knows about it and its source is gone"; a missing href is the same
    // fact arriving implicitly (there is nowhere to navigate).
    if (e.present === false) continue;
    const href = String(e.href || '').trim();
    if (!href) continue;
    // USAGE / EMPTINESS — records state, never hides. `count === 0` and an explicit
    // `empty:true` mean the same thing; either marks, neither removes.
    const empty = e.empty === true || (typeof e.count === 'number' && e.count === 0);
    out.push({
      id,
      label: String(e.label || e.title || id),
      href,
      order: Number.isFinite(e.order) ? Number(e.order) : 500,
      empty,
      current: id === current,
    });
  }
  // Declared order first, then alphabetical. Deliberately NOT ordered by usage: an
  // ordering that demotes the unvisited is one step from a filter that hides them.
  out.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  return out;
}

/**
 * Render the menu. PURE. Returns '' when there is nothing to federate — an empty
 * `<nav>` would be chrome asserting a family that does not exist.
 */
export function buildDashboardMenu(entries, { current = '', source = '' } = {}) {
  const list = selectDashboards(entries, { current });
  if (!list.length) return '';
  const items = list.map((d) => {
    const mark = d.empty
      ? ` <span class="shell-nav-empty" title="this dashboard exists but has no data yet">empty</span>`
      : '';
    if (d.current) {
      return `<span class="shell-nav-item is-current${d.empty ? ' is-empty' : ''}" aria-current="page">${esc(d.label)}${mark}</span>`;
    }
    return `<a class="shell-nav-item${d.empty ? ' is-empty' : ''}" href="${esc(d.href)}">${esc(d.label)}${mark}</a>`;
  }).join('');
  return `<details class="shell-menu" data-shell-menu data-shell-nav-source="${esc(source || 'manifest')}">
    <summary class="shell-menu-btn" title="switch dashboard — this list is derived, never hand-written">dashboards <span aria-hidden="true">▾</span></summary>
    <nav class="shell-nav" aria-label="dashboards">${items}</nav>
  </details>`;
}

/**
 * Find the dashboard family, in preference order. Never throws, never invents.
 *
 * 1. `data.dashboards` — inline in the same JSON the page already fetched. Preferred:
 *    it preserves the emitter's ONE SOURCE, TWO PROJECTIONS property (if two counts
 *    ever disagree, the cause is two code paths and the fix is to delete one).
 * 2. `dashboards.json` beside the data file — the manifest the scanner will emit from
 *    documents that self-declare `dashboard: true` in frontmatter.
 * 3. DERIVED FALLBACK — rows that self-declare by TAG (`tags: [dashboard]`), linked
 *    through the rendered page they already ship as a `view` artifact. This exists
 *    because the manifest emitter is NOT part of this pass, and the alternative was a
 *    literal array. It uses only fields the emitter already ships, so a new dashboard
 *    joins the menu by adding a tag — no edit here, no edit to the emitter.
 *
 * @returns {{entries: Array, source: 'inline'|'manifest'|'derived'|'none'}}
 */
export async function loadDashboards(dataUrl, data = {}) {
  if (Array.isArray(data.dashboards) && data.dashboards.length) {
    return { entries: data.dashboards, source: 'inline' };
  }
  if (dataUrl) {
    try {
      const res = await fetch(new URL('dashboards.json', dataUrl).href, { cache: 'no-store' });
      if (res.ok) {
        const m = await res.json();
        const entries = Array.isArray(m) ? m : (m.dashboards || []);
        if (entries.length) return { entries, source: 'manifest' };
      }
    } catch { /* no manifest is a normal state, not an error */ }
  }
  const derived = deriveDashboardsFromRows(data.cycles || []);
  return derived.length ? { entries: derived, source: 'derived' } : { entries: [], source: 'none' };
}

/**
 * The fallback projection. A row declares itself a dashboard with `tags: [dashboard]`;
 * its rendered page is whichever `view` artifact it ships. A dashboard cycle with no
 * rendered page has no destination, so `selectDashboards` will drop it as unavailable —
 * that is availability doing its job, not usage hiding something.
 * PURE and exported so the derivation is testable without a network.
 */
export function deriveDashboardsFromRows(rows) {
  const out = [];
  for (const r of rows || []) {
    const tags = (r.tags || []).map((t) => String(t).toLowerCase());
    if (!tags.includes('dashboard')) continue;
    const view = (r.artifacts || []).find((a) => a && a.kind === 'view');
    out.push({
      id: r.slug || r.arc || '',
      label: r.title || r.slug || r.arc || '',
      href: view ? view.href : '',
      // A dashboard whose cycle is Seeded has nothing behind it yet — listed, marked
      // empty. NEVER hidden: the newest dashboard is exactly the one a usage filter
      // would bury.
      empty: r.bucket === 'Seeded',
    });
  }
  return out;
}

// ── The header ───────────────────────────────────────────────────────────────

/**
 * @param {object} o
 * @param {object} o.brand    {name, symbol, url, color, color_light}
 * @param {string} o.product  what THIS dashboard is ("Cycle Registry")
 * @param {Array}  o.dashboards raw manifest entries (see loadDashboards)
 * @param {string} o.current  id of the dashboard being viewed
 * @param {string} o.source   provenance of the entries, for inspection
 * @param {string} o.meta     caller-owned right-hand slot (registry puts `generated`
 *                            + ⓘ help here; another layout will put something else)
 */
export function renderShellHeader({ brand = {}, product = '', dashboards = [], current = '', source = '', meta = '' } = {}) {
  const inner = lockup(brand.name, brand.symbol);
  // A sentinel, bundled with the header rather than left for the caller to place.
  // `attachShellHeader` observes it to toggle `.is-scrolled` -- same technique
  // `data-reg-sentinel` already proves for `.reg-sticky` (registry.mjs) -- so any
  // layout that adopts this header gets scroll-aware chrome with zero extra markup.
  // BREADCRUMB (g.1). The PRODUCT name is the home link — that is the "cycle registry"
  // Curtis pointed at. The BRAND keeps its own `url` when the host supplies one, because
  // that link goes somewhere else entirely (the brand's site); when it does not, the
  // whole lockup is the breadcrumb. Existing behaviour is preserved either way.
  const crumb = `<a class="shell-crumb" data-shell-home href="" title="back to this dashboard's root — keeps your current filters">${esc(product)}</a>`;
  const brandHtml = inner
    ? `${brand.url ? `<a class="shell-brand" href="${esc(brand.url)}">${inner}</a>` : `<span class="shell-brand" data-shell-home>${inner}</span>`}
       <span class="shell-brand-sep" aria-hidden="true">∕</span>
       ${crumb}`
    : crumb;

  return `<div data-shell-sentinel aria-hidden="true"></div>
  <div class="shell-topbar"${brandStyle(brand)}>
    <h2 class="shell-title">${brandHtml}</h2>
    <div class="shell-topmeta">
      ${buildDashboardMenu(dashboards, { current, source })}
      ${meta}
    </div>
  </div>`;
}

/**
 * S5 row 6 -- the z0 background layer. Fixed, viewport-covering, deliberately NOT
 * emitted from inside `.shell-topbar` itself: two radial-gradient orbs (§4.1/§4.2 of
 * the design-language report) that must sit BEHIND every layout's content regardless
 * of where the header is mounted, so it is its own small export rather than baked
 * into `renderShellHeader`'s markup. Callers place it once, as a sibling of their
 * content root (see registry.mjs) -- adopting it twice just stacks two identical,
 * fully-transparent divs, so it is harmless but pointless to call per-layout-instance.
 * Pure CSS: no canvas, no JS, matches the "cheap floor" S5 §2 costs at zero runtime.
 */
export function renderShellBackground() {
  return `<div class="shell-bg" aria-hidden="true">
    <div class="shell-orb shell-orb-warm"></div>
    <div class="shell-orb shell-orb-cool"></div>
  </div>`;
}

/**
 * Wire the breadcrumb.
 *
 * ⚠ SEMANTICS RULED: going home returns to the DEFAULT VIEW and **keeps the URL hash.**
 * Clearing it would destroy a shared filter link, and 002 §decisions-locked places view
 * state in the fragment on purpose. So "home" means *dismiss what you drilled into and
 * put the list back in front of you* — not *reset your query*.
 *
 * The `href` is set to the page WITHOUT its fragment, so copy-link / open-in-new-tab
 * still yield a clean root URL; the click itself is intercepted and never navigates.
 *
 * @param {Element} root
 * @param {{onHome?: () => void}} opts
 */
export function attachShellHeader(root, { onHome } = {}) {
  const bar = root.querySelector('.shell-topbar');
  if (!bar) return;
  // S5 row 7: transparent at scrollTop 0, gains a floor once the sentinel above the
  // bar scrolls out of view. Same IntersectionObserver shape `.reg-sticky` already
  // proves (registry.mjs) -- CSS alone cannot style a sticky element differently
  // once it pins, and a raw `scroll` listener would be the one already-rejected
  // pattern in this codebase (see `.reg-sticky`'s own comment).
  const sentinel = root.querySelector('[data-shell-sentinel]');
  if (sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      ([e]) => bar.classList.toggle('is-scrolled', !e.isIntersecting),
      { threshold: 0 },
    ).observe(sentinel);
  }
  for (const a of bar.querySelectorAll('a[data-shell-home]')) {
    a.setAttribute('href', location.pathname + location.search);
  }
  bar.addEventListener('click', (e) => {
    const home = e.target.closest('[data-shell-home]');
    if (!home) return;
    e.preventDefault();
    if (typeof onHome === 'function') onHome();
    // The hash is deliberately untouched — see the note above.
  });
  // A menu that stays open after you pick is a menu you have to dismiss twice.
  const menu = bar.querySelector('[data-shell-menu]');
  if (menu) {
    menu.addEventListener('click', (e) => {
      if (e.target.closest('a.shell-nav-item')) menu.open = false;
    });
  }
}
