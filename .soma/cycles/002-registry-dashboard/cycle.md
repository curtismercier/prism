---
type: cycle
cycle: 2
arc: prism-dashboards   # PRISM family arc, s01-6d4d53
title: Registry layout — from list to dashboard
status: active
created: 2026-08-01
updated: 2026-08-01
author: s01-8b4389 (Soma) + Curtis Mercier
session: s01-8b4389
edited_by: [s01-8b4389@prism, s01-593a6d@meetsoma]
license: CC BY 4.0
spans_repos: [Gravicity/personal/prism]
depends_on: [./001-renderer-spike/cycle.md]
companion: [../../../branches/cdn-renderer/layouts/registry.mjs, ../../../branches/cdn-renderer/layouts/cycle.mjs]
purpose: |
  Grow the `registry` layout from a flat sortable list into a dashboard: stat
  cards that double as filters, multi-axis grouping, a flat sortable table, and
  in-place editing of an artifact's frontmatter and body. Plus a viewer fallback
  so non-conformant Markdown still renders with a navigable index.
---

<!-- @section: trigger -->
## Trigger

The `registry` layout shipped as a grouped list over a consuming project's cycle corpus (~500
artifacts across 18 trees). At that size a list is a wall: everything is visible and nothing is
findable. Two distinct complaints surfaced in use.

**First, most artifacts rendered without any index.** Measured across the corpus: **3 of 671**
`cycle.md` files carry `@section` anchors. The rest parse to zero sections and a single
multi-thousand-character preamble — the exact Markdown wall PRISM was created to fix, reproduced
in the overwhelming majority of documents the renderer was pointed at.

**Second, the registry answered "what exists" but not "what needs attention."** The data to
answer the second question was already in every row and simply not projected.

> **Curtis:** *"add some visual stat cards to the top … other useful ways we can sort, like per
> project, per scope, and maybe a flat list that can sort the table ascending/descending … an
> awesome dashboard for managing, viewing, and even updating cycles … while keeping the code
> elegant, and light or simple as possible."*
<!-- /@section: trigger -->

<!-- @section: context -->
## Context

Two layouts are in scope, both in `branches/cdn-renderer/layouts/`:

- `cycle.mjs` — renders a single artifact (header, TOC sidebar, sections)
- `registry.mjs` — renders an index of many artifacts, with drill-in to `cycle.mjs`

The renderer is a CDN-loaded custom element with no build step. That constraint is load-bearing:
it is why the layout can be edited and reloaded live, and it is what "light and simple" means
here concretely. A framework or a bundler would end the property that makes this usable.

Row data is supplied by the consuming project as JSON — the layout does not scan a filesystem and
must not begin to. Everything below is a **projection of fields the consumer already emits**,
with exactly one deliberate exception (see `decisions-to-surface`).
<!-- /@section: context -->

<!-- @section: phases -->
## Phases

| Phase | Scope | Status |
|-------|-------|--------|
| a | Heading-derived sections — viewer fallback for anchor-less documents | ✅ shipped |
| b | Stat cards, doubling as quick filters | ✅ shipped s01-8b4389 |
| c | Grouping (project / scope / arc / status / flat) + sortable columns + URL state | ✅ shipped s01-8b4389 |
| d | Multi-axis filter bar (project × arc × status), expanded from the existing sticky control row | ✅ shipped s01-8b4389 |
| e | In-place editing — frontmatter fields and section bodies. **Curtis 08-05: opens in a PREVIEW/EDITOR PANEL** (same window, separate surface), NOT a scroll-to under the huge list | ⬜ queued — UX shape now specified, see §Phase e UX |
| g | **Navigation system (Curtis 08-05)** — breadcrumb header (click the logo / "cycle registry" to return), close/X on the preview/editor, and a cross-dashboard MENU to switch between PRISM surfaces (Cycle Registry → delegation timeline → others) | ⬜ new |
| f | **Filtering audit + default view** | 🟡 **default view SHIPPED s01-593a6d; audit queued** — see §Phase f |

