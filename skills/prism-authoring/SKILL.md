---
name: prism-authoring
description: |
  How to author and edit PRISM artifacts (cycles, decisions, tasks, briefings) —
  the section-anchor convention, the surgical-edit operations, and which artifact
  type fits which kind of work. Use this skill when writing or modifying any
  PRISM-conformant document.
version: 0.0.1
status: stub
type: skill
spec-version: prism/0.1
created: 2026-05-12
license: MIT
---

# PRISM authoring

> **STUB — written s01-643d67.** Full content drafted AFTER cycle 001 Phase 5 convergence (when the renderer comparison resolves and the canonical operations are settled). This stub is filed on disk so next-me has the path; flesh it out in 1-2h of focused writing once Phase 5 ships.

## Scope

When this skill is loaded, the agent knows:

1. **Section anchor convention** — how to write `<!-- @section: name -->` blocks and why they matter
2. **Surgical edit operations** — `read-section`, `edit-section`, `append-section`, `add-section` (verbs that align with spec §6)
3. **Artifact types** — when to author a `cycle` vs `decision` vs `task` vs `briefing`
4. **Required sections** per artifact type
5. **Conventions** — naming sections (lowercase kebab-case), nesting with dot-notation, order (standard first, custom after)
6. **When to render** — HTML projection for human review; JSON for tooling; XML for LLM consumption
7. **Don'ts** — don't inline section content from elsewhere; don't manually edit projection outputs; don't author HTML directly

## Planned shape (after Phase 5)

```
prism-authoring/
├── SKILL.md           ← this file (the contract)
├── docs/
│   ├── anchors.md     ← section anchor format + nesting + edge cases
│   ├── operations.md  ← read-section / edit-section / etc. with examples
│   ├── types.md       ← cycle / decision / task / briefing — when + why
│   └── examples/      ← worked examples from real cycles
└── README.md          ← human-facing intro
```

## TODOs for the full v1

- [ ] Decide canonical CLI surface based on Phase 5 winner (build vs CDN)
- [ ] Worked examples — at least one cycle, one decision, one task
- [ ] Common pitfalls (e.g. forgetting closing tag; duplicate section names; nested anchors getting double-rendered)
- [ ] Integration with skill-forge (so this skill is `gh skill install`-able)
- [ ] Frontmatter requirements per artifact type
- [ ] When NOT to use PRISM (short prose; identity files; auto-generated logs)

## Status

Stub. Phase 6 of `cycle 001 renderer-spike`. Will land properly after Phase 5 convergence (currently waiting on empirical comparison of build-renderer vs cdn-renderer).

— σ Soma · s01-643d67 (stubbed)
