---
type: cycle
cycle: 4
arc: prism-dashboards   # PRISM family arc, s01-6d4d53
title: Soma manager — one dashboard for every .soma's settings and body
status: seeded
created: 2026-08-05
updated: 2026-08-05
author: s01-6d4d53 (Soma) + Curtis Mercier
session: s01-6d4d53
edited_by: [s01-6d4d53@prism]
license: CC BY 4.0
spans_repos: [Gravicity/personal/prism, Gravicity/meetsoma]
companion: [../../../branches/cdn-renderer/layouts/registry.mjs, ../../../branches/cdn-renderer/layouts/soma-manager.mjs]
depends_on: [./002-registry-dashboard/cycle.md]
purpose: |
  A fourth PRISM dashboard: manage MULTIPLE .soma's and projects from one surface.
  Shows each soma's current settings and body version; edit/manage settings and
  configure somas WITHOUT hand-editing JSON files.
---

<!-- @section: trigger -->
## Trigger (Curtis, s01-6d4d53)

> "Another dashboard for the PRISM system should be for managing and updating multiple .soma's and
> projects — which could show current settings, version of body, an easy way to edit/manage the
> settings of various soma's — and/or configure them (vs editing the JSON files manually)."

## The problem it solves

Settings live in `~/.soma/settings.json` (and per-project `.soma/` config). Editing them is
**hand-editing JSON** — which is exactly the failure class this estate keeps finding (a bad edit
ships silently; there's no UI, no validation, no diff). A dashboard makes configuration a *visible,
validated, reversible* act instead of a blind file edit.

## What it shows (the dashboard's surface)

| column | what | from |
|---|---|---|
| **soma** | each `.soma` tree (meetsoma, somaverse, services, prism, clients…) | the tree walk |
| **settings** | current `settings.json` values (model, heat, budget…) | `~/.soma/settings.json` + per-tree overrides |
| **body version** | each soma's body/ frontmatter (updated:, lines, description) | `soma:body.index`-style scan |
| **state** | the per-project STATE (the door-index idea, cycle 005) | the STATE files |

## What it does

1. **Edit settings via form** — a validated UI for `settings.json` fields (selects for enums,
   numbers for budgets), **not a raw JSON textarea**.
2. **Diff before write** — show what would change; write is explicit, reversible.
3. **Body version at a glance** — which somas are stale (updated: > 30d), which bodies drifted.
4. **Configure** — the form knows the valid options (the same schemas the caps enforce), so a
   misconfigured value is impossible at the UI, not caught at runtime.

## The link to cycle 005 (project-state-registry)

The STATE files this dashboard would show are the same ones `cycles/infra/005-project-state-registry`
wants to index. **The dashboard is the natural consumer of the door-index** — 005 builds the index,
this dashboard renders it. Sequence: 005's index first, this dashboard reads it.

## Phases (draft)

| # | scope | gate |
|---|---|---|
| a | **Read-only dashboard** — list all `.soma`s, show settings + body version + state | a stranger's soma appears with correct settings/version, no config |
| b | **Form-based settings edit** — validated, diffed, reversible | edit a setting in the UI → `settings.json` reflects it; an invalid value is impossible |
| c | **Per-project state view** — consumes 005's door-index | a project's STATE renders from the index |
| d | **Multi-soma operations** — apply a config change across somas, with a dry-run | dry-run shows N somas would change; apply changes exactly N |

## Open questions

1. **Read vs write scope** — does it EDIT `~/.soma/settings.json` (global) or per-tree overrides?
   *Lean: per-tree overrides first; global is the fallback.*
2. **Validation source** — reuse the caps' schemas, or a dedicated settings schema? *Lean: reuse —
   one schema, UI and caps agree (the single-definition pattern from the registry audit).*
3. **Security** — a dashboard that edits settings is a privileged surface. Does it require a token
   or the local-machine boundary? *Lean: local-machine boundary — same as the serve script's.*

## Invalidating question

**If `~/.soma/settings.json` is already editable via `soma config` (or a cap) with validation, then
the gap is only the VISUAL layer** — and the cheapest fix is a read-only dashboard over the existing
edit command, not a new settings editor. **Verify what config tooling exists before building the form.**

## Status

Seeded — a fourth dashboard in the PRISM family. Next actor: verify the invalidating question, then
build the read-only surface (phase a) using the phase-g navigation from 002 (breadcrumb, cross-dashboard
menu) so it slots into the navigable family.

---

## ✅ Invalidating question — ANSWERED (s01-6d4d53): the edit-gap is REAL

**Q:** *if settings.json is editable via a cap, the ask is visual-only.*
**A:** **NO cap edits settings interactively.** Caps READ settings with precedence (agent.ts:204-212);
settings are WRITTEN only by `core/install.ts:319` and `core/migrations.ts:155` (setup-time). **There
is no interactive edit path** — configuring a running soma means hand-editing JSON. ⇒ The form-based
editor (phase b) is a genuine gap, not a visual layer.

**Design consequence:** the form's write path must be a NEW cap (`soma:config set <key> <value>`-style,
or direct file write with validation) — which then becomes the single editing surface. **The dashboard
is the UI; the cap is the mechanism; the settings schema is the single definition both share** (the
registry-audit pattern).