> **Table corrected s01-593a6d.** b/c/d shipped a session earlier and were never
> marked — the cycle read `queued` for features that had been live for hours, which
> is the "status is a lie" defect this corpus's own tooling exists to catch.
> Re-verified in the live DOM before flipping, not from the commit log:
> `.reg-card` ×7 (6 clickable filters) · `data-reg-sort` name|age · flat table
> present · URL hash state · `data-reg-project` ×4 / `data-reg-scope` /
> `data-reg-bucket` · **`e`: 0 edit controls, correctly still queued.**

### Phase b/c/d refinements — s01-593a6d (found in use, by Curtis)

All four surfaced by USING the dashboard, not by review. Each was invisible to the
code and visible on the page.

| # | defect | fix | commit |
|---|---|---|---|
| 1 | Table read `open` while the drill-in panel read `closed`, 2h after the edit. The JSON is a SNAPSHOT; the drill-in nests a live artifact on the real file — so **one view disagreed with itself**. Filtering only searched what was fetched at page load, so a cycle written since was invisible without a manual reload. | Re-poll on interaction (rate-limited 15s), re-render only when `generated_at` moves. Server regenerates in the BACKGROUND and sets `X-Registry-Refreshing` — a synchronous rebuild blocked ~9s and the browser aborted it, so the refresh failed in exactly the case it exists for. | `d7e2bce` |
| 2 | Inline stat chips used their own palette. A/S/C already matched; `O` was off against the pill base and `x` was a solid red of its own invention **with no dark rule at all** — invisible only because 0 cycles are unparseable today. | Chips take the pill palette. | `d7e2bce` |
| 3 | **The big summary numbers rendered `rgb(0,0,0)` on `rgb(22,22,29)` — ~1.1:1 contrast.** active/seeded/closed passed no tone class and `.reg-card-n` had no dark base; only `warn` ever set a colour, which is why the two warning cards were the only readable ones. | Each number carries its status pill's foreground. Measured after: 9.70 / 10.22 / 10.70 / 14.51:1. | `1c8fd54` |
| 4 | Clicking the `closed` card filtered the table while the toolbar still read "any status" — **two controls for one filter, disagreeing.** | Deleted the redundant state rather than syncing it: the dropdown OWNS bucket filtering; active/seeded/closed cards are a second way to set it. stale/no-git/broken stay orthogonal. Legacy `#card=closed` links are translated — otherwise they would open with the filter silently dropped. | `7bc9376` |

### Round 2 — s01-593a6d, three more, all against LOCKED decisions never implemented

| # | defect | fix |
|---|---|---|
| 5 | **Cards never recomputed.** §decisions-locked says *"cards recompute from the filtered set so they compose"* — counts were computed once at render from `rows` and baked into the HTML. Filter to Active and the seeded card still read 82. **Locked, never built.** | `recountCards()` with FACET semantics: each card counts rows passing every OTHER filter but not its own dimension. Counting with its own filter applied would zero every card but the one clicked. Verified: project=meetsoma → 78/80/280 becomes 28/22/59. |
| 6 | **Card clicks never re-polled.** The s01-593a6d auto-refresh was wired to the search box and dropdowns only, so a session that only clicks cards reads a snapshot from page load. Measured stale: `generated_at` 11:44:54 vs newest `cycle.md` 11:46:33. | `maybeRefresh()` added to the card handler. |
| 7 | **"Filtering is broken — clicking Active shows shipped."** It is NOT. With bucket=Active: 78 visible rows, **zero** showing `shipped`. The one element showing it is an ARC HEADER (`_meta/cycle-system`, status `active — 01 shipped · 02 batches closed`) — correctly bucketed Active, its status PROSE mentions shipped phases. | No code change. **Narrative-in-`status:` makes a correct UI look broken** — now a user-visible argument for the `status_note` migration, not a tidiness one. |

