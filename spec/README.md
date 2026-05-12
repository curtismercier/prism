---
type: spec
status: draft
version: 0.1.0
created: 2026-05-12
updated: 2026-05-12
author: Curtis Mercier
license: CC BY 4.0
complements: amp/0.3, amps/1.0, maps/0.1, seams/0.2, seeds/0.2, atlas/0.2
---

# PRISM — Projected Representations from Inscribed Source Markup v0.1

> AI-collaborative documents that render as human-visual artifacts AND machine-structured data, from one Markdown source. Edits happen surgically against named sections, never against whole files.

*Complements: [AMP v0.3](../../protocols/amp/) · [AMPS v1.0](../../protocols/amps/) · [MAPS v0.1](../../protocols/maps/) · [SEAMS v0.2](../../protocols/seams/) · [SEEDS v0.2](../../protocols/seeds/) · [ATLAS v0.2](../../protocols/atlas/)*

---

## 1. The Problem

Long-form collaborative documents — cycles, decisions, briefings, task ledgers — accumulate fast in AI-human teams. They get long. They span months. They get read, edited, re-read, audited, shared.

Two readers consume them very differently:

**Humans absorb information visually.** They scan for headings, jump to status pills, follow cross-links. A 12,000-character Markdown wall of text is friction. Add a sidebar TOC, collapsible sections, dependency-graph crosslinks, and the same content takes seconds to navigate.

**AI agents consume information structurally.** They benefit from explicit semantic anchors (`<phase>`, `<decision>`) over heuristic heading-parsing. They burn tokens re-reading whole files to edit one section. They are precise when the substrate is precise; they hallucinate when the substrate is ambiguous.

The current default — plain Markdown — serves neither well at scale:

- Humans get raw text walls. They squint, scroll, and miss things.
- Agents read 12K, edit one section, and risk breaking neighbors that shared context in the edit window.

PRISM is the substrate that lets one source serve both. The agent writes Markdown with **section anchors**. Humans read the same content rendered to HTML (or any other visual format). Other tooling consumes JSON or XML projections of the same content. **Edits happen surgically against named sections** — no whole-file re-reads, no broken neighbors.

The key insight: *authoring*, *agent reading*, and *human reading* should each get a representation optimized for them, all derived deterministically from the same source.

## 2. Core Concepts

### 2.1 Inscribed Source

A Markdown file with YAML frontmatter and section anchors. The **canonical** representation. The only file an author (human or agent) hand-edits. Everything else is derived.

### 2.2 Section Anchor

Invisible HTML comments that mark stable, machine-addressable region boundaries within an Inscribed Source. Opening and closing tags surround the editable region. Standard Markdown renderers ignore them; PRISM tooling treats them as first-class structural anchors.

```markdown
<!-- @section: phases -->
## Phases
(content here)
<!-- /@section: phases -->
```

Section names are arbitrary but conventionally lowercase kebab-case. Names within a single document MUST be unique.

### 2.3 Projection

A deterministic transformation from Inscribed Source to a target representation. Projections are **derived artifacts** — never hand-edited, gitignored or generated on demand, always reproducible from the source.

Three standard projections, each optimized for an audience:

| Projection | Format | Audience |
|------------|--------|----------|
| **Visual** | HTML | Humans |
| **Structured** | JSON | Tooling / dashboards / cross-document queries |
| **Tagged** | XML | LLM agents reading another agent's output |

A PRISM implementation MUST support at least one projection (Visual recommended). It MAY support all three or define custom ones.

### 2.4 Viewer

An implementation that consumes one or more Projections. Two reference flavors are explored in the [PRISM reference repository](../README.md):

- **Build-step Viewer** — a CLI that emits Projection files (`.html`, `.json`, `.xml`) next to the Source on demand or via watcher
- **Runtime Viewer** — a browser custom element (`<soma-artifact>`) that fetches the Source live and renders in the browser without producing files

PRISM is **viewer-agnostic**. The spec defines the source format and projection semantics; how a viewer materializes them is implementation choice.

### 2.5 Artifact Type

A typed PRISM document. Type is declared in frontmatter (`type: cycle`, `type: decision`, `type: task`, `type: briefing`). Type drives:

- Required section anchors (a `cycle` MUST have `trigger`, `context`, `phases`, `decisions-locked`, `out-of-scope`)
- Status vocabulary (a `cycle` status is one of `drafted | queued | in-progress | shipped | superseded | archived`)
- Default layouts in viewers

