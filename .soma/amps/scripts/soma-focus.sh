#!/bin/bash
# ---
# name: soma-focus
# description: Set focus before starting. Clear when done. Primes the next boot.
# tags: [focus, priming, boot, workflow]
# related-muscles: [deep-focus]
# related-protocols: [maps]
# ---
# ═══════════════════════════════════════════════════════════════════════════
# soma-focus.sh — Seam-traced boot focusing
# ═══════════════════════════════════════════════════════════════════════════
#
# Run BEFORE the model starts. Traces a keyword through memory and generates
# a .boot-target file that primes the system prompt for the topic.
#
# Usage:
#   soma-focus.sh <keyword>       Set focus, next boot uses it
#   soma-focus.sh show            Show current focus state
#   soma-focus.sh clear           Remove focus
#   soma-focus.sh dry-run <kw>    Show what would be focused without writing
#
# The existing soma-boot.ts reads .boot-target and applies promptConfig
# as plan overrides to the system prompt compiler.
#
# Related: soma-seam.sh (trace engine), maps.ts (prompt-config parser)
# MAP: soma-focus

set -eo pipefail

# ── Theme ──
_sd="$(dirname "$0")"
if [ -f "$_sd/soma-theme.sh" ]; then source "$_sd/soma-theme.sh"; fi
SOMA_BOLD="${SOMA_BOLD:-\033[1m}"; SOMA_DIM="${SOMA_DIM:-\033[2m}"; SOMA_NC="${SOMA_NC:-\033[0m}"; SOMA_CYAN="${SOMA_CYAN:-\033[0;36m}"
# ── Project root discovery ──
find_project_root() {
  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    if [[ -d "$dir/.soma" ]]; then
      echo "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  [[ -d "$HOME/.soma" ]] && echo "$HOME" && return 0
  echo "$PWD"
}

PROJECT_ROOT="$(find_project_root)"
SOMA_DIR="$PROJECT_ROOT/.soma"
BOOT_TARGET="$SOMA_DIR/.boot-target"

# Handle --help before checking dependencies
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" || "${1:-}" == "help" ]]; then
  echo "soma-focus — Set focus before starting. Clear when done. Primes the next boot."
  echo ""
  echo "Usage:"
  echo "  soma-focus <keyword>       Set focus, next boot uses it"
  echo "  soma-focus show            Show current focus state"
  echo "  soma-focus clear           Remove focus"
  echo "  soma-focus dry-run <kw>    Show what would be focused without writing"
  echo ""
  echo "Requires: soma-seam.sh (trace engine)"
  exit 0
fi

# Locate soma-seam — ships as .sh (dev, in scripts/_pro/) or .js (released, in scripts/).
# Also check project and global script dirs. Released package flattens _pro/ so look
# in scripts/ first, then scripts/_pro/ (dev fallback).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SEAM_SCRIPT=""
SEAM_RUNNER="bash"
for candidate in \
  "$SCRIPT_DIR/soma-seam.js" \
  "$SCRIPT_DIR/soma-seam.sh" \
  "$SCRIPT_DIR/_pro/soma-seam.sh" \
  "$SOMA_DIR/amps/scripts/soma-seam.js" \
  "$SOMA_DIR/amps/scripts/soma-seam.sh" \
  "$HOME/.soma/amps/scripts/soma-seam.js" \
  "$HOME/.soma/amps/scripts/soma-seam.sh" \
; do
  if [[ -f "$candidate" ]]; then
    SEAM_SCRIPT="$candidate"
    [[ "$candidate" == *.js ]] && SEAM_RUNNER="node"
    break
  fi
done
if [[ -z "$SEAM_SCRIPT" ]]; then
  echo "ERROR: soma-seam not found. Looked for soma-seam.{sh,js} in scripts/, scripts/_pro/, \$SOMA_DIR/amps/scripts/, ~/.soma/amps/scripts/."
  echo "Install via 'soma init' or check your release build."
  exit 1
fi

# Colors
BOLD="\033[1m"
DIM="\033[2m"
CYAN="\033[0;36m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
MAGENTA="\033[0;35m"
RESET="\033[0m"

CMD="${1:-help}"

# ─── Strip ANSI ───────────────────────────────────────────────────────────

strip_ansi() {
  sed 's/\x1b\[[0-9;]*m//g'
}

# ─── SHOW ─────────────────────────────────────────────────────────────────

show_focus() {
  if [[ -f "$BOOT_TARGET" ]]; then
    echo -e "${BOLD}Current focus:${RESET}"
    cat "$BOOT_TARGET" | python3 -m json.tool 2>/dev/null || cat "$BOOT_TARGET"
  else
    echo -e "${DIM}No focus set. Run: soma-focus.sh <keyword>${RESET}"
  fi
}

# ─── CLEAR ────────────────────────────────────────────────────────────────

