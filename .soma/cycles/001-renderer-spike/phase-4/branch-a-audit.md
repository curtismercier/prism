# Branch A audit — build-renderer (Node CLI)

Cycle 001 renderer spike, Phase 4. Evaluated against the 7 convergence criteria stated in
`.soma/cycles/001-renderer-spike/cycle.md`, section `decisions-to-surface`.

**Notation**: this report never writes a literal PRISM anchor comment. Wherever real CLI output
contained one, it is rendered here as `[[@section: name]]` / `[[/@section: name]]`. That
substitution is the only edit made to quoted output.

---

## Method

### Environment

| Item | Value |
|---|---|
| Node | v22.22.0 |
| npm | 11.12.1 |
| pnpm | 11.13.1 |
| OS | macOS 15.7.7, arm64 |
| Repo HEAD | `3f4d6d2` (2026-05-14 02:59:17 -0400) |
| Runtime deps | exactly one — `marked` 13.0.3 |
| Source size | 465 lines across 5 files (`bin/prism.mjs` 190, `src/parse.mjs` 89, `render-html.mjs` 129, `render-json.mjs` 18, `render-xml.mjs` 39) |

### Install

```
$ cd branches/build-renderer && pnpm install
[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY] Aborted removal of modules directory due to no TTY

If you are running pnpm in CI, set the CI environment variable to "true", or set "confirmModulesPurge" to "false".
```

This is a pnpm/environment interaction (a pre-existing `node_modules/` from a different installer),
not a renderer defect. With the documented workaround:

```
$ env CI=true pnpm install
Recreating .../branches/build-renderer/node_modules
Lockfile is up to date, resolution step is skipped
Packages: +1
dependencies:
+ marked 13.0.3
Done in 578ms using pnpm v11.13.1
```

A separate clean `npm install` in an isolated copy took **833ms** and added 1 package.

### Commands run (all output below is verbatim unless the `[[...]]` substitution applies)

```
node bin/prism.mjs validate ../../examples/cycle-215.md
node bin/prism.mjs validate ../../examples/decision-example.md
node bin/prism.mjs render   ../../examples/cycle-215.md --format all
node bin/prism.mjs render   ../../examples/decision-example.md --format all
node bin/prism.mjs read     ../../examples/cycle-215.md --section trigger
node bin/prism.mjs read     ../../examples/cycle-215.md --section phases
node bin/prism.mjs read     ../../examples/cycle-215.md --section bogus
node bin/prism.mjs append   <copy> --section <name> --content <various>
node bin/prism.mjs edit     <copy> --section context --content 'REPLACED BY AUDIT'
node bin/prism.mjs render   ../../examples/cycle-215.md --format all --out <new dir>
node bin/prism.mjs add-section <copy> --section newthing --content 'hello'
node bin/prism.mjs validate ../../examples/cycle-215.json
node bin/prism.mjs read     ../../examples/cycle-215.xml --section trigger
```

Mutating operations (`append`, `edit`) were run only against **copies** in a scratch directory,
never against tracked sources. `render` on `examples/*.md` writes derived artifacts that are already
gitignored (`.gitignore:16-19`), and the regenerated files are byte-identical to what was on disk
before the audit. No commits were made. No tracked file was modified by this audit.

### Integrity note — the tree changed under the audit

Partway through, `git status` showed `branches/build-renderer/bin/prism.mjs` and `src/parse.mjs`
modified by a concurrent process (not by this audit — this audit made no source edits). The change
adds an `unclosed` array to the parser and makes `validate` treat unclosed anchors as a blocking
error, and makes `ensureStylesheet` always overwrite instead of copy-if-absent.

Consequence: one finding below (unclosed/mismatched anchor treated as a warning, exit 0) was
**observed live at the start of the audit and fixed mid-audit by someone else**. Every other finding
was **re-verified against the post-change code** before this report was written; those re-runs are
marked "re-verified". Timings and byte counts were taken before the change; the change does not
touch any rendering path, so they stand.

---

## Criterion 1 — Authoring friction

**Verdict: mixed. Editing an existing section is genuinely cheap. Creating a new top-level section is unsupported by the CLI.**

Editing an existing section works and is cheap:

