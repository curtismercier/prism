# prism-build-renderer

Reference implementation A of the [PRISM v0.1 spec](../../spec/README.md) — a Node CLI that reads PRISM Inscribed Source files (Markdown with section anchors) and emits Projections to disk (HTML, JSON, XML).

This is one of two parallel implementations developed under the [PRISM renderer branching-cycle](../../.soma/cycles/001-renderer-spike/cycle.md). The other is [`../cdn-renderer/`](../cdn-renderer/) — a runtime browser custom element.

## Status

Scaffold only. Phase 1.A implementation queued — see [`../../.soma/cycles/001-renderer-spike/branch-a/README.md`](../../.soma/cycles/001-renderer-spike/branch-a/README.md) for the branch dossier.

## Planned usage (when shipped)

```bash
# Install (eventual)
npm install -g @gravicity/prism-build

# Or run via npx
npx @gravicity/prism-build render examples/cycle-215.md
# → emits examples/cycle-215.html next to source

# Multi-format output
npx @gravicity/prism-build render examples/cycle-215.md --format all
# → emits cycle-215.html + cycle-215.json + cycle-215.xml

# Surgical edit operations (spec §6)
npx @gravicity/prism-build read   examples/cycle-215.md --section phases
npx @gravicity/prism-build edit   examples/cycle-215.md --section phases --content "..."
npx @gravicity/prism-build append examples/cycle-215.md --section phases --content "- new item"

# Validation
npx @gravicity/prism-build validate examples/cycle-215.md
```

## Stack

- Node 22, ESM
- `gray-matter` for YAML frontmatter
- `marked` (or `markdown-it`) for Markdown rendering
- Hand-rolled section-anchor parser (~50 LOC, see [spec §3](../../spec/README.md#3-section-anchor-format))
- No build step for this package itself — published as plain ESM to npm

## License

MIT. See [`../../LICENSE-MIT`](../../LICENSE-MIT).
