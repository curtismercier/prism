// PRISM registry — the ARTIFACT PREVIEW PANE (002 Phase e, presentation half)
//
// ⚠ This pane was NOT built here. It existed in `registry.mjs` (the `.reg-detail`
// scaffold, its close ✕, and the nested <soma-artifact> projection). What changed is
// its PLACEMENT — and that was the whole of Phase e's complaint:
//
//   Curtis: "instead of it scrolling down to show it under the huge list of
//            projects/cycles — it could open up in a cycle preview/editor
//            (like kinda in the same window but not)."
//
// The old surface was an inline block BELOW the list plus
// `detail.scrollIntoView({behavior:'smooth'})`, so opening a cycle moved the page out
// from under the reader and lost their place in a 500-row tree. It is now a DOCKED
// panel: `position: fixed`, so it takes the artifact out of the list's flow entirely
// and the list does not move at all. The scrollIntoView is deleted, not re-tuned —
// there is nothing left to scroll to.
//
// ⛔ NO PUT/POST ENDPOINT GOES INTO THIS REPO. Ruled, and UNCHANGED: this panel ships
// READ + COPY-PATCH; real writes route through a live soma session. The repo is being
// prepared for publication and a published artifact must carry no write path.
//
// ✅ AMENDED 2026-08-12 (Curtis): a CAPABILITY-GATED, DORMANT edit affordance MAY live
// here — the endpoint still may not. The write half lives only in
// meetsoma/.soma/amps/scripts/soma-prism-serve.py, which is never published.
//   why: keeping the affordance out too would force a SECOND copy of this file on the
//   meetsoma side, tracking this one forever. Curtis: "we don't want to have to track
//   or update in code." Purity here, paid for in drift, is the worse trade.
//   The affordance is inert without a local --write server AND a per-session opt-in.
//   Spec + gates: personal/prism/.soma/cycles/006-line-scoped-editing/cycle.md
//
// The projection indirection is UNCHANGED and deliberate: the pane renders
// `<soma-artifact src=…>`, which dispatches to the artifact's OWN layout (cycle / arc /
// map / …). This index therefore inherits every layout that exists now or later
// without naming any of them.

/**
 * The pane's markup. Rendered inside [data-reg] but positioned out of flow, so its
 * position in the document order is irrelevant to where it appears.
 */
export function buildDetailPane() {
  return `
  <aside class="reg-detail" data-reg-detail hidden role="dialog" aria-label="artifact preview" aria-modal="false">
    <div class="reg-resize" data-reg-resize role="separator" aria-orientation="vertical"
         aria-label="resize preview pane" tabindex="0"></div>
    <div class="reg-detail-bar">
      <strong data-reg-detail-title></strong>
      <button type="button" data-reg-close class="reg-close">close ✕</button>
    </div>
    <div class="reg-detail-body" data-reg-detail-body></div>
  </aside>`;
}

/**
 * Wire the pane: what opens in it, and how it closes.
 * Owns the row / artifact click delegation, because "what may be projected" is the
 * pane's question, not the tree's.
 *
 * @param {Element} wrap  the [data-reg] root
 * @param {(s:any)=>string} esc
 * @returns {{ open():void, close():void, isOpen():boolean }}
 */
