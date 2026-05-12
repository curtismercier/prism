---
type: cycle
cycle: 1.A
title: Branch A — build-step renderer (Node CLI)
status: queued
created: 2026-05-12
updated: 2026-05-12
parent: ../cycle.md
license: CC BY 4.0
---

<!-- @section: hypothesis -->
## Hypothesis

A standalone CLI (`prism render cycle.md → cycle.html`) is the right shape because:

1. **Deterministic outputs** — derived artifacts exist on disk, reproducible, diff-able if checked in
2. **Works offline** — no CDN, no fetch(), no live JS
3. **No CORS surface** — output files open from `file://` URLs in any browser
4. **Naturally emits JSON/XML** as side outputs — the LLM/tooling consumers get structured projections without extra work
5. **Pre-commit hook integration** — keep `.html` synced with `.md` automatically
6. **Familiar pattern** — every static site generator works this way; well-understood tradeoffs
<!-- /@section: hypothesis -->

<!-- @section: scope -->
## Scope

Code lives in `branches/build-renderer/` (parallel directory, not under this dossier path — branches are extractable as standalone projects).

Phase 1.A target: `npx prism render examples/cycle-215.md` produces `cycle-215.html` that opens in a browser and renders the cycle artifact with:
- Frontmatter as styled header chrome
- Sections rendered as `<section>` blocks with anchor IDs for deep linking
- Status pill + dates in the header
- Sidebar TOC built from section anchors
- Markdown content within sections rendered via `marked` or `markdown-it`

Phase 2.A: add `--format json` and `--format xml` flags. JSON output matches spec §7.2 structure. XML output matches spec §7.3 with sensible defaults for opinionated structuring.

Stack: Node 22, ESM, minimal deps. Likely `gray-matter` for frontmatter, `marked` for markdown, hand-rolled section anchor parser (~50 LOC).
<!-- /@section: scope -->

<!-- @section: phases-log -->
## Phases log

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| 0 | ✅ scaffolded | 2026-05-12 | Branch dir + README + code-home README + package.json stub |
| 1.A | ⬜ queued | — | Implement HTML renderer; smoke-test on `examples/cycle-215.md` |
| 2.A | ⬜ queued | — | Add JSON + XML projections |

<!-- /@section: phases-log -->

<!-- @section: planned-artifacts -->
## Planned artifacts

```
branches/build-renderer/
├── README.md               ← code-home intro
├── LICENSE                 ← MIT (linked from root LICENSE-MIT)
├── package.json
├── bin/
│   └── prism.mjs           ← CLI entry point
├── src/
│   ├── parse.mjs           ← frontmatter + section anchor parser
│   ├── render-html.mjs     ← HTML renderer (with template + CSS)
│   ├── render-json.mjs     ← JSON projection
│   ├── render-xml.mjs      ← XML projection
│   └── templates/
│       ├── cycle.html      ← layout for type:cycle
│       ├── decision.html   ← layout for type:decision
│       └── default.html    ← fallback for unknown types
└── examples/
    └── cycle-215.html      ← rendered output (after Phase 1.A)
```
<!-- /@section: planned-artifacts -->

<!-- @section: known-risks -->
## Known risks

- **Style choices**: the CSS for the HTML output is taste-driven. The renderer should be opinionated enough to look good out of the box but flexible enough to override.
- **XML structuring depth**: spec §7.3 leaves latitude on how aggressively to structure markdown content within sections. This branch will pick a reasonable default (preserve markdown as text within `<section>` tags, no deeper parsing) and document the choice.
- **Watcher** is explicit non-goal for v0.1. Manual `prism render` invocation only. Watcher comes later if needed.
<!-- /@section: known-risks -->
