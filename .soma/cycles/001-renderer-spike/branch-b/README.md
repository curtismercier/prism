---
type: cycle
cycle: 1.B
title: Branch B — runtime browser renderer (CDN-loaded custom element)
status: queued
created: 2026-05-12
updated: 2026-05-12
parent: ../cycle.md
license: CC BY 4.0
---

<!-- @section: hypothesis -->
## Hypothesis

A browser custom element (`<soma-artifact src="./cycle.md">`) loaded from a CDN is the right shape because:

1. **Zero build step** — no install, no Node, no CLI. Open the HTML and it works.
2. **Live updates** — bump the CDN version pin and every project using PRISM gets the new renderer simultaneously
3. **Source stays canonical** — no derived `.html` to gitignore, no stale-render problem, no commit pollution
4. **Format-agnostic dispatch** — the same `<soma-artifact>` handles `.md`, `.json`, `.xml` sources by extension
5. **Per-cycle `index.html` is 8 lines** — trivial boilerplate, never edited by an author
6. **CDN economics are free** — jsDelivr serves any GitHub release; no infrastructure to maintain
<!-- /@section: hypothesis -->

<!-- @section: scope -->
## Scope

Code lives in `branches/cdn-renderer/` (parallel directory, extractable as standalone OSS).

Phase 1.B target: a working `<soma-artifact>` custom element that, given `src="./cycle.md"`, fetches the file, parses frontmatter + section anchors, renders styled HTML inside its shadow DOM.

Plus: an 8-line `index.html` next to `examples/cycle-215.md` that loads the element and renders the cycle. Opens in a browser (via `python3 -m http.server` or similar — CORS prevents pure `file://`).

Phase 2.B: extension-based dispatch. `<soma-artifact src="./taskboard.json">` triggers JSON parser + layout; `<soma-artifact src="./decision.xml">` triggers XML parser + layout. Demonstrates format-agnosticism.

Stack: vanilla JS modules (`.mjs`), no framework, no build. Just `parse()`, `render()`, and a `class extends HTMLElement`. CSS is co-located in `styles.css`.

Distribution: served via jsDelivr against `curtismercier/prism` at `https://cdn.jsdelivr.net/gh/curtismercier/prism@v0.1/branches/cdn-renderer/render.mjs`. If the branch stabilizes and we want a cleaner CDN path, extract to `curtismercier/prism-viewer` later. For this cycle, code lives locally under `branches/cdn-renderer/` and is loaded via relative import from `examples/index.html`.
<!-- /@section: scope -->

<!-- @section: phases-log -->
## Phases log

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| 0 | ✅ scaffolded | 2026-05-12 | Branch dir + READMEs + planned file layout |
| 1.B | ⬜ queued | — | Implement `<soma-artifact>` for `.md`; smoke-test in browser on `examples/cycle-215.md` |
| 2.B | ⬜ queued | — | Extension dispatch for `.json` + `.xml` inputs |

<!-- /@section: phases-log -->

<!-- @section: planned-artifacts -->
## Planned artifacts

```
branches/cdn-renderer/
├── README.md               ← code-home intro
├── LICENSE                 ← MIT (linked from root LICENSE-MIT)
├── render.mjs              ← <soma-artifact> custom element + main entry
├── styles.css              ← shared visual language
├── parsers/
│   ├── md.mjs              ← markdown + section anchor parser
│   ├── json.mjs
│   └── xml.mjs
├── layouts/
│   ├── cycle.mjs           ← cycle type layout (sections, status, depends-on)
│   ├── decision.mjs        ← decision layout (options table, consequences)
│   ├── task.mjs
│   ├── briefing.mjs
│   └── default.mjs         ← fallback for unknown types
└── examples/
    ├── cycle-215.md        ← same input as Branch A (symlink or copy)
    └── index.html          ← 8-line viewer boilerplate
```
<!-- /@section: planned-artifacts -->

<!-- @section: known-risks -->
## Known risks

- **CORS on `file://`** — modern browsers block `fetch()` from local file URLs. Mitigation: requires a tiny local server (`python3 -m http.server` is the universal one-liner). This branch documents that requirement clearly; a `serve.sh` helper script may be added.
- **No recursive dir listing in browser** — if we want a dashboard view showing all cycles in a folder, browser JS can't walk the filesystem. Either a generated manifest file (only build-step artifact in this approach) or a tiny serve helper that returns the directory listing. Out of scope for v0.1.
- **CDN version pinning discipline** — once published, breaking changes to `render.mjs` would break every consumer. Pin to `@v0.1` and bump deliberately.
- **Shadow DOM styling encapsulation** — anchors in shadow DOM aren't directly addressable from the URL hash. Either expose via `:host` + slot, or render in light DOM. Decision deferred to implementation.
<!-- /@section: known-risks -->
