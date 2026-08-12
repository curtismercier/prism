---
type: cycle
variant: standard
cycle: 6
name: line-scoped-editing
title: "Edit one line from the preview pane, addressed by content, never by number"
status: seeded
status_note: "s01-285a12"
arc: prism-dashboards
created: 2026-08-09
updated: 2026-08-09
session: s01-285a12
edited_by: [s01-285a12@meetsoma]
spans_repos: [Gravicity/personal/prism, Gravicity/meetsoma]
seams: [../002-registry-dashboard/cycle.md, ../005-plugin-packaging/cycle.md, meetsoma/.soma/amps/scripts/soma-prism-serve.py, ../../../branches/cdn-renderer/layouts/registry-detail.mjs]
depends_on: [002-registry-dashboard]
description: "Click a rendered row in the preview pane, edit it, save that one line — with a compare-and-swap on the line's CONTENT so a save can never overwrite someone else's concurrent edit."
tags: [prism, editing, concurrency, dashboard, compare-and-swap, registry]
---

<!-- SEAMS: → 002 §Phase e (this is the write half that Phase e deliberately deferred)
            → 005 (the server this endpoint lands in, and its packaging)
            → meetsoma/.soma/skills/meta-cycle/refs/prism.md (§Surgical edit operations — the
              section-anchor addressing this reuses)
     UPDATE WHEN: the endpoint lands, or the addressing rule changes.
     WHO UPDATES: whoever ships G1. -->

# Edit one line from the preview pane