Types are extensible. Implementations MAY define additional types. A viewer encountering an unknown type SHOULD fall back to a generic layout.

### 2.6 Surgical Edit

An operation that modifies a single section of an Inscribed Source without re-reading or re-writing the whole file. Standard operations (described in §6):

- `read-section <name>` → returns content between anchors
- `edit-section <name> <new>` → replaces content between anchors
- `append-section <name> <addition>` → adds content before the closing anchor

Surgical edits are the primary value proposition for agent consumers. A single edit costs ~50–500 tokens instead of ~3K–10K for whole-file edit-with-context patterns.

---

## 3. Section Anchor Format

### 3.1 Syntax

```markdown
<!-- @section: <name> -->
... content ...
<!-- /@section: <name> -->
```

- `<name>` MUST be lowercase kebab-case, alphanumeric plus hyphens (`[a-z0-9-]+`)
- Opening and closing tags MUST match by name
- A name MUST be unique within a single document
- Anchors MAY contain Markdown of any complexity (headings, lists, tables, code, nested HTML)
- Anchors MUST NOT cross frontmatter boundaries

### 3.2 Parsing

A conforming PRISM parser:

1. Reads YAML frontmatter (between `---` fences)
2. Walks the body, identifying anchor pairs by regex `<!--\s*@section:\s*([a-z0-9-]+)\s*-->`
3. Builds a map of `{section-name: content-between-anchors}`
4. Treats content outside any anchor as "preamble" / "trailer" (renderable but not section-addressable)

### 3.3 Nesting

Anchors MAY nest. Nesting MUST be balanced. Inner anchors create sub-sections of their enclosing parent. Standard naming convention for nested anchors uses dot-notation:

```markdown
<!-- @section: phases -->
<!-- @section: phases.phase-1 -->
... phase 1 content ...
<!-- /@section: phases.phase-1 -->
<!-- @section: phases.phase-2 -->
... phase 2 content ...
<!-- /@section: phases.phase-2 -->
<!-- /@section: phases -->
```

Implementations MAY treat dot-notation as a path hierarchy (allowing `read-section phases.phase-1`) or as flat names. The spec is permissive.

### 3.4 Edge Cases

- **Unclosed anchor** — implementations SHOULD warn and treat the unclosed section as extending to end-of-body
- **Mismatched anchors** — implementations MUST error; the document is malformed
- **Anchor inside code fence** — should be ignored (the parser MUST tokenize code fences first)
- **Anchor with no closing pair** at end of file — implementations SHOULD warn

---

## 4. Frontmatter

### 4.1 Required Fields

```yaml
---
type: <artifact-type>          # cycle | decision | task | briefing | <custom>
status: <status-value>         # type-specific vocabulary
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---
```

### 4.2 Optional Standard Fields

```yaml
title: <one-line title>        # falls back to first H1 in body
author: <name | agent-id>
license: <SPDX identifier>
depends_on: [<artifact-ref>]   # other PRISM artifacts this depends on
companion: [<artifact-ref>]    # related but non-dependency artifacts
supersedes: <artifact-ref>     # this artifact replaces another
session: <session-id>          # if produced by an agent session (e.g. AMP session ID)
```

### 4.3 Type-Specific Fields

Each artifact type defines its own additional frontmatter. See §5.

### 4.4 Artifact References

A reference is either:
- A file path relative to the current artifact (`../214-marketing-build/cycle.md`)
- An artifact ID (`cycle:215`, `decision:adr-009`) resolved by an implementation-specific registry

Implementations MUST resolve references at projection time and SHOULD render them as hyperlinks in Visual projections.

---

## 5. Artifact Types

### 5.1 cycle

A unit of planned work. Originates in the Soma cycles model but generalizes to any iterative-work tracker.

**Required sections**: `trigger`, `context`, `phases`, `decisions-locked`, `out-of-scope`
**Optional sections**: `decisions-to-surface`, `outtake`, `notes`

**Status vocabulary**: `drafted | queued | in-progress | shipped | superseded | archived`

**Type-specific frontmatter**:
```yaml
cycle: <integer>               # cycle number for cross-referencing
ticket_prefix: <string>        # optional issue-tracker prefix
spans_repos: [<repo-name>]     # repos this cycle touches
```

### 5.2 decision

An architecture decision record (ADR-style).

**Required sections**: `context`, `options`, `decision`, `consequences`
**Optional sections**: `alternatives-considered`, `revisited`

