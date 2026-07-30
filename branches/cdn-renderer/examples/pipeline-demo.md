---
type: pipeline
title: Pipeline comparison — a worked example
data: ./pipeline-demo.data.json
status: example
created: 2026-07-30
---

A worked example of the `pipeline` layout. The dataset is real: three configurations
of a text-to-speech pipeline, measured back to back on the same input.

**The layout is domain-neutral.** It renders any system where work units are
*produced* then *consumed* in order — synthesis→playback, fetch→parse, encode→upload,
build→deploy. Nothing in it knows what audio is.

<!-- @section: why-this-shape -->
## Why a timeline rather than a table

A table of averages hides the thing that matters in a pipelined system: **whether the
consumer ever ran dry.** Two configurations can have identical throughput while one
plays continuously and the other stutters four times.

Stalls are drawn as literal gaps on the consumer lane, so "did it stutter" is a
question you answer by looking, not by comparing numbers.
<!-- /@section: why-this-shape -->

<!-- @section: data-contract -->
## Data contract

The layout reads **one JSON file**, named in frontmatter as `data:`. It contains no
numbers of its own — a chart that can be edited into agreement with a claim is not
evidence.

> ⚠ **Name the data file `<name>.data.json`, not `<name>.json`.**
> `prism render <name>.md --format all` writes its JSON *projection* to `<name>.json`
> and will silently overwrite a data file that shares the name. Discovered by losing
> this example's dataset to the PR gate that was meant to validate it.

```jsonc
{
  "data_state": "measured" | "modelled",   // drives a loud banner
  "data_state_note": "how these numbers came to exist",
  "sample_text": "…",                      // optional: input for live re-runs
  "tts_url": "http://…",                   // optional: backend for live re-runs
  "observed_evidence": { "note": "…" },    // optional: a callout above the charts
  "strategy_notes": {                      // optional: pros/cons per approach
    "<key>": { "label": "…", "pros": ["…"], "cons": ["…"] }
  },
  "assumptions": { … },                    // shown as "Run parameters" when measured
  "scenarios": [{
    "label": "…",
    "note": "…",
    "group": "As shipped",                 // scenarios sharing a group share an axis
    "workers": 4,                          // optional badge
    "chunks": [{
      "i": 0, "chars": 85, "text": "…",
      "synth_start_ms": 0,  "synth_ms": 1983,      // producer bar
      "play_start_ms": 1983, "play_ms": 7673,      // consumer bar
      "gap_before_ms": 1983                        // stall drawn before this unit
    }],
    "metrics": {
      "chunk_count": 5, "time_to_first_word_ms": 1983,
      "total_wall_ms": 29892, "total_gap_ms": 0,
      "gap_count": 0, "worst_gap_ms": 0
    }
  }]
}
```

`synth_*` / `play_*` are the producer and consumer stages; rename them in your own
fork if the vocabulary grates — that is exactly the kind of change a fork is for.
<!-- /@section: data-contract -->

<!-- @section: honesty-rules -->
## The two rules this layout enforces

Both exist because the first version of this chart was **confidently wrong**.

**1. No fallback data.** If the JSON fails to load, the layout renders an error and
nothing else. A real-looking chart backed by invented numbers is worse than no chart,
because it is citable.

**2. `data_state` is displayed, loudly.** A modelled chart carries an orange banner
saying so. The original of this example was modelled from assumed constants and
implied a conclusion that measurement later reversed — not because the constants were
mis-tuned, but because the *shape* of the model was wrong. Nothing in the rendering
distinguished the two states until the banner existed.
<!-- /@section: honesty-rules -->

<!-- @section: live-runs -->
## Optional: live re-runs

If the data file provides `sample_text` and `tts_url`, the layout renders controls
that re-run a configuration against a live backend and draw the **measured** result
beneath the stored one, with a playhead tracking elapsed time.

This is opt-in by data. Omit those keys and the layout is a static chart.

The backend contract is deliberately small — `POST {url}/bench {text, strategy,
workers}` returning `{run_id}`, and `GET {url}/bench?id=` returning
`{state, chunks[], metrics{}, elapsed_ms}`. Any service that speaks it works.
<!-- /@section: live-runs -->
