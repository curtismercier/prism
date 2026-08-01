#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# soma-theme.sh — Shared theming for Soma scripts
# ═══════════════════════════════════════════════════════════════════════════
# Source this file at the top of any script:
#   source "$(dirname "$0")/soma-theme.sh" 2>/dev/null || true
#
# Provides: colours, σ header/footer, voice, summary helpers
# Falls back gracefully if not found (|| true)
#
# v0.20.3 item 3: if executed directly (not sourced), print help.
# Detection: BASH_SOURCE[0] == $0 means executed; otherwise sourced.
# (Guard placed AFTER comment block, BEFORE exports, so sourcing still sets vars.)
# ═══════════════════════════════════════════════════════════════════════════

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  cat <<'EOF'
σ  soma-theme.sh — shared theming library (source, don't execute)

  Usage:
    source "$(dirname "$0")/soma-theme.sh"

  Provides:
    SOMA_RED/GREEN/YELLOW/BLUE/CYAN/BOLD/DIM/NC  — ANSI colours
    soma_header "Name" "desc"                    — σ header block
    soma_footer [--license]                      — matching footer
    soma_summary / soma_voice / soma_error       — message helpers

  Not meant to run directly.
EOF
  exit 0
fi

# ── Colours ──
export SOMA_RED='\033[0;31m'
export SOMA_GREEN='\033[0;32m'
export SOMA_YELLOW='\033[0;33m'
export SOMA_BLUE='\033[0;34m'
export SOMA_CYAN='\033[0;36m'
export SOMA_GRAY='\033[0;90m'
export SOMA_BOLD='\033[1m'
export SOMA_DIM='\033[2m'
export SOMA_NC='\033[0m'

# ── Header ──
# Usage: soma_header "Script Name" "one-line description"
soma_header() {
  local name="${1:-soma}"
  local desc="${2:-}"
  echo ""
  echo -e "${SOMA_BOLD}σ ${name}${SOMA_NC}"
  if [[ -n "$desc" ]]; then
    echo -e "${SOMA_DIM}  ${desc}${SOMA_NC}"
  fi
  echo -e "${SOMA_DIM}──────────────────────────────────────${SOMA_NC}"
}

# ── Footer ──
# Usage: soma_footer [--license]
soma_footer() {
  echo -e "${SOMA_DIM}──────────────────────────────────────${SOMA_NC}"
  if [[ "${1:-}" == "--license" ]]; then
    echo -e "${SOMA_DIM}  BSL 1.1 © Curtis Mercier — open source 2027${SOMA_NC}"
  fi
  echo ""
}

# ── Status helpers ──
soma_ok()   { echo -e "  ${SOMA_GREEN}✓${SOMA_NC} $*"; }
soma_warn() { echo -e "  ${SOMA_YELLOW}⚠${SOMA_NC} $*"; }
soma_fail() { echo -e "  ${SOMA_RED}✗${SOMA_NC} $*"; }
soma_info() { echo -e "  ${SOMA_DIM}$*${SOMA_NC}"; }
soma_val()  { echo -e "  ${SOMA_BLUE}$*${SOMA_NC}"; }

# ── Next steps (progressive awareness) ──
# Usage: soma_next_steps [label] "cmd1:hint1" "cmd2:hint2" ...
#   Default label: "What next:"
# Suppresses output when stdout is not a TTY (piped / redirected) — `soma X | jq ...`
# stays clean. Interactive terminals get the scaffold.
# Pattern: amps/muscles/cli-progressive-awareness.md
soma_next_steps() {
  [[ -t 1 ]] || return 0
  local label="What next:"
  # Optional: first arg is custom label if it contains no ":"
  if [[ -n "${1:-}" && "$1" != *:* ]]; then
    label="$1"; shift
  fi
  echo
  echo -e "${SOMA_DIM}${label}${SOMA_NC}"
  for arg in "$@"; do
    local cmd="${arg%%:*}" hint="${arg#*:}"
    printf "  ${SOMA_CYAN}%-30s${SOMA_NC} ${SOMA_DIM}%s${SOMA_NC}\n" "$cmd" "$hint"
  done
}

# ── Summary ──
# Usage: soma_summary <pass> <warn> <fail> [message]
soma_summary() {
  local pass="${1:-0}" warn="${2:-0}" fail="${3:-0}" msg="${4:-}"
  echo ""
  echo -e "${SOMA_DIM}──────────────────────────────────────${SOMA_NC}"
  if [[ $fail -gt 0 ]]; then
    echo -e "  ${SOMA_RED}${pass} passed, ${fail} failed${SOMA_NC}${warn:+, ${SOMA_YELLOW}${warn} warnings${SOMA_NC}}"
  elif [[ $warn -gt 0 ]]; then
    echo -e "  ${SOMA_GREEN}${pass} passed${SOMA_NC}, ${SOMA_YELLOW}${warn} warnings${SOMA_NC}"
  else
    echo -e "  ${SOMA_GREEN}✓ ${pass} passed${SOMA_NC}"
  fi
  [[ -n "$msg" ]] && echo -e "  ${SOMA_DIM}${msg}${SOMA_NC}"
  echo ""
}

# ── Voice ──
# Usage: soma_say "ARRAY_NAME"
soma_say() {
  local msg
  eval "msg=(\"\${$1[@]}\")"
  local idx=$(( RANDOM % ${#msg[@]} ))
  echo -e "  ${SOMA_CYAN}σ${SOMA_NC} ${msg[$idx]}"
}

# ── Seams: related muscles/protocols ──
# Usage: soma_seams "script-name" ["seam message"]
# Finds .soma/ by walking up from CWD, looks for muscles with matching tools: field,
# and outputs TL;DR content. If a seam message is provided, shows that too.
# Scripts declare relationships via their YAML header's related-muscles/protocols fields.
soma_seams() {
  local script_name="${1:-}"
  local seam_msg="${2:-}"
  
  # Find .soma/ directory (walk up from CWD)
  local dir="$PWD"
  local soma_dir=""
  while [[ "$dir" != "/" ]]; do
    if [[ -d "$dir/.soma" ]]; then
      soma_dir="$dir/.soma"
      break
    fi
    dir="$(dirname "$dir")"
  done
  
  # Also check ~/.soma as fallback
  [[ -z "$soma_dir" && -d "$HOME/.soma" ]] && soma_dir="$HOME/.soma"
  [[ -z "$soma_dir" ]] && return 0
  
  local muscles_dir="$soma_dir/amps/muscles"
  local found=0
  
  # Find muscles whose tools: field lists this script
  if [[ -n "$script_name" && -d "$muscles_dir" ]]; then
    for mfile in "$muscles_dir"/*.md; do
      [[ ! -f "$mfile" ]] && continue
      # Check if tools: field contains our script name
      if grep -q "tools:.*${script_name}" "$mfile" 2>/dev/null; then
        local mname=$(basename "$mfile" .md)
        # Extract TL;DR section
        local tldr=$(sed -n '/^## TL;DR$/,/^## /{/^## TL;DR$/d;/^## /d;p;}' "$mfile" | head -5)
        if [[ -n "$tldr" ]]; then
          if [[ $found -eq 0 ]]; then
            echo -e "${SOMA_DIM}──────────────────────────────────────${SOMA_NC}"
            found=1
          fi
          echo -e "  ${SOMA_CYAN}📖${SOMA_NC} ${SOMA_BOLD}${mname}${SOMA_NC}"
          echo "$tldr" | while IFS= read -r line; do
            echo -e "  ${SOMA_DIM}${line}${SOMA_NC}"
          done
        fi
      fi
    done
  fi
  
  # Show seam message if provided
  if [[ -n "$seam_msg" ]]; then
    if [[ $found -eq 0 ]]; then
      echo -e "${SOMA_DIM}──────────────────────────────────────${SOMA_NC}"
    fi
    echo -e "  ${SOMA_YELLOW}σ${SOMA_NC} ${seam_msg}"
  fi
}

# ── Standard voice banks ──
SOMA_VOICE_HEALTHY=(
  "Looking good. The body is current."
  "All clear — nothing to fix."
  "Clean bill of health."
  "Everything checks out."
)
SOMA_VOICE_DONE=(
  "Done."
  "Finished."
  "All wrapped up."
  "That's a wrap."
)
SOMA_VOICE_NEEDS_WORK=(
  "Found some things. See above."
  "A few items need attention."
  "Not critical, but worth a look."
)
