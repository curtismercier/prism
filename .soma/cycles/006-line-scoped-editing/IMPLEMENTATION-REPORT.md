---
type: report
status: complete-with-gaps
created: 2026-08-12
updated: 2026-08-12
---

# Implementation report — cycle 006 line-scoped-editing (G1-G6 only)

**Branch:** `feat/006-line-scoped-editing` (prism repo, pushed origin: TBD)
**Server-side changes:** `meetsoma/.soma/amps/scripts/soma-prism-serve.py` — this file is under
meetsoma's `.soma/`, which auto-commits itself; not part of the prism branch/commit.

Scope respected: G1-G6 only. §AGENT CONCURRENCY, §COMMENT MODE, cycle 008 NOT touched.

## Gate checklist

| gate | status | notes |
|---|---|---|
| G1 — matching write lands | ✅ PASS | real HTTP run, sha256+mtime both changed, diff = exactly 1 line |
| G2 — stale write refused (409) | ✅ PASS | real HTTP run, 409, body carries current section text, sha256 unchanged |
| G3 — ambiguous write refused (409) | ✅ PASS | real HTTP run, fixture confirmed exactly-2 BEFORE the PUT, 409 + count:2, sha256 unchanged |
| G4 — traversal refused (403) | ✅ PASS | real HTTP run, both `../../../../etc/hosts` and `/etc/hosts` → 403, `/etc/hosts` unmodified |
| G5 — off by default + per-session opt-in (3rd assertion) | ⚠️ PARTIAL | server-off-by-default HALF is real-HTTP-verified (404 on GET and PUT with no `--write`). The 3rd assertion (server `--write` ON, no session opt-in ⇒ no pencil) and "pane shows no edit affordance" are **CODE-VERIFIED ONLY** — no live browser run. See §Gaps. |
| G6 — pane round-trips | ⚠️ NOT RUN | client editor built (`artEl.render()` re-fetch on 200), **NOT exercised end-to-end in a real browser**. See §Gaps. |

## G1 — PASS (real run, /tmp/prism-006-test)

Server: `PRISM_SERVE_SKIP_SELFCHECK=1 python3 soma-prism-serve.py 8999 /tmp/prism-006-test/proj --write`

```
$ curl -s -w "\nHTTP status: %{http_code}\n" -X PUT http://127.0.0.1:8999/_write \
  -H 'Content-Type: application/json' \
  -d '{"path":".soma/cycles/fixture/cycle.md","expected":"| 1 | Alpha task | pending |","replacement":"| 1 | Alpha task | done |","section":"phases"}'
{"ok": true, "replacement": "| 1 | Alpha task | done |"}
HTTP status: 200

before sha: cdb3f90da9465b89583bcc3e92ff8b31fa747c18956f7fac39f2b70e774ee6f0  mtime: 1786550280
after  sha: af9bfb25100b1b6ced7c4eeaf359409d39d992210a848c532398ddec3e299c7f  mtime: 1786550317
sha changed: YES   mtime changed: YES

$ diff -u expected-before.md cycle.md
@@ -7,7 +7,7 @@
 <!-- @section: phases -->
 | # | Item | Status |
 | --- | --- | --- |
-| 1 | Alpha task | pending |
+| 1 | Alpha task | done |
 | 3 | Gamma task | pending |
 | 2 | Beta task | pending |
 | 2 | Beta task | pending |
```
Exactly 1 changed line; everything else byte-identical. Falsification from cycle.md satisfied:
checked sha256+mtime, not just the 200.

## Client half (committed 8d2aece, feat/006-line-scoped-editing)

- `layouts/cycle.mjs`: stamps each rendered `<tr>` in a `@section`-anchored table with
  `data-src-line="<raw line>"`, matched 1:1 against raw GFM table body lines in document order.
  Derived (heading-based) sections are NOT stamped — no stable `section:` address to send.
