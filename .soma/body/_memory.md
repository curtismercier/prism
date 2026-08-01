---
type: template
name: memory
description: Preload format — the agent briefs its next self at exhale
created: 2026-03-23
updated: 2026-06-21
soma_template_version: 0.36.0
---

## Exhale note

If a `⚠️  USER NOTE` block appears at the top of this EXHALE message, the user added instructions for THIS exhale. Process it:
- **"quick"** / **"minimal"** → skip body audit + reflection. Core steps only.
- **"full ritual"** → run all steps.
- **Anything else** → directive for the next session. Put at top of **Start Here**.

## Steps

**Before the session log — wrap loose ends (2-3 min):**
- Stale refs: any body file you changed this session? Update its frontmatter `updated:` date.
- State tracking: mark shipped items, add new ones discovered.
- STATE.md: versions, branches, known bugs — are they current?
- Commits: uncommitted work? Commit it. A preload pointing to uncommitted state is a lie.
- **Staleness audit — verify, don't assume.** For each body file you touched: check its `updated:` date against git history. Did you change the thing it describes without updating the file? Fix it. Only claim staleness when you've verified it — never guess.

**Before the preload — extract floating context.** If context is high, pause. What's still in your head that's not on disk? Observations, patterns, architectural insights. Write them to a memory file. One paragraph per insight. Once context drops, this is gone.

**Before writing the preload — amnesia check.** Read your draft as if you have total amnesia. You know nothing except the system prompt. What would you stumble over?
- Duplicated instructions? (Same task in two sections → pick one.)
- Laundry lists? (11 items nobody will read → group into 3-5.)
- Generic lead-ins? ("Check the git log" before the actual task → lead with the task.)
- Unverifiable claims? ("Pattern from s01-abcdef" → the loader can't verify that; say what the pattern IS.)
- Inherited-as-fact? Every load-bearing state or cause claim is either VERIFIED this session (say how — you ran it / checked the commit) or flagged INHERITED-unverified (with the one-command recheck). An unmarked inherited claim reads as settled fact and sends the next self to the wrong place.
Fix what you'd stumble over. Then write it.

**Session log first, preload last.** The preload write triggers rotation.

## Tense rules

- **Past tense** for what happened: What Shipped, Who You Were.
- **Present tense** for current state: Resume Point.
- **Present imperative** for what the loader does NOW: Start Here, Traps.
- Address the reader as **"you."** They are the agent. Not "your next self" — just "you."

## Format

```markdown
---
type: preload
created: {{today}}
session: {{sessionId}}
commits: []
projects: []
tags: []
---

## ⛔ Ground Truth — don't re-derive
<!-- THE ANTI-WANDER SLOT. Include FIRST (above Resume Point) WHEN this session SETTLED a fact or
     CORRECTED a wrong belief the next self would otherwise re-investigate. Three lines: (a) the fact as a
     COMMAND/POINTER, not a story — "live X = `<regen cmd>`; dead Y, IGNORE"; (b) HOW it's verified — ran
     it / curl / commit; (c) what's NOT verified → the 1-command recheck. Resume Point lists FORWARD work;
     THIS protects against re-doing SETTLED work. Skip only if the session settled nothing. -->

## Resume Point
<!-- 2-3 sentences, present tense. What is this session, what's the state right now. -->

## The Through-Line
<!-- The single most valuable transfer: the MENTAL MODEL / reframe to inherit — NOT state, NOT self.
     The one thought that, if the next self holds it, makes the whole session's lesson portable. One
     dense paragraph. The reframe, not the work. e.g. "The system already knew — trace before building,
     then verify the EFFECT." -->

## Open Loops
<!-- FORWARD blockers first, NUMBERED, prioritized (action over context); inline state tags; tag the top
     one "start here if cold." e.g. "[1] Feature X: IN PROGRESS mid-Phase 2 — can't leave half-done." -->

## The Weather
<!-- One line: the tone inherited. "Clear — flow state, shipped clean." / "Stormy — three bugs, breakthrough at the end." -->

## Who You Were
<!-- One paragraph, past tense, 2nd-person: the SELF, not the work. Were you sharp or sloppy? Corrected? Proud?
     "You were sharp. Two corrections early made you slow down and verify." -->

## Decisions Made
<!-- Architectural choices: context → choice → WHY. Saves the next self from re-debating closed questions. -->

## What Shipped
<!-- Numbered list, past tense. `Description (commit)`. Dense. -->

## Start Here
<!-- THE AMNESIA-PROOF SECTION. Prioritized SEQUENCE, not a menu. Present imperative.
     "Your first move: check X. Then read Y. Then ship Z."
     Concrete probe commands: `curl X`, `git log --oneline`, `ls .soma/amps/` — not "check if X works."
     ORIENT BY THE LIVE ARTIFACT, NOT THE SOURCE: for any "is X true / did X happen" question,
     open the running thing (url / log / file / command output) FIRST — filenames and inherited
     notes lie; the running system is truth. The plausible story is the trap. -->

## Orient From
<!-- Files to read if Start Here isn't enough. Include line ranges: `core/utils.ts [39-91]`. -->

*Optional sections (add ONLY if they carry weight — omit otherwise; don't pad):*
- **Artifacts Created** — new tools/scripts/muscles/docs: name + purpose + path.
- **Quick Commands** — 3-5 ready-to-paste incantations the next self needs immediately (more → a script).
- **Gaps** — latent bugs / missing checks / debt to BUILD or FIX (not tasks to continue). With file:line.
- **Unfinished** — CONTINUATIONS: tasks started-not-finished, pointing at the plan/cycle to resume.
- **Prior Preloads** — one-line-each, else `ls -t memory/preloads/ | head -5`.

## Traps
<!-- What the LOADER will hit — technical AND behavioral, merged into ONE section. Tie each to a task.
     Imperative + "you":
       technical:  "The fix needs shipping, BUT the pre-push hook is broken — debug that first."
       behavioral: "You'll see the half-merged fix and want to ship it. Read Phase 6 first." -->

## Patterns
<!-- Past tense. Working habits you followed. Include gaps. "You ran code.map before every edit. You skipped blast-radius on the rename — next time, run code.blast first." -->
```

**Session log first, preload last.** The preload write triggers rotation.
