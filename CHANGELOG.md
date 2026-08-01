# Changelog

All notable changes to PRISM are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The spec version (declared in `spec/README.md` frontmatter) and the repo
release tags track together: `v0.1.0` of this repo corresponds to PRISM
spec v0.1.

## [Unreleased]

### Added

- **Heading-derived sections (cycle layout)** — a document with no `@section` anchors now gets a
  navigable TOC derived from its `## ` headings instead of rendering as one undifferentiated
  preamble. Fence-aware, so `## ` inside a code block cannot open a phantom section. Derived output
  is visually marked and keeps document order rather than canonical `STANDARD_ORDER`: a derived id
  is not a stable address, and a document that never opted into the section vocabulary must not be
  resequenced by it. **The parser is unchanged — section extraction remains anchor-only, so spec
  conformance is unaffected.**

- **`pipeline` layout (cdn-renderer)** — renders a linear timeline for pipelined
  producer/consumer systems: one row per work unit, producer and consumer bars on a
  shared time axis, and stalls drawn as literal gaps. Scenarios sharing a `group`
  render on one axis so comparisons are like-for-like. Pros/cons per strategy come
  from the data file.
- **Async layouts + post-render `attach` hook** — a layout may be a function or
  `{ render, attach }`. `render` may return a promise, so a layout can fetch its own
  data; `attach` runs after the HTML is in the DOM, which is the only way an
  interactive layout can bind handlers (`innerHTML` never executes `<script>`).
  Plain-function layouts are unchanged.
- **`examples/pipeline-demo.md`** — a worked example of the `pipeline` layout using a
  real measured dataset, rendering standalone with no backend.
- **`skills/prism-contributing`** — the fork-and-evolve model (your fork is an
  instrument, not a checkout awaiting upstream), the keep-private / generalize /
  vendor decision, layout design rules, and the contribution failure modes specific
  to agent contributors.

### Fixed

- **cdn-renderer README claimed "scaffold only" long after the implementation
  shipped** and cycle 001 resolved. A stale status line in a README is believed on
  sight; this one nearly caused a rebuild of working code.
- **Projection ignore patterns were root-anchored, so they never matched
  `branches/*/examples/`.** A pattern containing a slash anchors to the repo root, so
  `examples/**/*.json` matched only `<root>/examples/`. Derived `.html`/`.json`/`.xml`
  under the branch example directories were neither tracked nor ignored — one
  `git add -A` from being committed. Same class as the stale `styles.css` that kept a
  released fix from reaching output for 2.5 months; fixed there, missed here.
- **Data files could be destroyed by the validation gate.** `render --format all`
  writes its JSON projection to `<name>.json`, silently overwriting a data file of the
  same name. Data files now use `<name>.data.json` and are explicitly tracked; the
  convention is documented where a layout author will meet it.

- **build-renderer — the v0.1.1 narrow-column fix could not reach output
  directories, so the fixed bug still reproduced.** `ensureStylesheet()`
  copied the shared stylesheet only when the target was absent, which
  pinned any output directory to whichever `styles.css` landed there
  first. A stale pre-fix copy was committed at
  `branches/build-renderer/examples/styles.css`, so rendering a
  `type=decision` artifact there still produced the 200px column that
  v0.1.1 was released to fix. Measured in a headless browser at a
  1187px viewport: `.cycle-main` was **200px** wide with the stale
  stylesheet and **1080px** with the current one — same artifact, same
  renderer, stylesheet the only variable. `styles.css` is a derived
  artifact and is now always refreshed on render.

- **The stale stylesheet was tracked in git and the ignore rule never
  matched it.** `.gitignore` carried `examples/styles.css`, which git
  anchors to the repository root, so the copy under
  `branches/build-renderer/examples/` was never ignored — and the rule
  added in `fd09a10` did not untrack the already-committed file. The
  pattern is now `**/examples/styles.css` and the stale copy is
  untracked. Without this, a fresh clone reproduced the bug.