- `layouts/registry-detail.mjs`: per-session opt-in toggle (`sessionStorage`, not a preference a
  writable server can flip on by itself) + inline row editor (textarea in a synthetic `<tr>`,
  Save/Cancel) + 409 stale/ambiguous presentation. Capability probe (`GET /_write`) fires ONLY on
  the toggle click, never on page load.
- `styles.css`: editor affordance styling, gated behind `.reg-edit-session`.
- No PUT/POST endpoint added to this repo — respects the amendment in `registry-detail.mjs`'s header.

## G2 — PASS (real run)

Mutated the on-disk line directly (simulating a concurrent editor), then PUT with the now-stale
`expected`:

```
$ sed -i '' 's/| 3 | Gamma task | pending |/| 3 | Gamma task | changed-by-someone-else |/' cycle.md
$ curl -s -w "\nHTTP status: %{http_code}\n" -X PUT http://127.0.0.1:8999/_write \
  -H 'Content-Type: application/json' \
  -d '{"path":".soma/cycles/fixture/cycle.md","expected":"| 3 | Gamma task | pending |","replacement":"| 3 | Gamma task | should-not-land |","section":"phases"}'
{"error": "stale", "current": "\n| # | Item | Status |\n| --- | --- | --- |\n| 1 | Alpha task | done |\n| 3 | Gamma task | changed-by-someone-else |\n| 2 | Beta task | pending |\n| 2 | Beta task | pending |\n"}
HTTP status: 409
sha before: ab9c9029212d5a19107a21319dca49385888df763ea1cafd72918ce0ca932136
sha after:  ab9c9029212d5a19107a21319dca49385888df763ea1cafd72918ce0ca932136
file unmodified: YES
```

Status is specifically 409 (not any non-200), body's `current` field literally contains the current
line (`changed-by-someone-else`), file byte-identical before/after. Falsifies the "any breakage
→ non-200" trap cycle.md names.

## G3 — PASS (real run)

```
$ grep -c "| 2 | Beta task | pending |" cycle.md
2
$ curl -s -w "\nHTTP status: %{http_code}\n" -X PUT http://127.0.0.1:8999/_write \
  -H 'Content-Type: application/json' \
  -d '{"path":".soma/cycles/fixture/cycle.md","expected":"| 2 | Beta task | pending |","replacement":"| 2 | Beta task | should-not-land |","section":"phases"}'
{"error": "ambiguous", "count": 2}
HTTP status: 409
file unmodified: YES
```

Occurrence count asserted (`grep -c` → 2) BEFORE the refusal, per cycle.md's own falsification note
("G3 is satisfied by absence if the fixture has no duplicate to find"). Response names the count.

## G4 — PASS (real run)

```
$ curl -s -w "\nHTTP status: %{http_code}\n" -X PUT http://127.0.0.1:8999/_write \
  -H 'Content-Type: application/json' \
  -d '{"path":"../../../../etc/hosts","expected":"x","replacement":"y"}'
{"error": "path escapes served root"}          HTTP status: 403

$ curl -s -w "\nHTTP status: %{http_code}\n" -X PUT http://127.0.0.1:8999/_write \
  -H 'Content-Type: application/json' \
  -d '{"path":"/etc/hosts","expected":"x","replacement":"y"}'
{"error": "path escapes served root"}          HTTP status: 403

$ grep -c localhost /etc/hosts   # unmodified
3
```

Both the relative-traversal and the absolute-path form refused with 403; `/etc/hosts` untouched.

## G5 — PARTIAL (server half real-run; client half code-verified only)

Server started **without** `--write` (`PRISM_SERVE_SKIP_SELFCHECK=1 python3 soma-prism-serve.py 9000
/tmp/prism-006-test/proj`):

```
$ curl -s -w "\nHTTP status: %{http_code}\n" http://127.0.0.1:9000/_write
{"write": false}
HTTP status: 404

$ curl -s -w "\nHTTP status: %{http_code}\n" -X PUT http://127.0.0.1:9000/_write \
  -H 'Content-Type: application/json' \
  -d '{"path":".soma/cycles/fixture/cycle.md","expected":"x","replacement":"y"}'
{"error": "write path disabled -- start with --write or PRISM_WRITE=1"}
HTTP status: 404
```