```
$ node bin/prism.mjs append edit-test.md --section trigger --content "APPENDED-MARKER: audit test line."
✓ appended to section: trigger

$ node bin/prism.mjs read edit-test.md --section trigger
## Trigger

cloud VPS at `158.69.202.96` went offline 2026-05-12 (billing). ...

APPENDED-MARKER: audit test line.
```

```
$ node bin/prism.mjs edit dupe-test.md --section context --content 'REPLACED BY AUDIT'
✓ replaced section: context
```

But **`add-section` (spec §6.4) is not implemented**:

```
$ node bin/prism.mjs add-section docs/cycle-215.md --section newthing --content 'hello'
prism — PRISM build-step renderer (Branch A)

Usage:
  prism render <file.md> [--format html|json|xml|all] [--out <path>]
  prism read   <file.md> --section <name>
  prism append <file.md> --section <name> --content <text>
  prism edit   <file.md> --section <name> --content <text>
  prism validate <file.md>
...
EXIT=1
```

`remove-section` (§6.5) and `index` (§6.8) are likewise absent. Unknown commands fall through to the
usage banner with no "unknown command" message.

The only CLI path to a new section is to smuggle anchors through `append`, which nests the new
section inside an existing one:

```
$ node bin/prism.mjs append edit-test.md --section outtake --content '[[@section: audit-note]]
Added by the Phase 4 audit via append, no heading.
[[/@section: audit-note]]'
✓ appended to section: outtake

$ node bin/prism.mjs read edit-test.md --section audit-note
Added by the Phase 4 audit via append, no heading.

$ node bin/prism.mjs validate edit-test.md
✓ edit-test.md: clean (17 sections, type=cycle)
```

That works, and it is cheap (no whole-file read), but the new section is a **child of `outtake`**,
not a peer. A true top-level section requires hand-editing the Markdown — which means locating an
insertion point, which means a whole-file read. Branch A does not reduce authoring friction for the
"add a new section" case the criterion literally names.

Cost of the render step after an authoring edit: one command, ~0.04s (see Criterion 2).

---

## Criterion 2 — Viewing friction

**Verdict: 3 commands cold, 1 command + a browser refresh per subsequent view. Output is fully static — no server, no JS, no CORS.**

Cold path from a fresh checkout:

1. `env CI=true pnpm install` — 578ms
2. `node bin/prism.mjs render ../../examples/cycle-215.md --format html` — ~0.04s
3. `open examples/cycle-215.html`

Render output:

```
$ node bin/prism.mjs render ../../examples/cycle-215.md --format all
✓ /Users/user/Gravicity/personal/prism/examples/cycle-215.html
✓ /Users/user/Gravicity/personal/prism/examples/cycle-215.json
✓ /Users/user/Gravicity/personal/prism/examples/cycle-215.xml
```

Wall-clock, zsh `time`, warm cache, three consecutive runs of `--format all`:

```
node bin/prism.mjs render ../../examples/cycle-215.md --format all  0.04s user 0.00s system 97% cpu 0.041 total
node bin/prism.mjs render ../../examples/cycle-215.md --format all  0.04s user 0.01s system 97% cpu 0.044 total
node bin/prism.mjs render ../../examples/cycle-215.md --format all  0.04s user 0.01s system 97% cpu 0.049 total
```

`read` is faster still: `0.02s user 0.00s system 96% cpu 0.028 total`. Essentially all of this is
Node startup; the parse/render work on a 12.5 KB document is not measurable at this resolution.

Byte sizes emitted (`wc -c`):

| Artifact | cycle-215 | decision-example |
|---|---|---|
| `.md` source | 12,566 | 4,212 |
| `.html` | 17,740 (+41%) | 6,236 (+48%) |
| `.json` | 14,988 (+19%) | 4,328 (+3%) |
| `.xml` | 15,327 (+22%) | 4,449 (+6%) |
| `styles.css` | 10,245 (copied, see below) | — |

Real strengths, verified:

- `grep -c '<script' examples/cycle-215.html` → `0`; `grep -c 'fetch(' ...` → `0`. The HTML is a
  complete static document (`<!DOCTYPE html>`, `<head>`, one `<link>`). It opens over `file://` with
  no web server and no CORS surface.