⚠ **Also cost a false regression report:** "the section nav broke" was a browser tab open since before a `?v=` bump. An open tab renders the old ES module indefinitely — `no-store` prevents re-fetching stale bytes, it cannot refresh a page never reloaded. **"Looks broken" → hard-reload first.** (Same false-diagnosis class as s01-bbca8a.)

<!-- @section: phase-f -->
### Phase f — filtering audit + default view (queued s01-593a6d)

**Audit the filtering end to end.** Three defects surfaced by USE in one session, two of them
against decisions this document had already locked. That ratio says the filter path has never been
systematically exercised.

- every card × every dropdown × search × view-toggle (tree/flat), asserting **shown-count == the
  facet count** for each combination
- the compose cases: card + project + scope + search simultaneously
- **tree/flat double-count** — both copies live in the DOM; every counter must filter to the current
  view or every number doubles. Already a live footgun in `recountCards` and the `n` total.
- URL-hash round-trip for every filter, including legacy `#card=<bucket>` links
- **falsification:** a filter combination with genuinely zero results must render the
  explain-yourself empty state, not a bare `0 shown`

**Anchor drift (Curtis noticed the rendering split, s01-593a6d).** Measured over 265 cycles:
**261 derived · 4 anchored · 0 with no nav.** Every cycle DOES get a navbar — the visible difference
is that derived docs carry a `derived` badge, `toc-derived` styling and document order, while the
four anchored ones get canonical order and stable links.

🔴 **At 98.5% derived, styling derived as the degraded case is backwards.** The badge was right when
it flagged a handful of stragglers; as a permanent watermark on 261 documents it just says "almost
nothing here is real". **Fix: keep the marker only where it is ACTIONABLE** — surfaced when someone is
about to edit a section surgically (where a derived id genuinely will not hold), not as ambient
decoration. Backfilling anchors wholesale stays out of scope per §out-of-scope; anchors arrive
**on touch**, folded into `cycle-system/06`'s migration skill — same rule as statuses.

✅ **Default view SHIPPED s01-593a6d.** Group by PROJECT, all groups COLLAPSED, **projects ordered by
activity (median row age, most-recent first)**, first load only.

**Project order uses MEDIAN age, not min.** Measured: `personal/tincture-css` is min 0 / median 93 —
a single recently-touched file would rank a dormant project above `meetsoma` (median 1). Min answers
*did anything ever happen here*; median answers *is this project live*, which is the question a
collapsed view is asking. Result: meetsoma 1d · somaverse 1d · prism 2d · bonsai 4d · yoshi 5d ·
studio 42d · nova 47d · client-a 58d · services 84d · tincture 93d.

**Three bugs en route, all silent-success shaped:** (a) used the GLOBAL `rows` instead of the
project's `allRows`, giving every project age 0 and degenerating the sort to alphabetical while
looking correct; (b) `min` instead of median, above; (c) keyed project order off `sortSel`, whose
default is `name` — the feature undid itself. `sortSel` is labelled *"arcs A→Z"*; it governs ARCS.
Verified both branches: no hash → 50/50 groups closed, 0 tree rows exposed, 12 project groups;
`#status=Active` → dropdown restored and groups left expanded, so a shared link still opens on the
view it describes. **Ordering was the bug** — collapsing before `apply()` left one group open because
`apply()` touches group visibility after; the collapse runs last now.

**Default view (Curtis, s01-593a6d): group by PROJECT, all groups COLLAPSED, on first load.**
539 rows expanded is the wall this layout exists to fix — the trigger's own words. Collapsed-by-project
is navigable at a glance and makes the estate's shape (which project owns how much) the first thing
you see. Applies only when the URL carries no hash; a shared link still opens on the view it describes.
<!-- /@section: phase-f -->

