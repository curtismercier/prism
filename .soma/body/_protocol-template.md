---
name: {{name}}
type: protocol
status: active
description: "{{description}}"
heat-default: cold
applies-to: [any]
created: {{date}}
updated: {{date}}
soma_template_version: 0.37.0
related: []
origin: {{session}}
version: 1.0.0
author: {{author}}
license: MIT
tier: workspace
---

# {{title}}

## TL;DR

<!-- The warm-tier digest — what the agent sees when this protocol is warm
     (3-7 dense bullets: what this protocol is, when it fires, the minimum it
     demands). Shared `## TL;DR` format across all AMPS. If absent, warm falls
     back to the `description:` frontmatter. -->

- …

## Trigger

<!-- What signal tells me this protocol is active? Be specific about
     the observable condition. Protocols fire on conditions; muscles
     fire on intent. -->

- …

## Steps

<!-- The ordered actions. Each step should name its own purpose, its
     success criterion, and (if applicable) what happens when it fails. -->

### 1. …

<!-- What to do, why, how to know you did it. -->

### 2. …

## Decisions

<!-- Any branch points in the protocol. Each decision should have:
       - The condition
       - The options
       - The default
       - Who/what decides (agent, user, tool output) -->

| If … | Then … | Default |
|---|---|---|
| … | … | … |

## Related

- `<related protocol>` — …
- `<related muscle>` — …
