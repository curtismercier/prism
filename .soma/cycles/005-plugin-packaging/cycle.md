---
type: cycle
cycle: 5
name: plugin-packaging
title: "Ship the dashboard as one plugin — server and client in the same package"
status: seeded
arc: prism-dashboards
created: 2026-08-05
session: s01-7ca9ab
spans_repos: [Gravicity/personal/prism, Gravicity/meetsoma]
seams: [../prism-dashboards/cycle.md, ../002-registry-dashboard/cycle.md, meetsoma/.soma/amps/scripts/soma-prism-serve.py]
depends_on: [002-registry-dashboard]
description: "Package soma-prism-serve.py AND the cdn-renderer layouts as one installable unit under ~/.soma/plugins/prism-dashboard. Motivated by two independent failures the same day, both caused by the halves living in different repos with nobody holding the contract between them."
tags: [prism, packaging, plugin, distribution, discoverability]
---

<!-- SEAMS: → prism-dashboards/cycle.md §Architecture (why registry.json stays) and §Freshness (the
     protocol-split bug) → 002 §Q4/Q5 SCOPE (the decomposition this sequences after)
     UPDATE WHEN: the plugin lands, or the ~/.soma/plugins contract changes.
     WHO UPDATES: whoever builds it. -->

# 005 — the dashboard is one system shipped as two halves

## The problem, stated as evidence rather than preference

The dashboard is **a server and a client speaking one private protocol**:

| half | lives in |
|---|---|
| `soma-prism-serve.py` — scans, caches, emits `X-Registry-Refreshing` | `meetsoma/.soma/amps/scripts/` |
| `layouts/*.mjs` — fetches, reads that header, re-polls | `personal/prism/branches/cdn-renderer/` |

**Nobody owns the contract, because nobody holds both files.** On 2026-08-05 that cost twice, in two
different ways, within three hours:

### Failure 1 — two agents proposed rebuilding a system that was already running

Curtis asked *"why does `registry.json` need to exist at all?"* and I priced a redesign at ~30–40%
less machinery. **Both of us were describing software that was already deployed** — scan-on-request,
in-memory cache, background regen, stale-while-revalidate, live on `:8910`. A child found it by
checking for a running process and captured the live header as proof. Honest remaining win: **~0**.

🔑 Its own diagnosis of why we missed it: *"the server script lives in meetsoma's scripts directory,
not in the prism repo where the dashboard is."* **A discoverability failure, not an ignorance failure.**

### Failure 2 — a two-file protocol bug neither half could see

`refresh_if_stale()` returned `False` while a regen was in flight; that value became
`X-Registry-Refreshing: 0`; the client believed it and stopped re-polling. **Weeks of "flakey to see
cycle changes."** Measured: header lies at t=8s, fresh data lands at t=13s, client stopped asking at
t=8s.

**Neither half is wrong when read alone.** The server truthfully reported "I did not start a thread";
the client correctly trusted the header it was given. **The defect only exists in the seam** — and the
seam has no owner, no test, and no single place to document it.

## What "packaging" means concretely

```
~/.soma/plugins/prism-dashboard/
  serve.py            <- from meetsoma/.soma/amps/scripts/soma-prism-serve.py
  layouts/*.mjs       <- from personal/prism/branches/cdn-renderer/layouts/
  render.mjs, styles.css
  PROTOCOL.md         <- 🔑 the thing that does not exist today
```

**`PROTOCOL.md` is the actual deliverable.** The header contract, the poll interval, what
`X-Registry-Refreshing` promises, and the `?v=` module-cache rule — currently folklore split across
two repos' comments. *Packaging without writing the contract down repeats the bug in one directory
instead of two.*

## Constraints — verified, do not re-derive

- ✅ `~/.soma/plugins/` **exists and is populated** (`ai-gateway`, `checklist`, `faq`, `keybinds`,
  `nexus-os`, `presets`, `sessions`, …) — a plugin home is available today.
- ✅ `discover()` is `os.walk(ROOT)` matching `*/.soma/cycles`, *"Auto — omission cannot hide a tree"*.
  There is **no** projects registry in `~/.soma/config.json`; the walk IS the registration. **Keep it.**
- 🔴 **A browser cannot walk a filesystem.** `registry.mjs:197` — *"Browsers block `file://` fetches."*
  The server is not removable, only relocatable. **`registry.json` stays as a RESPONSE.**
- ⚠ **Ownership boundary (Curtis, 2026-07-27):** `~/.soma/agent/**` and distro surfaces belong to
  **meetsoma**; prism proposes, meetsoma builds. `~/.soma/plugins/` is a distro surface. ⇒ **This
  cycle produces a working local proof + a spec, and hands meetsoma the request** — it does not edit
  the distro from here.
- ⚠ **prism is being prepared to go PUBLIC** (`002 §Publication readiness`). A plugin that reads the
  user's own filesystem is fine; **committed internal cycle data is not.** Packaging must not carry a
  `registry.json` snapshot into the public repo.

## Sequencing

**After** `refactor/registry-decompose` merges (`002 §Phase e/g`). That branch moves the client half
into four modules; packaging the old shape would immediately be stale.

## Acceptance

- One directory contains both halves and a `PROTOCOL.md` that states the header contract.
- The dashboard runs from the plugin path with **no path knowledge in the page** beyond the plugin root.
- 🔑 **A falsifiable seam test exists** — assert `X-Registry-Refreshing` is truthful *while a regen is
  in flight*. **That single test would have caught Failure 2**, and its absence is why the bug lived
  for weeks.
- No internal cycle data is committed to the public repo.

## What would make a ✓ a lie

**"It runs from the plugin directory" proves packaging, not correctness.** The whole point is the
seam, so a pass that never exercises a *concurrent* regen has tested the easy path only. The gate must
touch a `cycle.md`, poll during the regeneration window, and assert the header tells the truth at
`t≈8s` — the exact moment that lied.