**The pattern across all four:** a surface that looked right and was wrong, where the
check that would have caught it either did not exist or could not see the defect. #3
is the sharpest — a 1.1:1 contrast ratio sat in the shipped dashboard until someone
looked at it, and a vision-model review of the same screenshot confidently reported
the colours were consistent. Every real catch came from `getComputedStyle` and the
layout's own filter summary, never from reading the CSS or trusting a rendered
impression.

**Argues for the tincture CDN/import plan:** these are hardcoded hexes in two CSS
blocks that must stay manually in sync with the pill rules. Token ownership plus an
automated contrast gate is what would have caught #2 and #3 before they shipped.

### Phase a — shipped

`renderCycle` now falls back to deriving sections from `## ` headings when the parser returns an
empty anchor map. Fence-aware, so a `## ` inside a code block cannot open a phantom section.

**The parser is untouched.** Section extraction remains anchor-only, so spec conformance is
unchanged — this is a viewer affordance, not a protocol change.

Derived output is deliberately **distinguishable** (dashed rule, `derived` tag): a derived id is
not a stable address. It breaks the moment someone rewords a heading, and it cannot be targeted by
a surgical edit. Rendering derived and anchored sections identically would erase the only visible
signal of which documents actually carry addressing.

Derived sections also keep **document order**, bypassing `STANDARD_ORDER`. Canonical ordering is a
promise an author makes by writing anchors; a document that never opted into the vocabulary must
not be resequenced by it. Caught by measurement, not review: a heading slugged to `phases`
silently jumped above its own document's opening section.

Verified in-browser, both directions:

| artifact | before | after |
|---|---|---|
| anchor-less | toc 0 · sections 0 · preamble 4286 | toc 6 · sections 6 · document order · marked derived |
| anchored (control) | toc 7 · sections 7 | **unchanged** — toc 7 · sections 7 · `derived=false` |
<!-- /@section: phases -->

<!-- @section: decisions-locked -->
## Decisions locked

**Cards are the filter UI.** A stat card is not decoration; clicking it filters the table, and
cards recompute from the filtered set so they compose. One mechanism serving two purposes is the
cheapest way to add a dashboard without adding dashboard chrome.

**View state lives in the URL fragment** (`#group=…&sort=…&dir=…&f=…`). Shareable, survives
reload, back button works, and it costs zero state management. This is the "simple" answer, not a
compromise against one.

**Prefer actionable cards over orientational ones.** A card should mean *go fix something*. Totals
and census counts orient but do not prompt; they earn a small corner, not the top row.

**No new emitter field without justification.** Every card and column should be a projection of
data the consumer already sends. A view that needs new data is usually a view inventing data.

**Data freshness is the layout's problem, not the reader's (s01-593a6d).** The registry JSON is a
SNAPSHOT while the drill-in nests a live artifact on the real file — so a stale snapshot makes ONE
VIEW DISAGREE WITH ITSELF (the table read `open` while the detail panel read `closed`, two hours
after the edit). Filtering only ever searched what was fetched at page load, so a cycle written
since was invisible without a manual reload. Interaction now re-polls, rate-limited, and re-renders
only when `generated_at` moves.

This stays inside "the layout does not scan a filesystem": it re-fetches the same consumer-supplied
JSON, it does not go looking for files. It is safe to re-render **because view state already
round-trips through the URL fragment** — the decision above paid for this one.
<!-- /@section: decisions-locked -->

<!-- @section: decisions-to-surface -->
## Decisions to surface

**Completion progress requires the one sanctioned new field.** "How many tasks/gates in this
artifact are complete" is genuinely not derivable from existing row data — it needs the body
parsed. This is the deliberate exception to the rule above, and it comes with a hazard measured
before design: across the corpus, **62.9%** of artifacts carry any completion marker at all, in
two competing vocabularies (checkbox lists and status glyphs).

So **"no tasks found" must not render as "0% complete."** A progress bar that cannot distinguish
*nothing to do* from *nothing done* is the same defect class as a badge that conflates two
opposite states — confidently wrong, and acted upon. The card must state its denominator and
render absence as absence.