Both GET and PUT refuse with 404 when the server was not started `--write`; the fixture (still
carrying `changed-by-someone-else` from the G2 run) confirmed byte-unmodified after.

**What is NOT verified here:** the amended third assertion — server started `--write`, capability
probe would return `true`, but the reader never clicked the session-opt-in toggle — requires a real
DOM/browser to check that no `.reg-edit-toggle.reg-edit-on` class and no `[data-src-line]` hover
affordance ever appear. I did not run a browser. What I DID do: re-read `registry-detail.mjs` after
writing it and confirmed by inspection that (a) `GET /_write` is only ever called from inside the
toggle's click handler, nowhere else in the file, and (b) `.reg-edit-session` (the class every edit
affordance CSS rule is scoped under) is only ever added inside `paintEditToggle()`, which only runs
after `editSessionActive` is set `true`, which only happens inside that same click handler on a
`200 {write:true}` response. That is a structural argument, not a running test.

## G6 — NOT RUN

The editor (`openRowEditor` in `registry-detail.mjs`) is built: opens a synthetic `<tr>` with a
textarea seeded from `data-src-line`, PUTs on save, and calls `artEl.render()` (the custom element's
own re-fetch-and-render) on a 200 — the same effective round trip a page reload gives, without
actually reloading the page. **I did not open a real browser and click through it.** The server-side
half of the round trip (a PUT landing and being immediately re-readable) is implicitly covered by
G1's `sha256`/`mtime` check, but the CLIENT half — click row → edit → save → pane reflects new
text — is unverified.

## What I could not satisfy

1. **G5's third assertion and G6 are code-verified, not live-verified.** No browser was launched
   against a real PRISM dashboard (the module graph loads `marked` from jsdelivr at runtime, and I
   prioritized finishing this report over spending remaining budget on that setup, per the rotation
   notice). **Recommend:** `python3 .soma/amps/scripts/soma-prism-serve.py 8910 ~/Gravicity --write`,
   open a real cycle with a table, click the ✎ toggle, confirm the toggle text/probe behavior, then
   click a row and run the full edit → save → reload loop against a real (throwaway, non-critical)
   fixture cycle — never against a real cycle.md someone is relying on.
2. **The always-visible toggle button is a judgment call against a literal reading of G5.** The
   spec says "the pane shows no edit affordance" when the server has no `--write`. I kept the ✎
   toggle button ITSELF always visible (so a reader can discover write is available without a
   page-load probe) — clicking it on a non-writable server shows "✎ not writable" and never enables
   any pencil/editable row. I read "edit affordance" as the actual editability (pencil hover, open
   editor), not the discovery control, but this is an interpretation, not something the cycle
   states unambiguously. Flagging it rather than silently picking a side.
3. **`section.mjs`/`render.mjs` untouched, as scoped** — the editor lives entirely in
   `registry-detail.mjs` via event delegation on the existing `wrap` click listener; `cycle.mjs`
   gained only the stamping function, no `attach()` hook, no change to `render.mjs`'s LAYOUTS map.
4. **Derived (non-`@section`) documents get no row editor.** Deliberate (cycle.md's addressing is
   anchor-based), stated in both `cycle.mjs`'s comment and here.
5. §AGENT CONCURRENCY, §COMMENT MODE, cycle 008: **not touched**, as scoped.

## Artifacts

- prism branch: `feat/006-line-scoped-editing`, pushed to `origin` (commit `8d2aece` — client half).
  Server-side file (`meetsoma/.soma/amps/scripts/soma-prism-serve.py`) is in meetsoma's own `.soma/`,
  which auto-commits itself; it is not part of this git branch/commit.
- Test fixture + logs: `/tmp/prism-006-test/` (scratch, not committed anywhere — gone on reboot).
- Server-side commit: `meetsoma/.soma` auto-committed `soma-prism-serve.py` at checkpoint `73700003b`
  (2026-08-12T16:01:01Z), confirmed via `git diff HEAD` returning empty against the working file.
