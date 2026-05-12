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

Curtis and Soma worked on cycle 211 Phase 2 (STUDIO mega-menu) for ~3 hours during a 2026-05-12 cloud host outage. The cycle dossier itself (`meetsoma/services/.soma/cycles/211-dashboard-menu-ia-redesign/cycle.md`) ballooned to 12K characters across multiple phases. Each section update required reading 3K-5K of surrounding context to edit safely. The artifact was simultaneously too long for the human to navigate easily (no visual chrome, no TOC, just a Markdown wall) and too expensive for the agent to edit precisely (whole-file re-reads, risk of breaking neighbors).

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
| 6 | Author SKILL.md — `skills/prism-authoring/SKILL.md` teaching agents the anchor convention + surgical-edit operations + when to author each artifact type | ⬜ queued | 1h | — |

**Phase 6 details** (s01-643d67): the SKILL.md is a focused single-file skill (NOT a meta-skill — skill-forge is for building skills, PRISM is a document substrate). Scope:

- ~200-300 lines
- Lives at `skills/prism-authoring/SKILL.md` in the PRISM repo
- Discoverable via `gh skill install curtismercier/prism prism-authoring` (matches skill-forge pattern)
- Written AFTER both renderer branches are evaluated (Phase 5 convergence) — so the skill teaches the canonical operations that emerge from the comparison, not premature ones
- Three sections: when-to-use, anchor convention, surgical-edit operations + render. Examples from the canonical `cycle-215.md` artifact.
- Skill frontmatter declares `requires: prism-authoring-renderer` (whichever branch wins or the synthesis) so the install picks up the renderer at the same time

Filed on-disk as an explicit phase, not "in my head" — the lesson from s01-643d67 (substrate over mental state).

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

<!-- @section: future-addons -->
## Future direction — visual addons (filed s01-643d67, Curtis)

Curtis surfaced after seeing Branch B render cycle 215: *"i'm looking forward to when you might include some more visual representations of work, whether it's css styles, colour 'moods' or themes for our tincture css, more sophisticated wiring diagrams -- there could be the potential to include more things like that as potential addons -- w/ each we'd consider optimizing the token efficiency allowing the potential for very few lines in, rendered html/svg, etc out."*

This is genuinely the right direction — PRISM's substrate (anchor-tagged markdown) is also the right substrate for **embeddable visual addons**: tiny declarative syntax in, rich SVG/HTML out. Same token-efficiency win as the artifacts themselves.

**Candidate addon types** to research / build later:

| Addon | Input shape | Output | Existing prior art |
|---|---|---|---|
| Mermaid diagrams | mermaid code block | SVG flowchart / sequence / state | mermaid.js (mature) |
| Tincture mood swatches | token list + theme name | inline palette card | bespoke |
| Wiring / system diagrams | YAML-ish nodes + edges spec | SVG with semantic styling | mermaid + improvements |
| Phase timeline | phase rows from frontmatter | horizontal track w/ status pills | bespoke |
| Diff viewer | before/after block | side-by-side or unified diff | shiki / diff2html |
| Metric deltas / KPI cards | data points + targets | rendered card | bespoke |
| Architecture maps | ATLAS-protocol-style | clickable SVG | bespoke + ATLAS spec |
| Code with annotations | code block + `# @ann: text` lines | code with margin notes | bespoke |

**Likely shape**: a PRISM extension protocol (call it **PRISM Addons** v0.1 if it ships) defining the embed format. Inside any section, an addon block like:

```
<!-- @addon: mermaid -->
graph LR
  A[git push] --> B[GHA build]
  B --> C[ghcr.io]
  C --> D[atom pull]
  D --> E[traefik flip]
<!-- /@addon: mermaid -->
```

The parser identifies addon blocks alongside section anchors; the renderer dispatches by addon type to a registered handler. Handlers can live on the CDN (jsDelivr) so projects opt-in by name only.

**Why this beats just-using-mermaid-directly**: mermaid alone is great but generic. A PRISM addon system gives us:
- One protocol for ALL visual addons (not 5 different JS libs to learn)
- Token-efficient: declarative input maps to rich output
- Registry of community addons (analog to skill-forge)
- Tincture/theme integration (addons get tenant brand palette automatically)
- Provenance + accessibility built-in (addons declare what they show as alt text)

**Status**: filed for now, not queued. Will likely graduate to cycle 002 in this repo once Branch A + B comparison resolves. Priority would be Mermaid-as-first-addon (mature, well-understood, demonstrates the registration shape) then Tincture mood swatches (most uniquely-ours).

<!-- /@section: future-addons -->

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
