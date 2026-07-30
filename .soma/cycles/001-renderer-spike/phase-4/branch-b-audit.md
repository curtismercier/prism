# Branch B audit — `branches/cdn-renderer/` (runtime `<soma-artifact>` custom element)

Cycle 001 renderer-spike, Phase 4. Evaluated against the seven convergence criteria pre-stated in
`.soma/cycles/001-renderer-spike/cycle.md` § *Decisions to surface*.

Audit date 2026-07-29 · commit `3f4d6d2` (working tree clean apart from untracked `.soma/`).
Adversarial posture: this report tries to break Branch B, not to sell it. No winner is declared here.

---

## Method

**Served.** Two static servers, both plain `python3 -m http.server`, no build step, no install:

```
python3 -m http.server 8901 --directory branches/cdn-renderer   # the branch as its own root
python3 -m http.server 8902 --directory .                       # repo root, so ../../../examples/ resolves
```

Both were killed at the end of the audit (verified: `curl` → `Failed to connect to localhost port 8901/8902`).

**Driven.** Real Chrome (`Chrome/151.0.7922.34`) over the DevTools Protocol on port 9333 — a live
profile, not headless. Console/exception/`Log.entryAdded`/`Network.loadingFailed` events were captured
over the websocket across a full `Page.reload`, so nothing that happened before an `evaluate` call was
missed. Geometry read via `getComputedStyle` / `offsetWidth`. Viewport for all measurements: **1187 × 1245 CSS px**.

**Pages driven:**

| URL | Artifact | Purpose |
|---|---|---|
| `http://localhost:8901/examples/index.html` | `examples/cycle-215.md` (`type: cycle`) | the only case this branch had ever been tested against |
| `http://localhost:8902/branches/cdn-renderer/examples/phase4-decision-test.html` | `examples/decision-example.md` (`type: decision`) | **the never-before-tested cross-type case** |
| same page, `src` swapped at runtime | `decision-example.json` | `.json` dispatch |
| same page, `src` swapped at runtime | `decision-example.xml` | `.xml` dispatch |
| same page, `src` → `./does-not-exist.md` | — | 404 path |
| `file:///…/branches/cdn-renderer/examples/index.html` | `cycle-215.md` | zero-server viewing claim |
| `8901/examples/index.html` with `*cdn.jsdelivr.net*` blocked | `cycle-215.md` | CDN-unavailable failure mode |

**Scratch file authored** (kept, as instructed): `branches/cdn-renderer/examples/phase4-decision-test.html`
— 15 lines, points `<soma-artifact src="../../../examples/decision-example.md">`. It must be served from
the repo root; that is why port 8902 exists. Nothing else in the repo was created or modified.

**Screenshots** (1187px-wide viewport, browser was in dark mode — `prefers-color-scheme: dark`):

- `.soma/cycles/001-renderer-spike/phase-4/branch-b-cycle-215.png`
- `.soma/cycles/001-renderer-spike/phase-4/branch-b-decision-example.png`

---

## The non-cycle layout bug — present or absent?

**Absent. The fix is in this branch and it is load-bearing.** Measured, not assumed.

`examples/decision-example.md` (`type: decision`) has no layout registered in `render.mjs`'s `LAYOUTS`
map, so it falls through to `renderDefault`, which emits a `.cycle-body` containing **only** `<main>` —
exactly the shape that triggered the sibling bug.

Measured on the live render:

```json
{ "type": "decision", "cls": "prism prism-default",
  "hasToc": false,
  "gridCols": "1080px",
  "bodyW": 1080, "mainW": 1080,
  "sections": ["context","options","decision","consequences","alternatives-considered"] }
```

`main.cycle-main` is **1080 px** wide on a 1187 px viewport — full content width, nowhere near the
~200 px failure threshold. Screenshot `branch-b-decision-example.png` confirms visually: prose runs
edge to edge, tables and lists are readable, no word-per-line wrapping.

**Counterfactual proof that the fix is what's doing the work.** I deleted the two `:has()` rules from
the live stylesheet via `CSSStyleSheet.deleteRule` and re-measured the same DOM:

```json
{ "killedRules": [".cycle-body:not(:has(> .toc)) > .cycle-main",
                  ".cycle-body:not(:has(> .toc))"],
  "before_bodyW_mainW": "1080/1080",
  "after": "200px 840px mainW=200" }
```

