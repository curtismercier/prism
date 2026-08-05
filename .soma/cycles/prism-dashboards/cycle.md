---
type: arc
name: prism-dashboards
status: active
created: 2026-08-05
updated: 2026-08-05
session: s01-6d4d53
arc: prism-dashboards
description: "The PRISM dashboard family — every rendering surface for the cycle corpus and beyond. Renderer (001) → Cycle Registry (002) → Delegation timeline (003) → Soma manager (004). One arc so the dashboard shows them as a collapsible folder, not four flat singleton leaves."
tags: [prism, dashboards, registry, renderer, navigation]
seams: [../001-renderer-spike/cycle.md, ../002-registry-dashboard/cycle.md, ../003-delegation-timeline/cycle.md, ../004-soma-manager/cycle.md]
---

# prism-dashboards — the dashboard family as one arc

## Why this arc exists (s01-6d4d53, Curtis's observation)

Curtis noticed the prism cycles render **flat** — no collapsible folder under the project. Cause,
measured: **all four cycles have NO `arc:` declaration**, so each renders as a singleton leaf
(per the renderer's rule: *a singleton is NOT an arc — render it as a leaf*).

They ARE a family — four surfaces of one system:

| member | surface |
|---|---|
| `001-renderer-spike` | the renderer itself — how any artifact becomes a page |
| `002-registry-dashboard` | the Cycle Registry (list → dashboard, preview/editor, nav) |
| `003-delegation-timeline` | delegation × git timeline |
| `004-soma-manager` | settings/body/state across all .somas |

⇒ **One arc, four members, one collapsible folder.** Membership is `arc: prism-dashboards` in each
cycle's frontmatter — no file moves, the renderer groups on the declaration.

## Cross-project relations (do NOT move, link)

`related prism` surfaced two meetsoma cycles that are ABOUT the dashboard but live in meetsoma's
trees. They stay where they are (their arcs own them); this arc links OUT:

- `meetsoma/.soma/cycles/_meta/cycle-system/04-prism-cycle-browser` — the in-repo browser, ancestor of 002.
- `meetsoma/.soma/releases/cycles/cycle-dashboard-plugin` — the distribution/plugin story (P5 skill-fold).

**These are distribution/ancestry relations, not members.** Moving them into prism would break their
meetsoma-arc membership for a cosmetic gain.

---

## 📇 Cross-project index — prism-adjacent cycles (Curtis, s01-6d4d53)

**These stay in their own trees** (they serve their arcs' scope), but the prism-dashboards arc is the
navigation point that names them — so a reader here finds every prism-related cycle, wherever it lives.

| cycle | tree | why it's here, why it stays |
|---|---|---|
| `cycle-dashboard-plugin` | `meetsoma/.soma/releases/cycles` | **shipping w/ soma** — the distribution/plugin story (P5 skill-fold). Stays: it's a release concern (Curtis's call). |
| `_meta/cycle-system/04-prism-cycle-browser` | `meetsoma/.soma/cycles` | the in-repo browser — 002's ancestor. Stays: meetsoma's internal arc owns it. |
| `002-registry-dashboard` | `personal/prism` | **member** — the Cycle Registry |
| `003-delegation-timeline` | `personal/prism` | **member** — delegation × git |
| `004-soma-manager` | `personal/prism` | **member** — settings/body/state |
| `001-renderer-spike` | `personal/prism` | **member** — the renderer |

**Rule: members are in `personal/prism`; adjacent cycles are LINKED, never moved.** A cycle that is
*about shipping* (cycle-dashboard-plugin) or *ancestry* (04-browser) keeps its owning arc's
membership — this file is where the family is seen whole.

---

## §g.3 — the importable cross-dashboard menu (design; Curtis handed me the lead, 2026-08-05)

> Curtis: *"the way i pictured it was to have it as an importable menu — and some clever way to only
> show what is available or used (some dashboards may not be used) — an idea that i'm not too sure
> about, your call, you lead."*

**Placed in the ARC, not in `002`**, because a shared menu is a family-level concern that touches all
four cycles. `002` §Phase g owns the *registry's* breadcrumb; this owns the *federation*.

### The shape: `shell-header.mjs`, importable, deriving its entries

One shared module any layout imports — **not** a registry-private header. (Scoping evidence in
`002` §Q4/Q5: every layout renders its own chrome today and `registry.mjs` has none, so a
registry-local header cannot federate anything.)

### 🔴 The entry list must be DERIVED, never hand-written

A hardcoded list of dashboards is **exactly the defect class this estate spent today fixing**: a
hand-maintained enumeration bound to no traversal, which drifts silently. `REGISTRY.md` sat 4 days
stale for precisely this reason. **A hardcoded menu would go stale the first time a dashboard is
added or renamed, and nothing would fail.**

⇒ **Dashboards self-declare; the scanner projects a manifest; the menu imports it.**

- each dashboard document declares itself in frontmatter (`dashboard: true`, `label:`, `order?:`)
- the existing scanner emits a small **`dashboards.json`** beside `registry.json` — preserving the
  established **"ONE SOURCE, TWO PROJECTIONS"** property (`cmd_json`'s own comment: *if the counts
  ever disagree, the cause is two code paths and the fix is to delete one*)
- `shell-header.mjs` renders from that manifest, so **adding a dashboard is a frontmatter edit, not
  a menu edit**

### 🔑 My call on "only show what is available or used" — AVAILABILITY hides, USAGE never does

Curtis's instinct is right on *available* and I am deliberately splitting it from *used*:

| signal | meaning | behaviour |
|---|---|---|
| **available** | the manifest lists it — its source document exists and declares itself | **hide when absent.** Safe: absence is a fact about the world |
| **used** | visited before / has data | **sort or de-emphasize. NEVER hide.** |

**Why usage must not hide:** hiding-by-unused is **self-reinforcing**. A dashboard that is never
shown is never visited, so it is never "used", so it is never shown. **The menu becomes incapable of
surfacing anything new — a filter that can only ever shrink.** That is the same shape as a check that
cannot fail: it looks like tidiness and is actually a one-way ratchet, and it would silently bury
`003`/`004` precisely because they are the newest.

**Empty ≠ absent.** A dashboard whose data source is empty (e.g. `003` with no `children.json`)
should render **listed but marked empty**, not vanish — "nothing here yet" is navigational
information; silence is not. *(Precedent: cycle 2's ruling that absence is a first-class state and
components render nothing rather than stubs — same principle, opposite surface.)*

### 🎁 This makes the publication problem SMALLER, not larger

`002` §Q4/Q5 flagged that a cross-dashboard menu enlarges the surface to sanitize before this repo
goes public. **A derived menu inverts that:** internal dashboard names and labels live in
**generated data** (`dashboards.json`, gitignorable / environment-local), not in committed source. A
hardcoded menu would bake internal surface names **into the public repo permanently**.

⇒ **Derivation is the sanitization strategy**, not merely an elegance preference. The publication
blocker becomes "ensure the manifest is not committed with internal entries", which is a
`.gitignore` + generation question rather than a source-scrubbing question.

### Acceptance

- Adding a new dashboard requires **zero edits to `shell-header.mjs`**.
- A dashboard whose source is absent disappears from the menu; one whose *data* is empty still
  appears, marked empty.
- No internal dashboard label appears in committed source.
- ⚠ **What would make a ✓ a lie:** testing only with all dashboards present and populated. **The gate
  must include an absent one AND an empty one** — those are the two branches that matter, and they
  are the two nobody runs.

---

## §Architecture — "why is there a registry.json at all?" (Curtis, 2026-08-05)

> Curtis: *"if the file/folder structure and frontmatter matches what we're displaying, why is there
> even the necessity for the registry.json? … if the prism dashboard sits as a plugin at
> `~/.soma/plugins/prism-dashboard`, couldn't the mjs load dynamically from all `.soma`s down the
> filesystem — we might even have a registration or a system to walk the path already. Then it could
> be 10x simpler, no?"*

**The core claim is RIGHT: `registry.json` does not need to exist as a persisted FILE.** Two of the
three premises check out exactly; one constraint reshapes the answer without killing it.

### ✅ Premise 1 — the walker already exists, and it is auto-discovering

`discover()` in `soma-cycles-registry.py` is `os.walk(ROOT)` matching `*/.soma/cycles`. Its own
docstring: *"Every `*/.soma/cycles` under ROOT. Auto — omission cannot hide a tree."*
⇒ **There is no registration list to maintain, and that is deliberate and better** — a config list can
omit a tree silently; a walk cannot.
⚠ There is **no** projects/roots registry in `~/.soma/config.json` (checked: only install metadata).
The walk *is* the registration.

### ✅ Premise 2 — the plugin home exists

`~/.soma/plugins/` is real and populated (`ai-gateway`, `checklist`, `faq`, `keybinds`, `nexus-os`,
`presets`, `sessions`, …). **A `prism-dashboard` plugin is architecturally available today.**

### 🔴 The constraint — a browser cannot walk a filesystem

`registry.mjs` runs **client-side**. `:191` is `fetch(src, {cache:'no-store'})` and `:197` is its own
error text: *"Browsers block `file://` fetches. Serve it:"*.

⇒ **The `.mjs` can never walk `~/Gravicity` itself.** Something server-side must scan and hand it
data. **That is the actual reason `registry.json` exists** — not caching, not preference: the
FS/browser boundary.

### ⇒ The right form of the idea: keep the PROJECTION, drop the PERSISTENCE

**The JSON becomes a RESPONSE, not an artifact.** The plugin serves `/registry.json` by scanning on
request (in-memory cached, background-refreshed). Nothing is written to disk, nothing can go stale,
nothing needs regenerating.

**What that deletes outright:**
- `registry.json` + `REGISTRY.md` as committed artifacts
- the self-heal / staleness-detection logic
- 🔑 **the entire "who regenerates it?" problem** — which is not hypothetical: `REGISTRY.md` sat
  **4 days stale** through a 21-cycle migration today, and a verifier had *correctly* ruled it "not a
  defect, regenerates on next run" — which is exactly how it rotted, because *next run* named no run.
  **This design does not mitigate that failure; it makes it unrepresentable.**
- one of two projections to keep in sync (`cmd_registry` and `cmd_json` both call `scan()` — that
  "ONE SOURCE, TWO PROJECTIONS" invariant stops needing to be defended)

**What it does NOT delete — and why "10x" is optimistic:**
- `discover()` + `scan()` + the YAML parse. **That is the bulk of the logic and it stays.** Measured:
  ~7.6s lazy / ~10s eager across 624 cycles, dominated by parsing, not by git.
- the server. The FS/browser boundary is not removable, only relocatable.

⇒ Honest sizing: **~30–40% less machinery, and 100% of the rot.** The prize is the rot, not the LOC.

### ⚠ The one real cost — and it is checkable, not hypothetical

`REGISTRY.md` has **49 documentation references and 0 code consumers**. Dropping the file breaks 49
pointers. **Either keep emitting the `.md` from the same in-memory scan (cheap, keeps the human-readable
mirror) or repoint 49 docs — do not discover this at cutover.**

### 🎁 It also shrinks the publication problem

prism is being prepared to go public. **A committed `registry.json` is a snapshot of internal cycle
names, statuses and paths; a served one is not committed at all.** Same argument as §g.3's derived
menu: **derivation is the sanitization strategy.** Two independent design pressures now point the
same way, which is the strongest signal available that the direction is right.

### Sequencing

**After** the current decomposition (`refactor/registry-decompose`). That work extracts
`shell-header.mjs` + `registry-detail.mjs`; this changes where data comes from. Doing both at once
would make a regression impossible to attribute.

---

## §Technique — preview a BRANCH of the dashboard side-by-side, without merging (s01-7ca9ab, 2026-08-05)

**Problem it solves:** a browser-rendered dashboard cannot be reviewed from a diff. The
decomposition branch (`refactor/registry-decompose` @ `b7cfb38`) passed every gate its builder
wrote — and **nobody had seen it render.** Merging to find out is the expensive order.

**The trick:** `soma-prism-serve.py` serves a ROOT (`~/Gravicity`). A `git worktree` placed under
that root is **already reachable by the running server** — no second server, no config, no merge.

```bash
# 1. worktree under the serve root (the builder already did this)
git -C personal/prism worktree add ../prism-wt-decompose refactor/registry-decompose

# 2. clone the entry page, repoint it at the worktree's renderer, bump the cache-buster
cd meetsoma/.soma/cycles
sed -e 's|/personal/prism/branches|/personal/prism-wt-decompose/branches|g' \
    -e 's|?v=registry-39|?v=decompose-b7cfb38|g' index.html > index-decompose.html

# 3. both URLs live on the SAME running server
#    current  http://localhost:8910/meetsoma/.soma/cycles/
#    branch   http://localhost:8910/meetsoma/.soma/cycles/index-decompose.html
```

**Why it works:** `index.html` holds **no content by design** — it points at four things
(`registry.json`, `registry.md`, the layout `.mjs`, and each cycle's own layout). Only the third is
branch-specific, so swapping one absolute path swaps the entire renderer while both pages read the
**same live data**. That is the honest comparison: same corpus, different code.

⚠ **The `?v=` cache-buster is mandatory, not cosmetic.** `index.html`'s own comment records that
browsers cache ES modules hard enough that an edited layout is silently not picked up — *"cost a
false 'dispatch is broken'"*. **Two pages loading two versions of the same module path is exactly the
case that bites.** Bump it to the branch sha.

🔑 **Generalises past prism:** any tool that serves a filesystem root can preview a branch by putting
a worktree under that root. **The reviewable unit becomes a URL, not a diff** — which is the only
form in which a UI change can actually be judged.

**Cleanup:** `index-decompose.html` is disposable — delete it after review, or keep it as the
standing preview slot and re-point the `sed` at the next branch.

---

## §Freshness — the "flakey to see cycle changes" bug, root-caused and fixed (2026-08-05, s01-7ca9ab)

> Curtis, after verifying the decomposed layout works: *"my main concern is about the overall
> improvement of the script and the way it loads the folder/cycles — the other was flakey to see the
> changes made to cycles."*

**It was never the layout. It was one boolean in the server.**

### Measured, not theorised

`touch`ed a `cycle.md`, then polled `_browser/registry.json`:

| t | `X-Registry-Refreshing` | reality |
|---|---|---|
| 2s | **1** | correct — staleness detected, regen kicked, client schedules a re-poll |
| **8s** | **0** | 🔴 **LIE** — the regen was still running |
| 13s | — | regen completes, new `generated_at` written |
| 15s | 0 | fresh data served — **but the client stopped asking at t=8** |

### The cause

`soma-prism-serve.py:refresh_if_stale()` had a one-at-a-time guard that `return False` when a regen
was **already in flight**. Its only consumer is `self._refreshing`, which sets the
`X-Registry-Refreshing` header. So for the whole ~8s regeneration window every poll was told
*"you are up to date"*. `registry.mjs:909` reads that header to decide whether to re-poll — so it
concluded it was current and stopped. **The fresh snapshot then landed with nobody listening, and the
page showed stale cycles until a manual reload.**

The code's own comment states the intent — *"serving stale-now and fresh-on-the-next-poll is strictly
better"* — and it was right. **The false negative cancelled the next poll, so there was no next poll.**

### 🔑 The generalisable error

**A busy-guard's return value is a fact about the GUARD. The caller read it as a fact about the WORLD.**
`return False` truthfully meant *"I did not start a thread"*; the header needed *"is what you hold
known-stale?"* Two different questions, one boolean.

Same shape as every other false signal in this estate: `agent.list`'s cost column, the `⚠ no grouping`
warning on a fully-grouped tree, `validate` vs `flat` disagreeing on flatness. **The signal was true
about its mechanism and false about its subject** — which is exactly why nobody caught it by reading
the code. It took touching a file and watching the header.

**Fix:** `return True` — "a refresh is in flight, keep polling" — with the measurement written into
the comment so the next reader sees the evidence, not the assertion.

### ⚠ This is the argument for the plugin packaging

The bug lives in a **protocol split across two repos**: the server sets a header in
`meetsoma/.soma/amps/scripts/`, the client consumes it in `personal/prism/branches/`. **Neither half
is wrong on its own reading.** Nobody owns the contract because nobody holds both files.

⇒ §Architecture's plugin proposal (`~/.soma/plugins/prism-dashboard` carrying `soma-prism-serve.py`
**plus** the layouts) is not tidiness — **it is what would have made this bug visible.** The same
discoverability failure that hid a running server from two agents hid a two-file protocol from its
own authors.

### Not live yet

The serving process has held **Aug-3 code** throughout; neither this fix nor the `REGISTRY.md`
co-regeneration is running. Restart required — deliberately left to Curtis, it is a live service.
