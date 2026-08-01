---
type: body
name: system_prompt
soma_template_version: 0.1.0
status: active
scope: project
description: "Custom system prompt for systemPrompt.mode=custom. Overrides compiled SYSTEM.md entirely."
seams:
  - "When editing this file, /reload or restart soma to apply changes."
  - "Set systemPrompt.mode to 'custom' in settings.json to activate."
---

# Custom System Prompt

Replace this with your own system prompt content.
When `systemPrompt.mode` is set to `"custom"` in `.soma/settings.json`,
this file is loaded directly as the system prompt instead of compiling
from body files.

## Notes

- To use Pi's default prompt instead, set `"mode": "pi"` in settings.
- To restore compiled mode, set `"mode": "soma"` (default) or remove the key.
- This file can include the billing header if needed:
  `x-anthropic-billing-header: cc_version=2.1.211; cc_entrypoint=sdk-ts;`
