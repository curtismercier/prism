---
type: cycle
cycle: 1
title: PRISM renderer spike — branching-cycle to compare two implementation flavors
status: in-progress
created: 2026-05-12
updated: 2026-05-12
author: s01-643d67 (Soma) + Curtis Mercier
session: s01-643d67
license: CC BY 4.0
spans_repos: [Gravicity/personal/prism]
depends_on: []
companion: [./branching-cycle.md, ./branch-a/README.md, ./branch-b/README.md]
purpose: |
  Compare two implementation flavors of the PRISM v0.1 spec by building
  both in parallel: a build-step CLI renderer and a runtime browser
  custom-element renderer. Resolve via empirical comparison to one of:
  pick-one, synthesize, or both-keep.
---

<!-- @section: trigger -->
## Trigger

Curtis and Soma worked on cycle 211 Phase 2 (STUDIO mega-menu) for ~3 hours during a 2026-05-12 OVH outage. The cycle dossier itself (`meetsoma/services/.soma/cycles/211-dashboard-menu-ia-redesign/cycle.md`) ballooned to 12K characters across multiple phases. Each section update required reading 3K-5K of surrounding context to edit safely. The artifact was simultaneously too long for the human to navigate easily (no visual chrome, no TOC, just a Markdown wall) and too expensive for the agent to edit precisely (whole-file re-reads, risk of breaking neighbors).

Curtis surfaced the underlying friction: *"Humans can pick details x times faster when presented in a visual way - ai likes details probably in a far more structured way -- like very different right -- so this is bridging that gap."*

Two design directions emerged in conversation:

1. **Build-step renderer** (Soma's initial proposal) — a Node CLI that transforms `.md` to `.html` / `.json` / `.xml` as derived artifacts
2. **Runtime browser renderer** (Curtis's sharpening) — a custom element that fetches source files live; no build step, CDN-loaded module

Both feel right for different reasons. Rather than picking on paper, build both and compare empirically.
<!-- /@section: trigger -->

<!-- @section: context -->
## Context

PRISM is a new protocol in the Gravicity protocols family, sitting alongside AMP, MAPS, SEAMS, SEEDS, and ATLAS. The spec (`../../spec/README.md` v0.1) defines the substrate: Markdown with section anchors, multi-format projection, surgical edit operations.

The spec is **viewer-agnostic** — it describes the source format and projection semantics but does not mandate how a viewer materializes them. This branching-cycle exists to fill that gap with two reference implementations.

Both branches share the same input (a sample PRISM cycle artifact in `../../examples/`) so direct visual + functional comparison is possible.

The methodology being applied (parallel-rival approaches with explicit convergence criteria) is itself documented as **branching-cycle methodology** in `./branching-cycle.md`. PRISM and the methodology emerged together; both may evolve into independent protocols.
<!-- /@section: context -->

<!-- @section: phases -->
## Phases

| Phase | Scope | Status | Est | Branch |
|-------|-------|--------|-----|--------|
| 0 | Scaffold both branches, shared example input, methodology doc | ✅ shipped s01-643d67 | 1h | — |
| 1.A | Build-step renderer — CLI parses `.md`, emits `.html` | ⬜ queued | 1-2h | A |
| 1.B | Runtime renderer — custom element `<soma-artifact>` + styles | ⬜ queued | 1-2h | B |
| 2.A | Build-step — add `--format json/xml` output | ⬜ queued | 1h | A |
| 2.B | Runtime — handle JSON/XML inputs via dispatch | ⬜ queued | 1h | B |
| 3 | Render the same `examples/cycle-215.md` through both branches | ⬜ queued | 30m | — |
| 4 | Honest comparison against convergence criteria (§ Decisions to surface) | ⬜ queued | 1h | — |
| 5 | Convergence: pick-one / synthesize / both-keep — decision + dossier update | ⬜ queued | 30m | — |

Phase 0 deliverables (this commit):
- Project README + LICENSE files
- Spec v0.1 draft (`../../spec/README.md`)
- This cycle dossier + branching-cycle methodology doc
- Branch directory skeletons with READMEs and `phases.md` per branch
- Shared `examples/cycle-215.md` (a real cycle artifact copied from the studio repo, converted to PRISM section-anchored shape)

Phases 1-4 are deliberately small per-branch so we can interleave (alternate days, alternate sessions) rather than serial-blocking one branch behind the other.
<!-- /@section: phases -->

<!-- @section: decisions-locked -->
## Decisions locked

- **2026-05-12 s01-643d67 + Curtis**: branching-cycle methodology adopted for this work — both implementations developed in parallel, convergence criteria stated up front
- **2026-05-12 s01-643d67 + Curtis**: project name PRISM (Projected Representations from Inscribed Source Markup) — fits Gravicity protocol naming family (acronym/backronym, single word, evocative)
- **2026-05-12 s01-643d67 + Curtis**: dual licensing — CC BY 4.0 for the spec (matches family), MIT for reference implementations
- **2026-05-12 s01-643d67 + Curtis**: published under `Gravicity/personal/prism/` as a candidate OSS repo (not in the existing `personal/protocols/` mono-repo because reference implementations + spec are co-located; spec text can be cross-linked from the protocols mono-repo later)
- **2026-05-12 s01-643d67**: section anchor syntax `<!-- @section: name -->` / `<!-- /@section: name -->` — HTML comments so all existing Markdown renderers ignore them; explicit close tag for unambiguous parsing
<!-- /@section: decisions-locked -->

<!-- @section: decisions-to-surface -->
## Decisions to surface (convergence criteria — answer at Phase 4)

These are the **explicit criteria** by which the branching-cycle resolves. Stated now, before either branch begins implementation, so the comparison is empirical not motivated reasoning.

1. **Authoring friction**: time to add a new section to `examples/cycle-215.md` under each approach. Branch wins if updates are noticeably cheaper.
2. **Viewing friction**: number of steps for a human to open the rendered artifact. Branch wins if it requires fewer commands / less setup.
3. **Agent token cost**: tokens consumed by an agent to perform a surgical edit (read-section + edit-section operations). Should be equivalent across branches IF both implement spec §6 correctly. Differences here are bugs, not features.
4. **LLM consumability**: if another agent needs to consume the cycle artifact as structured input, does the branch produce useful XML/JSON? Branch A naturally emits these; Branch B requires runtime JSON.stringify of in-memory state.
5. **Maintenance cost**: extrapolate 50 cycles + 2 years of edits. Which branch has lower per-update maintenance burden? Build-step has reproducibility; runtime has zero-install for new projects.
6. **Standalone fork-ability**: could this branch alone (extracted from the other) be a useful OSS project? Branches that survive extraction are stronger.
7. **Format-agnosticism**: Branch B's runtime dispatch handles `.md`, `.json`, `.xml` inputs natively. Branch A's CLI could too but requires per-format parser paths. Which extends more cleanly to a `task.json` taskboard or a `decision.xml` ADR?

The hypothesis going in (stated to be falsified, not confirmed): convergence will be **synthesize** — runtime renderer for human-viewing (Branch B's zero-build, live-update wins on UX), build-step optional for JSON/XML pipeline outputs (Branch A's structured projections kept for LLM/tooling consumers). The section-anchor source format is identical either way.

If the hypothesis holds, Phase 5 produces a unified architecture: spec stays as-is, both branches contribute code to the eventual canonical implementation, methodology doc captures the lesson.

If the hypothesis fails (one branch dominates outright, or a third option emerges from the comparison), Phase 5 reflects that finding honestly.
<!-- /@section: decisions-to-surface -->

<!-- @section: out-of-scope -->
## Out of scope (this cycle)

- **Adoption in production cycles**. The renderer is built and tested against `examples/cycle-215.md` only. Migrating real Gravicity cycle dossiers (e.g. `meetsoma/services/.soma/cycles/211-*`) to PRISM format is a follow-up cycle (PRISM v0.2 + a mechanical migration script).
- **Conformance test suite**. v0.1 ships with manual examples; formal conformance tests come with v0.2 once we know what edge cases real usage produces.
- **Bi-directional editing** (Projection edits flowing back to Source). Explicit non-goal for v0.1 — see spec §11.
- **Dashboard / index page generation**. The `index` operation (spec §6.8) is described but not implemented in either branch. Comes after the per-artifact renderer is stable.
- **Live-reload / watcher integration**. Manual `prism render` invocation for Branch A; manual browser refresh for Branch B. Watcher integration is post-v0.1 polish.
- **Branching-cycle as a separately-published protocol**. The methodology lives in `./branching-cycle.md` as a working doc. Extraction to `personal/protocols/branching-cycle/` happens if and when the pattern is reused on a second cycle.
- **Integration with AMP/MAPS/SEAMS**. The spec § 10 describes relationships; no integration code is shipped in this cycle.
<!-- /@section: out-of-scope -->

<!-- @section: outtake -->
## Out-take

This cycle is one of those rare ones where the *process* is part of the *output*. The methodology we're using (branching-cycle) is being captured as a reusable pattern document, the substrate we're building for (PRISM) is being used to write this cycle dossier itself (section anchors above, frontmatter at top), and the convergence criteria are stated up front so the comparison can be honest.

The risk to watch: motivated reasoning at Phase 4. The hypothesis says "synthesize" — but if Branch A turns out to be cleaner end-to-end, *say so*. The branching-cycle methodology only works if the cycle author commits to letting the data decide.

What ships either way: a working PRISM v0.1 spec; at least one functional reference implementation; the methodology pattern documented for reuse; and concrete proof (the rendered `cycle-215.md` viewable in a browser) that the spec serves the human/AI bridging goal.

— σ Soma · s01-643d67
<!-- /@section: outtake -->
