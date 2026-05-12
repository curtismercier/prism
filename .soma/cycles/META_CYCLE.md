---
type: meta-cycle
purpose: |
  Navigator for cycles in this project. Update as cycles advance; this file
  is the dashboard for "where is each piece of work right now."
created: 2026-05-12
updated: 2026-05-12
---

# META_CYCLE — PRISM project umbrella

> One row per cycle. Drill into `cycles/<NNN>-<slug>/cycle.md` for the
> living plan. Branching-cycles list their branches as sub-rows.

---

## Live cycles

| Cycle | Title | Status | Type | Next |
|-------|-------|--------|------|------|
| **001** | [Renderer spike — branching-cycle](./001-renderer-spike/cycle.md) | in-progress | branching-cycle | Phase 1.A or 1.B implementation (interleavable) |
| ├ 1.A | [Branch A — build-step renderer](./001-renderer-spike/branch-a/README.md) | queued | branch | Implement HTML renderer |
| └ 1.B | [Branch B — runtime browser renderer](./001-renderer-spike/branch-b/README.md) | queued | branch | Implement `<soma-artifact>` element |

---

## Cycle conventions used here

- **Cycle numbering**: zero-padded, sequential. `001`, `002`, ...
- **Cycle directory**: `<NNN>-<kebab-case-slug>/`
- **Cycle dossier**: always `cycle.md` at the root of the directory
- **Branches** (for branching-cycles): subdirectories `branch-a/`, `branch-b/`, etc. with their own `README.md` per branch
- **Code homes**: separate from cycle dossiers — under `branches/<name>/` at the project root, so branches can be extracted as standalone OSS if successful

---

## Status legend

| Status | Meaning |
|--------|---------|
| `drafted` | Dossier exists, not yet greenlit |
| `queued` | Greenlit, waiting for a session |
| `in-progress` | Active work in current/recent session |
| `shipped` | Done, evidence verified |
| `superseded` | Replaced by another cycle (link in dossier) |
| `archived` | Done with, no longer relevant |
