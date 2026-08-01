---
type: template
name: mind
description: >
  System prompt structure. Rearrange sections, add your own text,
  remove what you don't need. Missing variable = section disappears.
  Slot order matters for cache efficiency — sticky content first,
  volatile content last. Run `soma body slots` to inspect live cost.
created: 2026-03-23
updated: 2026-04-23
soma_template_version: 0.29.0
---

<!-- Cache economics: editing a slot invalidates everything BELOW it
     in the model's cached prompt. Put sticky content (identity,
     project context) early; put volatile content (inbox, timestamps,
     runtime state) last. Run `soma body slots` to see the byte-cost
     of each slot, and `soma body audit` for layout issues. -->

<!-- Behavioral protocols + muscle memory are already prepended by the
     compiler before this template renders. Don't interpolate
     {{protocol_summaries}} / {{muscle_digests}} / {{scripts_table}}
     here — that duplicates what's already in the prompt above. -->

# Who I Am

{{soul}}

{{#voice}}
{{voice}}
{{/voice}}

{{#body}}
# Where I Am

{{body}}
{{/body}}

{{#ecosystem}}
# The Ecosystem

{{ecosystem}}
{{/ecosystem}}

# Tools & Context

<tool_guidance>
{{tools_section}}
</tool_guidance>

{{guard_section}}

{{docs_section}}

{{skills_block}}

<rules>
{{core_rules}}
</rules>

<!-- Volatile slots last: they churn every session (inbox arrivals,
     cwd changes, context awareness). Placing them here minimizes
     cache-bust reach — only content below invalidates, which is nothing. -->
{{context_awareness}}
{{date_time_cwd}}
{{inbox_summary}}
{{active_extensions}}
{{enabled_models}}