`mainW` collapses from **1080 → 200 px** the instant those rules go away. So the bug is real in this
branch's grid, and `styles.css:115-120` is the only thing preventing it.

**Provenance.** `git log -S':not(:has(> .toc))'` shows the fix landed in `d50a3e6`
(*"fix(renderer): non-cycle artifacts no longer render in 200px column"*, 2026-05-14), applied directly
to `branches/cdn-renderer/styles.css`. That commit's message states cdn-renderer's `styles.css` is the
canonical source and build-renderer copies it at render time — so the v0.1.1 build-renderer fix and this
one are literally the same ten lines, not two parallel fixes. The premise that Branch B might still carry
it unfixed does not hold.

**Cycle layout unaffected** (regression check): `cycle-215.md` still measures
`gridCols: "200px 840px"`, `tocW: 200`, `mainW: 840`, 11 TOC items ↔ 11 sections.

**Three caveats I will not paper over:**

1. `.cycle-body:not(:has(> .toc)) > .cycle-main { max-width: none }` is a **no-op** — no rule anywhere in
   `styles.css` sets a `max-width` on `.cycle-main`. Half the fix is dead code that reads as protective.
2. The fix depends on `:has()`. `CSS.supports("selector(:has(> .toc))")` → `true` in this Chrome, but on
   any engine without `:has()` (Chrome < 105, Safari < 15.4, Firefox < 121) the selector is invalid, the
   whole rule is dropped, and the 200 px bug returns silently. There is no `@supports` fallback and no
   structural alternative (e.g. `renderDefault` emitting a distinct class such as `cycle-body--no-toc`,
   which would need no `:has()` at all).
3. The class name `.cycle-body` is used for artifacts that are not cycles. Cosmetic, but it is exactly the
   kind of naming that caused a cycle-shaped grid to be applied to a decision in the first place.

---

## Criterion 1 — Authoring friction

**Verdict: strong in principle, undercut by a measured caching bug.**

Mechanically Branch B has no authoring step at all: edit `examples/cycle-215.md`, reload the tab. There is
no CLI to re-run, no derived artifact to regenerate, no chance of source and render drifting. The served
`examples/cycle-215.md` is a **symlink** to `../../../examples/cycle-215.md` — the renderer reads the same
inode the author edits.

But the fetch is `fetch(src)` with no cache directive (`render.mjs:46`), and measured resource timings say
the browser will happily serve you a stale artifact:

| Navigation | `cycle-215.md` `transferSize` | Meaning |
|---|---|---|
| soft navigation (click/URL) | **0** | served from cache, no revalidation |
| plain reload (`Page.reload`, `ignoreCache:false` ≈ ⌘R) | **0** | still cache, **no revalidation** |
| hard reload (`ignoreCache:true` ≈ ⌘⇧R) | **12866** (12566 decoded) | network |

`python3 -m http.server` sends no `Cache-Control`, only `Last-Modified`; Chrome's heuristic freshness
(~10% of document age — the file is ~78 days old) means a normal ⌘R can show you yesterday's text. The
"edit, refresh" loop that is Branch B's headline advantage is not reliable out of the box.

One-line fix, noted but **not applied**: `render.mjs:46` → `await fetch(src, { cache: 'no-cache' })`.

Second measured defect on the same axis: **the artifact is fetched and rendered twice on every initial
page load.**

```
mdFetchEntries: [ {start: 19, dur: 6}, {start: 19, dur: 6} ]   // two concurrent fetches
```

Appending the element dynamically instead (`createElement` → `setAttribute` → `appendChild`) produces
exactly **one** fetch (count 2 → 3). The difference is the custom-element *upgrade* path: the element is
already in the DOM when `customElements.define` runs, so `attributeChangedCallback` fires with
`isConnected === true` (→ `render()`), and then `connectedCallback` fires (→ `render()` again).
`render.mjs:26-32` has no guard. Harmless-looking now, doubling in cost with artifact size, and it would
double any future side effect (analytics, mutation, `document.title` rewrite).

## Criterion 2 — Viewing friction

**Verdict: mixed — genuinely one step when a server exists, and a blank white page when one doesn't.**

