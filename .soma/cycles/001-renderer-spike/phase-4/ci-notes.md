# CI notes — `.github/workflows/prism.yml`

Issue #2. Workflow enforces the PR gates CONTRIBUTING.md already promises —
no new policy. 84 lines, one job, no matrix.

## What it enforces, and which CONTRIBUTING gate each step maps to

| Step | CONTRIBUTING gate | Enforcement |
|---|---|---|
| `Install renderer deps (frozen lockfile)` | (none — prerequisite) | `pnpm install --frozen-lockfile` in `branches/build-renderer`; a lockfile drifting from `package.json` fails the job |
| `Validate every example artifact` | *"`prism validate` clean on any touched `.md` artifact"* | Loops `examples/*.md`, runs `validate` on each; non-zero exit fails the build |
| `Render all projections and assert output` | *"Renders cleanly to all three projections"* | `render --format all` per artifact into `$RUNNER_TEMP`, then asserts each of `.html`/`.json`/`.xml` is non-empty (`[ -s ]`) and carries a format marker; JSON is `JSON.parse`d and checked for `.type` + non-empty `.sections` |
| `Regression guard — non-cycle single-column layout` | v0.1.1 bug (CHANGELOG `[0.1.1] Fixed`) | See below |

Every step runs `set -euo pipefail`. There is no `|| true` and no warn-only
step in the file (`grep -c '|| true'` → `0`).

The validate loop counts iterations and fails if the count is zero, so
deleting every example can't make the gate pass vacuously.

## The regression guard

The v0.1.1 bug needed **two** conditions, so the guard asserts both halves
plus a positive control:

1. `data-type="decision"` and `class="cycle-body"` present in the rendered
   decision HTML — the layout container is on the non-cycle path.
