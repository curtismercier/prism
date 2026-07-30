---
type: decision
decision: 2
title: Cycle 001 convergence — build-renderer vs cdn-renderer
status: accepted
created: 2026-06-02
updated: 2026-06-02
author: Soma (SIB-7) + audit children ec22d1 / 9bb98d / 65b9cb
session: SIB-7
license: CC BY 4.0
supersedes: null
cycle: 1
---

<!-- @section: context -->
## Context

Cycle 001 opened as a branching-cycle: build a Node CLI renderer (Branch A,
`branches/build-renderer/`) and a browser custom-element renderer (Branch B,
`branches/cdn-renderer/`) in parallel, then resolve empirically against seven
criteria stated before either branch began. Phases 1–2 shipped both renderers.
Phases 3–4 — actually rendering the same sources through both and comparing —
had never been executed. The dossier's phase table still read `queued` for work
whose output demonstrably existed, which is itself the finding that prompted
this pass: status tables rot faster than code.

Phase 4 was executed by three parallel audit children against the shared
fixtures `examples/cycle-215.md` (type=cycle, 12,566 bytes, 16 sections) and
`examples/decision-example.md` (type=decision, 5 sections), with the parent
independently measuring the layout behaviour in a headless browser. Reports:
`branch-a-audit.md`, `branch-b-audit.md`, `ci-notes.md`.

The founding hypothesis of PRISM — that an agent editing one named section is
dramatically cheaper than re-reading a whole file — was measured rather than
assumed for the first time.
<!-- /@section: context -->

<!-- @section: options -->
## Options

The branching-cycle methodology admits exactly three resolutions.

**Pick-one.** Choose Branch A or Branch B, archive the loser. Attractive for
maintenance surface (one codebase), but each branch measurably dominates a
different criterion: Branch A owns structured output (criterion 4), Branch B
owns human viewing friction (criterion 2). Picking either forfeits a criterion
the cycle called decisive.

**Synthesize.** Keep Branch B as the human-viewing path and Branch A as the
projection/pipeline path, unify the shared substrate, and stop treating them as
rivals. This was the hypothesis stated up front — explicitly to be falsified,
not confirmed.

**Both-keep.** Maintain two independent renderers indefinitely. Rejected on
evidence: they are already not independent (see the decision below), so
"both-keep" describes a state that does not exist.
<!-- /@section: options -->

<!-- @section: decision -->
## Decision

**Synthesize.** The pre-stated hypothesis holds, and it holds for a reason the
hypothesis did not anticipate: the two branches are already one system.

`branches/build-renderer/bin/prism.mjs:61` resolves `../cdn-renderer/styles.css`
and copies it into the output directory at render time. Branch A has a hard
filesystem dependency on Branch B. The Branch A audit's verdict on criterion 6
(standalone fork-ability) is a flat **no** — extract Branch A and it loses its
stylesheet. The v0.1.1 non-cycle layout fix is not two parallel fixes in two
branches; per `git log -S`, it is the same ten lines in `d50a3e6`, authored once
in Branch B's stylesheet and inherited by Branch A through that copy.

So the synthesis is not a plan. It already happened, undeclared, and the
architecture has been quietly relying on it. This resolution ratifies it.

**Division of labour, on the measured evidence:**

| Concern | Winner | Evidence |
|---|---|---|
| Human viewing | **B** | one step when a server exists; A needs 3 commands cold |
| Structured output (JSON/XML) | **A** | B produces nothing structured — its weakest criterion |
| Agent section-read cost | **tie** | ~30× cheaper than whole-file on both; parity by construction |
| Canonical stylesheet | **B** | already the single source; A copies it |
| Reproducible pipeline output | **A** | static files, no server, no JS, no CORS |
| Format-agnosticism | **neither** | A is Markdown-in only; B manages 1.5 of 3 formats |

**Criterion 3 — the founding hypothesis — measured:** reading one section of
`cycle-215.md` costs 416 bytes against 12,566 for the whole file (3.3%, ~30×).
A full read-then-edit round trip is ~15×. Estimates are `bytes ÷ 4`, not
tokenizer output, and are labelled as estimates. **The hypothesis holds.**

The cycle said differences under criterion 3 are bugs, not features. One
qualifies: Branch A's JSON and XML duplicate nested-section content, so
~15.8% of a 14,988-byte payload is a verbatim second copy (~590 estimated
tokens per read). That is a Branch A defect to fix under the synthesis, not a
characteristic to defend.
<!-- /@section: decision -->

<!-- @section: consequences -->
## Consequences

**Shipped in this pass** (4 fixes, 1 workflow, all verified):

