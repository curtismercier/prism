#!/usr/bin/env bash
# ---
# name: soma-body
# author: meetsoma
# version: 1.0.0
# license: MIT
# tags: [body, identity, templates, health, debug]
# description: Check your body files are current. Review heat before deep work. Know your chain.
# related-protocols: [codebase-state]
# ---
# ═══════════════════════════════════════════════════════════════════════════
# soma-body — inspect and verify body files outside a TUI session
# ═══════════════════════════════════════════════════════════════════════════
# Usage: soma body <command>
#
# Commands:
#   check              — health report: missing files, stale dates, empty content
#   vars               — list all template variables and what they resolve to
#   files              — show all body files with sizes and last-modified dates
#   chain              — show the inheritance chain (project → parent → global)
#   heat               — show muscle + protocol heat state
#   patterns           — extract behavioral patterns from recent sessions
#
# Runs outside the TUI. No API calls, no token cost.
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

_sd="$(dirname "$0")"
if [ -f "$_sd/soma-theme.sh" ]; then source "$_sd/soma-theme.sh"; fi

# ── Find .soma/ ──
find_soma() {
  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    if [[ -d "$dir/.soma" ]]; then
      echo "$dir/.soma"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  echo ""
  return 1
}

SOMA_DIR="$(find_soma)" || { echo "No .soma/ found. Run 'soma init' first."; exit 1; }
PROJECT_DIR="$(dirname "$SOMA_DIR")"

# ── Commands ──

cmd_check() {
  soma_header "soma body check" "body file health report"
  
  local pass=0 warn=0 fail=0
  
  # Required files
  for f in SOMA.md body/soul.md; do
    local path="$SOMA_DIR/$f"
    if [[ -f "$path" ]]; then
      local lines=$(wc -l < "$path" | tr -d ' ')
      if [[ $lines -lt 3 ]]; then
        soma_warn "$f exists but only $lines lines (scaffold?)"
        ((warn++))
      else
        soma_ok "$f ($lines lines)"
        ((pass++))
      fi
    else
      # SOMA.md or soul.md — at least one should exist
      if [[ "$f" == "SOMA.md" && -f "$SOMA_DIR/body/soul.md" ]]; then
        continue  # soul.md covers it
      elif [[ "$f" == "body/soul.md" && -f "$SOMA_DIR/SOMA.md" ]]; then
        continue
      fi
      soma_fail "$f missing"
      ((fail++))
    fi
  done
  
  # Optional body files
  for f in body/voice.md body/body.md body/_mind.md body/_memory.md body/pulse.md body/journal.md body/DNA.md; do
    local path="$SOMA_DIR/$f"
    if [[ -f "$path" ]]; then
      local lines=$(wc -l < "$path" | tr -d ' ')
      local mod=$(stat -f '%Sm' -t '%Y-%m-%d' "$path" 2>/dev/null || stat -c '%y' "$path" 2>/dev/null | cut -d' ' -f1)
      soma_ok "$f ($lines lines, modified $mod)"
      ((pass++))
      
      # Staleness check: body.md and pulse.md older than 7 days
      if [[ "$f" == "body/body.md" || "$f" == "body/pulse.md" ]]; then
        local mod_epoch=$(stat -f '%m' "$path" 2>/dev/null || stat -c '%Y' "$path" 2>/dev/null)
        local now_epoch=$(date +%s)
        local age_days=$(( (now_epoch - mod_epoch) / 86400 ))
        if [[ $age_days -gt 7 ]]; then
          soma_warn "  └─ $age_days days old — consider updating"
          ((warn++))
        fi
      fi
    else
      soma_info "$f not created yet"
    fi
  done
  
  # Settings
  if [[ -f "$SOMA_DIR/settings.json" ]]; then
    soma_ok "settings.json exists"
    ((pass++))
    # Check inherit flags
    if command -v python3 &>/dev/null; then
      local inherit=$(python3 -c "import json; d=json.load(open('$SOMA_DIR/settings.json')); print(d.get('inherit',{}).get('identity','not set'))" 2>/dev/null)
      if [[ "$inherit" != "not set" ]]; then
        soma_info "  └─ inherit.identity: $inherit"
      fi
    fi
  else
    soma_info "settings.json not created (using defaults)"
  fi
  
  # State
  if [[ -f "$SOMA_DIR/state.json" ]]; then
    soma_ok "state.json exists (heat state)"
    ((pass++))
  else
    soma_info "state.json not created yet (first-boot will create)"
  fi
  
  # AMPS
  local proto_count=0 muscle_count=0 script_count=0
  [[ -d "$SOMA_DIR/amps/protocols" ]] && proto_count=$(find "$SOMA_DIR/amps/protocols" -name "*.md" -not -path "*/_*" -not -name "README.md" | wc -l | tr -d ' ')
  [[ -d "$SOMA_DIR/amps/muscles" ]] && muscle_count=$(find "$SOMA_DIR/amps/muscles" -name "*.md" -not -path "*/_*" -not -name "README.md" | wc -l | tr -d ' ')
  [[ -d "$SOMA_DIR/amps/scripts" ]] && script_count=$(find "$SOMA_DIR/amps/scripts" -name "*.sh" -not -path "*/_*" | wc -l | tr -d ' ')
  
  echo ""
  soma_info "AMPS: $proto_count protocols, $muscle_count muscles, $script_count scripts"
  
  # Preloads
  local preload_count=0
  [[ -d "$SOMA_DIR/memory/preloads" ]] && preload_count=$(ls "$SOMA_DIR/memory/preloads/"*.md 2>/dev/null | wc -l | tr -d ' ')
  soma_info "Preloads: $preload_count"
  
  soma_summary "$pass" "$warn" "$fail"
}

