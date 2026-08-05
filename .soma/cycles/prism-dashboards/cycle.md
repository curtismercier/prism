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
