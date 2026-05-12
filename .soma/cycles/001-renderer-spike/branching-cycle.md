---
type: methodology
status: draft
version: 0.1.0
created: 2026-05-12
updated: 2026-05-12
author: s01-643d67 (Soma) + Curtis Mercier
license: CC BY 4.0
---

# Branching-Cycle — Methodology v0.1

> A cycle in which two or more rival approaches develop in parallel, with explicit convergence criteria stated before any branch begins. Resolves to one of: pick-one, synthesize, or both-keep.

This document captures the methodology pattern that produced PRISM. It is *not* part of the PRISM specification — PRISM is the substrate, branching-cycle is one way to use that substrate. The pattern is general-purpose and applicable to any cycle of design exploration.

---

## 1. When to Use a Branching-Cycle

Use a branching-cycle when:

1. **Two or more credible approaches exist** for solving a problem
2. **None of them is obviously dominant** on paper — design discussion produces "this depends" rather than "obviously X"
3. **The cost of building both is bounded** — typically each branch should be 1-3 days of work, not 1-3 weeks
4. **The cost of choosing wrong is high** — if you'd commit to and ship the wrong approach, the rework would hurt

Do NOT use a branching-cycle when:

- One approach is clearly better (just pick it)
- The choice is reversible cheaply (just try one)
- The branches would be expensive to build (>1 week each)
- The work is exploratory enough that you don't know what you'd compare against (need a regular cycle first to discover the question)

The branching-cycle costs roughly 1.6x of building a single approach (the second branch is cheaper because the spec / shared inputs / scaffolding are reused). The value comes from making the comparison empirical.

## 2. Anatomy

```
                  ┌─→ Branch A — own phases, own log
                  │
   Cycle root  ──┤   ← shared spec, shared inputs, convergence criteria
                  │
                  └─→ Branch B — own phases, own log
                                                       ↘
                                                         convergence → resolution
```

**Cycle root** — a normal PRISM cycle artifact that:
- States the **branching question** (what choice are we resolving?)
- States the **hypothesis** (which way you think it'll go, *to be falsified*)
- States the **convergence criteria** explicitly, before any branch begins
- Lists each branch and what it's testing
- Tracks the overall cycle's status

**Branches** — each branch is its own sub-cycle artifact with:
- A `README.md` explaining what this branch is testing
- A `phases.md` log specific to this branch
- Code under a parallel `branches/<name>/` directory (separate from the cycle dossier so branches can be extracted as standalone projects if needed)

**Shared inputs** — example artifacts, test data, integration fixtures live at the cycle root and are consumed by both branches. This ensures the comparison is honest.

**Convergence event** — a final phase in the cycle root where:
1. Each branch is evaluated against the pre-stated criteria
2. A resolution is recorded: pick-one, synthesize, or both-keep
3. The cycle root status flips to `shipped`
4. Branches that don't survive are archived (not deleted — their notes are valuable)

## 3. Resolution Types

### 3.1 Pick-one

One branch wins outright. The other is archived. The cycle dossier records:
- Why the winning branch was chosen (against the pre-stated criteria)
- What the losing branch taught (often: features the winner now needs to absorb)
- Any concessions the winner makes based on the comparison

### 3.2 Synthesize

A new approach emerges that combines what worked from each branch. Most common outcome for design-exploration branching-cycles. The cycle dossier records:
- The synthesis architecture
- Which elements came from which branch
- What was added or modified during the merge

The two original branches are archived but their commit history is the historical record of how the synthesis was discovered.

### 3.3 Both-keep

Rarely the right answer, but valid when the branches turn out to be for genuinely different contexts. Example: Branch A is the right approach for batch processing; Branch B is the right approach for interactive UI. Both ship as part of the project.

When both-keep is the resolution, the cycle dossier MUST be explicit about *which branch is for which context* — ambiguity here leads to long-term drift.

## 4. Pre-Stating Convergence Criteria (the critical discipline)

This is the part that makes the methodology honest. **Convergence criteria are stated in the cycle root before either branch starts implementation.** They are not invented or revised after the branches are built.

Good convergence criteria are:

- **Measurable** — "time to add a new section" is measurable; "feels nicer" is not
- **Few** — 4-7 criteria is the sweet spot; more than 10 becomes noise
- **Honest about tradeoffs** — each criterion should be one a branch could plausibly lose on
- **Domain-relevant** — generic metrics ("LOC count", "build time") are weak; problem-specific metrics ("token cost per surgical edit") are strong

Bad convergence criteria are post-hoc justifications. If you find yourself wanting to add a criterion *after* a branch is built, that's a sign of motivated reasoning. Either commit to the original criteria or pause the cycle and re-state them, but don't sneak adjustments in.

## 5. Avoiding Motivated Reasoning

The branching-cycle's biggest failure mode is the cycle author concluding what they wanted to conclude regardless of the evidence. Three guardrails:

### 5.1 Explicit hypothesis stated to be falsified

The cycle root states "I think this will resolve as X" *and frames X as the thing being tested, not the thing being confirmed*. If the evidence supports X, fine. If it doesn't, the hypothesis was wrong; record that.

### 5.2 Write the criteria as questions, not answers

"Which branch has lower token cost per edit?" is a question. "Branch B has lower token cost" is an answer. The first invites measurement; the second invites confirmation.

### 5.3 Resolution writeup includes "what I expected vs. what I found"

In the resolution phase, the cycle root records both. If they match, great — methodology working. If they don't, *especially* great — methodology working better, the cycle prevented a wrong commitment.

## 6. Documenting the Resolution

The resolution writeup belongs in the cycle root, in a section called `resolution`. Required content:

- Which resolution type (pick-one / synthesize / both-keep)
- For each convergence criterion: what each branch scored / how it performed
- The decision and the reasoning
- What each branch contributed to the outcome
- Where the surviving artifacts live (the winner's branches/<name>/ stays; losers move to `_archive/<name>/`)

## 7. Status

**Version**: 0.1 draft

**Validated against**: PRISM renderer spike (cycle 001 in this repository) — first applied use. May evolve based on what we learn here.

**Future**: if the methodology proves valuable, extract to `personal/protocols/branching-cycle/` as a sibling protocol to AMP, MAPS, SEAMS, etc. Don't promote prematurely — one validated use case isn't enough; want 3+ before publishing as a protocol spec.

## 8. Acknowledgments

The pattern was named by Curtis Mercier on 2026-05-12 ("let's also consider this a *branching-cycle* — where a cycle, now split into two approaches, evolves in phases/branches"). The methodology articulation was developed jointly between Curtis and Soma s01-643d67 during the PRISM renderer spike.

— σ Soma · s01-643d67

CC BY 4.0.
