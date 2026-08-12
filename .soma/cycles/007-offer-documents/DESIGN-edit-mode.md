---
type: task
status: proposed
created: 2026-08-12
session: s01-b75f40@meetsoma
parent: 007-offer-documents
goal: answer whether cycle-dashboard and offer-harness edit modes are one mechanism, and design the smallest safe write path
---

# Edit mode — design + review

> ✅ **THE CYCLE-DASHBOARD HALF IS IMPLEMENTED — verified live 2026-08-12 (`s01-5390f1`).**
> This doc still said "read-only, not implemented" and *"neither has a `do_POST`… zero hits"*.
> Both were true when written and are not now. **I nearly rebuilt it from this doc.**
>
> `skills/prism/scripts/soma-prism-serve.py` ships `do_PUT /_write`, gated by `WRITE_ENABLED`
> (`--write` / `PRISM_WRITE=1`), with `/_write` GET as the capability probe.
>
> **Driven, not read** — temp root, real server, four probes:
>
> | probe | result |
> |---|---|
> | `GET /_write` capability | `write: true` |
> | real section edit | `200 ok` — and the byte landed on disk |
> | **stale re-edit** (same `expected`, now absent) | **409** |
> | **path escape** `../../../etc/hosts` | **403** |
>
> Concurrency is **content-based** (`expected`/`replacement`), not the `expectedMtime` this doc
> proposed — a better choice: it survives a touch that changes no content.
>
> 🔑 **The lesson is about this doc, not the server.** A design doc that states the state of the
> world is a MEASUREMENT with a timestamp, and it rots exactly like any other. *"Grepped both
> files, zero hits"* was true and is now false, and nothing marked it. **A design's premises need
> re-probing before you build on them — including when the design is your own team's, and recent.**
>
> ⚠ Still open: `soma-prism-serve.py --help` crashes (`int('--help')`) — arg parsing assumes argv[0]
> is the port. And the startup self-check refuses any ROOT without the dashboard; the escape
> (`PRISM_SERVE_SKIP_SELFCHECK=1`) is printed in the error, which is why it cost nothing.
>
> 🟢 **AND THE OTHER HALF IS UNBLOCKED TOO — §"What I would not build" item 3 is now VOID.**
> *"Not offer-harness edit mode yet — there is no persisted source to write to"* was the correct
> call **when written**. `build_offer.js` now accepts a config **PATH** (`yoshi@4f56598`; verified
> at source, `:124` — inline still works, `{` vs path). There IS a persisted source.
>
> **How it got fixed is the part worth keeping:** this doc's blocker was passed forward as a block
> message, `s01-dd1dfa` handed it to their successor, and `s01-4c1557` shipped it mid-session —
> *"unblocks a peer's prism edit mode"*, with a differential (inline vs path → byte-identical HTML)
> and a real-file reproduction. **The peer relay worked exactly as designed.**
>
> 🔴 **What did NOT work was me.** I re-read this doc, treated its premises as current, wrote
> "BLOCKED" into cycle 007, and sent a peer a letter about a blocker they had already closed —
> hours late. I probed prism's server and found it built; I did **not** apply the same probe to
> `build_offer.js` and assumed it unchanged. **Inconsistent rigor inside one investigation is
> worse than none: the half I checked made me trust the half I did not.**

Verified live, this session: `:8910` = `python3 skills/prism/scripts/soma-prism-serve.py 8910 /Users/user/Gravicity`
(pid 59118) · `:8899` = `python3 offer-serve.py . --port 8899` (pid 76877,
`yoshi-platform/yoshi/tools/scripts/`).
<!-- PATH REPAIRED s01-5390f1: read `project-b/...`, which resolves to nothing. Collateral from my
     `git filter-repo --replace-text` pass on this repo — it reports "Rewrote the stash", and I had
     stashed with `-u`, so an UNTRACKED design doc was rewritten too.
     🔑 A history rewrite's blast radius includes the STASH, and therefore untracked files that were
     never part of the history you meant to change. Nothing warns you. -->
Both `curl` 200. Neither has a `do_POST`/`BaseHTTPRequestHandler` write path — grepped both files and
the rest of `yoshi/tools/scripts` + `prism/branches/cdn-renderer`, zero hits.

## Q1 — same server?

No. 341 lines vs 56. Overlap is exactly one idiom: `NoCacheHandler(SimpleHTTPRequestHandler)` +
`Cache-Control: no-store` on every response, because browsers heuristically cache static assets and a
rebuilt/re-edited doc silently keeps serving stale. Both were written to kill that. Everything else diverges:

| | `soma-prism-serve.py` (341 ln) | `offer-serve.py` (56 ln) |
|---|---|---|
| root | hardcoded self-check against `meetsoma/.soma/cycles/_browser/{index.html,registry.json}` at startup | generic — serves whatever dir you pass |
| beyond static files | yes: watches `**/cycle.md` mtimes, regenerates `registry.json`+`REGISTRY.md` in a background thread when stale, signals staleness via `X-Registry-Refreshing` header | no — plain static, no derived state |
| write path | none | none |
| reusable elsewhere | no — bound to the cycle-registry corpus by name | yes — already just `directory, port` |

