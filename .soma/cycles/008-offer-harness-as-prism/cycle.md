---
type: cycle
n: 008
name: offer-harness-as-prism
status: seeded
created: 2026-08-12
session: s01-93e7ac@meetsoma
opened_by: Curtis — "we should seed a cycle on the prism arc about making this offer harness an extension of the prism system"
decides: whether the offer harness becomes a PRISM surface, or stays a separate tool that borrows from it
relates: [007-offer-documents, 002-registry-dashboard, 005-plugin-packaging, 001-renderer-spike]
---

# Cycle 008 — the offer harness as a PRISM extension

## What exists today (built 2026-08-11, not designed — it accreted)

| artifact | lines | what it does |
|---|---:|---|
| `yoshi/tools/scripts/offer-harness.html` | ~200 | version dropdown from a manifest · N panes · live per-pane contrast readout |
| `offer-versions.mjs` | ~70 | scans a folder, emits `offer-versions.json`, prefers PREVIEW over DRAFT |
| `offer-serve.py` | ~56 | static server, `Cache-Control: no-store` |
| `offer-contrast.mjs` | ~250 | enumerates every text element in all panes, exits 1 on violation, has `--canary` |
| `offer-inline.mjs` | ~80 | resolves `{{inline:img}}` → data URIs, exits 2 on unresolved |

## The case that this is PRISM, not a sibling

**PRISM's README:** *"Projected Representations from Inscribed Source Markup — documents that render
as human-visual artifacts AND machine-structured data, from one source."* The harness is exactly a
**projection viewer with a machine-checkable projection attached** — the contrast enumerator is the
"machine-structured data" half, and it already exits non-zero, which is more than the cycle
dashboard's projection does.

⇒ **Two viewers over two corpora, built independently, converging on the same shape.** `007` argues
offers should become an inscribed source; this cycle asks whether the *viewer* should be a PRISM
surface too.

## The evidence FOR consolidating, gathered the hard way

- **`NoCacheHandler` was written twice, same day, same author, two repos** (`soma-prism-serve.py`
  and `offer-serve.py`) — neither knew the other existed. `dashboard-ui`'s finding.
- Both viewers hit the **identical** class of bug: stale artefact served to a human who believes
  they are reviewing current output. PRISM solved it with `X-Registry-Refreshing`; the harness
  solved it with `no-store` and a manifest stamp. **Same problem, two solutions, neither shared.**
- Both needed **version/variant selection**; the harness grew a dropdown, the registry grew filters.

### 🆕 New evidence FOR, 2026-08-12: the bespoke server lied about its own state

The offer dashboard 404'd everything and **nothing was broken** — not a file, not a reference.
`deliverables/` moved from `clients/` to `internal/` (tenant-topology work), and a server started the
previous evening had resolved its directory to an **absolute path string at startup**.

🔑 **`lsof` showed the process's cwd following the inode to the NEW path — so it looked healthy while
serving nothing.** Every static check passed: the harness is self-contained, `offer-serve.py` takes a
directory argument and hardcodes nothing, `offer-versions.json` was present. **Only driving the real
surface found it.** Fix was kill-and-restart.

⇒ **A long-running bespoke server is a second source of truth about where files are, and it goes
stale silently.** PRISM resolves per request; there is no startup-time path to rot. **This is the
strongest argument in this cycle that is not about code duplication** — it is about a whole class of
failure disappearing.

⚠ **Make it an acceptance gate, because it is cheap and it falsifies the whole premise:**
**move the artifact directory, reload the dashboard, it must still resolve.** If the PRISM version
fails that, consolidating bought nothing.

🔗 Sibling need: **cycle 78's RST-D2 dashboard** (restaurant, Curtis's stated priority loop-breaker).
**One dashboard system should serve both** rather than each growing its own server — which is exactly
how this one accreted.

## The evidence AGAINST, which is not weak

- `soma-prism-serve.py` is **341 lines and bound to the cycle-registry corpus by name** — it
  self-checks for `_browser/index.html` + `registry.json` at startup. `offer-serve.py` is 56 lines
  and generic. **Merging the servers would drag corpus-specific staleness logic into a static
  server that does not need it.**
- `dashboard-ui`'s verdict, unprompted: *"Not duplicates… **should not merge.** The one real
  duplication is the ~15-line `NoCacheHandler`."*

## The question this cycle actually decides

**Not "merge the servers" — that is already answered no.** It decides whether **the VIEWER is a
PRISM surface**: does PRISM own the pattern *"pick an artifact version → render it → run a
machine-checkable projection over it → show the verdict inline"*, with cycles and offers as two
corpora plugged into it?

If yes, `005-plugin-packaging` is the mechanism and the harness is its second consumer.
If no, the honest outcome is **factor the 15 shared lines and stop there.**

## What NOT to do

⛔ **Do not build a dashboard because the dashboard exists** (carried from `007`). The offer corpus
is ~2 documents per client. A browsing UI over 2 items is overhead; the *projection* (contrast gate,
quote gate) is the part that earns its keep, and it already runs headless from the CLI.

## Open

1. Is the PRISM surface the *viewer*, or only the *source format*? `007` claims the format; this
   claims the viewer. They can be decided independently.
2. `offer-contrast.mjs` is a projection with a verdict. Does the cycle dashboard want one — a
   machine-checkable assertion per cycle, exiting non-zero? That may be the more valuable direction
   than sharing a viewer.
3. Smallest useful step regardless of the ruling: extract `NoCacheHandler` into one shared module.
