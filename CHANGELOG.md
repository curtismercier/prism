# Changelog

All notable changes to PRISM are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The spec version (declared in `spec/README.md` frontmatter) and the repo
release tags track together: `v0.1.0` of this repo corresponds to PRISM
spec v0.1.

## [Unreleased]

### Added

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