Marker counting should also be **containment-scoped** to list items and table rows. A glyph in
prose is narration, not a task, and counting it inflates every number downstream.

**Open:** should the layout accept a progress field, or compute it from a body it already fetches
on drill-in? The former keeps the layout dumb; the latter keeps the emitter simple.

**Open:** editing requires a write endpoint, which the reference dev server does not have. The
protocol question is whether PRISM should specify a canonical write contract (path containment,
optimistic concurrency via caller-supplied mtime, atomic replace) or leave it entirely to the
host. Leaning: specify the *contract*, ship no server.
<!-- /@section: decisions-to-surface -->

<!-- @section: out-of-scope -->
## Out of scope

- Scanning a filesystem from the layout. Row data arrives as JSON; that boundary stays.
- Any build step, bundler, or framework.
- Authentication. A local editing surface is protected by binding to loopback, not by a login.
- Backfilling anchors into anchor-less documents. Phase a makes them *navigable*; making them
  *addressable* is per-document work, justified by editing need rather than done wholesale.
<!-- /@section: out-of-scope -->

<!-- @section: publication-readiness -->
## Publication readiness — BLOCKER before this repo goes public

The repo is **private today** (verified `gh repo view` → `isPrivate: true`), but it is licensed,
CONTRIBUTING-gated and structured for publication. Two things must be settled before that flip.

**1. The canonical example is a real internal dossier.** `examples/cycle-215.md` says so in its own
`example_note`: it is an anchored copy of a production infrastructure cycle from a private
workspace. It was chosen as the shared input so both renderer branches could be compared against
identical realistic content — which was the right instinct for the comparison and the wrong artifact
to keep.

It has since been rendered into HTML, JSON and XML derivatives, copied into a second branch's
examples dir, and wired into CI (*"validate and render EVERY examples dir"*). **8 tracked files,
~95 occurrences** of workspace-internal identifiers: a client directory name, host and container
names, an auth service, a secret store, a hosting provider, absolute home paths, and strategic notes
naming a single point of failure.

**Fix: replace the fixture, do not redact it.** A find-and-replace over five derived files leaves a
plausible-looking document whose *shape* is still someone's real infrastructure. Author a synthetic
dossier of comparable size and structure, regenerate all derivatives from it, and delete the
originals. The comparison value is in the shape, which a synthetic fixture reproduces exactly.

**2. History, not just HEAD.** The derivatives were committed over multiple sessions. Removing them
from HEAD leaves them in the log. Decide before flipping visibility: rewrite history, or start the
public repo from a fresh initial commit.

**Gate:** a scan for workspace identifiers across **all tracked files at every reachable commit**
returns zero — with the scan canaried against a string known to be present, so a zero means "clean"
and not "my pattern is broken."
<!-- /@section: publication-readiness -->

<!-- @section: notes -->
## Notes

**Editing is the second argument for anchors.** With `@section` anchors, a save can write one
section; without them it must rewrite the whole file. That makes anchor adoption self-justifying
on exactly the documents that get edited — which is also the correct rule for choosing them.

**Elegance gate, made falsifiable:** if `registry.mjs` passes ~600 lines, split it by concern
(cards / table / edit) rather than letting one layout quietly become an application. It stands at
373 lines entering phase b.
<!-- /@section: notes -->

---

## §Phase e UX + Phase g — navigation (Curtis, 2026-08-05)

### Phase e — the preview/editor panel shape (not just "edit in place")

Curtis: *"instead of it scrolling down to show it under the huge list of projects/cycles — it could
open up in a cycle preview/editor (like kinda in the same window but not)."*

- Clicking a cycle/phase opens a **preview/editor panel** — a distinct surface within the same window
  (the `<soma-artifact>` detail-pane mechanism already exists; this is its UX upgrade).