cmd_files() {
  soma_header "soma body files" "all body files"
  
  if [[ ! -d "$SOMA_DIR/body" ]]; then
    soma_info "No body/ directory"
    return
  fi
  
  echo ""
  for f in "$SOMA_DIR/body/"*; do
    [[ ! -f "$f" ]] && continue
    local name=$(basename "$f")
    local lines=$(wc -l < "$f" | tr -d ' ')
    local mod=$(stat -f '%Sm' -t '%Y-%m-%d %H:%M' "$f" 2>/dev/null || stat -c '%y' "$f" 2>/dev/null | cut -d'.' -f1)
    local size=$(wc -c < "$f" | tr -d ' ')
    printf "  %-25s %4d lines  %6s  %s\n" "$name" "$lines" "$(numfmt --to=iec $size 2>/dev/null || echo "${size}B")" "$mod"
  done
  echo ""
}

cmd_chain() {
  soma_header "soma body chain" "inheritance chain"
  
  echo ""
  local level=0
  local dir="$PWD"
  
  while [[ "$dir" != "/" ]]; do
    if [[ -d "$dir/.soma" ]]; then
      local label="project"
      [[ $level -eq 0 ]] || label="parent"
      local has_soul="no"
      [[ -f "$dir/.soma/body/soul.md" || -f "$dir/.soma/SOMA.md" ]] && has_soul="yes"
      local has_settings="no"
      [[ -f "$dir/.soma/settings.json" ]] && has_settings="yes"
      
      local prefix=""
      for ((i=0; i<level; i++)); do prefix="  $prefix"; done
      
      echo -e "${prefix}${SOMA_BOLD}[$label]${SOMA_NC} $dir/.soma/"
      echo -e "${prefix}  soul: $has_soul, settings: $has_settings"
      
      # Check inherit
      if [[ -f "$dir/.soma/settings.json" ]] && command -v python3 &>/dev/null; then
        local inherit=$(python3 -c "import json; d=json.load(open('$dir/.soma/settings.json')); i=d.get('inherit',{}); print('identity:'+str(i.get('identity','?'))+' protocols:'+str(i.get('protocols','?'))+' muscles:'+str(i.get('muscles','?')))" 2>/dev/null)
        echo -e "${prefix}  inherit: $inherit"
      fi
      
      ((level++))
    fi
    dir="$(dirname "$dir")"
  done
  
  # Global
  if [[ -d "$HOME/.soma" ]]; then
    local prefix=""
    for ((i=0; i<level; i++)); do prefix="  $prefix"; done
    local has_soul="no"
    [[ -f "$HOME/.soma/body/soul.md" ]] && has_soul="yes"
    echo -e "${prefix}${SOMA_BOLD}[global]${SOMA_NC} $HOME/.soma/"
    echo -e "${prefix}  soul: $has_soul"
  fi
  
  echo ""
}

