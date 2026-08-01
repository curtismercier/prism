---
name: {{name}}
type: muscle
status: active
description: "{{description}}"
heat: 0
heat-default: warm
triggers: [{{triggers}}]
applies-to: [any]
created: {{date}}
updated: {{date}}
soma_template_version: 0.29.0
related: []
origin: {{session}}
version: 1.0.0
author: {{author}}
license: MIT
tier: workspace
---

<!-- Loading note: this muscle auto-warms for 48 hours after `created` via
     the cold-start boost in core/utils.ts (effective_heat = max(raw_heat,
     digestThreshold + 3) for muscles created within COLD_START_WINDOW_MS).
     After 48h, it decays to its raw heat unless triggered (focus / file-edit /
     script match) or manually pinned. To guarantee long-term warm-loading,
     bump `heat:` to >= 1 (warm) or >= 5 (hot). Per docs/heat-system.md. -->

# {{title}}

## TL;DR

<!-- One paragraph. The minimum viable version of this muscle. A reader
     should be able to apply the rule after reading only this section. -->

## Why This Matters

<!-- The failure mode this muscle prevents. What happens without it.
     Ground the abstraction in a concrete pattern the author observed. -->

## Rules

<!-- Actionable items the agent follows. Each rule should be:
       - Testable ("did I do X?")
       - Small enough to remember
       - Different from every other muscle's rules
     Delete this placeholder list and write real rules. -->

1. …
2. …
3. …

## Anti-patterns

<!-- What this muscle is NOT. Failure modes that look like the muscle
     firing but aren't. Helps future-self notice drift. -->

- …
- …

## When This Fires

<!-- Concrete session examples (s01-XXXX references if you have them).
     Keep 1-3 examples max. More = evidence you're writing a protocol,
     not a muscle. -->

- …

## Related

<!-- Other muscles / protocols / plans this connects to.
     The seams are load-bearing: future self navigates through them. -->

- `<related muscle>` — how they relate
