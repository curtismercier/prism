---
type: cycle
n: 007
name: offer-documents
status: seeded
status_note: "🔴 BLOCKED ON A PREREQUISITE IN ANOTHER LANE (recorded s01-5390f1). Design is DONE — `DESIGN-edit-mode.md`, now committed (was untracked). Its verdict: **do not build offer-harness edit mode yet** — `build_offer.js` takes the offer config as an EPHEMERAL CLI argv, not a file; `sources/` holds only an HTML snapshot and a brief. There is nothing to write to, so building it means editing GENERATED OUTPUT, which is the bug this cycle exists to fix. ⇒ Unblocker = persist the offer config as a file, and that lives in `yoshi-platform` (s01-dd1dfa's lane), not here. The cycle-dashboard half IS ready and is prism's to build."
created: 2026-08-11
session: s01-93e7ac@meetsoma
opened_by: Curtis — "this could become a new dashboard / plugin for the prism dashboard system — this actually kinda brings it back to the original idea of the prism, which there is some drift since, it's more of a cycle dashboard"
decides: whether client-facing OFFER documents become the second PRISM corpus, and whether that is what un-narrows PRISM
relates: [001-renderer-spike, 002-registry-dashboard, 005-plugin-packaging, prism-dashboards]
---

# Cycle 007 — offer documents as a PRISM corpus

## The drift, stated with its evidence

**PRISM's README:** *"**P**rojected **R**epresentations from **I**nscribed **S**ource **M**arkup —
AI-collaborative documents that render as human-visual artifacts AND machine-structured data, from
one Markdown source."* The named gap: humans read visually, agents read structurally and *"burn
tokens re-reading whole files to find one section to edit."* **Edits happen surgically against
named sections.**

**What it is used for today:** cycles. `meetsoma/.soma/skills/prism/SKILL.md` describes it as
*"the universal dashboard that every .soma can use"* and every trigger word is `registry` ·
`cycle browser` · `drill-in` · `registry.json`.

⇒ **The generality survived in the name; the application narrowed to the corpus that was at
hand.** Not a wrong turn — cycles were the obvious first corpus — but it is why "PRISM" now reads
as "cycle dashboard" to anyone who arrives after it.

## Why an OFFER document is the right second corpus

Not because it is another thing to render. **Because the existing offer generator is PRISM's
thesis restated as a bug list**, and every one of these was hit in a single session
(2026-08-11, truecoat):

`yoshi/tools/scripts/build_offer.js` — 368 lines, the entire client-facing document held in JS
template literals.

| what happened | the PRISM property it lacks |
|---|---|
| Changing a **price** required editing **code** | content ≠ code |
| The rate card (`OFFER.md`) is the declared SoT and **the generator cannot read it** — every number is hardcoded | machine-structured projection of the same source |
| To change the price block you re-emit the whole document | surgical edits against named sections |
| Human artifact and machine data are one string, so nothing can check one against the other | one source, two projections |
| A `{{inline:img}}` token ships literal into a client's inbox if the sender forgets `--inline`; the quote gate checks sentences, not tokens | a projection can be validated; a string cannot |

🔑 **The drift diagnosis and the offer problem are the same finding.** PRISM narrowed to cycles;
meanwhile a document with a *harder* human/machine split than any cycle was solved by hand, badly,
somewhere else in the estate. **The corpus that most needed PRISM was the one nobody pointed it at.**

## The shape, if it goes ahead

One Markdown source per offer with anchors — `<fixed>`, `<comparison>`, `<price>`, `<tier>`,
`<proof>`, `<never-promise>` — projecting to:

- **HTML** — what the client reads (today's `proposal.html`)
- **JSON** — what the gates read: `offer-quotes.mjs` (quoted sentences still verbatim on the live
  site), a new image-token check, and a **price-vs-rate-card assertion** that is impossible today
- **the rate card as DATA**, so `OFFER.md` stops being a document nobody's code opens

## Open questions

1. **Is this a plugin, or a second first-class corpus?** `005-plugin-packaging` decides the
   mechanism; this cycle only claims the corpus is worth having.
2. **Does the rate card become PRISM-inscribed too?** It is the more valuable half — it is the
   thing that must not drift — but it is also estate-wide policy, and rewriting it is a bigger
   move than rendering a proposal.
3. **Does anything here need the dashboard at all?** The projection is the point; the browsing UI
   may be irrelevant for a corpus of ~2 documents per client. ⚠ *Do not build a dashboard because
   the dashboard exists.*

## Not started. Seeded so the observation is not lost

Evidence lives in the session that produced it —
`meetsoma/.soma/memory/sessions/2026-08-11-s01-93e7ac.md` — and in
`project-b/clients/truecoat-painting/deliverables/2026-07-25-proposal-truecoat/PRICING-THINKING.md`.