- Deep links work for top-level sections: 11 `id="section-…"` attributes and 11 matching TOC
  `<a href="#section-…">` links.

Real costs:

- The render **must be re-run after every source edit** — no watcher (explicitly out of scope per
  `cycle.md`), so the human loop is edit → re-run → refresh, not edit → refresh.
- Rendering **writes files into the source directory** by default, three of them plus a stylesheet.
- Deep-linking is top-level only: the five `phases.phase-N` nested sections get **no** `id` and no
  TOC entry. You cannot link a human to Phase 1.

---

## Criterion 3 — Agent token cost

**Verdict: the section read IS dramatically cheaper than a whole-file read — roughly 30× on this document. But two token-cost bugs exist, and one of them is exactly the kind of cross-branch difference the cycle says to treat as a bug.**

All token figures below are **estimates** computed as `bytes ÷ 4`. They are not tokenizer output.

Measured with `wc -c`:

| Operation | Bytes | Est. tokens (bytes÷4) |
|---|---|---|
| whole-file read of `cycle-215.md` | 12,566 | ~3,142 |
| `read --section trigger` | 416 | ~104 |
| `read --section phases` | 2,760 | ~690 |
| section-name enumeration (error path, see below) | 276 | ~69 |

```
$ node bin/prism.mjs read ../../examples/cycle-215.md --section trigger | wc -c
     416
$ wc -c ../../examples/cycle-215.md
   12566
```

A surgical edit of `trigger` costs roughly `read` (416 B) + `edit --content <new body>` (~416 B plus
the delta) ≈ **832 B ≈ ~208 est. tokens**, against ~3,142 est. tokens for a whole-file read alone.
That is a **~30× reduction on read, ~15× on the full read-then-edit round trip**. The core value
proposition of the spec holds up empirically on this branch.

Two caveats that erode it, both of which I consider bugs under this criterion:

**3a. There is no way to list section names.** No `list` command exists. Discovering what sections a
document has requires either a whole-file read (defeating the entire mechanism) or abusing the error
path:

```
$ node bin/prism.mjs read ../../examples/cycle-215.md --section bogus
Section not found: bogus
Available: trigger, context, phases, phases.phase-0, phases.phase-1, phases.phase-2, phases.phase-3, phases.phase-4, ruled-out, decisions-locked, decisions-to-surface, scope-clarification, local-atom-spectrum, parity-discipline, out-of-scope, outtake
EXIT=1
```

276 bytes on **stderr with exit code 1**. It works and it is cheap, but an agent has to deliberately
trigger a failure to enumerate a document. That is a design gap, not a feature.

**3b. The JSON and XML projections duplicate all nested-section content.** `phases` is emitted as a
key containing the full nested prose *including the raw anchor comments*, and each of the five
`phases.phase-N` children is **also** emitted as its own key:

```
$ python3 -c "import json; d=json.load(open('cycle-215.json')); print(list(d['sections'].keys()))"
['trigger', 'context', 'phases', 'phases.phase-0', ..., 'phases.phase-4', 'ruled-out', ...]

$ grep -o 'phases.phase-[0-4]' cycle-215.json | sort | uniq -c
   3 phases.phase-0
   3 phases.phase-1
   3 phases.phase-2
   3 phases.phase-3
   3 phases.phase-4
```

(3 = the JSON key + the open anchor + the close anchor embedded inside the `phases` blob.)

Summed nested-section sizes: 572 + 838 + 451 + 259 + 250 = **2,370 bytes duplicated** in a
14,988-byte JSON — **~15.8% of the payload an LLM consumer pays for is a verbatim second copy**
(~590 est. tokens wasted per read of the JSON projection). The same duplication is present in the
XML. The nested anchors also leak into the HTML (10 occurrences of `[[@section: phases.phase-N]]` /
its close form) where they are invisible but still cost bytes.

**Saying it loudly, as the cycle asks**: the section read *is* cheaper — that part is not a bug.
The bug is the ~16% duplicated payload in the structured projections. If Branch B's JSON output does
not duplicate nested sections, that is a Branch A defect to fix, not a Branch A characteristic to
defend.