Not duplicates: one is a generic reusable no-cache static server, the other is that same idiom plus a
project-specific staleness-and-regen engine bolted on. **Should not merge.** The one real duplication is
the ~15-line `NoCacheHandler` class itself, written twice, same day, same author, two repos. Worth factoring
into one shared `nocache_server.py` both import — small, safe, not urgent, not part of this design.

## Q2 — the corpora are not the same shape (the crux)

**Cycle dashboard:** markdown → `cdn-renderer/parsers/md.mjs` (`parsePrism`) → `Map<section, content>` in
the BROWSER → `layouts/cycle.mjs` renders each section into `<section id="section-<name>" data-section="<name>">`
(verified `cycle.mjs:185-188`). The DOM is already section-addressable — no new read mechanism needed, the
client already holds the raw markdown for the clicked section in memory from parsing it.

**Offer harness:** `build_offer.js` (576 ln) takes one JSON object as a **CLI argv string** — not a
persisted file. Checked `truecoat-painting/deliverables/.../sources/`: an HTML snapshot and a markdown
BRIEF, no `config.json`. The prose Curtis means (`performance.caveat`, `need[].why`) exists only inside
that ephemeral argv, already flattened into markup with **no `data-*` trace back to the field that produced
it** by the time `offer-harness.html` serves it. There is nothing on disk in the deliverable folder to
write a paragraph edit back to — the generated HTML is the only artifact, and it is `git`-un-tracked-source,
regenerated wholesale on the next run.

So "edit the markdown" is two different claims:
- **cycle** = edit an existing, persisted, section-anchored source. Mechanism exists end-to-end minus a write endpoint.
- **offer** = there is no source to edit yet. cycle-007 already proposes making one (`<fixed>`, `<price>`,
  `<tier>`, `<proof>` anchors) — that phase is a **prerequisite**, not parallel work.

**Can one mechanism serve both?** The *UI* mechanism yes (click → identify section → inline editor → PATCH
same-origin). The *write target* does not exist for offers today. Building offer edit-mode now means either
(a) editing generated HTML directly — the exact anti-pattern cycle-007 calls out, overwritten on next build —
or (b) waiting on cycle-007 turning the offer config into an Inscribed Source. Do not paper over this: (a) is
wrong, (b) is not built. Recommend (b), sequenced after this design, not alongside it.

## Q3 — does the spec already answer this?

Partially, and it says so itself. §2.6/§6.1-6.2 define `read-section`/`edit-section` as the primitive, and
`branches/build-renderer/bin/prism.mjs` **already implements `edit`** (`cmdEdit`, line 140: splices content
between `<!-- @section: X -->` anchors, `writeFileSync`). That part is built, tested-shaped, real.

But §11 "Known gaps" lists, verbatim: *"Bidirectional Edits (when a Projection is edited and changes flow
back to Source — out of scope for v0.1, may be revisited)."* That is precisely "click the rendered page,
write the source" — the spec's own author deferred it. So: the **file-level** primitive (edit a section by
name, given the file) is built. The **projection-level** loop (click in the browser → write to source) is
explicitly not in v0.1, and it is not built.

The actual gap is narrower than "spec vs code" — it is **cdn-renderer vs build-renderer**. These are the
two rival branches of cycle 001, developed in parallel per the branching-cycle methodology. cdn-renderer is
what's live at `:8910` (fetch + render, read-only, browser-side). build-renderer has the write CLI. Nothing
connects them — they're two implementations of one spec that never talk to each other. Wiring cdn-renderer's
click target to build-renderer's `cmdEdit` (or an equivalent inline in the server) *is* the v0.2 bidirectional-edit
work the spec flagged and didn't design.

## Recommended design — smallest first step