Happy path is as advertised: navigate to a URL, artifact renders, no build output to locate. TOC clicks
work (clicking `outtake` scrolled `0 → 3780`, with a `.section-flash` highlight).

Two failures:

1. **`file://` produces a completely blank page — not the friendly error the code was written to show.**
   Verbatim console:

   ```
   [log.error] javascript | Access to script at
   'file:///Users/user/Gravicity/personal/prism/branches/cdn-renderer/render.mjs' from origin 'null'
   has been blocked by CORS policy: Cross origin requests are only supported for protocol schemes:
   brave, chrome, chrome-extension, chrome-untrusted, data, http, https, isolated-app.
   [log.error] network | Failed to load resource: net::ERR_FAILED
   ```

   DOM state: `{"url":"file:","text":"","hasArticle":false}`. `render.mjs:53` contains a well-written
   *"browsers block fetches from local files, serve via `python3 -m http.server`"* hint — it can never
   run, because the **module itself** is CORS-blocked before the element is ever defined. The user sees
   nothing. Branch A's output, being a plain `.html` file, opens from `file://` by double-click.

2. **URL fragments do not resolve on load.** Loading `…/index.html?x=1#section-phases` gives
   `{"hash":"#section-phases","scrollY":0,"targetTop":1309}` — the browser's fragment scroll fires before
   the async render has produced `#section-phases`, so you land at the top of a long document. (An earlier
   measurement appeared to show this working; that was Chrome scroll-restoration from the previous
   navigation. Re-tested from a clean URL, it does not work.) Compounding it, the TOC click handler calls
   `preventDefault()` and never writes `location.hash`, so `hash` stays empty after navigating — you
   cannot copy a link to the section you are reading. **Section-level deep links, on both the produce and
   consume side, do not work in Branch B today.**

## Criterion 3 — Agent token cost for surgical edits

**Verdict: parity by construction; no evidence of a Branch-B-specific penalty.**

Branch B does not touch the source format. The agent-facing substrate is byte-identical to Branch A's:
the same `examples/cycle-215.md` (12,566 bytes), the same `<!-- @section: name -->` anchors, so
read-section / edit-section cost the same tokens either way. The cycle doc predicted differences here
would be *bugs, not features*; I found no divergence.

The asymmetry is downstream, not in the edit: after an edit, Branch A must regenerate its derived
artifacts (`cycle-215.html` 17,740 B, `.json` 14,988 B, `.xml` 15,327 B) or they go stale and an agent
reading the wrong one gets wrong data. Branch B has nothing to regenerate. That is a real Branch B
advantage, but it is a *staleness* advantage, not a token one — and per Criterion 1, Branch B trades it
for a browser-cache staleness problem of its own.

**Not measured:** I did not run an actual agent edit through both branches and count tokens. The parity
claim is an argument from identical inputs, not an experiment.

## Criterion 4 — LLM consumability

**Verdict: the weakest criterion for Branch B. It produces nothing structured, and exposes nothing.**

Branch B *consumes* JSON but never *emits* it. `parsePrism` builds `{frontmatter, sections, preamble,
trailer, rawBody}` — a perfectly good structured object — and then throws it away: it is a local
`const` inside `render()` (`render.mjs:60-88`). The element's public surface, read off the live instance:

```json
{ "el_keys": [], "proto": ["constructor","connectedCallback","attributeChangedCallback","render"],
  "shadowRoot": false }
```

No `.parsed` getter, no `toJSON()`, no `prism:render` CustomEvent. A consuming agent or script cannot get
the structure out without re-importing `parsers/md.mjs` and re-parsing the file itself. The cycle doc's
framing — *"Branch B requires runtime `JSON.stringify` of in-memory state"* — turns out to be optimistic:
there is currently no in-memory state to stringify from outside.

Fixes are small and unimplemented: `this.parsed = parsed` plus a `dispatchEvent(new CustomEvent('prism:render', {detail: parsed}))`. Worth naming as the gap rather than pretending the criterion is neutral.

(Incidental: the header comment on `render.mjs:5` says it "renders into the element's shadow DOM". It does
not — it assigns `this.innerHTML`, light DOM, which is *why* the global `styles.css` works at all.
`shadowRoot: false` measured. The comment is wrong, and the wrongness matters: anyone who "fixes" the code
to match the comment breaks all styling.)