cmd_heat() {
  soma_header "soma body heat" "muscle + protocol heat state"
  
  echo ""
  echo -e "${SOMA_BOLD}Protocols${SOMA_NC} (from state.json)"
  echo -e "${SOMA_DIM}──────────────────────────────────────${SOMA_NC}"
  
  if [[ -f "$SOMA_DIR/state.json" ]] && command -v python3 &>/dev/null; then
    python3 -c "
import json
d = json.load(open('$SOMA_DIR/state.json'))
protocols = d.get('protocols', {})
for name, state in sorted(protocols.items(), key=lambda x: -x[1].get('heat',0)):
    h = state.get('heat', 0)
    tier = '🔥' if h >= 8 else '🟡' if h >= 3 else '❄️'
    pinned = ' 📌' if state.get('pinned') else ''
    applied = state.get('timesApplied', 0)
    print(f'  {tier} {h:3d}  {name}{pinned}  (applied: {applied})')
" 2>/dev/null || soma_info "No protocol state"
  else
    soma_info "No state.json or python3 not available"
  fi
  
  echo ""
  echo -e "${SOMA_BOLD}Muscles${SOMA_NC} (from frontmatter)"
  echo -e "${SOMA_DIM}──────────────────────────────────────${SOMA_NC}"
  
  if [[ -d "$SOMA_DIR/amps/muscles" ]]; then
    for f in "$SOMA_DIR/amps/muscles/"*.md; do
      [[ ! -f "$f" ]] && continue
      local name=$(basename "$f" .md)
      [[ "$name" == "_"* ]] && continue
      local heat=$(grep '^heat:' "$f" 2>/dev/null | head -1 | awk '{print $2}')
      local loads=$(grep '^loads:' "$f" 2>/dev/null | head -1 | awk '{print $2}')
      local hd=$(grep '^heat-default:' "$f" 2>/dev/null | head -1 | awk '{print $2}')
      heat=${heat:-0}
      loads=${loads:-0}
      
      local tier="❄️"
      [[ $heat -ge 5 ]] && tier="🔥"
      [[ $heat -ge 1 && $heat -lt 5 ]] && tier="🟡"
      
      local extra=""
      [[ -n "$hd" && "$hd" != "cold" ]] && extra=" (default: $hd)"
      
      printf "  %s %3d  %-30s loads: %s%s\n" "$tier" "$heat" "$name" "$loads" "$extra"
    done
  else
    soma_info "No muscles directory"
  fi
  
  echo ""
}

cmd_patterns() {
  soma_header "soma body patterns" "behavioral patterns from recent sessions"
  
  local sessions_dir="$SOMA_DIR/memory/sessions"
  if [[ ! -d "$sessions_dir" ]]; then
    soma_info "No session logs yet"
    return
  fi
  
  echo ""
  echo -e "${SOMA_BOLD}Recent session patterns:${SOMA_NC}"
  echo ""
  
  # Look at last 5 session logs for pattern indicators
  local count=0
  for f in $(ls -t "$sessions_dir/"*.md 2>/dev/null | head -5); do
    local session=$(basename "$f" .md)
    local date=$(echo "$session" | cut -d'-' -f1-3)
    
    # Extract tools used
    local tools=$(grep -oE 'soma (code|refactor|verify|seam|focus|health|github)[^"]*' "$f" 2>/dev/null | sort -u | head -5)
    # Extract muscles mentioned
    local muscles=$(grep -oE '(muscle|protocol)[s]?[:/] *[a-z-]+' "$f" 2>/dev/null | sort -u | head -5)
    # Extract read-before-edit patterns
    local reads=$(grep -oE '(read|loaded|checked|verified|mapped) .* before' "$f" 2>/dev/null | head -3)
    
    if [[ -n "$tools" || -n "$muscles" || -n "$reads" ]]; then
      echo -e "  ${SOMA_CYAN}$date${SOMA_NC} ($session)"
      [[ -n "$tools" ]] && echo "$tools" | while read t; do echo -e "    ${SOMA_DIM}tool: $t${SOMA_NC}"; done
      [[ -n "$muscles" ]] && echo "$muscles" | while read m; do echo -e "    ${SOMA_DIM}$m${SOMA_NC}"; done
      [[ -n "$reads" ]] && echo "$reads" | while read r; do echo -e "    ${SOMA_GREEN}pattern: $r${SOMA_NC}"; done
      echo ""
      ((count++))
    fi
  done
  
  [[ $count -eq 0 ]] && soma_info "No patterns detected in recent sessions"
  
  soma_seams "soma-body.sh"
}