clear_focus() {
  if [[ -f "$BOOT_TARGET" ]]; then
    rm "$BOOT_TARGET"
    echo -e "${GREEN}Focus cleared.${RESET}"
  else
    echo -e "${DIM}No focus was set.${RESET}"
  fi
}

# ─── TRACE + SCORE ────────────────────────────────────────────────────────

run_focus() {
  local keyword="$1"
  local dry_run="${2:-false}"
  
  echo -e "${BOLD}═══ soma focus: \"$keyword\" ═══${RESET}"
  echo ""

  # ── 1. Search: frontmatter first, seam second ──
  # Split multi-word phrases into keywords
  # "build a new astro site" → search for: build, astro, site (skip stopwords)
  local search_keywords=""
  local stopwords="a an the of in on to for is it and or but with by from new"
  for word in $keyword; do
    local lower=$(echo "$word" | tr '[:upper:]' '[:lower:]')
    if ! echo " $stopwords " | grep -q " $lower "; then
      search_keywords="${search_keywords} ${lower}"
    fi
  done
  search_keywords=$(echo "$search_keywords" | sed 's/^ //')
  local kw_count=$(echo "$search_keywords" | wc -w | tr -d ' ')
  
  if [[ $kw_count -gt 1 ]]; then
    echo -e "${DIM}Keywords: $search_keywords${RESET}"
    echo ""
  fi

  # Phase 1: ALWAYS scan AMPS frontmatter first (fast, precise)
  local trace_output=""
  local fast_output=""
  local fm_matches=0
  
  for f in $(find "$SOMA_DIR/amps" -name "*.md" -not -path "*/_archive/*" -not -name "_*" 2>/dev/null); do
    local match_score=0
    for kw in $search_keywords; do
      if grep -qiE "tags:.*$kw|keywords:.*$kw|triggers:.*$kw|topic:.*$kw" "$f" 2>/dev/null; then
        match_score=$((match_score + 1))
      fi
    done
    # Also check name match
    local fname=$(basename "$f" .md)
    for kw in $search_keywords; do
      if echo "$fname" | grep -qi "$kw"; then
        match_score=$((match_score + 1))
      fi
    done
    
    if [[ $match_score -gt 0 ]]; then
      local rel=$(echo "$f" | sed "s|$PROJECT_ROOT/||")
      fast_output+="  $rel  ( match,  active)\n"
      fm_matches=$((fm_matches + 1))
    fi
  done
  trace_output=$(echo -e "$fast_output")

  # Phase 2: If frontmatter found <5 results AND single keyword, broaden with seam trace
  if [[ $fm_matches -lt 5 && $kw_count -eq 1 ]]; then
    echo -e "${DIM}Frontmatter: $fm_matches matches — broadening with seam trace${RESET}"
    local seam_output=$("$SEAM_RUNNER" "$SEAM_SCRIPT" trace "$keyword" 2>/dev/null | strip_ansi)
    trace_output="${trace_output}\n${seam_output}"
  elif [[ $fm_matches -ge 5 ]]; then
    echo -e "${DIM}Frontmatter: $fm_matches matches${RESET}"
  fi
  echo ""

  # ── 2. Extract matched muscles (deduplicated) ──
  local muscles=()
  local muscle_scores=()
  local seen_muscles=""
  
  while IFS= read -r line; do
    # Match lines like: .soma/amps/muscles/ship-cycle.md or .soma/amps/muscles/ui/tokenized-css.md
    if [[ "$line" =~ \.soma/amps/muscles/([^\ ]+)\.md ]]; then
      local fullpath="${BASH_REMATCH[1]}"
      local name="${fullpath##*/}"  # strip subdirectory prefix for dedup
      echo "$seen_muscles" | grep -qF "|$name|" && continue
      seen_muscles="${seen_muscles}|$name|"
      muscles+=("$name")
      
      # Score: seam match = 5, content match = 3
      local score=3
      local file="$SOMA_DIR/amps/muscles/${fullpath}.md"
      if [[ -f "$file" ]]; then
        local seams=$(sed -n '/^---$/,/^---$/p' "$file" 2>/dev/null | grep "^seams:" || true)
        if [[ -n "$seams" ]]; then
          score=5
        fi
        # Check if keyword is in the digest (most relevant)
        local digest=$(sed -n '/<!-- digest:start -->/,/<!-- digest:end -->/p' "$file" 2>/dev/null | head -3)
        if echo "$digest" | grep -qi "$keyword" 2>/dev/null; then
          score=8
        fi
      fi
      muscle_scores+=("$score")
    fi
  done <<< "$trace_output"

  # ── 3. Extract matched protocols (deduplicated) ──
  local protocols=()
  local protocol_scores=()
  local seen_protocols=""
  
  while IFS= read -r line; do
    if [[ "$line" =~ \.soma/amps/protocols/([^\ ]+)\.md ]]; then
      local fullpath="${BASH_REMATCH[1]}"
      local name="${fullpath##*/}"
      echo "$seen_protocols" | grep -qF "|$name|" && continue
      seen_protocols="${seen_protocols}|$name|"
      protocols+=("$name")
      protocol_scores+=(3)
    fi
  done <<< "$trace_output"

  # ── 4. Extract matched MAPs (deduplicated) ──
  local maps=()
  local map_scores=()
  local seen_maps=""
  
  while IFS= read -r line; do
    if [[ "$line" =~ \.soma/amps/automations/maps/([^\ ]+)\.md ]]; then
      local fullpath="${BASH_REMATCH[1]}"
      local name="${fullpath##*/}"
      echo "$seen_maps" | grep -qF "|$name|" && continue
      seen_maps="${seen_maps}|$name|"
      maps+=("$name")
      
      # Score: trigger match = 5, name match = 8
      local score=3
      if [[ "$name" == *"$keyword"* ]]; then
        score=8
      fi
      local file="$SOMA_DIR/amps/automations/maps/${fullpath}.md"
      if [[ -f "$file" ]]; then
        local triggers=$(sed -n '/^---$/,/^---$/p' "$file" 2>/dev/null | grep "^triggers:" || true)
        if echo "$triggers" | grep -qi "$keyword" 2>/dev/null; then
          score=$((score > 5 ? score : 5))
        fi
      fi
      map_scores+=("$score")
    fi
  done <<< "$trace_output"

  # ── 5. Extract matched sessions (most recent, deduplicated) ──
  local sessions=()
  local seen_sessions=""
  while IFS= read -r line; do
    if [[ "$line" =~ (20[0-9]{2}-[0-9]{2}-[0-9]{2}-s[0-9]+-[a-f0-9]+) ]]; then
      local sess="${BASH_REMATCH[1]}"
      if ! echo "$seen_sessions" | grep -qF "|$sess|"; then
        seen_sessions="${seen_sessions}|$sess|"
        sessions+=("$sess")
      fi
    fi
  done < <(echo "$trace_output" | grep -E "^  20[0-9]{2}-")

  # ── 6. Find latest preload mentioning keyword ──
  local latest_preload=""
  local preload_dir="$SOMA_DIR/memory/preloads"
  if [[ -d "$preload_dir" ]]; then
    latest_preload=$(grep -rl "$keyword" "$preload_dir"/*.md 2>/dev/null | sort | tail -1 || true)
  fi

  # ── 7. Build heat overrides (score 3+ gets boosted, 5+ gets force-included) ──
  # Heat formula: score * 2 (so score 5 → heat 10 = HOT)
  # Force-include: score 5+ (seam match with tag/keyword = important enough to load fully)
  local muscle_heat_json="{"
  local muscle_force_json="["
  local first_mh=true
  local first_mf=true
  for i in "${!muscles[@]}"; do
    local name="${muscles[$i]}"
    local score="${muscle_scores[$i]}"
    if [[ $score -ge 3 ]]; then
      if $first_mh; then first_mh=false; else muscle_heat_json+=","; fi
      muscle_heat_json+="\"$name\":$((score * 2))"
    fi
    if [[ $score -ge 5 ]]; then
      if $first_mf; then first_mf=false; else muscle_force_json+=","; fi
      muscle_force_json+="\"$name\""
    fi
  done
  muscle_heat_json+="}"
  muscle_force_json+="]"

  local proto_heat_json="{"
  local first_ph=true
  for i in "${!protocols[@]}"; do
    local name="${protocols[$i]}"
    local score="${protocol_scores[$i]}"
    if [[ $score -ge 3 ]]; then
      if $first_ph; then first_ph=false; else proto_heat_json+=","; fi
      proto_heat_json+="\"$name\":$((score * 2))"
    fi
  done
  proto_heat_json+="}"

  # ── 8. Build related MAPs list ──
  local maps_json="["
  local first_map=true
  for i in "${!maps[@]}"; do
    local name="${maps[$i]}"
    local score="${map_scores[$i]}"
    if [[ $score -ge 5 ]]; then
      if $first_map; then first_map=false; else maps_json+=","; fi
      maps_json+="\"$name\""
    fi
  done
  maps_json+="]"

  # ── 9. Build sessions list (last 5) ──
  local sessions_json="["
  local first_s=true
  local sess_count=0
  for s in "${sessions[@]}"; do
    if [[ $sess_count -ge 5 ]]; then break; fi
    if $first_s; then first_s=false; else sessions_json+=","; fi
    sessions_json+="\"$s\""
    sess_count=$((sess_count + 1))
  done
  sessions_json+="]"

  # ── 10. Build preload path ──
  local preload_rel=""
  if [[ -n "$latest_preload" ]]; then
    preload_rel=$(echo "$latest_preload" | sed "s|$SOMA_DIR/||")
  fi

  # ── 11. Build supplementary identity ──
  local identity="This session is focused on: $keyword."
  if [[ -n "$latest_preload" ]]; then
    # Extract resume point from preload
    local resume=$(grep -A 2 "## Resume Point" "$latest_preload" 2>/dev/null | tail -1 | head -c 200 || true)
    if [[ -n "$resume" ]]; then
      identity="$identity Last known state: $resume"
    fi
  fi

  # ── 12. Assemble .boot-target ──
  local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  local boot_target=$(cat <<EOF
{
  "type": "focus",
  "keyword": "$keyword",
  "timestamp": "$timestamp",
  "promptConfig": {
    "heatOverrides": {
      "muscles": $muscle_heat_json,
      "protocols": $proto_heat_json
    },
    "forceInclude": {
      "muscles": $muscle_force_json
    },
    "supplementaryIdentity": "$identity"
  },
  "preloadPath": "$preload_rel",
  "relatedMaps": $maps_json,
  "relatedSessions": $sessions_json
}
EOF
)

  # ── 13. Report ──
  echo -e "${CYAN}Muscles matched:${RESET} ${#muscles[@]}"
  for i in "${!muscles[@]}"; do
    local indicator="  "
    if [[ ${muscle_scores[$i]} -ge 8 ]]; then
      indicator="${RED}★${RESET} "
    elif [[ ${muscle_scores[$i]} -ge 5 ]]; then
      indicator="${YELLOW}●${RESET} "
    fi
    echo -e "  ${indicator}${muscles[$i]} (score: ${muscle_scores[$i]})"
  done
  echo ""

  echo -e "${CYAN}Protocols matched:${RESET} ${#protocols[@]}"
  for i in "${!protocols[@]}"; do
    echo -e "  ${YELLOW}●${RESET} ${protocols[$i]} (score: ${protocol_scores[$i]})"
  done
  echo ""

  echo -e "${CYAN}MAPs matched:${RESET} ${#maps[@]}"
  for i in "${!maps[@]}"; do
    local indicator="  "
    if [[ ${map_scores[$i]} -ge 8 ]]; then
      indicator="${RED}★${RESET} "
    elif [[ ${map_scores[$i]} -ge 5 ]]; then
      indicator="${YELLOW}●${RESET} "
    fi
    echo -e "  ${indicator}${maps[$i]} (score: ${map_scores[$i]})"
  done
  echo ""

  echo -e "${CYAN}Sessions:${RESET} ${#sessions[@]} found (showing last 5)"
  for s in "${sessions[@]:0:5}"; do
    echo -e "  ${GREEN}$s${RESET}"
  done
  echo ""

  if [[ -n "$latest_preload" ]]; then
    echo -e "${CYAN}Latest preload:${RESET} $(basename "$latest_preload")"
  else
    echo -e "${DIM}No preload found for \"$keyword\"${RESET}"
  fi
  echo ""

  if [[ "$dry_run" == "true" ]]; then
    echo -e "${YELLOW}── DRY RUN — would write: ──${RESET}"
    echo "$boot_target" | python3 -m json.tool 2>/dev/null || echo "$boot_target"
  else
    echo "$boot_target" > "$BOOT_TARGET"
    echo -e "${GREEN}✓ Focus set.${RESET} Next \`soma\` boot will be primed for \"$keyword\"."
    echo -e "${DIM}  .boot-target written to: $BOOT_TARGET${RESET}"
    echo -e "${DIM}  Clear with: soma-focus.sh clear${RESET}"
  fi
}

# ─── DISPATCH ─────────────────────────────────────────────────────────────

case "$CMD" in
  show)
    show_focus
    ;;
  clear)
    clear_focus
    ;;
  dry-run|dry_run|dryrun)
    keyword="${2:?Usage: soma-focus.sh dry-run <keyword>}"
    run_focus "$keyword" true
    ;;
  help|--help|-h)
    echo "soma-focus.sh — Seam-traced boot focusing"
    echo ""
    echo "Commands:"
    echo "  <keyword>       Set focus for next boot"
    echo "  show            Show current focus state"
    echo "  clear           Remove focus"
    echo "  dry-run <kw>    Preview without writing"
    echo ""
    echo "Examples:"
    echo "  soma-focus.sh runtime        # Focus on runtime work"
    echo "  soma-focus.sh meetsoma       # Focus on Soma product"
    echo "  soma-focus.sh glass-dashboard # Focus on dashboard"
    echo ""
    echo "After setting focus, run \`soma\` to start a focused session."
    echo ""
    soma_seams "soma-focus.sh" 2>/dev/null || true
    ;;
  *)
    run_focus "$CMD" false
    ;;
esac