## Criterion 5 — Maintenance cost over ~50 cycles / 2 years

**Verdict: lowest per-artifact cost, highest tail risk. The tail risk is measured, not hypothetical.**

Cheap side: 594 lines total (`render.mjs` 115, `parsers/md.mjs` 108, `layouts/cycle.mjs` 105,
`layouts/default.mjs` 41, `styles.css` 225). No `package.json`, no lockfile, no `node_modules`, nothing to
`npm audit`. Adding artifact type N+1 is one file plus one line in the `LAYOUTS` map. 50 cycles adds 50
markdown files and zero derived files — versus 150 derived files for Branch A at three formats each.

Expensive side: **a hard runtime dependency on a third party, with a silent-blank-page failure mode.**
Both layouts `import { marked } from 'https://cdn.jsdelivr.net/npm/marked@13/+esm'` — 38,996 bytes fetched
from jsDelivr on every load, no SRI hash, no integrity pin, no local fallback, and `marked@13` floats
across all 13.x minors and patches.

Blocking `*cdn.jsdelivr.net*` and reloading:

```
[net-fail]   <- https://cdn.jsdelivr.net/npm/marked@13/+esm
DOM: {"bodyText":"","hasArticle":false,"elChildren":0}
```

Completely blank page. Not the `.prism-error` box, not the `.prism-loading` state — nothing, because the
static `import` fails at module-evaluation time so `customElements.define` never runs. Every carefully
written error path in `render.mjs` is downstream of a dependency that can take the whole thing out. Over
two years that is: no offline reading, no reading on a locked-down network, and a supply-chain surface
(unpinned, unhashed, third-party) on every view of every artifact. Branch A vendors `marked` into
`node_modules` with a `pnpm-lock.yaml`; its rendered HTML keeps working with the network unplugged.

## Criterion 6 — Standalone fork-ability

**Verdict: architecturally yes; as currently packaged, no.**

Nothing in the code imports Branch A. Five files, MIT, zero build — the `<soma-artifact src="…">` element
is a legible, self-contained idea and the most obviously *extractable* of the two branches.

What blocks it today:

- `README.md:9` says **"Status: Scaffold only. Phase 1.B implementation queued"** — the implementation has
  been on disk since `4a0e5f9`. The README describes a project that no longer exists.
- The same README advertises `<soma-artifact src="./decision.xml">` as working format-agnostic dispatch.
  It is a stub that renders an error (see Criterion 7). A fork's front page currently overclaims.
- `README.md:54` calls the `python3 -m http.server` requirement *"a one-time setup; the resulting URL is
  just as ergonomic as a built file."* Measured, it is worse than that: without the server you don't get a
  degraded experience, you get a blank page with a console-only CORS error.
- The distribution story is `cdn.jsdelivr.net/gh/curtismercier/prism@v0.1/branches/cdn-renderer/` — a path
  through the *monorepo*. Extraction means moving files and breaking that URL for anyone who used it.
- No tests, no CI, no conformance fixtures. Before this audit, **it had never been run against any artifact
  other than `cycle-215.md`** — a project whose entire test surface was one file.
- No license header in the source files, only the repo-level `LICENSE-MIT`.

None of these are architectural. All of them are the difference between "code that works" and "a project
someone else can adopt."

## Criterion 7 — Format-agnosticism

**Verdict: one and a half of three formats. Measured.**

| Extension | Result | Evidence |
|---|---|---|
| `.md` | ✅ full | both artifacts render; 11 and 5 sections respectively |
| `.json` | ⚠️ partial — **drops `preamble` and `trailer`** | see below |
| `.xml` | ❌ not implemented | renders `XML parsing not yet implemented (Phase 2.B)` |
| unknown ext | ✅ clean error | `Unknown extension: .xyz` path exists |
| 404 | ✅ clean, helpful error | `Failed to load ./does-not-exist.md / HTTP 404 / …serve via python3 -m http.server…` |

