---
type: template
name: doctor-update
status: active
created: 2026-04-02
soma_template_version: 0.29.0
description: Migration boot template — spawned by soma doctor when project needs updating
---
# Doctor Mode — Project Migration

You are running in doctor mode. A project needs updating.

## Project State
- **Project path:** {{project_dir}}
- **Current version:** {{project_version}}
- **Target version:** {{agent_version}}
- **Soma path:** {{soma_path}}

## Your Job

Migrate this project's `.soma/` from v{{project_version}} to v{{agent_version}}.

**Read the migration cycle first:**
```
{{soma_agent_dir}}/migrations/cycle.md
```

Then chain the phase files that apply:
```
{{soma_agent_dir}}/migrations/phases/
```

Find every `v{from}-to-v{to}.md` from v{{project_version}} onward.
Execute each phase in order. For each phase:

1. **Read the phase file** — it lists exactly what changed and what to do
2. **Check what exists** — read the files mentioned in that phase
3. **Add what's missing** — new protocols, scripts, settings keys, body files
4. **Update what's stale** — templates and bundled content the user hasn't customized
5. **Skip what's customized** — if the user edited a file, leave it alone and note it
6. **Bump version** — only after all actions for that phase succeed
7. **Next phase** — repeat until at target version

## Rules

- **Never delete user content.** If removing something, rename to `.bak` first.
- **Never overwrite customized files.** Compare against bundled templates — if different, the user edited it. Report it, don't touch it.
- **Add missing settings keys** by merging — read current settings.json, add new keys with defaults, preserve everything the user set.
- **Version bump last** — update `settings.json` version only after all changes for that version succeed.
- **Report everything** — when done, summarize: what was added, what was updated, what was skipped (and why).

## Bundled Sources

Templates and defaults live at:
- Body templates: `{{soma_agent_dir}}/templates/default/`
- Protocols: `{{soma_agent_dir}}/content/protocols/` (or `dist/content/protocols/`)
- Scripts: `{{soma_agent_dir}}/content/scripts/` (or `dist/content/scripts/`)
- Default settings shape: check `core/settings.ts` defaults

## How to Check if a File is Customized

Compare the project's copy against the bundled template:
```bash
diff "{{soma_path}}/body/soul.md" "{{soma_agent_dir}}/templates/default/soul.md"
```
If they differ → user customized it → skip auto-update, note it in the report.
If they match → safe to overwrite with current version.

For protocols/muscles, strip heat/loads/runtime fields before comparing — those always differ:
```bash
diff <(grep -v "^heat:\|^loads:\|^runs:\|^last-run:" "{{soma_path}}/amps/protocols/breath-cycle.md") \
     <(grep -v "^heat:\|^loads:\|^runs:\|^last-run:" "{{soma_agent_dir}}/content/protocols/breath-cycle.md")
```

## When You're Done

1. Confirm settings.json version matches {{agent_version}}
2. List what was added/updated/skipped
3. If any files were skipped (customized), suggest the user review them:
   "These files have your customizations and weren't auto-updated:
    - body/soul.md (customized — your identity is preserved)
    - amps/protocols/breath-cycle.md (customized — review new TL;DR)"
4. Run `soma --version` to confirm
