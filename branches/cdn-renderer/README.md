# prism-cdn-renderer

Reference implementation B of the [PRISM v0.1 spec](../../spec/README.md) — a browser custom element (`<soma-artifact>`) loaded as an ES module from a CDN. Fetches PRISM Inscribed Source files at runtime and renders them in the page without a build step.

This is one of two parallel implementations developed under the [PRISM renderer branching-cycle](../../.soma/cycles/001-renderer-spike/cycle.md). The other is [`../build-renderer/`](../build-renderer/) — a Node CLI that emits files.

## Status

**Implemented.** `render.mjs` + `parsers/md.mjs` + `layouts/` are working (~600 LOC); cycle 001 resolved
**synthesize** — this runtime renderer for human viewing, the build-step branch retained for JSON/XML
pipeline outputs. See [`../../.soma/cycles/001-renderer-spike/`](../../.soma/cycles/001-renderer-spike/).

<!-- CORRECTED 2026-07-30 (meetsoma s01-2a3668): this line read "Scaffold only. Phase 1.B
     implementation queued" long after the implementation shipped and the cycle resolved. It was
     believed on sight and nearly caused a rebuild of working code. -->

## Layouts

Dispatched by frontmatter `type`. Layouts may be **sync or async** — an async layout can fetch its
own data, which is how an artifact stays live without anyone hand-editing HTML.

| `type` | Layout | For |
|---|---|---|
| `cycle` | `layouts/cycle.mjs` | branching-cycle dossiers |
| `pipeline` | `layouts/pipeline.mjs` | producer/consumer timeline comparisons — renders a Gantt of work units from a JSON emitted by a collector, so stalls are visible as literal gaps |
| *(other)* | `layouts/default.mjs` | frontmatter + sections in document order |

## Planned usage (when shipped)

`index.html` next to any PRISM source file:

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/curtismercier/prism@v0.1/branches/cdn-renderer/styles.css">
  <script type="module" src="https://cdn.jsdelivr.net/gh/curtismercier/prism@v0.1/branches/cdn-renderer/render.mjs"></script>
</head>
<body>
  <soma-artifact src="./cycle.md"></soma-artifact>
</body>
</html>
```

Open `index.html` in a browser → the element fetches `cycle.md` → parses + renders.

Format-agnostic dispatch via file extension:

```html
<soma-artifact src="./cycle.md"></soma-artifact>          <!-- markdown + anchors -->
<soma-artifact src="./taskboard.json"></soma-artifact>    <!-- structured JSON -->
<soma-artifact src="./decision.xml"></soma-artifact>      <!-- tagged XML -->
```

## Stack

- Vanilla JS ES modules. No framework, no build step, no package manager required at consumer side.
- CSS co-located in `styles.css`, served alongside `render.mjs` via the same CDN URL prefix.
- Distribution: served via jsDelivr against the parent repo at `curtismercier/prism` (which serves any GitHub repo + tag for free). When the cdn-renderer branch stabilizes, it may be extracted to its own repo `curtismercier/prism-viewer` for a cleaner CDN path; until then `cdn.jsdelivr.net/gh/curtismercier/prism@v0.1/branches/cdn-renderer/` works fine.
- For local development under this cycle, code is loaded via relative imports from `examples/index.html`.

## Caveat: CORS

Browsers block `fetch()` from `file://` URLs. To open `index.html` locally, serve the directory via a tiny HTTP server:

```bash
python3 -m http.server 8000
# Then visit http://localhost:8000/examples/index.html
```

This is a one-time setup; the resulting URL is just as ergonomic as a built file.

## License

MIT. See [`../../LICENSE-MIT`](../../LICENSE-MIT).