The `.json` gap is concrete. `examples/decision-example.json` (Branch A's output) has keys
`['type','frontmatter','sections','preamble','trailer','references']`. `render.mjs:67` hardcodes
`preamble: '', trailer: ''`. Measured on the `.json` render: all five sections present,
`hasPreamble: false` — the ADR's title block (`# ADR-0 — Use Section Anchors Over Heading-Based Parsing`
plus its summary blockquote) is **silently dropped**, though the same file rendered from `.md` shows it.
Two formats of the same artifact render different content, with no warning. The top-level `type` and
`references` keys are ignored too.

One-line fix, noted not applied: `render.mjs:67` → use `obj.preamble || ''` and `obj.trailer || ''`.

So the criterion's premise — that Branch B's runtime dispatch handles `.md`/`.json`/`.xml` natively — is
**half true today**. The *dispatch mechanism* (extension → parser) is genuinely clean and would extend to
a `task.json` taskboard in a few lines. The *implementations behind it* are one complete, one lossy, one
absent. Judged on architecture Branch B looks strong here; judged on what actually runs, it is not yet
ahead of a CLI with per-format parser paths.

---

## Console errors and failures

Verbatim, per page.

**`8901/examples/index.html` (cycle-215.md), full reload with `ignoreCache`:**

```
[log.error] network | Failed to load resource: the server responded with a status of 404 (File not found) | http://localhost:8901/favicon.ico
[log.error] network | Failed to load resource: the server responded with a status of 404 (File not found) | http://localhost:8901/favicon.ico
TOTAL_EVENTS 2
```

Favicon only. **Zero JS errors, zero exceptions, zero `console.warn` from the parser.**

**`8902/branches/cdn-renderer/examples/phase4-decision-test.html` (decision-example.md), full reload:**

```
[log.error] network | Failed to load resource: the server responded with a status of 404 (File not found) | http://localhost:8902/favicon.ico
[log.error] network | Failed to load resource: the server responded with a status of 404 (File not found) | http://localhost:8902/favicon.ico
TOTAL_EVENTS 2
```

Same — clean. The never-before-tested cross-type artifact rendered without a single error.

**`file://…/examples/index.html`:** two CORS errors + two `net::ERR_FAILED`, blank page (quoted in full
under Criterion 2).

**`8901/examples/index.html` with jsDelivr blocked:** one `Network.loadingFailed` on the `marked` URL
(CDP reported an empty `errorText` — the block is DevTools-injected), blank page, `elChildren: 0`, no
user-visible message.

**Handled failure paths that behaved well:** `.xml` → clear "not yet implemented" notice; 404 → error box
naming the URL, the HTTP status, and the `file://`/http-server remedy. The error *design* is good. The
problem is that the two failures that actually blank the page both occur upstream of it.

---

## Honest weaknesses

Ordered by how much they'd hurt a real user, most first. Nothing here was fixed.

1. **Blank page when jsDelivr is unreachable** (measured). A hard third-party runtime dependency, unpinned
   below the major, no SRI, no fallback, no error. Offline reading is impossible.
2. **Blank page on `file://`** (measured). The graceful hint written for exactly this case cannot execute.
3. **Reload does not reliably show your edits** (measured: `transferSize: 0` on plain reload). Undermines
   the branch's core pitch. `fetch(src, {cache:'no-cache'})` would fix it.
4. **Section deep links don't work in either direction** (measured): `#section-x` on load lands at
   `scrollY: 0`; TOC clicks never write `location.hash`.
5. **No structured output and no public API** (measured: empty `el_keys`, prototype has only lifecycle +
   `render`). Criterion 4 is currently a zero, not a partial.
6. **`.json` input silently loses `preamble`/`trailer`** (measured). Two formats of one artifact render
   different content, no warning.
7. **Double render on every initial page load** (measured: 2 concurrent fetches at `start: 19`; 1 when
   appended dynamically). Missing guard on the upgrade path.
8. **The layout fix rests entirely on `:has()`** with no `@supports` fallback, and half of it
   (`max-width: none`) is a no-op. A structural class from `renderDefault` would be sturdier than a
   selector-support bet.
9. **`renderDefault` throws away the artifact's real title.** `decision-example.md` has no `title:` in
   frontmatter, so the `<h1>` reads literally **"PRISM artifact"** while the true title
   (`# ADR-0 — Use Section Anchors…`) sits below in the preamble block. Measured: `"h1": "PRISM artifact"`.
   The default layout also dumps *every* frontmatter key into a `<dl>`, so `type` and `status` are shown
   twice (once as a pill, once as a row) — visible in the screenshot.
