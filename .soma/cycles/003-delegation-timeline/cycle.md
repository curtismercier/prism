---
type: cycle
status: seeded
title: "Delegation + git timeline — one view of how work actually evolved"
arc: prism-dashboards   # PRISM family arc, s01-6d4d53
project: prism
created: 2026-08-04
updated: 2026-08-04
session: s01-e27e85
seeds_from: "Curtis, 2026-08-04 (live, during the somaverse merge session)"
tags: [prism, dashboard, git, delegation, timeline, observability]
related: [002-registry-dashboard, meetsoma L13 soma-flow, meetsoma L43 session-hierarchy]
---

# 003 — Delegation + git timeline

## The ask (Curtis, verbatim, 2026-08-04)

> *"I think this might be the next prism dashboard — a visual bar graph and project/agent delegation
> overview — where in one view I'd see a visual bar/timeline graph representing the
> projects/git/branches/merges/evolution, and we could keep a history of this, or even a script that
> uses the git history. It would help users keep track of the projects' git/branches/merges. This too
> helps the interconnected work AI agents and humans can work together more effectively."*

## 🔑 GROUND FIRST — two thirds of this already exists. This is COMPOSITION, not invention.

| piece | where | state |
|---|---|---|
| **Delegation bar-timeline** | `meetsoma/.soma/amps/scripts/commands/flow.sh` (L13) | **BUILT, 18.5 KB.** ASCII, `--live`, `--phases`, `--self-test`; renders scout→gate→impl→verify. Reads `~/.soma/state/children.json`. Layout math in embedded Python, unicode-width correct. |
| **Browser rendering of an artifact + its data** | `prism/branches/cdn-renderer/render.mjs` + `layouts/` | 6 layouts: `cycle`, `arc`, `pipeline` (**has a live `attach` hook**), `registry` (sortable index, click-through nesting), `registry-flat`, `body`, `default`. |
| **The layout↔data contract** | `render.mjs:~168` → `layout(parsed)` | **ONE argument; the layout fetches its own `data:` sidecar, resolved against the SOURCE .md.** Verified 2026-08-03 (`63f6e99`) after the body dashboard shipped `undefined`/`NaN%` from a 4-arg signature. **Do not reintroduce a caller-passes-data shape.** |
| **The raw history itself** | every `.soma/` is its own auto-committing git repo; project repos have normal history | Already versioned. Nothing new to persist for the *past* — it is sitting in git. |

⇒ **The new work is a COLLECTOR + a LAYOUT**, plus the one genuinely novel thing below.

## What is actually new: correlating GIT events with DELEGATION events

`flow.sh` knows about children. Git knows about branches and merges. **Nothing joins them.** The
value Curtis is describing — *"helps interconnected work between AI agents and humans"* — is exactly
that join: *this branch was produced by that child, reviewed by those reviewers, gated here, merged
there.*

**We have a perfect, complete dataset to build against — this very session (s01-e27e85):**
6 branches → 3 parallel Sonnet reviewers → a parent gate that FAILED one on a real CSRF bypass →
a builder fix → 5 merges (`--no-ff`, so every merge is one revertable commit) → a production deploy
→ a post-merge verifier. Costs, verdicts, shas and timestamps all exist in files:
`meetsoma/.soma/releases/audits/merge-reviews/_GATE.md`, `PROJECT_BOARD.md`, the session log, and
`git log` in 4 repos.

**Build the collector against this session first.** If it cannot reconstruct today, it cannot
reconstruct anything.

## Known gap that this cycle must decide, not inherit

`flow.sh`'s own source names it: *"children.json has no field for WHICH of these 4 phases a child is
in — registered, not phase-mapped, liveness unverified."* So delegation phase is **not** currently
recorded anywhere machine-readable. Options: infer from artifacts (deliverable file appears → impl
done), have the parent stamp phase transitions, or render only what is known and mark the rest
UNKNOWN. **Do not silently invent phases** — the estate has a standing rule that a status field must
name what it probed (`_GATE.md`, three false greens).

## Shape (draft — the design decision below gates it)

```
collector: soma-timeline.py  →  timeline.json          (git events × delegation events, per project)
prism:     layouts/timeline.mjs                        (bars; reuses pipeline.mjs's attach pattern for --live)
artifact:  timeline.md  (frontmatter: type: timeline, data: ./timeline.json)
```