---

## Criterion 4 — LLM consumability (useful XML/JSON)

**Verdict: strongest criterion for this branch. Both projections are structurally valid and the JSON matches spec §7.2 exactly — with the duplication caveat from Criterion 3.**

```
$ python3 -c "import json; d=json.load(open('cycle-215.json')); print('VALID JSON, keys:', list(d.keys())); print('refs:', d['references'])"
VALID JSON, keys: ['type', 'frontmatter', 'sections', 'preamble', 'trailer', 'references']
refs: {'depends_on': ['cycle:162', 'cycle:153'], 'companion': ['cycle:152', 'cycle:165'], 'supersedes': None, 'parent': None}
```

That top-level shape is a literal match for the spec §7.2 example. References parse correctly,
including stripping the trailing `# comment` from YAML list items.

```
$ python3 -c "import xml.etree.ElementTree as ET; ET.parse('cycle-215.xml'); print('WELL-FORMED')"
WELL-FORMED
$ python3 -c "import xml.etree.ElementTree as ET; ET.parse('decision-example.xml'); print('WELL-FORMED')"
WELL-FORMED
```

Both XML projections are well-formed, including the CDATA escaping of Markdown bodies
(`render-xml.mjs:21` handles the `]]>` split correctly). The conservative "keep Markdown as CDATA
text" choice is documented in the source and is defensible.

Gaps against the spec:

- Spec §7.3's illustrative XML nests `<phase name="…" status="…">` elements inside
  `<section name="phases">`. Branch A emits flat `<section>` elements only. The spec explicitly
  grants latitude here, so this is conformant — but it means the XML projection carries no more
  structure than the JSON, which weakens its distinct purpose.
- The duplication from Criterion 3b applies to both projections.

Net: the criterion's own framing — "Branch A naturally emits these" — is confirmed. Two well-formed,
spec-shaped machine projections for ~57 lines of renderer code.

---

## Criterion 5 — Maintenance cost over 50 cycles / 2 years

**Verdict: genuinely reproducible, very small surface — but the repo's own habits already show the drift failure mode this branch invites.**

Reproducibility is real and verified. The same source rendered into two different directories
produced byte-identical output:

```
$ diff scratch/out/cycle-215.html extracted/docs/cycle-215.html
HTML-DIFF-EXIT=0
```

And the projections **committed** to `branches/build-renderer/examples/` are byte-identical to a
fresh render today:

```
$ diff branches/build-renderer/examples/cycle-215.html examples/cycle-215.html
DIFF-EXIT=0
$ diff branches/build-renderer/examples/cycle-215.json examples/cycle-215.json
DIFF-EXIT=0
```

Surface area is small: 465 lines, one dependency (`marked` 13.0.3), no build step for the package
itself, ESM only. Extrapolating 50 cycles, the per-update burden is one command per changed file.

Against that:

- **Derived artifacts are committed to git in this branch.** `git ls-files branches/build-renderer/`
  returns `examples/cycle-215.html`, `.json`, `.xml`. Spec §2.3 says projections are "never
  hand-edited, gitignored or generated on demand." They happen to be in sync *today*; over 50
  cycles, with no watcher and no pre-commit hook, three tracked artifacts per document is exactly
  the drift surface the spec warns about. The root `examples/` directory does it right
  (`.gitignore:16-19`); this branch's own directory does not.
- **A concrete instance of that drift already happened.** The concurrent edit to `ensureStylesheet`
  landed with this comment in the source: *"This used to be copy-only-if-absent, which silently
  pinned any output dir to whatever stylesheet landed there first. That is how the v0.1.1 non-cycle
  narrow-column fix failed to reach `branches/build-renderer/examples/` — a stale pre-fix
  styles.css sat there and was never refreshed, so the fixed bug reproduced at 200px on every
  subsequent render."* The build-step model's stale-derived-artifact failure mode has already bitten
  this project once, before it has a single real user.
- Every source edit requires remembering to re-render. The cycle scopes watchers out, which is fine
  for v0.1, but it means the 50-cycle maintenance story depends on a pre-commit hook that does not
  exist yet.

---

## Criterion 6 — Standalone fork-ability