**Scope: cycle dashboard only.** Offer harness is blocked on cycle-007 turning the offer config into a
persisted source (open question in that cycle, unresolved — flag it there, don't decide it here).

1. **Write endpoint, `soma-prism-serve.py` only** (not offer-serve.py — it has nothing to write to).
   `do_PATCH` (or POST to keep it curl-friendly): body `{path, section, content, expectedMtime}`.
   - Confine: `os.path.realpath(join(ROOT, path))` must `startswith(realpath(ROOT))` — no traversal.
   - Confine further: path must already exist, must end `.md`, and the file must already contain a
     `type:` frontmatter key the server recognizes (cycle/decision/task/briefing) — refuses to become a
     generic file-write endpoint by construction.
   - Reuse the exact splice logic from `build-renderer/bin/prism.mjs::cmdEdit` rather than a third
     reimplementation of anchor-splicing — either shell out to it or port the ~12 lines in.
   - **Concurrency guard**: read `os.path.getmtime()` at open, compare to `expectedMtime` from the request;
     mismatch → `409`, do not write. This is the direct answer to "another agent may be editing this file" —
     the collision this estate hit three times today. Client re-fetches, shows a conflict, does not silently
     clobber.
   - `127.0.0.1` only — the server already binds there; keep it that way, no override flag for this endpoint.

2. **Client**, new small module in `cdn-renderer` (plain `.mjs`, no build step, no framework — matches the
   existing constraint): a pencil affordance on `[data-section]` elements already in the DOM. Click → swap
   that section's rendered HTML for a `<textarea>` prefilled from the **raw markdown already in memory**
   (`sections.get(name)` from the parse that produced the page — no new read endpoint needed). Save → PATCH
   with the section's current `content-length`/mtime captured at page-load-or-last-refresh. On success,
   re-render from the response (or refetch, the server is already no-store).

3. **Granularity: whole section, not paragraph.** The spec's addressable unit is the named section; nesting
   (`phases.phase-1`) already exists for finer control (§3.3). If Curtis wants paragraph-level clicking,
   the answer is "author narrower nested anchors in the source," not a second, finer-grained editing UI —
   that keeps exactly one edit primitive in the system instead of two.

## ✅ SPEC — offer edit mode, now that the prerequisite shipped (s01-5390f1)

Written so the next agent does not re-derive it. **Probed, not assumed:** `offer-config-v9.json`
exists with the prose fields this doc names (`performance`, `need`) as real top-level keys;
`offer-serve.py` is still 56 lines with no write path.

🔴 **IT IS A CROSS-LANE FEATURE, AND THAT IS WHY IT WILL STALL IF NOBODY SAYS SO.**

| piece | lives in | lane |
|---|---|---|
| the editing PATTERN (PUT + optimistic concurrency + containment) | `soma-prism-serve.py`, already built | prism |
| the SURFACE being edited (`offer-serve.py`, the config) | `yoshi-platform` | yoshi (`4c1557`) |

⇒ **Do not port the pattern by copying it.** That is a third implementation of a write path, and
this estate has already paid for two copies of one contract today. Either `offer-serve.py` imports
the shared handler, or the offer dir is served BY `soma-prism-serve.py`. **Deciding which is the
first task, and it is a lane question before it is a technical one.**

### What differs from the cycle-dashboard case — the whole design delta

**The edit target is the CONFIG, not the rendered document.** Prism edits a markdown SECTION in
place. Here the artifact is generated, so:

1. **Edit `offer-config-v9.json` field, then REBUILD.** `build_offer.js <config-path>` regenerates
   the HTML. Never edit the HTML — that is the defect cycle 007 exists to remove.
2. **Addressing is a JSON path** (`performance.caveat`, `need[2].why`), not a section anchor. The
   rendered markup has **no `data-*` trace back to the field**, so click-to-edit needs the
   generator to emit one — that is a `build_offer.js` change, in yoshi's lane, and it is the
   largest single unknown here.
3. **Concurrency: reuse `expected`/`replacement` on the FIELD VALUE**, not mtime — same reason it
   was right for prism: it survives a touch that changes no content.
4. **The rebuild is the risky half, not the write.** A bad config write is one field; a rebuild
   overwrites a client-facing deliverable. ⚠ `proposal-v9-DRAFT.html` is COMMITTED and
   byte-reproducible from the config (`s01-4c1557` verified) — **that reproduction IS the gate**:
   rebuild must be byte-identical before any edit is accepted as safe.

### Acceptance (pre-registered)

| # | gate | pass |
|---|---|---|
| G1 | rebuild from unedited config | byte-identical to the committed HTML |
| G2 | edit one field → rebuild | exactly that field's text changes in the HTML |
| G3 | stale `expected` | 409, config untouched |
| G4 | write outside the config path | 403 |
| G5 | **generator emits `data-field` for edited prose** | click maps to a JSON path — else there is no edit MODE, only an edit API |

**G5 is the one that decides whether this is a feature or a curl recipe.**

## What I would not build

- **Not** a shared server merge (Q1) — real divergent purpose, only the cache-defeat idiom overlaps, and
  that's a low-priority factor-out, not part of this feature.
- **Not** a generic "any DOM element is editable" reverse-map from rendered HTML back to markdown — lossy
  and fragile. Always edit the raw section text already held in memory, never try to serialize rendered
  HTML back into Markdown.
- **Not** offer-harness edit mode yet — there is no persisted source to write to; building it now means
  editing generated output, which cycle-007 already names as the bug this whole effort exists to fix.
- **Not** a locking/CRDT service. One `expectedMtime` optimistic-concurrency check is proportionate for a
  localhost dev tool with one human and occasional agents; a 409-and-refetch is enough.
- **Not** extending the write endpoint to arbitrary files or arbitrary extensions — scored to `.md` files
  with a recognized PRISM `type:` only, on purpose, so the endpoint cannot become a general filesystem
  write primitive by accident.