> **Trigger (Curtis, 2026-08-09), verbatim across three messages:**
> *"the ability to edit/save (w/ detection/gate to prevent saving over a cycle that's already been
> changed / saved (like an IDE does — if editing and going to save a file it would prevent you"*
> *"a per line edit tool — so it's not editing/saving the whole document"*
> *"like clicking edit on a entry/line — then i could save that line without effecting saving over
> the whole file"*

## Goal

A reader can click one rendered row in the preview pane, change it, and save **only that row** — and
a save whose source line changed underneath them is **refused with the current text shown**, never
silently applied.

## Acceptance — gates

| # | gate | command | pass | now |
|---|---|---|---|---|
| G1 | a matching write lands | `PUT /_write` with `{path, expected, replacement}` where `expected` is the current line | 200; file contains `replacement`; **byte-identical elsewhere** (diff shows exactly 1 changed line) | ⬜ |
| G2 | a stale write is REFUSED | change the line on disk, then PUT with the old `expected` | **409**; body carries the CURRENT line; **file unmodified** | ⬜ |
| G3 | an ambiguous write is REFUSED | PUT an `expected` that appears twice in the file (see §The 87) | **409 ambiguous**; file unmodified; response names the occurrence count | ⬜ |
| G4 | traversal is refused | PUT `path: ../../../../etc/hosts` and an absolute path | **403**, both; nothing written outside the served root | ⬜ |
| G5 | the write path is OFF by default | start the server with no write flag, PUT anything | **405/404**; and the pane shows **no edit affordance** | ⬜ |
| G6 | the pane round-trips | click a row, edit, save, reload | the rendered row shows the new text and `git diff` shows one line | ⬜ |

**What would make these gates a lie:**

- **G1 passing on a file it did not actually write.** Assert the file's **mtime AND sha256 changed**,
  not that the endpoint returned 200. A handler that returns 200 and writes nothing passes a naive G1.
- **G2 passing because the PUT failed for an unrelated reason** — wrong path, server down, malformed
  JSON all also produce a non-200. **Assert the status is specifically 409 and the body carries the
  current line**, or G2 is satisfied by any breakage.
- **G3 is satisfied by absence** if the fixture has no duplicate to find. Assert the ambiguous
  fixture **contains exactly 2 occurrences** before asserting the refusal.
- **G5 is the one that will rot.** It passes trivially today, because there is no write path at all.
  It must be re-run **after** G1 lands, against a server started without the flag — otherwise it is
  measuring the absence of a feature rather than the presence of a gate.

## Spec

### Addressing: match by CONTENT, refuse on ambiguity

🔑 **Line numbers are not stable addresses.** Another agent appends six lines above your edit and
line 214 is now line 220 — the write lands in the wrong place *and* a line-number conflict check
still passes, because line 214 exists and has content. That is silent corruption, which is strictly
worse than a refused save.

So the wire format is the same contract the `edit` tool already runs on in this estate — **unique
match or refuse**:

```json
PUT /_write
{ "path": "clients/example-client/.soma/cycles/shared-shell/cycle.md",
  "expected":    "| 5 | Ontario cutover | ⏳ |",
  "replacement": "| 5 | Ontario cutover | ✅ shipped 2026-08-07 |",
  "section":     "phases" }
```

| server finds | response |
|---|---|
| exactly 1 occurrence of `expected` | replace it, write, **200** |
| 0 occurrences | **409 stale** + the section's current text |
| >1 occurrence | **409 ambiguous** + the count; `section` narrows the search first |

`section` is optional and is the **disambiguator**, reusing PRISM's existing
`<!-- @section: name -->` anchors (`refs/prism.md` §Surgical edit operations) rather than inventing
a second addressing scheme.

### Why a table row is the right first target

**In GFM a table row is exactly one source line.** So "click the entry, save the entry" maps 1:1 onto
the source with no diffing, no reflow, and no lossy HTML→markdown round-trip — and it lands exactly
where cycle editing actually happens: status cells and phase rows.

Measured across **744 `cycle.md` / 10,693 table rows**: **99.19% are uniquely addressable by their
line content alone.**

#### The 87

The 87 non-unique rows sit in **25 files**, and the sample is uniform — they are **header rows**:
`| # | Item | Est | Status |`, `| Cycle | What | Maps to gohighlevel | Status |`. **Nobody edits a
header row through this affordance**, so the ambiguous case is real but not in the way of the
feature. G3 exists so it fails loudly rather than picking one.

### Where it lands — and why NOT in this repo

⛔ `registry-detail.mjs:18` carries a standing ruling: *"EDITING (Phase e write) IS OUT OF SCOPE.
Ruled: this panel ships READ + COPY-PATCH… no PUT/POST endpoint goes into this repo while it is
being prepared for publication."*

**That ruling protects `prism`, the published artifact. It does not bind `soma-prism-serve.py`,**
which is our local tool in `meetsoma`. So:

| half | repo | why |
|---|---|---|
| `PUT /_write` + the CAS | `meetsoma/.soma/amps/scripts/soma-prism-serve.py` | local tooling; never published |
| the edit affordance | `prism/branches/cdn-renderer` | **capability-gated** — render it only if the server advertises write |

⇒ prism stays publishable and read-only when served by anything else; we get editing locally.
🔴 **This is still an amendment to a Curtis ruling and needs his word before G1 starts.**

### Off by default

The server takes `--write` (or `PRISM_WRITE=1`). Without it there is no handler, and the client's
capability probe fails closed, so the pencil never renders. G5 asserts both halves.

## Risks

| risk | first symptom |
|---|---|
| the rendered row cannot be mapped back to its source line | the pencil appears on rows whose `expected` does not match the file — **G1 fails on the very first table** |
| `marked` normalises the row (whitespace, escaped pipes) so `expected` never matches | 409 stale on a file **nobody has touched** — the tell is that it fails *every* time, not intermittently |
| a concurrent `.soma` auto-commit rewrites the file between load and save | intermittent 409s that resolve on reload — **expected and correct**, but it will read as a bug if not documented in the UI copy |
| the pane holds a stale copy after a successful write | second edit to the *same* row 409s, because the pane still holds the pre-write text. **The response must return the new line and the pane must adopt it** |
| write enabled on a server someone else can reach | any PUT succeeding from a non-loopback origin. Bind write to `127.0.0.1` and assert it |

⚠ **`.soma` auto-commits — checkpoints landed every ~60s during the session that wrote this cycle.**
Concurrent modification here is the **normal case, not the edge**, which is what makes the CAS the
feature rather than a nicety.

## Files

| file | change |
|---|---|
| `meetsoma/.soma/amps/scripts/soma-prism-serve.py` | `do_PUT`, the CAS, path containment, `--write` flag, self-test |
| `prism/branches/cdn-renderer/layouts/registry-detail.mjs` | capability probe + inline row editor + 409 presentation |
| `prism/branches/cdn-renderer/styles.css` | editor affordance styling |
| `prism/branches/cdn-renderer/layouts/cycle.mjs` | stamp each rendered block with the source line that produced it |

## 🆕 AGENT CONCURRENCY — the case this cycle does not yet cover (Curtis, 2026-08-12)

> *"an agent may also be in the process of editing — so a user's edits need to be respectful to
> current state, and where there is a conflict their edit/save would be initially blocked."*

The CAS above solves **user vs disk**. It does not solve **user vs a live agent**, and the two differ:

**1. 🔴 An agent's edit is not one write.** `N files = N edit calls`, and a failed multi-edit batch
rolls back **entirely**. So a user can land a valid CAS write into the *middle* of an agent's
sequence — every individual write consistent, the resulting file incoherent. **Line-level CAS cannot
see a multi-file intention.**

**2. `.soma` auto-commits ~every 60s.** An agent's intermediate state is committed before it is
finished, so "committed" is not "settled". ⚠ Measured today: a truncated file was checkpointed
empty within a minute, and `git checkout HEAD -- f` then restored **0 bytes**. **Recency of commit
proves nothing about coherence.**

**3. The agent is a stale cache too.** It may write from content it read minutes ago — the same
failure the 409 protects the user from. **The rule must be symmetric: an AGENT write should also
carry `expected` and take a 409.** Today a `write_text` with no such check destroyed a 364-line file.

**4. A 409 has no UX for an agent.** A human sees the current text and re-decides. An agent needs a
**machine-readable** conflict: current content + a hint of what changed, so it can re-read and retry
rather than treat 409 as failure and give up (or worse, force).

**5. Non-hypothetical, same day:** a librarian child was moving/archiving `.md` files in the
workspace root while two orchestrators were live. **"Who else is editing right now" is a question the
estate cannot currently answer** — `soma:agent.list` shows children, not what they hold open.

### Sketch to argue with, not adopt

- **Advisory intent, not a lock.** An agent about to edit declares `path + expected-duration`; the
  pane shows *"an agent is editing this — save will be checked"*. **Advisory, because a real lock
  will be orphaned by a killed pane** and then the estate needs lock-breaking, which is worse.
- **Both sides use the same endpoint and the same `expected` check.** No privileged writer. If the
  agent path bypasses CAS, the guarantee is decorative.
- **Conflict returns a DIFF, not a rejection** — enough for either party to merge or re-decide.
- ⚠ **Falsify with a real race**, not a unit test: land a user save mid-way through a scripted 3-file
  agent edit and assert the file is coherent. **A test that serialises the two proves nothing.**

## 🆕 COMMENT MODE — a second verb, not a variant of edit (Curtis, 2026-08-12)

> *"the ability to edit OR comment on artifacts — which would land differently than an edit — maybe
> a comment at the end of the line — these could then be used by the soma agent to update."*

**Select a rendered line → attach a comment → it appends to that line in source → an agent reads the
comments and actions them.** A review loop where the human annotates and the agent executes. This is
the more valuable half: **editing asks a human to do the agent's job; commenting asks the human to do
the part only they can do — decide.**

### 🔴 The hazard to settle FIRST: a comment on a client-facing artifact can LEAK

The motivating example is a line in the **offer harness** — which renders the **proposal**, a document
that goes to the client. **An HTML comment is visible in view-source and survives export.**
⚠ Precedent, same estate, this month: `gsc-28d-AS-IS-do-not-send.png` sat inside the client's own git
repo. **Internal annotation reaching a client surface is a thing that has already happened here.**

⇒ **Never write a comment into an artifact that ships.** Options, in order of preference:

| approach | leaks? | survives an edit to the line? | notes |
|---|---|---|---|
| **Sidecar file, keyed by content-hash** | ✅ no | ✅ yes — rehash and re-anchor | `<artifact>.comments.json` beside the file, gitignored on client paths. **Recommended.** |
| Inline `<!-- -->` in source | 🔴 **yes** for `.html`/rendered output | ❌ no — mutates the line | Curtis's literal sketch. Fine for a `.md` cycle, **not** for a proposal |
| A separate review branch | ✅ no | ✅ | Heavy; a reviewer should not need git |

🔑 **Split by artifact class, not by preference:** internal `.md` (cycles, notes) can take inline
comments safely. **Anything that renders to a client takes a sidecar.** The same UI, two backends —
and the artifact class decides, never the user.

### Why comment mode collides with the CAS above — and why that is good

**Appending a comment CHANGES THE LINE**, so any pending edit whose `expected` matched the old text
now gets a **409**. That is correct behaviour and worth stating: *a comment is a write, and it takes
part in the same conflict protocol.*
⚠ But it means **a reviewer commenting can 409 an agent mid-edit** — the exact race in §AGENT
CONCURRENCY. **A sidecar avoids this entirely** (the artifact is untouched), which is a second
argument for it beyond leak-safety.

### What the agent needs to consume them

- **An anchor that survives reflow.** Line numbers rot; the CAS lesson applies — anchor on **content
  hash of the line**, and on re-anchor failure surface the comment as *orphaned*, never drop it.
  **A silently-dropped review comment is worse than no comment mode.**
- **State per comment:** `open → actioned → dismissed`, with the actioning commit. Otherwise the agent
  re-actions the same note every session — the `runs: 0` failure inverted.
- **A comment is an INSTRUCTION, not prose.** *"tell me which address you actually watch"* is a
  question to Curtis; *"change this to X"* is work. The agent must not guess — **unclear comment ⇒
  ask, do not act.**

### Open, and genuinely undecided

- Does an agent mid-edit **block** a user save, or **warn** it? Blocking is safer and will be
  resented; warning is honest and will be ignored. **Curtis's call — it is a UX ruling, not a
  technical one.**
- Same mode for the **offer preview/dashboard** (Curtis) →
  `project-b/.soma/cycles/102-offer-dashboard-into-prism`. **Do not build a second editor** —
  if that artifact renders through PRISM, it inherits this one.

## Open questions

1. ✅ **RESOLVED — Curtis, 2026-08-12: AMEND, along the repo split. G1 is unblocked.**
   > *"yes i agree — we don't want to have to track or update in code."*

   **The ruling now reads:** no PUT/POST **endpoint** enters `prism`, ever — that half stands
   unchanged. A **capability-gated, dormant edit affordance** may. The write path lives only in
   `meetsoma/.soma/amps/scripts/soma-prism-serve.py`.

   **The deciding argument was drift, not purity.** Keeping the affordance out too would force a
   second copy of `registry-detail.mjs` on the meetsoma side, tracking the published one forever.
   **That is the two-surfaces failure this estate keeps paying for** — bridge vs somadian, four
   DAG-ish surfaces, `personal/yoshi` vs its successor. Purity in the published repo, paid for in
   drift, is the worse trade.

   🔑 **What actually protects publication is that the ENDPOINT never exists there.** The worst case
   for the shipped artifact is inert UI, not an exposure.

   ⚡ **Tightening (mine, reversible, Curtis delegated the detail):** the capability probe must be an
   **explicit per-session opt-in**, not merely "the server advertises write." ⇒ **G5 gains a third
   assertion:** with the server started `--write` but no session opt-in, **the pencil still must not
   render.** Otherwise dormant UI can wake up by accident the first time someone runs the local tool
   for an unrelated reason.
2. Does the pane write through to **disk only**, or also `git add`? The `.soma` auto-committer will
   pick it up either way — so probably disk only, and let the existing machinery do its job.
3. **Beyond table rows** — list items and paragraphs can wrap across source lines, so they need a
   block-level `raw` from `marked.lexer`, not a line. Worth it, but it is a second phase and should
   not hold the row editor.
4. 🆕 **A hazard the CAS must not be built on top of: DOUBLE-TRACKED `.soma` trees.** A cycles tree
   can be a nested git repo *and* have its files tracked by the parent repo — so **"has this file
   changed?" has two different answers depending on which repo you ask**, and the two drift.

   | project | nested `.soma` repo says | parent repo says |
   |---|---|---|
   | `personal/prism` | `2026-08-05`, 2 files dirty | `2026-08-09` (43 files tracked) |
   | `meetsoma/nova-voice` | `2026-07-30` | `2026-08-09` (`83900f5`, mode `100644` — real files, not gitlinks) |

   ⇒ **Hash the file CONTENT. Never use git state or mtime as the conflict signal.**

   🔑 This is not theoretical: it produced a false finding *within an hour of being written*. The new
   `soma-cycles-registry.py unrecorded` read only the nested repo and reported nova-voice as **53
   commits of unrecorded work** — its cycles had in fact been committed to the parent that same day.
   **A property of my instrument, reported as a property of the estate.** Fixed by taking the later
   date across both repos; the live differential (2 findings → 0) is the proof.

   (Separately: the double-tracking contradicts `meetsoma/.soma/cycles/infra/003-soma-repo-topology`,
   is present in at least 2 projects, and is worth its own fix.)