**Verdict: NO, not as it stands. Branch A does not survive extraction. This is the single most damaging finding in the audit.**

`bin/prism.mjs:61` resolves the stylesheet out of the **sibling branch**:

```js
const cdnStyles = resolve(PKG_ROOT, '../cdn-renderer/styles.css');
```

Branch A ships no stylesheet of its own. `package.json` `files` is `["bin/", "src/", "README.md"]` —
so a published npm package cannot contain one either.

I tested extraction empirically: copied `bin/`, `src/`, `package.json` into an isolated directory
with **no** `cdn-renderer` sibling, ran `npm install` (833ms, 1 package), and rendered:

```
$ node bin/prism.mjs render docs/cycle-215.md --format all
✓ .../extracted/docs/cycle-215.html
✓ .../extracted/docs/cycle-215.json
✓ .../extracted/docs/cycle-215.xml
$ ls docs/
cycle-215.html  cycle-215.json  cycle-215.md  cycle-215.xml
$ grep -n 'stylesheet' docs/cycle-215.html
7:  <link rel="stylesheet" href="./styles.css">
```

**No `styles.css` was produced. Exit code 0. No warning.** The extracted renderer emits HTML with a
dangling stylesheet link — an unstyled wall of text, which is precisely the friction PRISM exists to
remove. Re-verified against the post-change code (the `existsSync(cdnStyles)` guard means the
"always overwrite" fix does not help when the sibling is absent).

In-repo, the dependency is live and observable — rendering to a fresh directory produced a
10,245-byte `styles.css` there, the exact size of `branches/cdn-renderer/styles.css`.

Secondary extraction blockers found:

- **Package name mismatch.** `README.md` tells users to `npm install -g @gravicity/prism-build` and
  `npx @gravicity/prism-build …`. `package.json` says `"name": "@curtismercier/prism-build"`. A
  forker following the README installs a package that does not exist.
- **README is stale to the point of being wrong.** It says *"Status: Scaffold only. Phase 1.A
  implementation queued"* for a fully working CLI, and lists `gray-matter` as a dependency — the
  frontmatter parser is hand-rolled and `gray-matter` appears nowhere in `package.json` or the
  source.
- **No LICENSE file in the package directory**, despite `package.json` declaring MIT and the branch
  dossier planning one. `files` does not include a license either.
- The branch dossier plans `src/templates/{cycle,decision,default}.html`; none exist, and there is no
  `decision` layout (see Criterion 7).

None of these are hard to fix. But the question asked was "could this branch alone be a useful OSS
project" and the honest answer today is: it produces unstyled output, under a name nobody can
install, with a README describing a different program.

---

## Criterion 7 — Format-agnosticism

**Verdict: weakest criterion for this branch. Markdown-in only, and non-Markdown input is mis-parsed rather than rejected.**

`cmdRender`/`cmdRead`/`cmdValidate` call `parsePrism()` unconditionally on whatever file they are
handed. There is no format dispatch. Feeding back the branch's own projections:

```
$ node bin/prism.mjs validate ../../examples/cycle-215.json
✗ ../../examples/cycle-215.json:
  - missing frontmatter: type
  - missing frontmatter: status
EXIT=1
```

A clean-ish failure, though the message is misleading (the file has a `type` — the CLI simply cannot
read JSON). The XML case is worse:

```
$ node bin/prism.mjs read ../../examples/cycle-215.xml --section trigger
Section not found: trigger
Available: phases.phase-0, phases.phase-1, phases.phase-2, phases.phase-3, phases.phase-4
EXIT=1
```

The Markdown parser found five "sections" inside an XML file — because the nested anchor comments
embedded in the CDATA of the `phases` section look like anchors to the regex. Branch A **silently
half-parses XML** and reports a confident, entirely bogus section list. A clean rejection would be
better than this.

Extending to new **artifact types** is also a code change, not configuration. `render-html.mjs:105`
is `const LAYOUTS = { cycle: renderCycle };` — one entry. `decision` falls through to
`renderDefault`, with visible consequences:

```html
<article class="prism prism-default" data-type="decision">
    <header class="cycle-header">
      <h1>PRISM artifact</h1>
```