Reuse, explicitly: `pipeline.mjs` for the live-attach precedent, `registry.mjs` for
sortable/click-through-nesting, and `flow.sh`'s Python layout math (it is already unicode-correct and
self-tested — port the math, don't rewrite it).

## 🔴 The open decision (Curtis's — do not pre-empt)

**Is this ONE surface or TWO?** `flow.sh` renders delegation in the **terminal**; prism renders in the
**browser**. Either (a) prism becomes the single visual surface and `flow.sh` stays the terminal view
over the *same* `timeline.json` — one collector, two renderers; or (b) they stay independent and
diverge. **(a) is the recommendation** — it makes the collector the contract and prevents two
half-truths — but it means touching L13's shipped command, which is a different owner's lane.

## Acceptance (gates, not sentences)

- [ ] Collector reconstructs **this session** end-to-end from git + files: 6 branches, 5 merges, 1 FAIL,
      the deploy — with shas that resolve. A run that "looks right" but cannot name `682e1c6`,
      `200dbf1`, `3653935` is a fail.
- [ ] Layout renders from a `data:` sidecar via the ONE-ARG contract, and **fails visibly** when the
      sidecar is missing (the L9 lesson: no silent `undefined`).
- [ ] Anything not actually known (delegation phase) renders as UNKNOWN, never as a guess.
- [ ] Works for a project with **no** `.soma` delegation history (plain git) — degraded, not broken.

---

## Extension (Curtis, 2026-08-04) — ONE generator: project STATE + git/agent workflows

> *"we may also want to consider shared project 'state' like files updated with similar or same
> script that also generates the git and agent workflows"*

**Prior art — do NOT build a second state system:**

| piece | where | state |
|---|---|---|
| **STATE.md verification** | `.soma/skills/atlas/SKILL.md` | ✅ exists — *"ensure STATE.md files reflect reality; run after releases, branch changes, repo structure changes, or when STATE.md is >7 days stale."* |
| **STATE.md files, in the wild** | 12+ across the estate: `.soma/body/STATE.md`, `project-b/.soma/body/`, `clients/gravicity-studio/.soma/`, `infra/servers/cloud-host/`, `products/gravicity-io/` (×2), `personal/yoshi/`, root `STATE.md`, archives… | ⚠ **heterogeneous** — different owners, formats and update paths. `soma-dev sync` writes one of them automatically (`activity logged to STATE.md`). |
| **the timeline collector** | this cycle, §Shape | 🌱 not built |

⇒ **The proposal:** the collector this cycle builds emits BOTH `timeline.json` (git × delegation
events) AND refreshes each project's `STATE.md`. One traversal of git + `.soma/` produces both,
because they read the *same* source: commits, branches, merges, children, cycles.

**Why this is more than convenience:** a STATE.md maintained by hand drifts silently (ATLAS exists
precisely because it does). A STATE.md *derived* from the same pass that draws the timeline cannot
disagree with the timeline — the two artifacts become two projections of one measurement.

**Design constraints (inherited, non-negotiable):**
- **ATLAS owns the contract for what a STATE.md must contain.** Read it before emitting one; do not
  invent a competing schema. If ATLAS's shape is wrong for generated files, say so — that is a
  finding, not a licence to fork.
- **Generated ≠ authored.** Some STATE.md files are hand-written and carry judgement that no script
  can derive. **A generator must never overwrite an authored section.** Either emit into a clearly
  delimited generated block, or emit a sibling file and leave the authored one alone. **Decide and
  state which** — silently clobbering a human's STATE.md is the failure mode that kills adoption.
- Heterogeneity is data, not noise: 12 files with different formats means the first job is to
  **measure what they actually contain**, not to standardise them by fiat.

## Doc-drift discipline for THIS cycle (Curtis, same message)

> *"where you notice drifting docs… we keep the cycles aligned, making surgical adjustments, not
> rewriting in ways that lose still relevant facts, truths, or alignment with our goals/ideas."*

This is already protocol — `amps/protocols/internal/document-seams.md` **§4 CORRECTED**: keep the
fossil, attach the refutation *inline where the wrong claim lives*, `~~strikethrough~~ → CORRECTED
§ref`. **Applies to every artifact this cycle touches.** A generator that rewrites a doc wholesale
destroys exactly the still-true facts §4 exists to preserve — so **the generator is bound by the same
rule as a human editor: amend in place, never regenerate over authored prose.**