**Status vocabulary**: `proposed | accepted | superseded | rejected`

**Type-specific frontmatter**:
```yaml
decision: <integer>            # ADR number
supersedes: <decision-ref>     # if this ADR replaces another
```

### 5.3 task

A discrete unit of work, smaller than a cycle.

**Required sections**: `goal`, `acceptance`
**Optional sections**: `blockers`, `notes`

**Status vocabulary**: `todo | in-progress | blocked | done | abandoned`

**Type-specific frontmatter**:
```yaml
parent: <cycle-ref | task-ref>  # what this task is part of
owner: <name | agent-id>
due: <YYYY-MM-DD>
```

### 5.4 briefing

A handoff document. The "messages I leave for my future self" pattern — context-dense, action-oriented, time-bounded.

**Required sections**: `situation`, `recommendation`
**Optional sections**: `alternatives`, `rationale`, `do-not`

**Status vocabulary**: `live | acknowledged | stale | archived`

**Type-specific frontmatter**:
```yaml
intended_for: <name | agent-id | session>
expires: <YYYY-MM-DD>          # after this date, treat as stale
```

### 5.5 Custom Types

Implementations MAY define custom types (`type: experiment`, `type: incident`, etc.). Required sections for custom types MUST be declared in the implementation's type registry. Viewers encountering unknown types SHOULD fall back to a generic layout that renders all sections in document order.

---

## 6. Operations (Informative)

These are reference operations a PRISM-conformant tooling layer SHOULD provide. Naming and exact CLI surface vary by implementation.

### 6.1 read-section
```
read-section <file> <name> → text
```
Returns the content between the named section's anchors. Idempotent. Read-only.

### 6.2 edit-section
```
edit-section <file> <name> <new-content>
```
Replaces the content between the named section's anchors. Preserves anchors. MUST fail if the section does not exist (no implicit creation — use `add-section` for that).

### 6.3 append-section
```
append-section <file> <name> <addition>
```
Inserts content just before the closing anchor. Preserves the rest of the section.

### 6.4 add-section
```
add-section <file> <name> <content> [--after <existing-name>]
```
Creates a new section with the given name and content. Position via `--after` (default: end of body, before any trailer).

### 6.5 remove-section
```
remove-section <file> <name>
```
Removes the section and its anchors. Implementations MAY support a soft-delete that comments out the section.

### 6.6 render
```
render <file> [--format html|json|xml|all] [--out <path>]
```
Emits one or more Projections. With no `--out`, prints to stdout for single format, otherwise writes next to source.

### 6.7 validate
```
validate <file>
```
Checks: frontmatter conforms to type, required sections present, anchors balanced, references resolve. Returns exit code 0 (clean) or non-zero (with descriptions of failures).

### 6.8 index
```
index <dir>
```
Walks a directory of PRISM artifacts, emits a manifest (typically `cycles.json` or similar) for dashboard consumers.

---

## 7. Projection Formats

### 7.1 Visual (HTML)

Human-facing rendering. Conforming implementations SHOULD:

- Render Markdown content within each section
- Surface frontmatter as structured header chrome (title, status pill, dates, author)
- Generate a sidebar / table-of-contents from section anchors
- Resolve `depends_on` / `companion` / `supersedes` references to hyperlinks
- Apply type-specific layout (e.g. cycles render phases as a vertical track; decisions render options as a comparison table)

Section anchors SHOULD become HTML `id` attributes on wrapping `<section>` elements for deep-link support.

### 7.2 Structured (JSON)

Machine-facing. Conforming implementations MUST emit:

```json
{
  "type": "cycle",
  "frontmatter": { ... },
  "sections": {
    "trigger": "markdown content...",
    "context": "...",
    "phases": "..."
  },
  "preamble": "content before first section",
  "trailer": "content after last section",
  "references": {
    "depends_on": [...],
    "companion": [...],
    "supersedes": "..."
  }
}
```

This format is suitable for dashboards, cross-document queries, and pipeline consumers.

### 7.3 Tagged (XML)

LLM-facing. Suitable for when one agent needs to consume another agent's output as structured semantic input. Conforming implementations SHOULD emit:

```xml
<cycle type="cycle" status="drafted" version="0.1.0">
  <frontmatter>
    <title>...</title>
    <status>drafted</status>
    <depends-on>[...]</depends-on>
  </frontmatter>
  <section name="trigger">
    ... markdown rendered as XML-safe text or further-structured ...
  </section>
  <section name="phases">
    <phase name="phase-1" status="shipped">
      ...
    </phase>
  </section>
</cycle>
```

