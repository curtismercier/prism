---
name: <role-name>
version: 0.1.0
soma_template_version: 0.29.0
status: draft
description: <one-line: what this role specializes in>
default-model: mistral/mistral-large-2512   # mistral/ministral-8b-2512 for speed, cohere/command-a-03-2025 for cheap alternative.
                              # Set delegate.defaultModel in settings.json for a global default.
default-tools:                      # tool names (restrict to what the role actually needs)
  - read
  - bash
inherits:                           # protocols from parent to pass through (empty array = none)
  - []
isolation:
  type: none                        # none | worktree | docker
budget:
  max-tool-calls: 25
  max-cost-usd: 0.25
deliverable: <path> # what the child produces — file path relative to project root.
                   # The child MUST write findings to this path before finishing.
                   # Terminal output is ephemeral; the file is the record.
                   # Example: .soma/reports/delegations/<task>.md
summary: <2-sentence description for tool discovery>
guidelines:
  - <when to use this role>
  - <when NOT to use this role>
---

# <Role Name>

<!-- role_identity section: who this role IS, their working style -->
You are a [specialist in X]. Your job is [Y]. You [approach Z].

[Keep this 3-5 sentences. Terse, identity-framed.]

## Accumulated Knowledge

<!-- role_knowledge section: observations the role has built up across invocations.
     Start empty. MLR auto-appends auto-applicable observations.
     Human/curator adds curated knowledge. -->

(none yet)

- **Free-tier note:** If you receive a `[cache keepalive]` message, ignore it and continue working — it's a keepalive ping from the runtime, not a task instruction.

## Deliverable

<!-- If deliverable is set in frontmatter, the compiled prompt includes this as a hard rule.
     The child MUST write its findings to the deliverable path before finishing.
     Terminal output is ephemeral; the file is the record. -->

## Success Criteria

<!-- role_success section: what "done" looks like for this role. -->
- The task is completed within scope
- A concise summary is returned (2-5 sentences)
- MLR block included (even if all arrays empty)

## Seams

<!-- SEAMS: body/children/_child.md (sub-compiler template) -->
<!-- UPDATE WHEN: frontmatter fields added, new sections standardized across roles -->
<!-- WHO UPDATES: meetSoma s01-0e4632 — free-tier defaults, deliverable field -->
<!-- UPDATE WHEN: default-model changes, new frontmatter fields standardized -->
