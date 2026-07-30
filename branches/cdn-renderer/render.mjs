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

import { parsePrism } from './parsers/md.mjs';
import { renderCycle } from './layouts/cycle.mjs';
import { renderDefault } from './layouts/default.mjs';
import { renderPipeline } from './layouts/pipeline.mjs';

const LAYOUTS = {
  cycle: renderCycle,
  pipeline: renderPipeline,
  // future: decision, task, briefing, methodology, spec...
};

class SomaArtifact extends HTMLElement {
  static get observedAttributes() { return ['src']; }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'src' && oldVal !== newVal && this.isConnected) this.render();
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

    // Dispatch by type
    const type = parsed.frontmatter?.type || 'unknown';
    const layout = LAYOUTS[type] || renderDefault;

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