The XML projection is the most opinionated — implementations may diverge on how aggressively to structure Markdown content within sections (preserve as text vs. parse to nested tags). The spec leaves this latitude open.

---

## 8. Conformance

A PRISM-conformant implementation MUST:

1. **Parse** Inscribed Source files (frontmatter + section anchors) per §3 and §4
2. **Support** at least the `read-section` and `edit-section` operations per §6
3. **Render** at least one Projection format per §7
4. **Honor** required sections for at least one Artifact Type (typically `cycle`)
5. **Validate** anchor balance and report mismatches

A PRISM-conformant implementation SHOULD:

- Support all standard operations in §6
- Support all three standard Projections (HTML, JSON, XML)
- Provide validation tooling per §6.7
- Resolve artifact references in Visual projections

A PRISM-conformant implementation MAY:

- Define custom Artifact Types (per §5.5)
- Define additional Projections
- Provide a Viewer (build-step or runtime)
- Integrate with other Gravicity protocols (AMP, MAPS, SEAMS) per §10

---

## 9. Methodology: Branching Cycles

PRISM was developed using a methodology pattern called the **branching-cycle** — a cycle in which two or more rival approaches develop in parallel, with explicit convergence criteria stated before either branch begins. The methodology is documented separately and may evolve into its own protocol; see `branching-cycle.md` in the PRISM reference repository for the v0.1 specification.

PRISM does not depend on branching-cycle methodology. The pattern is mentioned here because PRISM artifacts are well-suited to capturing branching-cycle state (each branch's `phases.md` is a PRISM `cycle` artifact; the root document is itself a `cycle` artifact that references both branches via `companion`).

---

## 10. Relationship to Other Protocols

PRISM is **about artifacts**. Other protocols in the family govern other concerns:

| Protocol | Concern | PRISM relationship |
|----------|---------|-------------------|
| **AMP** | Filesystem-based memory hierarchy | PRISM artifacts ARE AMP content. Frontmatter `type:` aligns with AMP content-type registries. |
| **AMPS** | Content type registry over AMP | An AMP implementation MAY treat PRISM artifacts as a content type with its own heat / preload semantics. |
| **MAPS** | Task-specific navigation | A MAP MAY reference PRISM sections by anchor name when describing where to read / edit. |
| **SEAMS** | Provenance traceability | PRISM frontmatter naturally carries SEAMS origin markers (`session:`, `created:`). |
| **SEEDS** | Template scaffolding | A seed MAY emit a PRISM-conformant document with required anchors pre-stubbed. |
| **ATLAS** | Living architecture maps | An ATLAS map MAY be a PRISM `decision` or custom-type artifact with hyperlinked navigation. |
| **PHASE** | Session prompt configuration | A PHASE config MAY load PRISM artifacts as context using surgical-read operations. |

PRISM is **independent** — it can be used without any other protocol. It is **composable** — it slots cleanly into a stack that includes AMP, AMPS, MAPS, and SEAMS.

---

## 11. Status

**Version**: 0.1 (draft)
**Reference implementations**: in active development under [`branches/`](../branches/) in this repository — two parallel approaches (build-step CLI and runtime browser custom element) compared empirically per the methodology in §9.

**Known gaps** (queued for v0.2+):

- Formal schema for type-specific frontmatter (currently described prose; should be JSON Schema)
- Bidirectional Edits (when a Projection is edited and changes flow back to Source — out of scope for v0.1, may be revisited)
- Inline section-anchor authoring shortcuts (perhaps a `<!-- §name -->` shorthand) — deferred until usage informs design
- Conformance test suite

**Versioning**: PRISM follows semantic versioning. Breaking changes to the anchor format, frontmatter schema, or required sections of standard types are MAJOR. Adding new optional fields or new standard types are MINOR. Clarifications and editorial fixes are PATCH.

---

## 12. Acknowledgments

PRISM was developed during a 2026 session between Curtis Mercier and the Soma agent, in response to a recurring friction: long collaborative cycle dossiers were expensive for the agent to edit (token-wise) and hard for the human to navigate (visually). The protocol is the substrate; the branching-cycle is the methodology that produced both reference implementations.

Drafted by Curtis Mercier with substantial co-authorship by σ Soma (session `s01-643d67`).

The protocol is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Reference implementations are licensed under MIT. See the parent repository for details.