- `ensureStylesheet()` now always refreshes the derived stylesheet. It copied
  only when absent, so a stale pre-fix `styles.css` committed under
  `branches/build-renderer/examples/` was never refreshed — and the bug v0.1.1
  was released to fix still reproduced. Measured at a 1187px viewport, same
  artifact, same renderer, stylesheet the only variable: `.cycle-main` was
  **200px** with the stale sheet and **1080px** with the current one. The
  `.gitignore` rule meant to ignore it was anchored to the repo root and never
  matched the nested copy, which is why it survived; the pattern is now
  unanchored and the file untracked.
- `validate` treats unclosed anchors as blocking errors. It previously printed
  `clean (0 sections)` and exited 0 while `read`/`edit`/`append` on that
  section all failed with exit 1 — greenlighting an artifact whose sections are
  unaddressable. Spec §307 lists "anchors balanced" as part of validate's
  contract, so this was a conformance gap, not a preference.
- `validate` enforces required sections for all four standard types from spec
  §5. It checked only `cycle`, and only 3 of its 5; a `decision` artifact with
  none of its four required sections validated clean.
- `render --out` creates its target directory instead of dying with a raw
  ENOENT out of the stylesheet copy.
- CI (`.github/workflows/prism.yml`, closes #2) validates every example,
  renders all three projections and asserts their content, carries a regression
  guard for the v0.1.1 layout, and includes a negative test proving `validate`
  still rejects malformed input. Both negative paths were verified to actually
  fail — a guard that cannot fail is decoration.

**Follow-ups this pass created, with evidence:**

1. **Escalate issue #3 to high.** It was filed as a "copy-only-if-not-present
   foot-gun". It was in fact the live root cause by which a shipped, tagged fix
   silently un-fixed itself. Now fixed; the issue should record the mechanism.
2. **`:has()` has no fallback.** The layout fix depends entirely on
   `:has()`. On any engine without it (Chrome <105, Safari <15.4, Firefox <121)
   the selector is invalid, the rule is dropped, and the 200px bug returns
   silently. Proven load-bearing by counterfactual: deleting the two rules from
   the live stylesheet collapsed `mainW` from 1080 to 200 instantly. The
   structural fix is for `renderDefault` to emit a distinct class
   (`cycle-body--no-toc`) needing no `:has()` at all.
3. **Half the layout fix is dead code.** `.cycle-body:not(:has(> .toc)) >
   .cycle-main { max-width: none }` overrides a `max-width` that no rule sets.
   It reads as protective and protects nothing.
4. **Nested-section duplication** in JSON/XML (~15.8% of payload) — and nested
   anchor comments leak into the HTML output.
5. **No way to list section names.** Agents must deliberately trigger the
   `read --section bogus` error path to enumerate a document. A `list` command
   is the obvious primitive and the spec's own operations section does not name
   it.
6. **`package.json` says `0.0.0`** while the repo ships tag `v0.1.1`.
7. **`.cycle-body` is applied to artifacts that are not cycles** — exactly the
   naming that let a cycle-shaped grid reach a decision artifact.
8. **cdn-renderer's parser has the same warn-and-continue shape** for unclosed
   anchors (`parsers/md.mjs:92`) but ships no validate command. Parity left as
   follow-up rather than fixed blind.
9. **XML consumption is still unproven.** PRISM emits XML for agents; no agent
   has yet been measured reading the XML projection versus raw Markdown. The
   founding hypothesis is proven for *section reads*, not for the XML
   projection specifically.

**Unblocked by this resolution:** Phase 6 (`skills/prism-authoring/SKILL.md`,
still a stub awaiting exactly this convergence) and the v0.2 framing reshape
from "independent + composable" toward "PRISM is the substrate everyone
authors against".

**Methodology note.** The branching-cycle worked, with one caveat worth
carrying: because both branches lived on `main` simultaneously and shared a
stylesheet, they drifted into dependency without anyone declaring it. A future
branching-cycle should assert isolation periodically — try extracting each
branch — or the comparison quietly stops being a comparison.
<!-- /@section: consequences -->

<!-- @section: alternatives-considered -->
## Alternatives considered

**Pick Branch B alone and drop the CLI.** Tempting: B owns the human-facing
win and needs no build step. Rejected because criterion 4 (LLM consumability)
is the reason PRISM exists at all, and B produces nothing structured. Dropping
A would leave the agent-facing half of the protocol unimplemented.

**Pick Branch A alone and drop the custom element.** Rejected on criterion 2
and on the stylesheet: B is the canonical source of the shared CSS, so
"dropping" B means absorbing it, which is the synthesis under another name.

**Defer resolution until XML consumption is measured** (follow-up 9). Rejected
as scope: the seven stated criteria are answerable now, and Phases 6 and the
v0.2 framing have been blocked on this convergence for weeks. The XML
measurement is a real experiment but it tests PRISM's value proposition, not
the choice between two renderers.
<!-- /@section: alternatives-considered -->
