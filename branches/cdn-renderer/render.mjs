// PRISM CDN renderer — Branch B of cycle 001 renderer-spike.
//
// Defines <soma-artifact> custom element. Fetches a PRISM source file,
// dispatches to a parser by extension, dispatches to a layout by frontmatter.type,
// renders into the element's shadow DOM with shared styles.
//
// Usage:
//   <link rel="stylesheet" href="./styles.css">  (or CDN URL)
//   <script type="module" src="./render.mjs"></script>
//   <soma-artifact src="./cycle.md"></soma-artifact>
//
// Zero build step. Zero install. Works in any modern browser.

// ── Module loading: the version query MUST propagate to the graph ──────────────
//
// Chrome keeps parsed ES modules in a module map keyed by URL. `Cache-Control:
// no-store` does NOT evict what is already parsed — verified s01-bbca8a: with
// no-store set, the file correct on disk AND correct on the wire, a brand-new tab
// still executed the OLD module (`renderCycle.toString()` showed the previous
// source). Only a DIFFERENT URL is a different key.
//
// So `render.mjs?v=N` busts only render.mjs; its static imports resolve to
// unversioned URLs and stay stale forever. That produced two false diagnoses in one
// session — "layout dispatch is broken" and "the title fix didn't apply" — while
// both files were correct the whole time.
//
// Fix: read our own query off `import.meta.url` and forward it to every child
// import. Bumping `?v=` in the HTML now busts the whole graph, which is what the
// author already believes it does.
const V = new URL(import.meta.url).search;                 // '' in production, '?v=N' in dev
const load = (rel) => import(new URL(rel + V, import.meta.url).href);

const [
  { parsePrism },
  { renderCycle },
  { renderDefault },
  { renderPipeline, attachPipelineLive },
  { renderRegistry, attachRegistry },
  { renderBody, attachBody },
] = await Promise.all([
  load('./parsers/md.mjs'),
  load('./layouts/cycle.mjs'),
  load('./layouts/default.mjs'),
  load('./layouts/pipeline.mjs'),
  load('./layouts/registry.mjs'),
  load('./layouts/body.mjs'),
]);

// A layout is either a render function, or { render, attach }. `attach` runs
// AFTER the HTML is in the DOM — innerHTML never executes <script>, so an
// interactive layout has no other way to bind handlers.
const LAYOUTS = {
  cycle: renderCycle,
  // An `arc` is cycle-shaped (through-line, phase table, gates) — same projection.
  // Without this it silently fell to renderDefault, which looks fine and is wrong.
  arc: renderCycle,
  // A `phase` is a cycle scoped to one step of an arc — same shape, same projection.
  // It fell to renderDefault for the same reason `arc` once did, and with the same
  // symptom: the body renders, so it looks fine, and only the missing TOC gives it
  // away. Measured s01-6f59eb in a real browser: cycle 8 anchors, arc 12, phase 0.
  // 🔑 The bug reported against `arc` was never in `arc` — `arc` renders a full TOC.
  //    It was this line's absence, one type over.
  phase: renderCycle,
  pipeline: { render: renderPipeline, attach: attachPipelineLive },
  // A sortable index over MANY artifacts. Click-through nests a <soma-artifact>,
  // so the index inherits every layout above it without knowing any of them.
  registry: { render: renderRegistry, attach: attachRegistry },
  // The agent's OWN body — a ledger with a cache physics, not a hierarchy.
  // Distinct layout rather than a `registry` variant because its spine is slot
  // ORDER (= cache order) and `registry`'s is project/arc/phase; collapsing them
  // would make the ladder sortable, which destroys the only axis that explains cost.
  body: { render: renderBody, attach: attachBody },
  // future: decision, task, briefing, methodology, spec...
};

class SomaArtifact extends HTMLElement {
  static get observedAttributes() { return ['src']; }

  // MECHANISM (task 1, s01-ac5017 follow-up): per the custom-elements upgrade
  // algorithm, an element already sitting in parsed HTML when
  // `customElements.define()` runs gets BOTH reactions fired for its initial
  // `src` -- attributeChangedCallback(name='src', oldVal=null, newVal=<src>)
  // AND connectedCallback -- back to back, synchronously enqueued in that
  // order. Every attribute on a pre-existing element counts as a "change" from
  // null, so the old `oldVal !== newVal` guard never caught it. That fired
  // TWO concurrent render() calls on the ONE <soma-artifact src="registry.md">
  // in index.html. Each render() does its own fetch + attach(); attach() ends
  // by calling readHash() then writeHash(). Whichever call's fetch chain
  // settled LAST clobbered `this.innerHTML` with a FRESH, unfiltered DOM,
  // re-ran readHash() against the (still-correct) location.hash, and — this is
  // the part that produced the selective-loss symptom — proved to be racing
  // its OWN registry.json fetch against the first call's, so the second
  // attach()'s writeHash() sometimes fired before its readHash() had finished
  // populating every control, re-serializing a PARTIAL state (only whichever
  // field happened to already be set — measured: program, the last field
  // readHash() assigns before the async gap) back over the correct hash the
  // first call had just written. Confirmed by instrumenting connectedCallback/
  // attributeChangedCallback with call-order logging: both fired for the one
  // statically-declared element, every load, only on first parse.
  //
  // Fix: an element should render once when it first becomes connected with a
  // src, and again only on a REAL subsequent src change. `_rendered` distinguishes
  // "initial upgrade noise" from "src actually changed after the fact".
  _rendered = false;