The decision artifact renders with the title **"PRISM artifact"** — in the `<h1>` and in the
`<title>` tag — because `decision-example.md` has no `title:` in frontmatter and Branch A does not
implement the spec §4.2 fallback ("falls back to first H1 in body"). The real title,
"ADR-0 — Use Section Anchors Over Heading-Based Parsing", sits in the preamble. Non-cycle types also
get no TOC and a raw `<dl>` frontmatter dump.

So: a new input format needs a new parser path *and* a dispatch layer that does not exist; a new
artifact type needs a new entry in a hardcoded map plus a layout function. For the criterion's
examples — a `task.json` taskboard or a `decision.xml` ADR — Branch A as built handles neither.

---

## Failures and bugs found

Ordered by severity. Every one was reproduced against the code as it stands after the concurrent
mid-audit change, except where noted.

### 1. `append` corrupts content containing `$&` (or any `$`-replacement pattern) — silent document corruption

`bin/prism.mjs:125` uses `text.replace(closeTag, insertion + closeTag)`. JS `String.replace`
interprets `$&`, `` $` ``, `$'`, `$n` in the **replacement** string. Content is not escaped.

```
$ node bin/prism.mjs append recheck.md --section trigger --content 'BUDGET: 90% $& remaining'
✓ appended to section: trigger
$ grep -n 'BUDGET' recheck.md
41:BUDGET: 90% [[/@section: trigger]] remaining
```

`$&` expanded to the matched close anchor. The document now contains a **duplicated close anchor
mid-content**; the text " remaining" is orphaned outside the section. Exit code 0, success message.
Earlier run on a different section produced the same corruption and `validate` still called the file
`clean (16 sections, type=cycle)`.

### 2. `--content` beginning with `--` is silently replaced by the literal string `true` — data loss

`parseArgs` (`bin/prism.mjs:48`) treats any following token starting with `--` as absent and sets the
flag to boolean `true`. `cmdAppend`'s `!flags.content` guard passes for `true`, and the template
literal writes it out.

```
$ node bin/prism.mjs append recheck.md --section context --content '--- horizontal rule note'
✓ appended to section: context
```

Resulting file, line 61: `true`

The user's content is gone, replaced by `true`, with a success message and exit 0. Any Markdown
starting with `---` (a horizontal rule, a frontmatter fence, a table separator) or `--` triggers it.

### 3. `--out <dir>` crashes with an uncaught ENOENT if the directory does not exist

The CLI never creates the output directory. `--out` is documented in the usage banner and in spec
§6.6.

```
$ node bin/prism.mjs render recheck.md --format html --out .../scratch/nodir
node:fs:3097
  binding.copyFile(
          ^

Error: ENOENT: no such file or directory, copyfile '/Users/user/Gravicity/personal/prism/branches/cdn-renderer/styles.css' -> '.../scratch/nodir/styles.css'
    at copyFileSync (node:fs:3097:11)
    at ensureStylesheet (file://.../bin/prism.mjs:70:5)
    at cmdRender (file://.../bin/prism.mjs:86:7)
    ...
Node.js v22.22.0
EXIT=1
```

Raw stack trace, no handled error message. Creating the directory first makes the same command
succeed.

### 4. Duplicate section names silently drop content from every projection

Spec §3.1: "A name MUST be unique within a single document." `parse.mjs:81` is
`if (!sections.has(name)) sections.set(name, content)` — first wins, no warning.

Fixture with `trigger` declared twice:

```
$ node bin/prism.mjs validate dupe-test.md
✓ dupe-test.md: clean (3 sections, type=cycle)
EXIT=0

$ node bin/prism.mjs read dupe-test.md --section trigger
FIRST-COPY

$ node bin/prism.mjs render dupe-test.md --format json
✓ .../dupe-test.json
$ grep -c 'SECOND-COPY' dupe-test.json
0
$ grep -c 'FIRST-COPY'  dupe-test.json
1
```

The second section's content is absent from the projection. The projection is not a faithful
representation of the source, and nothing tells you. Re-verified on current code.

### 5. Anchors inside fenced code blocks are parsed as real sections

Spec §3.4: "Anchor inside code fence — should be ignored (the parser MUST tokenize code fences
first)." `parse.mjs` runs a global regex over the raw body with no fence tokenisation.

