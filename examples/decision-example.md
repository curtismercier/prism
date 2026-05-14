---
type: decision
status: accepted
decision: 0
slug: decision-example
created: 2026-05-14
updated: 2026-05-14
spec-version: prism/0.1
artifact-conforms-to: prism
license: CC BY 4.0
---

# ADR-0 — Use Section Anchors Over Heading-Based Parsing

> Example PRISM `type=decision` artifact. Demonstrates the four required sections (`context`, `options`, `decision`, `consequences`) plus the optional `alternatives-considered` section. Also serves as a cross-type rendering regression artifact — if this renders in a 200px column, the layout fix has regressed.

<!-- @section: context -->

## Context

PRISM Inscribed Source files need stable, machine-addressable region boundaries so that tooling can perform surgical edits without re-reading whole files. Two candidate boundary mechanisms were considered during the v0.1 design phase.

The choice determines:
- How brittle a section reference is to authors editing surrounding text
- Whether Markdown renderers leak structural metadata into the visual output
- How much parser complexity is required to identify section boundaries

<!-- /@section: context -->

<!-- @section: options -->

## Options

### Option A — HTML-comment anchors (`@section: name` shorthand)

Invisible HTML comments wrap the editable region (opening comment marks the start, closing comment marks the end). Standard Markdown renderers ignore them; PRISM tooling treats them as first-class structural anchors. See PRISM spec §3.1 for the exact syntax.

**Pros.** Explicit boundaries. Authors can rename headings without breaking references. Names are arbitrary, not tied to display text. Round-trips through any Markdown processor unchanged.

**Cons.** Authors must remember to write both opening and closing tags. Slight visual noise in raw Markdown.

### Option B — Heading-based parsing (slugify the H2/H3 text)

Use Markdown heading text as the section identifier; the boundary is implicit (next heading of equal or lower level closes the section).

**Pros.** Zero authoring overhead — just write normal Markdown. No new syntax to learn.

**Cons.** Renaming a heading breaks every reference to it. Section names tied to display text (no separation of identity from presentation). Boundary ambiguity at nested headings. Heuristic, not explicit.

<!-- /@section: options -->

<!-- @section: decision -->

## Decision

**Adopt Option A — HTML-comment anchors.**

Rationale:
- Identity separated from display: authors can polish heading text without breaking references
- Explicit boundaries eliminate parser heuristics
- HTML comments are universally ignored by Markdown renderers; no visual noise in projected HTML
- The small authoring overhead (writing both opening and closing tags) is justified by the stability guarantee

<!-- /@section: decision -->

<!-- @section: consequences -->

## Consequences

### What this enables

- Surgical operations (`prism read --section`, `prism edit --section`) become precise
- Authors can rename headings freely
- Section names form a stable namespace per document

### What this requires

- PRISM-aware tooling to parse the anchor syntax (out of scope for plain Markdown viewers)
- Authoring discipline: balanced opening/closing anchors
- A `prism validate` step in any commit hook that touches PRISM sources

### What this does NOT change

- Plain Markdown renderers continue to work unchanged — anchors are invisible HTML comments
- Existing Markdown files can be incrementally promoted to PRISM by adding anchors around named regions

<!-- /@section: consequences -->

<!-- @section: alternatives-considered -->

## Alternatives Considered

### Option C — Frontmatter section map

Declare section ranges via line numbers in YAML frontmatter (e.g. `sections: { context: [10, 25], decision: [27, 40] }`). Rejected because line numbers shift on every edit, breaking the reference stability the whole feature was meant to provide.

### Option D — Sibling `.sections.json` file

Maintain section boundaries in a separate JSON file next to the source. Rejected because it doubles the authoring surface and creates a synchronization burden between two files describing the same content.

<!-- /@section: alternatives-considered -->