- **`prism validate` enforced required sections only for `type=cycle`, and
  only 3 of the 5 the spec requires.** Every other standard type went
  unchecked, so a `decision` artifact carrying none of its four required
  sections validated clean and exited 0. Required sections are now a
  registry transcribed from spec §5: `cycle` (§5.1), `decision` (§5.2),
  `task` (§5.3), `briefing` (§5.4). Unknown and custom types stay
  unenforced per §5.5. Both shipped examples already carry every section
  their type requires and still validate clean.

- **`render --out <dir>` crashed with a raw `ENOENT` stack trace when the
  target directory did not exist**, because the stylesheet copy ran
  before any `mkdir`. The output directory is now created recursively.

- **`prism validate` reported unclosed section anchors as clean and
  exited 0.** An anchor that opens but never closes is dropped by the
  parser, so `read`, `edit`, and `append` against that section all fail
  with exit 1 — while `validate` printed `clean (0 sections)` and exited
  0, greenlighting an artifact whose sections are unaddressable. The
  parser now reports unclosed anchors and `validate` treats them as
  blocking errors. Both shipped examples still validate clean.

### Added

- **CI workflow** (`.github/workflows/prism.yml`) — closes issue #2.
  Runs on push to `main` and on every pull request: validates every
  `examples/*.md`, renders all three projections and asserts their
  content, and carries a regression guard for the v0.1.1 non-cycle
  layout that is verified to fail against the pre-fix stylesheet. Also
  includes a negative test asserting `validate` rejects a malformed
  artifact, so the validate gate cannot silently stop blocking. Every
  step fails the build on violation — no warn-only steps.

- **CONTRIBUTING.md** — Contribution guide covering the three change
  classes (editorial / markdown content / substantial), PR gates,
  commit & code discipline, the branching-cycle pattern, and release
  flow. Drawn from Conventional Commits, Keep a Changelog, JSON Schema,
  and AsyncAPI patterns — sized for a small Markdown-substrate project.

## [0.1.1] - 2026-05-14

### Fixed

- **cdn-renderer/styles.css** — Artifacts without a TOC sidebar
  (`type=decision`, `type=task`, `type=briefing`, or any artifact the
  renderer emits without an `<aside class="toc">`) no longer render in
  a 200px-constrained column. The `.cycle-body` grid now collapses to
  a single full-width column when no TOC is present. Cycle artifacts
  (which emit a TOC) keep their sidebar layout — behavior unchanged.

### Added

- **examples/decision-example.md** — Reference `type=decision` artifact
  demonstrating the four required sections (`context`, `options`,
  `decision`, `consequences`) plus the optional `alternatives-considered`.
  Also serves as a cross-type rendering regression artifact: validating
  and rendering this file exercises the non-cycle layout path.

### Build

- **`.gitignore`** — Added `examples/styles.css` (derived from
  `branches/cdn-renderer/styles.css` at render time; was previously
  not ignored despite being a reproducible build output).

## [0.1.0] - 2026-05-12

### Added

- **PRISM v0.1 spec** (`spec/README.md`, CC BY 4.0) — Inscribed Source
  format, section anchors, three projections (Visual HTML / Structured
  JSON / Tagged XML), four artifact types (cycle, decision, task,
  briefing), surgical edit operations.
- **branches/build-renderer/** — Reference Implementation A: Node CLI
  (`prism render | read | edit | append | validate`). Emits HTML, JSON,
  and XML projection files next to the source.
- **branches/cdn-renderer/** — Reference Implementation B: browser
  custom element (`<soma-artifact>`). Fetches the Inscribed Source at
  runtime and renders in-page without a build step. Distributed via
  jsDelivr from this repo.
- **.soma/cycles/001-renderer-spike/** — The branching-cycle dossier
  that produced both renderers as parallel implementations. Authored
  as a PRISM artifact (self-referential exhibit).
- **skills/prism-authoring/** — Stub skill for PRISM authoring
  discipline; fleshed out post-renderer-convergence.
- **examples/cycle-215.md** — Reference `type=cycle` artifact.

[Unreleased]: https://github.com/curtismercier/prism/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/curtismercier/prism/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/curtismercier/prism/releases/tag/v0.1.0