A fixture with an anchor pair inside a ` ```markdown ` fence, used purely as documentation:

```
$ node bin/prism.mjs read fence-test.md --section nope
Section not found: nope
Available: trigger, context, example-in-fence, phases
```

`example-in-fence` became an addressable section. Re-verified on current code. This is a stated MUST
in the spec and it also means **any PRISM document that documents PRISM syntax corrupts its own
section map** — which is exactly why this report uses the `[[...]]` substitution.

### 6. Mismatched / unclosed anchors reported as a warning, exit 0 — FIXED MID-AUDIT BY A THIRD PARTY

Observed at the start of the audit:

```
$ node bin/prism.mjs validate fence-test.md
[prism] unclosed section: @section: mismatched-open
✓ fence-test.md: clean (4 sections, type=cycle)
EXIT=0
```

Spec §3.4 says mismatched anchors MUST error; §6.7 says `validate` checks anchor balance and returns
non-zero. After the concurrent edit to `parse.mjs`/`prism.mjs`, the same command gives:

```
$ node bin/prism.mjs validate fence-test.md
[prism] unclosed section: @section: mismatched-open
✗ fence-test.md:
  - unclosed section anchor: mismatched-open (opened but never closed — section is unaddressable)
EXIT=1
```

Recorded for the record: this was a live defect when Phase 4 began. It is fixed now. It was not
fixed by this audit.

### 7. `validate` under-enforces required sections and ignores artifact type

`cmdValidate` checks only `trigger`, `context`, `phases` for `type: cycle`. Spec §5.1 requires five
(`decisions-locked` and `out-of-scope` are not checked). No other type is checked at all:

```
$ node bin/prism.mjs validate ../../examples/decision-example.md
✓ ../../examples/decision-example.md: clean (5 sections, type=decision)
EXIT=0
```

That file happens to be well-formed, but a `decision` missing `options` or `consequences` (spec
§5.2) would pass identically. There is no type registry.

### 8. Missing file produces an uncaught ENOENT stack trace

```
$ node bin/prism.mjs append edit-test.md --section outtake --content '…'
node:fs:440
    return binding.readFileUtf8(path, stringToFlags(options.flag));
                   ^