export function attachDetail(wrap, esc) {
  const detail = wrap.querySelector('[data-reg-detail]');
  const detailBody = wrap.querySelector('[data-reg-detail-body]');
  const detailTitle = wrap.querySelector('[data-reg-detail-title]');
  const closeBtn = wrap.querySelector('[data-reg-close]');
  if (!detail) return { open() {}, close() {}, isOpen: () => false };

  const isOpen = () => !detail.hidden;

  function open() {
    detail.hidden = false;
    wrap.classList.add('reg-detail-open');
    // Focus the close control, so the pane is dismissable from the keyboard the moment
    // it appears. There is no scroll of any kind here — that is the point of the move.
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }

  function close() {
    detail.hidden = true;
    wrap.classList.remove('reg-detail-open');
    detailBody.innerHTML = '';
  }

  wrap.addEventListener('click', (e) => {
    // Artifacts split by whether PRISM can PROJECT them.
    //
    // A .md sibling is the same species as the cycle.md next to it -- frontmatter plus
    // prose -- so routing it to its own window hands the reader raw markdown when the
    // detail pane could render it through its own layout. Those open INLINE, exactly
    // like a cycle row, and are marked so the reader can tell which they are looking at.
    //
    // Everything else (a rendered dashboard, a PNG, a JSON blob) is already a finished
    // page or is not markdown at all: projecting it would try to project a page that is
    // already a page. Those keep the real target=_blank navigation.
    const artLink = e.target.closest('[data-artifact]');
    if (artLink) {
      if (!artLink.hasAttribute('data-projectable')) return;   // let the browser have it
      e.preventDefault();                                       // ⌘/middle-click still opens a tab
      // The tag is the only difference from a cycle: same projection, different label,
      // so "what am I reading" never has to be inferred from the content.
      detailTitle.innerHTML = `<span class="reg-detail-kind">artifact</span> `
        + esc(artLink.dataset.artName || 'artifact')
        + (artLink.dataset.artOf ? ` <span class="reg-detail-of">of ${esc(artLink.dataset.artOf)}</span>` : '');
      detailBody.innerHTML = `<soma-artifact src="${esc(artLink.getAttribute('href'))}"></soma-artifact>`;
      open();
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
    open();
  });

  if (closeBtn) closeBtn.addEventListener('click', close);

  attachResize(detail);

  // Escape closes. Additive: the ✕ Curtis asked for is unchanged and still the visible
  // affordance. Bound to `wrap`, never to `document` — this layout re-renders itself on
  // data refresh, and a document-level listener would accumulate one copy per render.
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) close();
  });

  return { open, close, isOpen };
}

/**
 * Drag the docked edge to resize; the width persists across reloads.
 *
 * Phase e docked the pane and hardcoded `min(760px, 52vw)`. That is one width for
 * every artifact in the estate -- a 60-line seed and a 440-line branching cycle with
 * five-column tables get the same box (Curtis, 2026-08-09: "it's not adjustable").
 *
 * The width lives in a CSS custom property on the pane, NOT in an inline `width`:
 * the bottom-sheet media query at <=800px overrides `width` wholesale, and an inline
 * style would beat it and leave a 400px-wide sheet on a phone.
 *
 * Pointer events, not mouse: one code path covers trackpad, touch and pen, and
 * `setPointerCapture` keeps the drag alive when the cursor outruns the 7px strip --
 * without it a fast drag drops on the first frame that lands outside the handle.
 */
function attachResize(detail) {
  const handle = detail.querySelector('[data-reg-resize]');
  if (!handle) return;
  const KEY = 'prism.reg-detail-w';
  const MIN = 320;
  // Leave the list reachable: a pane that can cover the whole window is a modal, and
  // this one is deliberately not (`aria-modal="false"` -- you keep your place in the list).
  const max = () => Math.max(MIN, Math.round(window.innerWidth * 0.92));
  const clamp = (px) => Math.min(max(), Math.max(MIN, Math.round(px)));
  const put = (px) => detail.style.setProperty('--reg-detail-w', clamp(px) + 'px');

  const saved = Number(localStorage.getItem(KEY));
  if (saved) put(saved);

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    detail.classList.add('reg-resizing');
    const move = (ev) => put(window.innerWidth - ev.clientX);   // docked RIGHT: width grows leftward
    const up = () => {
      handle.removeEventListener('pointermove', move);
      detail.classList.remove('reg-resizing');
      const w = detail.style.getPropertyValue('--reg-detail-w');
      if (w) localStorage.setItem(KEY, parseInt(w, 10));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up, { once: true });
    handle.addEventListener('pointercancel', up, { once: true });
  });

  // Keyboard parity. A drag handle reachable only by pointer is a control half the
  // users cannot operate, and this one is in the tab order (tabindex=0) either way.
  handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 100 : 20;
    const cur = parseInt(detail.style.getPropertyValue('--reg-detail-w'), 10)
      || Math.round(detail.getBoundingClientRect().width);
    if (e.key === 'ArrowLeft')       put(cur + step);
    else if (e.key === 'ArrowRight') put(cur - step);
    else return;
    e.preventDefault();
    localStorage.setItem(KEY, parseInt(detail.style.getPropertyValue('--reg-detail-w'), 10));
  });
}
