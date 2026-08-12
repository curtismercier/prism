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
      <button type="button" data-reg-edit-toggle class="reg-edit-toggle" hidden
              title="cycle 006: opt in to line editing for this browser tab -- off by default, and a --write server alone does not turn it on">✎ editing off</button>
      <button type="button" data-reg-close class="reg-close">close ✕</button>
    </div>
    <div class="reg-detail-body" data-reg-detail-body></div>
  </aside>`;
}

// ── cycle 006: line-scoped editing ──────────────────────────────────────────
//
// The write ENDPOINT lives only in meetsoma/.soma/amps/scripts/soma-prism-serve.py
// (never published -- see this file's header for the standing ruling + its
// 2026-08-12 amendment). This half is the DORMANT, capability-gated affordance:
// inert unless (1) the server was started --write AND (2) the reader clicked
// the toggle THIS session. Neither alone is enough -- §Open questions item 1.

const EDIT_SESSION_KEY = 'prism.edit-session';

function escText(s) {
  return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

// A `src="/meetsoma/.soma/cycles/x/cycle.md"` on <soma-artifact> is already
// root-relative to the SAME root soma-prism-serve.py serves (it starts the
// server FROM that root -- see its docstring). Stripping the leading slash is
// therefore the whole conversion; no path math, no guessing.
function toServerPath(src) {
  const u = new URL(src, document.baseURI);
  return decodeURIComponent(u.pathname).replace(/^\//, '');
}

let closeActiveRowEditor = null;

function openRowEditor(tr, detailBody) {
  if (closeActiveRowEditor) closeActiveRowEditor();
  const raw = tr.dataset.srcLine;
  const artEl = detailBody.querySelector('soma-artifact');
  const src = artEl && artEl.getAttribute('src');
  if (raw == null || !src) return;
  const section = tr.closest('[data-section]')?.dataset.section || undefined;
  const cols = tr.children.length || 1;

  const editRow = document.createElement('tr');
  editRow.className = 'reg-row-editor';
  const td = document.createElement('td');
  td.colSpan = cols;
  td.innerHTML = `<div class="reg-edit-box">
    <textarea class="reg-edit-textarea" rows="2" spellcheck="false">${escText(raw)}</textarea>
    <div class="reg-edit-actions">
      <button type="button" class="reg-edit-save">save</button>
      <button type="button" class="reg-edit-cancel">cancel</button>
    </div>
    <pre class="reg-edit-status" hidden></pre>
  </div>`;
  editRow.appendChild(td);
  tr.after(editRow);
  tr.classList.add('reg-row-editing');

  const ta = td.querySelector('.reg-edit-textarea');
  const statusEl = td.querySelector('.reg-edit-status');
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);

  const cleanup = () => { editRow.remove(); tr.classList.remove('reg-row-editing'); };
  closeActiveRowEditor = cleanup;

  td.querySelector('.reg-edit-cancel').addEventListener('click', cleanup);

  td.querySelector('.reg-edit-save').addEventListener('click', async () => {
    const replacement = ta.value;
    statusEl.hidden = true;
    let res, body;
    try {
      res = await fetch('/_write', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: toServerPath(src), expected: raw, replacement, section }),
      });
      body = await res.json().catch(() => ({}));
    } catch (err) {
      statusEl.hidden = false;
      statusEl.textContent = `network error: ${err.message}`;
      return;
    }
    if (res.status === 200) {
      cleanup();
      closeActiveRowEditor = null;
      // Re-fetch + re-render from disk -- the same round trip a page reload would
      // give (cycle.md §G6), without actually reloading the page.
      artEl.render();
      return;
    }
    statusEl.hidden = false;
    if (res.status === 409 && body.error === 'ambiguous') {
      statusEl.textContent = `refused (409 ambiguous) -- this exact line appears ${body.count}× in this section. Narrow it with more context, or edit the source directly.`;
    } else if (res.status === 409) {
      statusEl.textContent = `refused (409 stale) -- this line changed on disk since you opened it.\nCurrent text:\n${body.current || '(unknown)'}`;
    } else if (res.status === 403) {
      statusEl.textContent = 'refused (403) -- path escapes the served root.';
    } else if (res.status === 404) {
      statusEl.textContent = 'refused (404) -- this server was not started with --write, or /_write is unreachable.';
    } else {
      statusEl.textContent = `refused (${res.status}): ${body.error || 'unknown error'}`;
    }
  });
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
  const editToggle = wrap.querySelector('[data-reg-edit-toggle]');
  if (!detail) return { open() {}, close() {}, isOpen: () => false };

  const isOpen = () => !detail.hidden;

  // cycle 006: per-SESSION opt-in (sessionStorage — gone when the tab closes), never a
  // preference a --write server's mere existence can flip on. Restoring `true` from an
  // earlier click THIS tab is still an opt-in this session; a fresh tab always starts false.
  let editSessionActive = sessionStorage.getItem(EDIT_SESSION_KEY) === '1';

  function paintEditToggle() {
    if (!editToggle) return;
    editToggle.textContent = editSessionActive ? '✎ editing ON' : '✎ editing off';
    editToggle.classList.toggle('reg-edit-on', editSessionActive);
    wrap.classList.toggle('reg-edit-session', editSessionActive);
  }

  if (editToggle) {
    editToggle.hidden = false;
    paintEditToggle();
    editToggle.addEventListener('click', async () => {
      if (editSessionActive) {
        editSessionActive = false;
        sessionStorage.removeItem(EDIT_SESSION_KEY);
        if (closeActiveRowEditor) { closeActiveRowEditor(); closeActiveRowEditor = null; }
        paintEditToggle();
        return;
      }
      // The probe fires HERE, on a real click, and nowhere else — never on page load,
      // never merely because a --write server exists to be asked. Third G5 assertion
      // (cycle.md §Open questions item 1): server advertising write ≠ session opt-in.
      editToggle.disabled = true;
      try {
        const res = await fetch('/_write', { cache: 'no-store' });
        const body = await res.json().catch(() => ({}));
        if (res.status === 200 && body.write === true) {
          editSessionActive = true;
          sessionStorage.setItem(EDIT_SESSION_KEY, '1');
        } else {
          editToggle.textContent = '✎ not writable';
          setTimeout(paintEditToggle, 1600);
        }
      } catch {
        editToggle.textContent = '✎ offline';
        setTimeout(paintEditToggle, 1600);
      } finally {
        editToggle.disabled = false;
        paintEditToggle();
      }
    });
  }

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
    if (closeActiveRowEditor) { closeActiveRowEditor(); closeActiveRowEditor = null; }
  }

  wrap.addEventListener('click', (e) => {
    // cycle 006: row editor takes priority. A `[data-src-line]` only ever appears on a
    // <tr> already INSIDE the open detail pane's rendered content, so this cannot
    // shadow the registry-list click handling below it.
    if (editSessionActive) {
      const srcRow = e.target.closest('[data-src-line]');
      if (srcRow && detailBody.contains(srcRow) && !srcRow.classList.contains('reg-row-editing')) {
        openRowEditor(srcRow, detailBody);
        return;
      }
    }
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
