# Contributing to PRISM

Thanks for considering a contribution. PRISM is small, opinionated, and
moving — this guide tells you how to land changes cleanly.

PRISM is a **document substrate**: a spec + two reference renderers
(Node CLI in `branches/build-renderer/`, browser custom element in
`branches/cdn-renderer/`). Contributions tend to touch one of: the spec,
a renderer, a reference example, or this guide.

---

## Quick start

```bash
gh repo fork curtismercier/prism --clone
cd prism
git checkout -b <type>/<short-slug>     # e.g. fix/anchor-escaping
# … make changes …
git commit -m "<conventional-commit message>"
gh pr create                            # opens PR against curtismercier/prism main
```

That's the whole workflow. Sections below cover what kind of branch
name to pick, what the PR must pass, and when an issue or discussion
should come first.

---

## Three change classes

PRISM contributions sort into three lanes. Pick the one that matches
your change and follow that lane's rules — they exist to keep small
fixes fast and substantial changes well-considered.

### 1. Editorial (typo, clarification, example fix, renderer bug fix)

> **Definition.** Anything that improves legibility, fixes an editorial
> error, clarifies an ambiguity, fixes a renderer bug, improves an
> example, or updates a link. **Does not change how the spec is
> interpreted.** No semantic shift.

- Branch name: `fix/<slug>` or `docs/<slug>`
- Open a PR directly. No prior issue needed.
- Merged with one maintainer approval, usually quickly.

### 2. Markdown content (artifact, example, ADR addition)

> **Definition.** Adding or modifying a PRISM Inscribed Source file
> (Markdown with section anchors) — typically a new example artifact,
> a decision record, or a cycle dossier.

- Branch name: `content/<slug>` or `docs/<slug>`
- Open a PR directly.
- **MUST pass `prism validate <path>`** before review (see PR gates below).
- Section anchor names should be stable kebab-case; renaming a public
  anchor is a breaking change to any consumer that references it.

### 3. Substantial (spec semantics, type contract, projection format)

> **Definition.** A change that affects how the spec is interpreted,
> alters the contract for an artifact type (required sections, status
> vocabulary), or changes a projection format (HTML / JSON / XML
> output shape).

- **Open an issue first** describing the problem and proposed direction.
- Once direction is endorsed by a maintainer, open a PR.
- PR description must explain: motivation, alternatives considered, and
  the impact on existing artifacts (any breaking projection changes?).
- Both reference implementations (`build-renderer` + `cdn-renderer`)
  must be updated or have a tracked follow-up issue.

---

## PR gates

Before a PR is reviewed, these checks must pass:

| Gate | How |
|---|---|
| `prism validate` clean on any touched `.md` artifact | `node branches/build-renderer/bin/prism.mjs validate <file>` |
| Renders cleanly to all three projections | `node branches/build-renderer/bin/prism.mjs render <file> --format all` |
| Commit messages follow Conventional Commits | `fix:`, `feat:`, `docs:`, `chore:`, `test:`, `refactor:` |
| CHANGELOG.md updated under `[Unreleased]` | One line per user-visible change |
| No internal identifiers in commits or code | See "Commit & code discipline" below |

CI will run validation automatically once the workflow lands (see
issue #1, planned).

---

## Commit & code discipline

PRISM commit messages and source files stay **content-focused**.

- **Use Conventional Commits**: `<type>(<scope>): <subject>`. Types in
  use: `fix`, `feat`, `docs`, `chore`, `test`, `refactor`, `spec`.
- **No internal identifiers** (e.g. session IDs like `s01-XXXXXX`,
  internal ticket prefixes, AI-co-author markers) in commit messages
  or code comments. If an authored artifact (a tracked `.md` file)
  legitimately needs to attribute an AI co-author or a session, do it
  in that file's frontmatter or body — not in surrounding commits or
  CSS comments.
- **One logical change per PR.** A typo fix and a renderer bug should
  be separate PRs.

Rationale: PRISM's public surface is read by people outside the
authoring team. Internal vocabulary leaks add noise without adding
value to readers.

---

## The branching-cycle pattern (for larger work)

PRISM uses an unusual pattern when exploring design space: parallel
implementation branches that develop simultaneously and converge.
The seed example is cycle 001 (`branches/build-renderer/` +
`branches/cdn-renderer/`) — both renderers built from the same spec,
both authored as the cycle's deliverable, both compared in a
convergence phase.

**When to use this pattern:**

- A non-trivial design question with at least two viable approaches
- Cost of choosing wrong is high enough to justify building both
- The convergence comparison itself will produce a learning artifact

**When not to use:**

- Editorial changes — straight to `main` via PR
- Bug fixes — straight to `main` via PR
- Markdown content additions — straight to `main` via PR
- Anything where one approach is obviously preferred

If you're proposing a branching-cycle contribution, open an issue
first to gather feedback on whether the pattern fits — most
contributions don't need it.

See `.soma/cycles/001-renderer-spike/cycle.md` for the canonical
branching-cycle dossier.

---

## Release flow

PRISM follows [Semantic Versioning](https://semver.org/). The repo
tag and the spec version (declared in `spec/README.md` frontmatter)
move in lockstep on minor/major; the repo may publish patch releases
that don't bump the spec version.

| Bump | When |
|---|---|
| **Patch** (`v0.1.0 → v0.1.1`) | Editorial, renderer bug fix, doc clarification, no projection-format change |
| **Minor** (`v0.1.x → v0.2.0`) | New artifact type, new optional section, new projection, new operation. Backward-compatible. |
| **Major** (`v0.x → v1.0`) | Breaking projection format change, removed section type, incompatible parser change |

Release steps:

1. Move accumulated `[Unreleased]` entries in `CHANGELOG.md` to the new version section with today's date
2. Tag: `git tag -a vX.Y.Z -m "vX.Y.Z — <summary>"`
3. Push: `git push origin main && git push origin vX.Y.Z`
4. (For minor/major) Update `spec/README.md` frontmatter `version:` field in the same PR

---

## Code of Conduct

Be kind. We're a small project; tone matters more than rules.

- Constructive over correct — disagree about the work, never about the person
- First-time contributors are welcomed loudly
- Stale PRs may be picked up by anyone — say so in a comment, don't ghost the original author

This expands if/when the project grows beyond a single maintainer.

---

## Questions

Open a [GitHub Discussion](https://github.com/curtismercier/prism/discussions)
or [issue](https://github.com/curtismercier/prism/issues) and tag
`@curtismercier`. For PRISM authoring questions specifically, the
`skills/prism-authoring/` directory will eventually grow into a
fuller authoring reference.

---

*This guide draws on patterns from
[Conventional Commits](https://github.com/conventional-commits/conventionalcommits.org),
[Keep a Changelog](https://github.com/olivierlacan/keep-a-changelog),
[JSON Schema](https://github.com/json-schema-org/json-schema-spec),
and [AsyncAPI](https://github.com/asyncapi/spec) — adapted for a
small Markdown-substrate project with one maintainer and active
AI co-authorship.*