- The panel shows the artifact; editing (phase e) happens there, not in the list.

### Phase g — the navigation system

Curtis: *"the top banner/header where it has the soma logo and 'cycle registry' could be treated a bit
like a breadcrumb/link — so I could click back on cycle registry — there might also be a close or X
button on the cycle preview/editor."*

1. **Header = breadcrumb** — the logo + "cycle registry" are a clickable link back to the registry
   root (not static chrome).
2. **Close/X on the preview/editor** — dismiss the panel, return to the list.
3. **Cross-dashboard menu** — a menu in the shared header to switch PRISM surfaces (Cycle Registry →
   the delegation timeline (003) → others), so the dashboards become a navigable family, not islands.

### Why this matters (the collaboration angle)

Curtis: *"allowing me to navigate more freely and improve our overall collaborative and communication
between soma and me/users."* **The dashboard is the communication surface** — navigation freedom IS
communication quality. A breadcrumb + close + cross-dashboard menu turns a wall of cycles into a
navigable workspace.

### Decision to surface (next actor)

The preview/editor + navigation are **renderer work** in `branches/cdn-renderer/layouts/registry.mjs` —
the same file the audit refactor just touched. Coordinate: the registry audit (`child-e6b15c`, merged
`589deb1d`) changed the DATA layer; this changes the PRESENTATION. Both land in the same layout, so
sequence them.

---

## §Q4/Q5 SCOPE — validated against the code, 2026-08-05 (s01-7ca9ab@meetsoma)

Curtis: *"you can scope q4 and q5 — validate and/or confirm your recommendations, and/or the child's."*
Source proposal: `meetsoma/.soma/releases/audits/prism-registry-refactor-proposal-2026-08-05.md`.

### What VALIDATED (child's claims, re-derived independently)

| claim | verdict | evidence |
|---|---|---|
| `registry.mjs` is 967 ln vs its own ~600-ln split gate | ✅ | `wc -l` = **967**; the gate is this file, line 298: *"if `registry.mjs` passes ~600 lines, split it by concern"* — **it fired silently and was walked past** |
| detail pane already built | ✅ | `.reg-detail` scaffold at `registry.mjs:427-441` (`data-reg-detail`, `-title`, `-body`) |
| close/X already built | ✅ | `registry.mjs:430` — `<button data-reg-close class="reg-close">close ✕</button>` |
| per-artifact layout reuse already built | ✅ **and better than described** | `:571,:587` render `<soma-artifact src=…>` — the selected artifact renders **through ITS OWN layout** (cycle/arc/map). It does not name `cycle.mjs`; it inherits *every* layout that exists now or later. ⚠ My first probe grepped for the string `cycle.mjs`, got **0**, and nearly filed a correct claim as wrong — *the filename was the wrong instrument; the mechanism was the right one.* |
| cross-dashboard menu unbuilt | ✅ | 0 hits for any nav/surface-switch construct |
| publication blocker is real | ✅ | §Publication readiness: `examples/cycle-215.md` is a real internal dossier, **already rendered into HTML/JSON/XML derivatives and copied into a second branch**; repo `isPrivate: true` today |

### 🔑 The finding that reframes Phase e — the panel EXISTS, it is in the WRONG PLACE

`registry.mjs:573` — `detail.scrollIntoView({ behavior: 'smooth', block: 'start' })`.

**The detail pane is an inline block below the list that the page SCROLLS TO.** That is verbatim
Curtis's complaint: *"instead of it scrolling down to show it under the huge list of
projects/cycles."* ⇒ **Phase e is not "build a preview panel." It is "relocate the existing one"** —
from an inline scroll-to block into a distinct surface (side/overlay pane) that does not move the
list. Much smaller than it reads, and it means the *rendering* half is done.

### 🔴 The scoping correction — a registry-private header CANNOT deliver g.3

