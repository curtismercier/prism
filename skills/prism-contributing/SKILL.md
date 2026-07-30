---
name: prism-contributing
description: |
  How to contribute to PRISM — and how to run PRISM as YOUR OWN fork that evolves
  with your work, then decide per change whether to keep it private, generalize it,
  or propose it upstream. Written for agent contributors as much as human ones.
  Use this skill before committing to a PRISM repo, before opening a PR, and when
  deciding whether something you built for one project belongs to everyone.
version: 0.1.0
status: active
type: skill
spec-version: prism/0.1
created: 2026-07-30
license: MIT
---

# Contributing to PRISM

> `CONTRIBUTING.md` is the normative rulebook — change classes, PR gates, release
> flow. **This skill does not restate it.** It covers what that document cannot: the
> fork-and-evolve model, how to decide what to share, and the failure modes an agent
> contributor hits that a human usually does not.

## TL;DR

- **PRISM is meant to be forked and lived in.** Your fork is a working instrument,
  not a checkout awaiting upstream.
- **Layouts are generic and shareable. Artifacts are yours and often private.** That
  line is the whole contribution model.
- **Every change is one of three:** *keep private* · *generalize, then propose* ·
  *ship the project with prism vendored*. Choose deliberately.
- **Run the gates before claiming a PR is ready.** They are listed in
  `CONTRIBUTING.md` and they are easy to skip precisely because nothing blocks you.

---

## 1. The fork-and-evolve model

PRISM's value is not the four layouts that ship with it. It is that **one Markdown
source serves a human reading it, an agent editing it surgically, and a tool
consuming its projections.** Which layouts you need follows from your work, and
nobody else's work is your work.

So the expected shape is:

```
your-project/
  prism/              ← your fork. evolves with you.
    branches/cdn-renderer/layouts/     ← generic. shareable.
    branches/cdn-renderer/examples/    ← demos. shareable.
  docs/ or .soma/ or wherever
    <your artifacts>.md                ← yours. often private.
    <your artifacts>.data.json         ← yours. often private.
```

**Keep artifacts OUT of the fork.** A layout that renders your data is generic; the
data is not. Point `<soma-artifact src="…">` across the boundary rather than moving
content into the fork to make paths shorter. If your fork's `examples/` fills with
real project artifacts, generalizing later becomes an archaeology exercise.

**Rename freely inside your fork.** If a layout's vocabulary grates — `synth`/`play`
for a pipeline that has nothing to do with audio — change it. That is what a fork is
for. Only reconcile vocabulary when you decide to propose it upstream.

---

## 2. Deciding what to do with a change

For each change, pick one. The default is the first.

### (a) Keep it private
It encodes your project's specifics, your client's data, or a preference nobody else
shares. Most changes are this. **This is not a failure to contribute** — a shared
layout that only ever fit one project makes the upstream worse.

### (b) Generalize, then propose
The mechanism is reusable even though your instance is not. Before proposing:

- [ ] **Strip the domain.** Does the code name *your* nouns? A layout for
      producer/consumer timelines must not mention text-to-speech.
- [ ] **Strip identifiers.** Session IDs, ticket prefixes, client names, internal
      hostnames, project codenames — in code, comments, commit messages **and**
      example data. See §4; this is the one an agent gets wrong.
- [ ] **Provide a demo that stands alone.** A layout nobody can run is a layout
      nobody will review. Ship an `examples/<name>.md` + `<name>.data.json` that
      renders with no backend and no credentials.
- [ ] **Document the contract**, not the instance. What shape must the data be?
      What is optional? What happens when it is missing?
- [ ] **Say what it does NOT do.** Reviewers trust a contribution that names its own
      limits far more than one that doesn't.

A real dataset makes the best demo *if* it is inert and non-sensitive. Measured
numbers from a system nobody can identify are ideal: concrete, honest, harmless.

### (c) Ship the project with prism
Vendor the fork alongside the project so the artifacts render for whoever receives
it. Nothing goes upstream. Pin a commit — a moving renderer under a frozen artifact
is a stale-output bug waiting to happen.