cmd_vars() {
  soma_header "soma body vars" "template variables and resolution"
  
  echo ""
  echo -e "${SOMA_BOLD}Body file variables:${SOMA_NC}"
  echo ""
  
  # Check _mind.md for variable references
  local mind="$SOMA_DIR/body/_mind.md"
  if [[ -f "$mind" ]]; then
    echo -e "  ${SOMA_DIM}Template: $mind${SOMA_NC}"
    echo ""
    grep -oE '\{\{[a-z_]+\}\}' "$mind" 2>/dev/null | sort -u | while read var; do
      local name=$(echo "$var" | tr -d '{}')
      local resolved="?"
      
      case "$name" in
        soul)
          [[ -f "$SOMA_DIR/body/soul.md" ]] && resolved="${SOMA_DIR}/body/soul.md ($(wc -l < "$SOMA_DIR/body/soul.md" | tr -d ' ') lines)"
          [[ -f "$SOMA_DIR/SOMA.md" ]] && resolved="${SOMA_DIR}/SOMA.md ($(wc -l < "$SOMA_DIR/SOMA.md" | tr -d ' ') lines)"
          ;;
        voice) [[ -f "$SOMA_DIR/body/voice.md" ]] && resolved="$SOMA_DIR/body/voice.md" || resolved="(not created)" ;;
        body) [[ -f "$SOMA_DIR/body/body.md" ]] && resolved="$SOMA_DIR/body/body.md" || resolved="(not created)" ;;
        state) [[ -f "$SOMA_DIR/body/STATE.md" ]] && resolved="$SOMA_DIR/body/STATE.md" || resolved="(not created)" ;;
        ecosystem) [[ -f "$SOMA_DIR/body/ecosystem.md" ]] && resolved="$SOMA_DIR/body/ecosystem.md" || resolved="(not created)" ;;
        *) resolved="(runtime-resolved)" ;;
      esac
      
      printf "  %-25s → %s\n" "$var" "$resolved"
    done
  else
    soma_info "No _mind.md template found"
  fi
  
  echo ""
}

cmd_tokens() {
  soma_header "soma body tokens" "per-variable token cost audit"
  
  echo ""
  
  # Find _mind.md
  local mind="$SOMA_DIR/body/_mind.md"
  if [[ ! -f "$mind" ]]; then
    soma_info "No _mind.md template — using built-in defaults"
    return
  fi
  
  # Walk chain to build body dirs (same order as body.ts)
  local body_dirs=("$SOMA_DIR/body")
  local dir="$(dirname "$(dirname "$SOMA_DIR")")"
  while [[ "$dir" != "/" ]]; do
    if [[ -d "$dir/.soma/body" && "$dir/.soma" != "$SOMA_DIR" ]]; then
      body_dirs+=("$dir/.soma/body")
    fi
    dir="$(dirname "$dir")"
  done
  [[ -d "$HOME/.soma/body" ]] && body_dirs+=("$HOME/.soma/body")
  
  # Extract variables from _mind.md (strip frontmatter first)
  local vars=($(sed '/^---$/,/^---$/d' "$mind" | grep -oE '\{\{[a-z_]+\}\}' 2>/dev/null | sort -u | tr -d '{}'))
  
  local total=0
  local content_total=0
  
  echo -e "  ${SOMA_BOLD}Template: ${SOMA_NC}$(basename "$mind")"
  echo -e "  ${SOMA_BOLD}Chain:${SOMA_NC} ${body_dirs[*]}"
  echo ""
  printf "  ${SOMA_BOLD}%-25s %8s %6s  %s${SOMA_NC}\n" "Variable" "Tokens" "Lines" "Source"
  echo -e "  ${SOMA_DIM}$(printf '%.0s─' {1..70})${SOMA_NC}"
  
  local seen=()
  for var in "${vars[@]}"; do
    # Skip runtime-only variables
    case "$var" in
      core_rules|protocol_summaries|muscle_digests|scripts_table|tools_section|\
      guard_section|docs_section|context_awareness|skills_block|date_time_cwd|\
      inbox_summary|git_context|soma_changes|project_changes|greeting|\
      session_id|session_files|preload)
        printf "  %-25s %8s %6s  %s\n" "{{$var}}" "—" "—" "(runtime)"
        continue
        ;;
    esac
    
    # Find file in chain (child wins)
    local found=""
    local fname="${var//_/-}.md"
    local fname2="${var}.md"
    for bd in "${body_dirs[@]}"; do
      if [[ -f "$bd/$fname" ]]; then
        found="$bd/$fname"; break
      elif [[ -f "$bd/$fname2" ]]; then
        found="$bd/$fname2"; break
      fi
    done
    
    if [[ -n "$found" ]]; then
      local body=$(sed '/^---$/,/^---$/d' "$found")
      local words=$(echo "$body" | wc -w | tr -d ' ')
      local tokens=$((words * 4 / 3))
      local lines=$(echo "$body" | wc -l | tr -d ' ')
      content_total=$((content_total + tokens))
      total=$((total + tokens))
      
      # Show relative path
      local rel="${found/$HOME/~}"
      printf "  %-25s %7d %6d  %s\n" "{{$var}}" "$tokens" "$lines" "$rel"
    else
      printf "  %-25s %8s %6s  %s\n" "{{$var}}" "⬜" "—" "(not found)"
    fi
  done
  
  echo -e "  ${SOMA_DIM}$(printf '%.0s─' {1..70})${SOMA_NC}"
  printf "  ${SOMA_BOLD}%-25s %7d${SOMA_NC}\n" "Content files total" "$content_total"
  echo ""
  soma_info "Runtime variables (protocols, muscles, tools, etc.) add ~2-5K tokens"
  soma_info "Full prompt: use /body render --send in TUI for exact count"
  echo ""
}

