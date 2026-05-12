<div align="center">

# PRISM

**Projected Representations from Inscribed Source Markup**

*AI-collaborative documents that render as human-visual artifacts AND machine-structured data, from one Markdown source.*

[![License: CC BY 4.0](https://img.shields.io/badge/License%20(spec)-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)
[![License: MIT](https://img.shields.io/badge/License%20(code)-MIT-blue.svg)](#license)
[![Status: Draft](https://img.shields.io/badge/Status-Draft-orange.svg)](#status)

</div>

---

## The Gap This Bridges

Humans and AI agents read documents differently:

- **Humans** absorb information visually, fast, hierarchically. They scan headings, jump to status pills, follow links. A 12,000-character markdown document is a wall; a styled HTML page with a sidebar TOC and collapsible sections is a building they can walk through.
- **AI agents** consume information structurally, with semantic anchors. They burn tokens re-reading whole files to find one section to edit. They benefit from explicit tags (`<phase>`, `<decision>`) over heuristic heading-parsing.

PRISM is the substrate that lets one source serve both. The agent writes Markdown with section anchors. Humans read the same content rendered to HTML. Other tooling consumes JSON or XML projections of the same content. **Edits happen surgically against named sections** — no whole-file re-reads, no token waste, no broken neighbors.

This is a protocol specification, alongside [AMP](https://github.com/curtismercier/protocols/tree/main/amp), [MAPS](https://github.com/curtismercier/protocols/tree/main/maps), [SEAMS](https://github.com/curtismercier/protocols/tree/main/seams), [SEEDS](https://github.com/curtismercier/protocols/tree/main/seeds), and others in the same family. It also ships **reference implementations** in this repository.

## What's In This Repo

| Path | What |
|---|---|
| [`spec/`](./spec) | The PRISM v0.1 protocol specification. The canonical document if you're implementing PRISM in another framework. |
| [`branches/build-renderer/`](./branches/build-renderer) | Reference implementation A — a Node CLI that reads `.md` and emits styled `.html` / `.json` / `.xml`. Build-step approach. |
| [`branches/cdn-renderer/`](./branches/cdn-renderer) | Reference implementation B — a browser custom element (`<soma-artifact>`) hosted via jsDelivr that renders source files live in the browser. Runtime approach. |
| [`examples/`](./examples) | Shared sample inputs. Both branches render the same source so you can compare side-by-side. |
| [`.soma/cycles/001-renderer-spike/`](./.soma/cycles/001-renderer-spike) | The branching-cycle that produced the two implementations. Documents the methodology and convergence criteria. |

## Why Two Implementations

We don't know which approach is right yet. So we're building both and comparing empirically. This is a *branching-cycle* — a methodology pattern where rival approaches develop in parallel until convergence criteria resolve one of: *pick one*, *synthesize*, or *both keep* (rare).

See [`.soma/cycles/001-renderer-spike/cycle.md`](./.soma/cycles/001-renderer-spike/cycle.md) for the full branching question, hypotheses, and resolution criteria.

## Quick Concept

The source artifact (a cycle, decision, task, briefing) is Markdown with **section anchors** — invisible HTML comments that mark stable, machine-addressable regions:

```markdown
---
type: cycle
cycle: 215
title: Atom multi-Server progression
status: drafted
---

<!-- @section: trigger -->
## Trigger
cloud VPS outage exposed single-host coupling between build,
orchestrate, and run.
<!-- /@section: trigger -->

<!-- @section: phases -->
## Phases
...
<!-- /@section: phases -->
```

An AI agent can read or edit a single section:

```bash
prism read   cycle.md --section trigger
prism edit   cycle.md --section trigger --content "<new>"
prism append cycle.md --section phases --content "- Phase 1.b shipped..."
```

A human can open `index.html` next to the source and see it rendered with styled sections, a sidebar TOC, status pills, and resolved depends-on cross-links.

Same source. Both happy.

## Status

Draft. The spec is v0.1. Both reference implementations are in active development under [`branches/`](./branches). Convergence criteria are documented in the branching-cycle.

## License

- **Specification** (`spec/`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — same as the rest of the Gravicity protocol family
- **Reference implementations** (`branches/`): [MIT](./LICENSE-MIT) — standard permissive for code

## Related

PRISM is one of several open protocols for AI-agent collaboration developed alongside [Soma](https://soma.gravicity.ai). Companion specs (all under [curtismercier/protocols](https://github.com/curtismercier/protocols)):

- **AMP** — agent memory protocol (filesystem-based persistent memory)
- **MAPS** — task-specific navigation paths through memory
- **SEAMS** — traceable provenance across artifacts
- **SEEDS** — self-evolving templates
- **ATLAS** — architecture maps with staleness signals

PRISM differs by focusing on the **artifact substrate** — the shape of individual documents and how they project across audiences (human visual, AI structured, tooling parseable).