  connectedCallback() {
    this._rendered = true;
    this.render();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name !== 'src' || oldVal === newVal) return;
    if (!this._rendered) return;          // initial-upgrade fire — connectedCallback owns it
    if (this.isConnected) this.render();
  }

  async render() {
    const src = this.getAttribute('src');
    if (!src) {
      this.innerHTML = `<div class="prism-error">Missing <code>src</code> attribute</div>`;
      return;
    }

    // Loading state
    this.innerHTML = `<div class="prism-loading">Loading <code>${src}</code>…</div>`;

    let text;
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } catch (err) {
      this.innerHTML = `<div class="prism-error">
        <strong>Failed to load <code>${src}</code></strong><br>
        <small>${err.message}</small><br>
        <small>If the URL looks like <code>file://</code>, browsers block fetches from local files. Serve via <code>python3 -m http.server</code> and visit via http://localhost:8000.</small>
      </div>`;
      return;
    }

    // Dispatch by extension
    const ext = src.split('.').pop().toLowerCase();
    let parsed;
    try {
      if (ext === 'md') {
        parsed = parsePrism(text);
      } else if (ext === 'json') {
        // Future: JSON parser. For now treat as raw.
        const obj = JSON.parse(text);
        parsed = { frontmatter: obj.frontmatter || obj, sections: new Map(Object.entries(obj.sections || {})), preamble: '', trailer: '' };
      } else if (ext === 'xml') {
        this.innerHTML = `<div class="prism-error">XML parsing not yet implemented (Phase 2.B)</div>`;
        return;
      } else {
        this.innerHTML = `<div class="prism-error">Unknown extension: <code>.${ext}</code></div>`;
        return;
      }
    } catch (err) {
      this.innerHTML = `<div class="prism-error">
        <strong>Parse failed</strong><br>
        <small>${err.message}</small>
      </div>`;
      return;
    }

    // Resolve the source to an absolute URL and hand it to the layout. A layout that
    // fetches a sidecar file (`data: ./x.json`) must resolve it relative to the SOURCE,
    // not to the document — otherwise the same .md renders correctly only when it
    // happens to sit beside the page including it. Latent bug found s01-bbca8a: the
    // registry .md lives in `_browser/` while the page is a directory above, so
    // `./registry.json` silently resolved to the wrong path.
    parsed.srcUrl = new URL(src, document.baseURI).href;

    // Dispatch by type
    const type = parsed.frontmatter?.type || 'unknown';
    const entry = LAYOUTS[type] || renderDefault;
    const layout = typeof entry === 'function' ? entry : entry.render;
    const attach = typeof entry === 'function' ? null : entry.attach;

    // Layouts may be async — a layout that fetches its own data (e.g. a metrics
    // JSON emitted by a collector) is how an artifact stays live without anyone
    // rewriting HTML. `await` on a sync return is a no-op, so this is backwards
    // compatible with every existing layout.
    let html;
    try {
      html = await layout(parsed);
    } catch (err) {
      this.innerHTML = `<div class="prism-error">
        <strong>Layout <code>${type}</code> failed</strong><br>
        <small>${err.message}</small>
      </div>`;
      return;
    }

    this.innerHTML = html;

    if (attach) {
      try {
        attach(this, { frontmatter: parsed.frontmatter });
      } catch (err) {
        console.error('[prism] layout attach failed:', err);
      }
    }

    // Set page title from artifact if not set
    if (parsed.frontmatter?.title && !document.title.includes(parsed.frontmatter.title)) {
      const original = document.title;
      document.title = parsed.frontmatter.title + (original ? ` · ${original}` : '');
    }

    // Smooth-scroll for in-page anchors after render
    this.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', (e) => {
        const id = a.getAttribute('href').slice(1);
        const target = this.querySelector(`#${CSS.escape(id)}`);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Optional: highlight section briefly
          target.classList.add('section-flash');
          setTimeout(() => target.classList.remove('section-flash'), 1200);
        }
      });
    });
  }
}

if (!customElements.get('soma-artifact')) {
  customElements.define('soma-artifact', SomaArtifact);
}