2. **No** `class="toc"` in that HTML — the bug's structural precondition
   still holds (`renderDefault` emits `<main>` as `.cycle-body`'s only child).
   If a future renderer *does* emit a TOC for decisions, the step fails loudly
   telling the maintainer to re-point the guard, rather than passing silently.
3. The emitted `styles.css` contains `.cycle-body:not(:has(> .toc))` followed
   by `grid-template-columns: 1fr` — the actual v0.1.1 fix
   (`branches/cdn-renderer/styles.css:115-117`, commit `d50a3e6`).
4. Positive control: `cycle-215.html` still contains `class="toc"`, so the
   fix hasn't collapsed the sidebar layout cycles are supposed to keep.

Asserting on `$OUT/styles.css` rather than the source file is deliberate: the
CLI's `ensureStylesheet()` copies it from `../cdn-renderer/styles.css` at
render time, so the assertion covers both the stylesheet content *and* the
copy path that ships it.

> **Interaction with the concurrent `ensureStylesheet` fix.** While this
> workflow was being written, another phase-4 change (unstaged, in
> `branches/build-renderer/bin/prism.mjs`) changed `ensureStylesheet` from
> copy-only-if-absent to always-overwrite, because a stale pre-fix
> `styles.css` in an output dir was never refreshed. That does not change the
> guard's correctness here — CI renders into a fresh `$RUNNER_TEMP` on every
> job, so no stale stylesheet can pre-exist either way — but it does make the
> guard robust in reused output dirs too, and the guard now also covers that
> staleness regression class. The verification runs below were executed
> against the modified `prism.mjs`.

**This guard is a real test, not a tautology.** Verified by running the step's
actual `run:` body against an output dir seeded with the pre-fix stylesheet
(`git show d50a3e6^:branches/cdn-renderer/styles.css`):

```
$ python3 .ci-probe/negtest.py
guard exit=1
REAL TEST: guard correctly failed against pre-fix CSS
```

### Honest limit of the guard

It is a **string assertion on an emitted CSS rule**, not a computed-layout
check. It catches deletion or renaming of the collapse rule — the exact
v0.1.1 regression. It would **not** catch a *different* route to a narrow
column (e.g. someone adds a `max-width` to `.cycle-main`, or changes the
base `200px 1fr` in a way the `:not(:has())` override doesn't neutralise).
Catching that class of bug needs a headless browser asserting
`getComputedStyle(main).width`, which is out of scope for a cheap gate. Worth
a follow-up issue if layout regressions recur.

## What it deliberately does NOT enforce

| Not enforced | Why |
|---|---|
| Conventional Commits | CONTRIBUTING lists it as a gate, but it's a **human review** check there ("Commit messages follow…" with no command). Mechanising it needs a policy decision on squash-merge titles vs. every commit in the branch — that's new policy, out of scope for #2. |
| `CHANGELOG.md` updated under `[Unreleased]` | Same reason: no command given in CONTRIBUTING, and any automated version would need an exemption path for changes that aren't user-visible. A diff-based check would fire false positives on CI-only PRs (including this one). |
| No internal identifiers in commits/code | CONTRIBUTING defers to a prose section, not a pattern list. A grep for `s01-[0-9a-f]{6}`-style IDs is feasible but the allowed-exception carve-out ("legitimately needs to attribute an AI co-author… in that file's frontmatter or body") makes a naive grep wrong. Needs a spec'd pattern first. |
| `cdn-renderer` behaviour | It's a browser custom element; testing it needs a headless browser. CONTRIBUTING only requires both impls be updated *or have a tracked follow-up* — a review judgement, not a CI gate. |
| Node/OS matrix | `package.json` declares `engines: node >=22`; CI's job is gate enforcement, not compatibility proof. One line of justification in the workflow. |
| Spec-mandated required sections | Blocked by a CLI gap — see below. |

## CLI findings

Read from `branches/build-renderer/bin/prism.mjs` and confirmed by running it.

**1. `validate` does exit non-zero on invalid input — it is a real gate.**
`cmdValidate` calls `process.exit(1)` when issues are found (`prism.mjs:166`):

```
$ node branches/build-renderer/bin/prism.mjs validate /tmp/prism-ci-probe/bad-artifact.md
✗ /tmp/prism-ci-probe/bad-artifact.md:
  - missing frontmatter: type
  - missing frontmatter: status
exit=1
```

**2. BUG — `validate` under-enforces required sections vs. the spec.**
`cmdValidate` only checks required sections for `type: cycle`, and even there
only three of five. Per `spec/README.md`:

- §5.1 `cycle` requires `trigger`, `context`, `phases`, `decisions-locked`,
  `out-of-scope` — the CLI checks only the first three (`prism.mjs:157`).
- §5.2 `decision` requires `context`, `options`, `decision`, `consequences` —
  the CLI checks **none of them**.

A hollow decision artifact with none of its four required sections passes:

```
$ node branches/build-renderer/bin/prism.mjs validate /tmp/prism-ci-probe/hollow-decision.md
✓ /tmp/prism-ci-probe/hollow-decision.md: clean (1 sections, type=decision)
exit=0
```

Consequence for CI: the validate gate currently enforces only
`frontmatter.type` + `frontmatter.status` for non-cycle types. The workflow
can't check more than the CLI knows how to check. **This deserves its own
issue** — it's a renderer fix (`fix:` class), not a CI change, and fixing it
retroactively strengthens the gate with no workflow edit.

**3. Rough edge — `render --out <dir>` does not create the directory.**
`cmdRender` calls `ensureStylesheet(dir)` → `copyFileSync` before any
`mkdirSync`, so a missing `--out` target dies with a raw `ENOENT` stack trace.
Still reproduces after the concurrent `ensureStylesheet` change:

```
$ node branches/build-renderer/bin/prism.mjs render examples/decision-example.md --format all --out .ci-probe/still-missing
Error: ENOENT: no such file or directory, copyfile
  '.../cdn-renderer/styles.css' -> '.../.ci-probe/still-missing/styles.css'
    at ensureStylesheet (.../bin/prism.mjs:70:5)
    at cmdRender (.../bin/prism.mjs:86:7)
exit=1
```

Exit code is non-zero, so it's CI-safe — the workflow just `mkdir -p`s first.
Minor UX bug (uncaught exception instead of a clean error message), not a
gate gap.

## Reproducing the CI run locally

```bash
cd /path/to/prism

# 1. install exactly as CI does
pnpm --dir branches/build-renderer install --frozen-lockfile

# 2. validate gate
node branches/build-renderer/bin/prism.mjs validate examples/cycle-215.md
node branches/build-renderer/bin/prism.mjs validate examples/decision-example.md

# 3. render gate (CI uses $RUNNER_TEMP; any empty dir works — it must exist)
OUT=$(mktemp -d)
node branches/build-renderer/bin/prism.mjs render examples/cycle-215.md       --format all --out "$OUT"
node branches/build-renderer/bin/prism.mjs render examples/decision-example.md --format all --out "$OUT"

# 4. regression guard
grep -qF 'data-type="decision"' "$OUT/decision-example.html"
grep -qF 'class="cycle-body"'   "$OUT/decision-example.html"
! grep -qF 'class="toc"'        "$OUT/decision-example.html"
grep -A1 -F '.cycle-body:not(:has(> .toc))' "$OUT/styles.css" | grep -qF 'grid-template-columns: 1fr'
grep -qF 'class="toc"' "$OUT/cycle-215.html"

# 5. YAML parses
python3 -c "import yaml;yaml.safe_load(open('.github/workflows/prism.yml'))"
```

## Verification actually performed

All four `run:` bodies were extracted from the committed YAML and executed
locally (`.ci-probe/dryrun.py`), so the dry run tested the shipped script
text, not a paraphrase:

- **Positive:** all four steps `exit=0`, `DRY RUN: ALL STEPS PASSED`.
- **Negative (validate gate):** planted an invalid artifact in `examples/`;
  the validate step reported both missing-frontmatter issues and `exit=1`,
  `DRY RUN: FAILED`. Artifact removed afterwards.
- **Negative (regression guard):** guard step body run against the pre-fix
  v0.1.0 stylesheet → `exit=1`.
- **YAML:** `yaml.safe_load` → OK, 7 steps.

Toolchain used locally: Node `v22.22.0`, pnpm `11.13.1`, lockfile
`lockfileVersion: '9.0'` — hence `node-version: 22` and pnpm `version: 11`
in the workflow, both matching what was actually exercised.

## Cleanup still owed

`.ci-probe/` (repo root, untracked) holds the dry-run harness and fixtures:
`dryrun.py`, `negtest.py`, `guard.sh`, `repro.sh`, `prefix-styles.css`,
`out/`, `negout/`, `still-missing/`, `zz-bad-artifact.md`. **Delete it before
committing** — `rm` was not permitted in this session, so it could not be
removed automatically:

```bash
rm -rf .ci-probe
```

Nothing else in the working tree is mine. `branches/build-renderer/bin/prism.mjs`
(modified), the staged `branches/build-renderer/examples/styles.css` deletion,
and `branches/cdn-renderer/examples/phase4-decision-test.html` came from a
concurrent phase-4 process, not from this task. The only files this task
authored are `.github/workflows/prism.yml` and this report.
