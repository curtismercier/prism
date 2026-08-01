---
type: body
name: body
status: active
created: 2026-05-31
updated: 2026-06-02
description: Where I am — PRISM routing table, repo topology, the traps
---

# Where I Am

> **Every file in this project has an owner in this table.** The 30-second read prevents the 30-minute mistake.
>
> **Tool reflex:** `soma:code.find` before `grep` · `soma:code.outline` before reading a whole file · `soma:browser.*` before `curl` · `soma:docs.search` before drafting.

## Project

**PRISM** — *Projected Representations from Inscribed Source Markup.* A protocol spec **plus** two reference renderers. One Markdown source with invisible HTML-comment section anchors (`@section: name` … closing form) projects to three audiences: **HTML** for humans (visual chrome, sidebar TOC, status pills), **JSON** for tooling, **XML** for agents. The point is **surgical edits against named sections** — an agent edits one section without re-reading the whole file and without breaking neighbors.

Sits in the Gravicity protocol family (AMP, MAPS, SEAMS, SEEDS, ATLAS, PHASE, MLX, MLR). PRISM's niche is the **artifact substrate** — the shape of a document and how it projects. Stage: v0.1 spec published, `v0.1.1` tagged, renderers in active development, cycle 001 unresolved.

## The Line

| Ships to users | Ours only |
|---|---|
| `spec/` (CC BY 4.0) · `branches/` (MIT) · `examples/` · `README` · `CHANGELOG` · `CONTRIBUTING` · `skills/` | `.soma/` (memory, cycles, body) · `_resume.md` (gitignored) |

Editing `spec/` changes a published protocol — other repos declare `complements:` against it. Treat spec-body edits as versioned events, not typos.

## Repo Topology

| Path | Remote | Branch | Notes |
|------|--------|--------|-------|
| `.` (repo root) | github.com/curtismercier/prism | `main` | The whole thing is one repo. Tag `v0.1.1`. |
| `branches/build-renderer/` | — | — | Branch A. Node CLI, `bin/prism.mjs`, dep `marked`. Node >=22, pnpm lockfile. |
| `branches/cdn-renderer/` | — | — | Branch B. Browser custom element `<soma-artifact>`, `render.mjs` + `layouts/`. No build step. |

`branches/*` are **rival implementations, not git branches.** Both are on `main` simultaneously — that is the branching-cycle design, not a mistake.

## If You Just Woke Up

- **Real memory before `.soma/` existed lives in `_resume.md`** (repo root, gitignored). Sessions s01-6e4f26 and s01-77e31d are recorded there. Read it if a preload is thin.
- **Active release:** `v0.1.1`. **Work branch:** `main` (small repo, direct commits; PRs for substantial changes per CONTRIBUTING).
- **Cycles live in** `.soma/cycles/`. The live one is `001-renderer-spike/`.
- **What's next:** Phase 3/4 of cycle 001 — the empirical renderer comparison. It gates Phase 5 convergence, which gates the `prism-authoring` skill and the v0.2 framing.

## Routing Table

> **Spec:** `spec/README.md` (v0.1, canonical). **Cycle:** `.soma/cycles/001-renderer-spike/cycle.md`. **Methodology:** `branching-cycle.md`. **Contribution gates:** `CONTRIBUTING.md`.

| Before you … | Read first |
|---|---|
| Change renderer behavior | `.soma/cycles/001-renderer-spike/cycle.md` § decisions-to-surface — the 7 criteria are the rubric |
| Touch `spec/` body | `CONTRIBUTING.md` (three-class flow) + `CHANGELOG.md`; spec changes are versioned events |
| Add/modify a CLI command | `branches/build-renderer/bin/prism.mjs` — dispatch is one `switch`: render · read · append · edit · validate |
| Change layout/CSS | `branches/cdn-renderer/styles.css` — the single canonical source; build-renderer copies it. Note the layout fix depends on `:has()` with no `@supports` fallback |
| Author a new artifact | `skills/prism-authoring/SKILL.md` (stub) + `examples/cycle-215.md`, `examples/decision-example.md` |
| Ship anything | `CHANGELOG.md` entry + Conventional Commit + `prism validate` clean |
| Reach for raw grep | `soma:code.find` — and `ls .soma/amps/muscles/` for existing tools |

## Traps

1. **Anchor escaping — the authoring trap.** Writing anchor syntax in prose triggers the parser as if you declared a real anchor. **Backticks do NOT escape it** — the parser scans raw source *before* Markdown rendering. Use the `@section: name` shorthand when writing *about* anchors. Hit twice in s01-77e31d. Still unfixed in spec §3.4 Edge Cases.
2. **One stylesheet, two branches — the risk is staleness, not divergence.** Corrected SIB-7: `branches/cdn-renderer/styles.css` is the *canonical* stylesheet and build-renderer copies it at render time (`bin/prism.mjs:61`). The v0.1.1 fix is the same ten lines for both branches (`d50a3e6`), so a CSS fix does not need applying twice. What bit us was a **stale copy** in an output dir that was never refreshed — now fixed by always overwriting. Corollary: Branch A cannot be forked standalone; it would lose its stylesheet.
3. **`package.json` version drift.** `branches/build-renderer/package.json` says `0.0.0` while the repo ships `v0.1.1`. Don't trust the package version as the release marker; the git tag is truth.

6. **`pnpm install` aborts without a TTY** when a `node_modules/` from another installer exists: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. Use `env CI=true pnpm install`. Harmless in GitHub Actions, which sets `CI` itself.

7. **Enumerating sections requires abusing an error path.** There is no `list` command; `read --section bogus` prints the available names to stderr with exit 1. Filed as a follow-up — don't mistake it for the intended API.
4. **The dossier's phase table lies.** Phases 1–4 read `⬜ queued` while both renderers demonstrably render. Status tables rot faster than code — verify against the artifact.
5. **Cross-repo reciprocity.** PRISM's `complements:` mirrors the `protocols` mono-repo's frontmatter. Sync direction is bidirectional and lives in two repos — update both or neither.

## Active State

- **Current focus:** cycle 001 Phase 3/4 — empirical comparison of both renderers against the 7 criteria.
- **Blocked on:** nothing external.
- **Known bugs:** cdn-renderer non-cycle layout status unverified (suspected same bug as v0.1.1) · `package.json` 0.0.0 drift · issues #2 (CI), #3 (`styles.css` copy-only-if-absent foot-gun), #4 (spec §7.1 type-specific layouts).
- **Under-tested:** the XML projection has never been *consumed* by an agent — that's the hypothesis PRISM exists to prove, still unproven.