Error: ENOENT: no such file or directory, open '.../extracted/edit-test.md'
    at readFileSync (node:fs:440:20)
    at cmdAppend (file://.../bin/prism.mjs:117:14)
    ...
```

No input-existence check anywhere in the CLI.

### 9. Spec §6.6 stdout behaviour not implemented

"With no `--out`, prints to stdout for single format, otherwise writes next to source." `cmdRender`
always calls `writeFileSync`. There is no way to get a projection on stdout — an agent that wants
the JSON must write a file, read it back, and then clean it up.

### 10. References are not hyperlinked in the Visual projection

Spec §4.4: implementations MUST resolve references at projection time; §7.1: SHOULD render them as
hyperlinks. They render as inert spans:

```html
class="ref">cycle:162</span>
class="ref">cycle:153</span>
```

### 11. Nested sections get no HTML `id` and no TOC entry

11 top-level sections produce 11 ids and 11 TOC links; `phases.phase-0` … `phases.phase-4` produce
none. Their anchor comments do pass through into the HTML (10 occurrences), costing bytes without
providing deep links.

### 12. `title` does not fall back to the first H1 (spec §4.2)

`decision-example.html` renders `<title>PRISM artifact</title>` and `<h1>PRISM artifact</h1>`
instead of "ADR-0 — Use Section Anchors Over Heading-Based Parsing".

### Code observation, not empirically triggered

`parse.mjs:7` — `name.replace('.', '\\.')` uses a string first-argument, which replaces only the
**first** dot. A section named `a.b.c` would build a close-regex with an unescaped second dot, which
matches any character. I did not construct a document that this actually corrupts, so I am flagging
it as a latent issue rather than a confirmed bug.

---

## Honest weaknesses of this branch

Beyond the enumerated bugs, the structural weaknesses:

1. **It cannot stand alone.** The stylesheet — the entire reason the HTML projection is nicer than
   raw Markdown to a human — belongs to the other branch. Extracted, Branch A produces unstyled
   output and says nothing about it.

2. **Its edit primitives are string-surgery, not parser-backed.** `cmdEdit` and `cmdAppend` use
   `indexOf` and `replace` on exact anchor strings, while `parsePrism` uses a permissive regex
   (`<!--\s*@section:\s*…`). The two disagree: a document with non-canonical anchor spacing parses
   fine and reads fine but cannot be edited. Bugs 1 and 2 above are both direct consequences of
   editing with string operations instead of using the ranges the parser already computed
   (`parse.mjs:80` builds `contentStart`/`contentEnd` for every section — and then no edit path
   uses them).

3. **Every mutating operation reports success on failure.** Bugs 1, 2 and 4 all end with `✓` and
   exit 0 while the document is wrong. For a tool whose pitch is "agents edit surgically without
   re-reading," silent corruption is the worst possible failure mode: the agent has no whole-file
   read with which to notice.

4. **The write-side ergonomics fight the read-side win.** The token argument (Criterion 3) says
   "never read the whole file." But there is no `list`, no stdout, no `add-section` — so the
   realistic agent workflow still involves a whole-file read to find out what is there, or an
   deliberately-failed command to enumerate.

5. **The build-step model's known failure mode has already occurred here**, before any external
   user: a stale derived `styles.css` masked a fixed rendering bug for an entire release. Three
   derived artifacts are committed to git in this branch with no hook keeping them fresh.

6. **Documentation does not describe the program.** README says "scaffold only" for a working CLI,
   names a dependency it does not use, and gives an npm package name that does not match
   `package.json`.

7. **It is Markdown-only, and fails ugly on anything else** — including its own output.

What is genuinely good, stated plainly so the parent can weigh it: 465 lines, one dependency,
sub-50ms runs, byte-deterministic output, spec-shaped JSON, well-formed XML, and static HTML that
opens over `file://` with no server, no JS and no CORS. Those are real and they are the things a
runtime renderer structurally cannot offer.

---

## Would it survive extraction as a standalone OSS project?

**Not today. With roughly a day of work, yes — and the day of work is mostly not renderer code.**

Blocking, in order:

1. **Vendor a stylesheet.** Copy `styles.css` into `branches/build-renderer/`, add it to
   `package.json` `files`, drop the `../cdn-renderer/` resolve. Until this is done the extracted
   package's headline feature produces unstyled HTML silently. (If the two branches are meant to
   share one stylesheet permanently, extract it to a third shared package — but then neither branch
   is independently forkable, which is a convergence decision, not an implementation detail.)
2. **Fix the two silent-corruption bugs** (`$&` replacement; `--`-prefixed content). Both are
   one-line fixes — a replacer function, and a `--content=` / `--` sentinel in `parseArgs` — and
   both currently destroy user data with a success message.
3. **Reconcile README with reality**: package name, status, dependency list. Add the LICENSE file.
4. **Create the `--out` directory** (`mkdirSync(dir, {recursive: true})`) and handle missing input
   files.

Then it is a credible small OSS tool: "point it at anchored Markdown, get static HTML plus JSON and
XML, one dependency, no server." That is a real niche and 465 lines is an honest size for it.

What it would *not* be, even fixed, is a general PRISM implementation — no `add-section`,
`remove-section` or `index`; one artifact-type layout; Markdown input only; spec §3.4 code-fence
handling absent; duplicate-name and reference-resolution requirements unmet. Presented as
"a build-step viewer for PRISM `cycle` documents," it is honest. Presented as "the PRISM reference
implementation," it is not.

---

### Audit hygiene

- No git commits made.
- No tracked file modified by this audit. The two modified tracked files in `git status`
  (`bin/prism.mjs`, `src/parse.mjs`) were changed by a concurrent process, not by this audit — see
  the integrity note in Method.
- `render` regenerated the gitignored derived artifacts under `examples/`; the regenerated bytes are
  identical to what was there before.
- Fixtures and the extraction test live under
  `.soma/cycles/001-renderer-spike/phase-4/scratch/` (untracked). Removal was attempted and denied
  by the sandbox, so they remain on disk as reproducible evidence. They can be deleted safely.