10. **Unstyled status values.** `status: accepted` → class `status-accepted`, for which `styles.css` has
    no rule; it falls back to generic grey. The status palette only covers cycle vocabulary
    (shipped / in-progress / queued / drafted / superseded / archived).
11. **Every section renders its `data-section` tag *and* its own `##` heading** — "CONTEXT / Context",
    "OPTIONS / Options" — in both layouts. Visible duplication in both screenshots.
12. **Unsanitised HTML passthrough.** Measured by importing the modules in-page and parsing a synthetic
    source: `renderDefault` output contained `onerror=` verbatim (`rawHtmlPassthrough: true`). `marked`
    runs with defaults, and the hand-rolled `escape()` (`layouts/*.mjs`) covers `& < > "` but not `'`.
    For local files this is the same trust model as any markdown viewer; for a CDN element pointed at a
    remote `src`, it is stored XSS in the page that embeds it.
13. **The frontmatter parser is a deliberate ~50-line YAML subset.** It worked on both artifacts here, but
    it has no error reporting: a malformed key is silently skipped, not flagged. `parsePrism` does
    `console.warn` on an unclosed section — the only diagnostic in the codebase.
14. **`.cycle-body` / `.cycle-main` / `.cycle-header` class names are applied to non-cycle artifacts** —
    the naming that produced the original 200px bug is still in place.
15. **Untested territory remains large.** Two artifact types, both authored in-house, both well-formed.
    No tests for: nested dot-notation anchors (the filter at `layouts/cycle.mjs:38` is unexercised here),
    duplicate section names, unclosed anchors, empty sections, non-UTF-8, or very large files.

---

## Would it survive extraction as a standalone OSS project?

**As an idea, yes. As the directory currently stands, not without a week of work.**

What genuinely survives: a 594-line, dependency-light, zero-build custom element that turns an
anchor-tagged markdown file into a readable document with a sticky TOC, and does it with no JS errors on
both artifact types I threw at it. `<soma-artifact src="./cycle.md">` is a one-line adoption story, which
is the thing OSS projects mostly fail at. The parser is dependency-free and reusable on its own. The
extension→parser and type→layout dispatch tables are the right seams, and adding a `decision` layout is
demonstrably one file plus one line. The visual design is better than most spec reference
implementations.

What would have to change first, in order:

1. **Remove or make optional the runtime jsDelivr dependency**, or at minimum pin exactly + add SRI + fail
   loudly. Today the entire project can be turned off by someone else's outage, and it fails to a white
   screen. No OSS project ships that.
2. **Make `file://` degrade to a message instead of nothing.** An inline bootstrap in the example
   `index.html` that detects `location.protocol === 'file:'` and prints the http-server instruction would
   cost five lines and remove the single worst first-run experience.
3. **Fix `fetch` caching.** "Edit and refresh" must actually work; it is the whole pitch.
4. **Give the element a public surface** — `.parsed`, a `prism:render` event, maybe a static
   `SomaArtifact.parse()`. Without it the project is a viewer only, and Criterion 4 stays at zero.
5. **Tests.** Even three fixtures (cycle, decision, malformed) run in a headless browser in CI would have
   caught the 200px bug, the `.json` preamble loss, and the double render. This audit is the first time
   the second artifact type was ever rendered; that is the real finding behind the bug I was sent to look
   for.
6. **Truthful README** — it currently says "scaffold only", advertises working XML that errors, and
   describes the CORS constraint as ergonomically free.
7. **Decide the `:has()` posture** — either declare a modern-browser baseline explicitly, or emit a
   structural class and stop depending on selector support for correct layout.

Honest summary of what this audit establishes: the specific regression it was sent to find **is not
present** — `type: decision` renders full-width at 1080px, proven by counterfactual, with a clean console.
What it found instead is that the branch's *stated* advantages (edit-and-refresh, zero install,
format-agnostic, structured output for agents) are each partly compromised by a small, fixable, currently
unfixed defect — and that every one of those defects survived until now because the branch had exactly one
test artifact.

— audit run 2026-07-29, Chrome 151 over CDP, servers stopped.