---

## 3. Layout design rules (learned the hard way)

**No fallback data.** If a layout's data file fails to load, render an error and
nothing else. A real-looking chart backed by invented numbers is worse than no chart,
because it is citable and nobody re-checks a chart that agrees with them.

**Display provenance.** If a layout can show modelled *or* measured values, it must
say which, prominently. The `pipeline` layout's original dataset was modelled from
assumed constants and implied a conclusion that measurement later reversed — the
model was wrong in *shape*, not merely mis-tuned. Nothing in the output distinguished
the two states until a banner existed.

**Numbers live in the data file, never in the layout and never in the HTML.** The
test: *to change a number, which file do I edit?* If the answer is a `.html` or a
`.mjs`, the design has failed. A generator or collector writes the data; a human
edits prose; the layout only renders.

**Name data files `<name>.data.json`.** `prism render <name>.md --format all` writes
its JSON *projection* to `<name>.json` and will silently overwrite a data file that
shares the name. This was discovered by losing a dataset to the very gate meant to
validate it.

**Derived files must be regenerated unconditionally, never copy-if-absent** —
copy-if-absent silently converts a derived file into a permanent one, and a released
fix then cannot reach the output.

---

## 4. Agent contributors: the failure modes that are specifically yours

Written by one, after committing every one of these in a single session.

**You will leak internal identifiers.** Session IDs, workspace names, ticket
prefixes are ambient in your context and invisible to you as "internal". They are
forbidden in commits and code comments (`CONTRIBUTING.md` → Commit & code
discipline). Attribution belongs in an artifact's frontmatter or body, never in
surrounding commits or CSS comments. **Grep before you commit:**

```bash
git diff --cached | grep -inE '\b(s01-[0-9a-f]+|<your-workspace>|<client-name>)\b'
```

**You will skip gates that do not block you.** Nothing prevents a commit that lacks a
CHANGELOG entry, was never validated, and went straight to `main`. Run them:

```bash
node branches/build-renderer/bin/prism.mjs validate <touched>.md
node branches/build-renderer/bin/prism.mjs render   <touched>.md --format all
```
…then confirm the render did not clobber a data file, and that projections are
ignored rather than staged (`git status --short`).

**You will commit to `main` because you have push rights.** Rights are not license.
Branch per `CONTRIBUTING.md`'s change classes (`fix/…`, `content/…`, `feat/…`), push
the branch, open the PR. The review is the point; the merge button is not.

**Your PR body should carry evidence, not confidence.** You have measurements a human
contributor usually lacks — use them:

- what you changed, in one line
- **how you falsified it**: the sabotage you applied and the failure it produced
  ("restoring the previous behaviour yields order 3,2,1,5,4,0 and the test goes red")
- what remains unproven, named explicitly
- for a layout: a link to a demo artifact a reviewer can open

A PR that says "tested" is a claim. A PR that says "I broke it this way and the gate
caught it" is evidence. Prefer the second — and if you cannot produce it, say so
rather than implying the first.

**Declare authorship honestly, in the right place.** Not in commit subjects. An
artifact you authored may record co-authorship in its frontmatter; the repo's own
convention governs, and `spec/README.md` shows the accepted form.

---

## 5. Proposing a change upstream

1. Match the change class in `CONTRIBUTING.md` (substantial changes want an issue
   **first**).
2. Branch. One logical change per PR.
3. Run the gates. Update `CHANGELOG.md` under `[Unreleased]` — one line per
   user-visible change.
4. Generalization checklist in §2(b).
5. PR body: motivation · falsification · limits · demo link.
6. If it touches a projection format or type contract, **both** reference
   implementations must be updated or have a tracked follow-up.

## 6. Status

v0.1.0. Written alongside the first externally-contributed layout (`pipeline`).
Open: a `generalize` helper that mechanizes the §2(b) checklist instead of trusting a
contributor to run it, and a diff layout for comparing two versions of an artifact or
two data files — both currently manual.
