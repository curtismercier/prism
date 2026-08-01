---
type: content
name: state
status: active
created: 2026-04-27
updated: 2026-06-02
soma_template_version: 0.29.0
description: Living architecture state — versions, services, tools, known bugs
lazy: true
---

# State

> **Living document.** Update when versions ship, cycles advance, or bugs accumulate. The next session reads this to ground itself in current reality.

## Versions

| Component | Version | Status |
|-----------|---------|--------|
| PRISM spec | v0.1 | published (`spec/README.md`), draft status |
| PRISM repo | tag `v0.1.1` | shipped 2026-05-14 — non-cycle narrow-column fix |
| build-renderer (Branch A) | `package.json` says `0.0.0` | **drift** — git tag is the real release marker |
| cdn-renderer (Branch B) | unversioned | active, no release |
| Node | >=22 required (`engines`) | pnpm lockfile present |
| `marked` | ^13.0.0 | only runtime dep of Branch A |

## Branches

| Branch | Purpose | Last synced |
|--------|---------|-------------|
| `main` | the only branch; production + development | 2026-05-14 (`3f4d6d2`) |

`branches/build-renderer` and `branches/cdn-renderer` are **directories**, not git branches — rival implementations coexisting on `main` by design (branching-cycle methodology).

## Services

| Service | Where | Port / URL | Status |
|---------|-------|------------|--------|
| cdn-renderer static server | local, ad-hoc | `python3 -m http.server` (8901 used in Phase 4 audit) | started per-session, not persistent |
| jsDelivr CDN delivery | planned for Branch B | — | not yet published |

## Tools & Scripts

| Tool | Location | Notes |
|------|----------|-------|
| `prism` CLI | `branches/build-renderer/bin/prism.mjs` | subcommands: `render` · `read` · `append` · `edit` · `validate`. Single `switch` dispatch. |
| `<soma-artifact>` | `branches/cdn-renderer/render.mjs` | custom element; `parsers/md.mjs`, `layouts/cycle.mjs`, `layouts/default.mjs` |
| shared fixtures | `examples/` | `cycle-215.md` (type=cycle), `decision-example.md` (type=decision) — both branches must render both |

## Cycles

| Cycle | Status | Blocking |
|-------|--------|----------|
| 001-renderer-spike | **in-progress** — Phases 0–5 shipped (SIB-7). Phase 5 resolved **synthesize**: B for human viewing, A for JSON/XML projections; they were already one system (A copies B's stylesheet). Reports in `.soma/cycles/001-renderer-spike/phase-4/` | Only Phase 6 remains — `prism-authoring` SKILL.md, now unblocked. Then v0.2 framing |

## Open Issues

| # | What | Priority |
|---|------|----------|
| 2 | CI workflow — `validate` + render snapshots | high — would have caught the v0.1.1 bug at first render |
| 3 | `styles.css` copy-only-if-not-present foot-gun in build-renderer | medium |
| 4 | spec §7.1 note on type-specific layouts | low |
| — | spec §3.4 Edge Cases: anchor escaping in prose (unfiled) | low, but hit twice while authoring |
| — | issue label taxonomy (`type:`/`priority:`/`scope:`) never designed | low, ~30 min |

## Known Bugs / Risks

1. ~~cdn-renderer non-cycle layout~~ — **RESOLVED, absent.** The fix lives in Branch B's stylesheet and is load-bearing: deleting the two `:has()` rules from the live sheet collapsed `.cycle-main` from 1080px to 200px instantly. Measured, not assumed.
2. **`:has()` has no fallback** — the layout fix depends entirely on `:has()`. On Chrome <105 / Safari <15.4 / Firefox <121 the selector is invalid, the rule drops, and the 200px bug returns silently. Structural fix: have `renderDefault` emit a `cycle-body--no-toc` class needing no `:has()`.
3. **Half the layout fix is dead code** — `.cycle-body:not(:has(> .toc)) > .cycle-main { max-width: none }` overrides a `max-width` no rule sets.
4. **Nested-section duplication** — JSON/XML emit nested sections twice; ~15.8% of a 14,988-byte payload is a verbatim second copy (~590 est. tokens per read). Nested anchor comments also leak into the HTML.
5. **No `list` command** — agents must trigger `read --section bogus` and parse stderr to enumerate sections.
6. **`package.json` at `0.0.0`** while repo tags `v0.1.1` — publishing from this state would ship a wrong version.
7. **cdn-renderer parser parity** — `parsers/md.mjs:92` has the same warn-and-continue shape for unclosed anchors that was just fixed in build-renderer, but ships no validate command.
8. **XML projection never consumed** — the section-read hypothesis is now proven (~30×), but no agent has been measured reading the XML projection vs raw Markdown.
9. **Anchor-escaping trap** — parser scans raw source before Markdown; backticks do not escape anchor syntax in prose.
10. **`.cycle-body` applied to non-cycles** — the naming that let a cycle-shaped grid reach a decision artifact.

### Fixed this pass (SIB-7)

- `ensureStylesheet()` copy-only-if-absent → always refresh. Was the live root cause by which tagged fix v0.1.1 silently un-fixed itself (issue #3 — escalate to high).
- `.gitignore` `examples/styles.css` was root-anchored, so the nested stale copy was never ignored and stayed tracked.
- `validate` called unclosed anchors "clean" and exited 0 while read/edit/append failed on them.
- `validate` enforced required sections for `cycle` only, and only 3 of 5; `decision` went entirely unchecked.
- `render --out <dir>` died with a raw ENOENT when the dir didn't exist.
- Dossier phase table read `queued` for shipped work — corrected from the artifacts.