The proposal suggested splitting into `registry-header.mjs` + `registry-detail.mjs`. **Probed: each
layout renders its own chrome** (`<h1>`/header constructs live in `body.mjs`, `default.mjs`,
`pipeline.mjs`, `cycle.mjs` — and **no header at all in `registry.mjs`**). There is **no shared header
component**, and the string "Cycle Registry" does not exist in the repo — the title comes from the
rendered document, not the layout.

⇒ A `registry-header.mjs` would give the breadcrumb to the **registry only**, while g.3's whole point
is *"so the dashboards become a navigable family, not islands."* **The header must be SHARED or g.3 is
not delivered.** Corrected split:

| module | scope | delivers |
|---|---|---|
| **`shell-header.mjs`** | **SHARED across layouts** | g.1 breadcrumb + g.3 cross-dashboard menu |
| `registry-detail.mjs` | registry-private | Phase e panel (relocate, don't rebuild) |

### Q4 scope — sequenced, on a branch

Branch **`refactor/registry-decompose`** created (not checked out); working tree snapshotted as tag
**`backup/pre-registry-decomp-2026-08-05`** (`5d11e28`) — ⚠ prism had **uncommitted** `registry.mjs` +
`registry-flat.mjs` edits (the `meetsoma/releases` tier change) belonging to another agent; they were
preserved without being committed or disturbed. **Work in a `git worktree`** — do not check the branch
out in place.

1. Extract `registry-detail.mjs` (pane + its handlers) — mechanical, no behaviour change.
2. Extract `shell-header.mjs` as a **shared** module; adopt in `registry.mjs` first, others after.
3. Relocate the pane (Phase e presentation) — kill the `scrollIntoView`.
4. Breadcrumb (g.1) + close/X already exists (g.2 ✅).
5. **Gate: `registry.mjs` back under 600 ln** — the gate that silently failed becomes the acceptance test.

⛔ **Editing (Phase e write) stays out of scope** — R1 ruled: read + copy-patch, writes route through a
live soma session, **no PUT endpoint** in a repo about to go public.

### Q5 scope — build the menu, and make it a PUBLICATION-GATED item

The menu enlarges what must be sanitized: it binds registry ↔ 003 delegation-timeline ↔ 004
soma-manager into one navigable family, and those surfaces render **real internal cycle data**.

**Recommendation (mine, for Curtis):** build it, and **add it to §Publication readiness as blocker #3**
rather than discovering the coupling at publish time. The repo is private today, so the menu costs
nothing *now* — the cost is a sanitization obligation that must be written down while the connection
is fresh.
⚠ **Sanitization scope is already larger than one file:** `cycle-215.md` has HTML/JSON/XML derivatives
**and a copy in a second branch**. A menu that links three dashboards means the audit must cover the
data each renders, not just the example doc.

**Still Curtis's** (his message cut off mid-Q5): build-now-and-gate vs defer-until-sanitized.

---

## ✅ Phase e/g — BUILT and HUMAN-VERIFIED (2026-08-05)

**Branch `refactor/registry-decompose` @ `b7cfb38`** (worktree `personal/prism-wt-decompose`).
`registry.mjs` **961 → 540** · `registry-tree.mjs` 399 · `registry-detail.mjs` 124 ·
**`shell-header.mjs` 263 (SHARED)** · `tests/registry-decompose.test.mjs` 269.

### Curtis's verdict, rendered live and clicked

Previewed side-by-side against the running dashboard via the worktree-under-serve-root technique
(see the arc's §Technique) — **no merge required to review it.**

| ask | verdict |
|---|---|
| **Phase e** — preview opens as its own surface, not a scroll-down under the list | ✅ *"the preview opens and works, with a dragable resize split on page — though it's not exactly how i pictured it, it does work"* |
| **Phase g.2** — close/X dismisses the panel | ✅ *"it closed the pane/preview yes — doesn't change page — that's fine"* |
| overall | ✅ *"so yes it works"* |

🎁 **The draggable resize split was NOT specified** — the child added it. Curtis's "not exactly how I
pictured it" is a note, not a defect; it was accepted as-is.

⚠ **What this verification does NOT cover:** g.1's breadcrumb-to-root and g.3's cross-dashboard menu
were not exercised. The header currently *closes the pane* rather than navigating — which Curtis
accepted for now, but it means **the breadcrumb's "return to root" semantics are still unproven** and
g.3's menu has no data source until a manifest exists (see arc §g.3 — the emitter is out of that pass
by design).

### Known gap at review time, and it is NOT the branch's fault

The preview showed **13 projects** where the live dashboard shows **14** — `meetsoma/releases` did not
appear as its own folder. That is another agent's **uncommitted** `tree_kind` change, which the branch
was cut before. It returns when their two hunks are re-applied
(`registry-tree.mjs:160` and `registry.mjs:93` — mapped, not resolved, by the builder).

### Merge order — unchanged

1. **this branch** (moves the render code)
2. the other agent's `tree_kind` hunks re-applied at the two mapped sites — **blocked on them
   committing**; their work is uncommitted and protected only by tag
   `backup/pre-registry-decomp-2026-08-05` (`5d11e28`)
3. Q14's declared-links renderer half, built directly in `registry-tree.mjs`

### 🔑 The complaint this branch did NOT fix

Curtis's stated main concern was *"flakey to see the changes made to cycles."* **That was never the
layout** — it was a lying `X-Registry-Refreshing` header in `soma-prism-serve.py`, measured and fixed
the same day (arc §Freshness). Recorded here because the two were easy to conflate: *the UI work and
the freshness complaint were independent, and shipping the UI would not have addressed the concern.*

### ✅ MERGED 2026-08-05 — `5469941` (by s01-a134e9, after my defect report)

**Sequencing executed exactly as prescribed**: the `tree_kind` orphan committed first (`7fadb17`),
decomposition rebased onto it (`55cb306`), then merged (`5469941`). **The stash-object orphan is home.**

**My filter defect report was CONFIRMED** — they verified live before fixing: selecting
`meetsoma/releases` emptied the view, exactly as read from source. Fixed the way I argued for and
**not** the way I argued against: **ONE exported `displayProject(r)`** (`registry-tree.mjs:140`)
consumed by the grouped tree, the flat table, the facet list **and every `data-project` /
`data-fproject` attribute** — so `:717`/`:756` compare like-to-like and were left untouched. *No
suffix-aware patches anywhere.* **One derived value, every consumer** — the same shape as §g.3's
derived menu and the flatness predicate.

**Parent-verified independently** [ran: `git log`, `wc -l`, `grep displayProject`, ran the test file]:
merge + rebase commits exist · split is live in the working tree (`registry.mjs` **540**,
`registry-tree` 411, `registry-detail` 124, `shell-header` 263) · `displayProject` exported **once**
and consumed in both modules · the **10 `shell-header` behaviour tests pass**, including both
"branches nobody runs" (ABSENT hidden, EMPTY listed-and-marked).

⚠ **What I could NOT reproduce:** their "21/21 green". The differential test extracts a pre-split
baseline to **`/tmp/prism-old-registry-5469941/`**, which no longer exists, so that half errors on a
missing module. Their run was green at merge time; I am recording that I verified the *behaviour*
tests and the *artifacts*, **not** the differential.
🔑 **A test whose baseline lives in `/tmp` cannot be re-run later** — it is a one-shot that reads as a
standing gate. Durable artifacts never touch `/tmp`; that applies to fixtures too.

**Their live check** (bridge evaluate on :8910): 1250 rows → `meetsoma/releases` = 152 → `meetsoma`
= 140 → reset restores 1250, **14 project folders** — the count I predicted from the 13-vs-14 gap.

⇒ **Q14's grouping affordance is UNBLOCKED** and targets `registry-tree.mjs` on live
`exp/cycles-mechanic`.