# ── Main ──
case "${1:-}" in
  check)
    cmd_check
    soma_next_steps \
      "soma body heat:muscle + protocol heat state" \
      "soma body vars:template variables ↔ resolved values" \
      "soma body tokens:per-variable token cost (walks chain)"
    ;;
  files)
    cmd_files
    soma_next_steps \
      "soma body check:health report for these files" \
      "soma body chain:inheritance chain (project → parent → global)"
    ;;
  chain)
    cmd_chain
    soma_next_steps \
      "soma body files:see files at each level" \
      "soma body vars:what resolves where"
    ;;
  heat)
    cmd_heat
    soma_next_steps \
      "soma body check:health on the files that hold these" \
      "soma body patterns:recent session behavioral patterns"
    ;;
  patterns)
    cmd_patterns
    soma_next_steps \
      "soma reflect --since 3d:recent session detail" \
      "soma body heat:current muscle state"
    ;;
  vars)
    cmd_vars
    soma_next_steps \
      "soma body tokens:cost audit per variable" \
      "soma body chain:inheritance origin for each var"
    ;;
  tokens)
    cmd_tokens
    soma_next_steps \
      "soma body vars:what each variable resolves to" \
      "/body render --send:exact TUI-side token count"
    ;;
  *)
    soma_header "soma body" "body file inspector"
    echo ""
    echo -e "  ${SOMA_GREEN}check${SOMA_NC}     health report — missing files, staleness, content"
    echo -e "  ${SOMA_GREEN}files${SOMA_NC}     all body files with sizes and dates"
    echo -e "  ${SOMA_GREEN}chain${SOMA_NC}     inheritance chain (project → parent → global)"
    echo -e "  ${SOMA_GREEN}heat${SOMA_NC}      muscle + protocol heat state"
    echo -e "  ${SOMA_GREEN}patterns${SOMA_NC}  behavioral patterns from recent sessions"
    echo -e "  ${SOMA_GREEN}vars${SOMA_NC}      template variables and what they resolve to"
    echo -e "  ${SOMA_GREEN}tokens${SOMA_NC}    per-variable token cost audit (walks chain)"
    echo ""
    echo -e "  ${SOMA_DIM}Runs outside the TUI. No API calls, no token cost.${SOMA_NC}"
    soma_next_steps \
      "soma body check:start here — health report" \
      "soma tool:sibling surface — registered tools" \
      "soma docs:sibling surface — doc search (pending SX-588)"
    soma_seams "soma-body.sh"
    echo ""
    ;;
esac
