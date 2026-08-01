#!/usr/bin/env bash
# ---
# name: soma-code
# author: meetsoma
# version: 3.0.0
# license: MIT
# tags: [navigation, search, code, grep, map, refactor, agent-first]
# requires: [bash 4+, grep, sed, awk; optional: rg]
# description: Map before editing. Refs before renaming. Blast before deleting.
#              Agent-first: auto-detects language, progressive scan, never hangs.
# ---
# ═══════════════════════════════════════════════════════════════════════════
# soma-code — fast codebase navigator (v3, agent-first)
# ═══════════════════════════════════════════════════════════════════════════
# What's new in v3:
#   • Auto-detects language from cwd (Cargo.toml → rs, package.json → ts/js, etc.)
#   • Progressive scan with status updates every ~3s
#   • Hard timeout (default 30s) — never hangs the agent's session
#   • Stutter detection — if 0 progress 9s, exit gracefully
#   • Per-command help (soma-code find --help) with examples
#   • Fuzzy command match (soma-code fnd → "did you mean find?")
#   • Uses rg if installed, falls back to grep
#   • Output capped + narrow-suggestions
#   • Pipefail-safe grep handling (0-match no longer kills script)
#   • Map: now Rust, Python, TOML, YAML, JSON, Markdown
#
# Run `soma-code` (no args) for help. `soma-code <cmd> --help` for per-cmd help.
# ═══════════════════════════════════════════════════════════════════════════

# Note: NOT using -e — grep returns 1 on no match and we handle it explicitly.
set -uo pipefail

# ── Configuration knobs (env-overridable) ────────────────────────────────
SOMA_CODE_TIMEOUT="${SOMA_CODE_TIMEOUT:-30}"          # hard wall-clock seconds
SOMA_CODE_STUTTER="${SOMA_CODE_STUTTER:-9}"           # abort after N seconds without progress
SOMA_CODE_LIMIT="${SOMA_CODE_LIMIT:-100}"             # max hits to display
SOMA_CODE_HEARTBEAT="${SOMA_CODE_HEARTBEAT:-3}"       # status interval (seconds)
SOMA_CODE_QUIET="${SOMA_CODE_QUIET:-0}"               # 1 = no heartbeats (for scripts)

# ── Theme ────────────────────────────────────────────────────────────────
_sd="$(dirname "$0")"
if [ -f "$_sd/soma-theme.sh" ]; then source "$_sd/soma-theme.sh"; fi
SOMA_BOLD="${SOMA_BOLD:-\033[1m}"; SOMA_DIM="${SOMA_DIM:-\033[2m}"; SOMA_NC="${SOMA_NC:-\033[0m}"
SOMA_GREEN="${SOMA_GREEN:-\033[0;32m}"; SOMA_YELLOW="${SOMA_YELLOW:-\033[0;33m}"; SOMA_CYAN="${SOMA_CYAN:-\033[0;36m}"

SHELL_DIR="${SOMA_SHELL_DIR:-$(pwd)}"
RED='\033[0;31m'
GREEN='\033[0;32m'
DIM='\033[0;90m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

# ── Engine detection (rg vs grep) ────────────────────────────────────────
# rg is faster + auto-respects .gitignore. Fall back to grep if not installed.
ENGINE=""
if command -v rg >/dev/null 2>&1; then
  ENGINE="rg"
elif command -v grep >/dev/null 2>&1; then
  ENGINE="grep"
else
  echo "✗ neither rg nor grep available — soma-code requires one"
  exit 127
fi

# ── File-type sets ───────────────────────────────────────────────────────
# v3: extended to cover the full ecosystem (Rust, Python, Bash, TOML, YAML).
# These map to grep --include patterns OR rg --glob patterns depending on engine.
TS_EXTS="ts,tsx,js,jsx,mjs,mts"
RUST_EXTS="rs"
PY_EXTS="py"
SHELL_EXTS="sh,bash"
WEB_EXTS="css,scss,html,astro,svelte,vue"
DOC_EXTS="md,json,toml,yml,yaml"
ALL_EXTS="${TS_EXTS},${RUST_EXTS},${PY_EXTS},${SHELL_EXTS},${WEB_EXTS},${DOC_EXTS}"

# ── Language auto-detect (one-time per invocation) ────────────────────────
# Walks up from cwd looking for project markers. Maps to a sensible default ext.
# Probe a single directory for marker files. Echoes ext list, or empty if no match.
_probe_dir() {
  local dir="$1"
  [ -f "$dir/Cargo.toml" ]       && { echo "rs,toml,md"; return; }
  [ -f "$dir/package.json" ]     && { echo "$TS_EXTS,json,md"; return; }
  [ -f "$dir/pyproject.toml" ]   && { echo "py,toml,md"; return; }
  [ -f "$dir/requirements.txt" ] && { echo "py,toml,md"; return; }
  [ -f "$dir/go.mod" ]           && { echo "go,md"; return; }
  [ -f "$dir/Gemfile" ]          && { echo "rb,md"; return; }
  [ -f "$dir/CMakeLists.txt" ]   && { echo "c,cpp,h,hpp,md"; return; }
}

_probe_dir_kind() {
  local dir="$1"
  [ -f "$dir/Cargo.toml" ]       && { echo "Rust"; return; }
  [ -f "$dir/package.json" ]     && { echo "Node/TypeScript"; return; }
  [ -f "$dir/pyproject.toml" ]   && { echo "Python"; return; }
  [ -f "$dir/requirements.txt" ] && { echo "Python"; return; }
  [ -f "$dir/go.mod" ]           && { echo "Go"; return; }
  [ -f "$dir/Gemfile" ]          && { echo "Ruby"; return; }
  [ -f "$dir/CMakeLists.txt" ]   && { echo "C/C++"; return; }
}

detect_default_ext() {
  # Env override — callers (e.g. soma-github local-mode) can pass language
  # hint when cwd-marker detection won't work (pre-modules Go, monorepo,
  # extracted tarball without manifest).
  if [ -n "${SOMA_CODE_DEFAULT_EXT:-}" ]; then
    echo "$SOMA_CODE_DEFAULT_EXT"
    return
  fi
  # Walk up first (cheap)
  local dir="$SHELL_DIR"
  for _ in 1 2 3 4 5; do
    [ "$dir" = "/" ] && break
    local hit=$(_probe_dir "$dir")
    [ -n "$hit" ] && { echo "$hit"; return; }
    dir="$(dirname "$dir")"
  done
  # Walk-up failed — check immediate children (monorepo case, e.g. somadian/bins/<bin>/Cargo.toml)
  for child in "$SHELL_DIR"/*/; do
    [ -d "$child" ] || continue
    local hit=$(_probe_dir "$child")
    [ -n "$hit" ] && { echo "$hit"; return; }
    # One more level for nested-monorepo (somadian/bins/cloud/Cargo.toml)
    for grandchild in "$child"/*/; do
      [ -d "$grandchild" ] || continue
      local hit2=$(_probe_dir "$grandchild")
      [ -n "$hit2" ] && { echo "$hit2"; return; }
    done
  done
  # Generic — broad coverage
  echo "$ALL_EXTS"
}

detect_project_kind() {
  local dir="$SHELL_DIR"
  for _ in 1 2 3 4 5; do
    [ "$dir" = "/" ] && break
    local hit=$(_probe_dir_kind "$dir")
    [ -n "$hit" ] && { echo "$hit"; return; }
    dir="$(dirname "$dir")"
  done
  for child in "$SHELL_DIR"/*/; do
    [ -d "$child" ] || continue
    local hit=$(_probe_dir_kind "$child")
    [ -n "$hit" ] && { echo "$hit (subdir)"; return; }
    for grandchild in "$child"/*/; do
      [ -d "$grandchild" ] || continue
      local hit2=$(_probe_dir_kind "$grandchild")
      [ -n "$hit2" ] && { echo "$hit2 (monorepo)"; return; }
    done
  done
  echo "generic"
}

# ── Helpers ───────────────────────────────────────────────────────────────
header() { echo -e "\n${BOLD}$1${NC}"; }
dim() { echo -e "${DIM}$1${NC}"; }
hit() { echo -e "${CYAN}$1${NC}:${YELLOW}$2${NC}: $3"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1" >&2; }
err()  { echo -e "${RED}✗${NC}  $1" >&2; }

heartbeat() {
  [ "$SOMA_CODE_QUIET" = "1" ] && return
  local elapsed="$1"; local files="$2"; local hits="$3"; local note="${4:-}"
  echo -e "  ${DIM}scanning ... ${elapsed}s • ${files} files • ${hits} matches${note:+ • $note}${NC}" >&2
}

# Run command with progressive monitoring + timeout + stutter detection.
# Args: <result-file> <heartbeat-cmd> <timeout-s> <stutter-s>
# Returns: 0 done, 124 timeout, 125 stalled. Result text in $result-file.
with_progress() {
  local resultfile="$1"; shift
  local timeout="$1"; shift
  local stutter="$1"; shift
  # Remaining args: the command + args to execute, output captured to resultfile.

  ( "$@" > "$resultfile" 2>/dev/null ) &
  local pid=$!
  local started=$(date +%s)
  local last_size=0
  local last_change=$started

  while kill -0 "$pid" 2>/dev/null; do
    sleep "$SOMA_CODE_HEARTBEAT"
    local now=$(date +%s)
    local elapsed=$((now - started))
    local size=$(wc -l < "$resultfile" 2>/dev/null | tr -d ' ' || echo 0)
    local note=""

    [ "$size" -ne "$last_size" ] && { last_size=$size; last_change=$now; }
    local stalled_for=$((now - last_change))
    [ "$stalled_for" -ge "$stutter" ] && note="stalled ${stalled_for}s"

    heartbeat "$elapsed" "?" "$size" "$note"

    # Hard timeout
    if [ "$elapsed" -ge "$timeout" ]; then
      kill -9 "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
      warn "search hit ${timeout}s timeout — partial results below"
      return 124
    fi
    # Stutter: aborted with what we have
    if [ "$stalled_for" -ge "$stutter" ] && [ "$elapsed" -gt "$stutter" ]; then
      kill -9 "$pid" 2>/dev/null
      wait "$pid" 2>/dev/null
      warn "search stalled ${stalled_for}s without progress — partial results below"
      return 125
    fi
  done

  wait "$pid" 2>/dev/null
  return 0
}

# Run the search engine. Uses rg if available (smart-case, gitignore, hidden).
# Otherwise grep -rn. Both produce file:line:content output.
#
# Args: <pattern> <path> <ext_or_type>
# ext_or_type: comma-list of extensions OR a type name prefixed with 'type=' or 't=':
#   ts,tsx,js                     — explicit ext list
#   type=rust                     — lift rg's 100+ type aliases (rust, cpp, cmake, ...)
#   t=cpp                         — short form
# When engine=grep, type aliases are mapped to a small built-in subset; rg
# delegates directly via --type.
#
# CRITICAL: ext globs (*.ts etc.) MUST be passed as separate args, not as a
# string. Otherwise bash glob-expands them against cwd before they reach rg.
run_search() {
  local pattern="$1"; local path="$2"; local ext_or_type="$3"
  local mode="${SOMA_CODE_MODE:-standard}"  # standard | json | stats | files

  local -a engine_args=()

  # Type alias path: pass --type X directly to rg.
  if [[ "$ext_or_type" =~ ^(type=|t=) ]]; then
    local type_name="${ext_or_type#type=}"
    type_name="${type_name#t=}"
    if [ "$ENGINE" = "rg" ]; then
      engine_args+=(--type "$type_name")
    else
      # Grep fallback: map common types manually
      case "$type_name" in
        rust)    engine_args+=("--include=*.rs") ;;
        py|python) engine_args+=("--include=*.py") ;;
        ts)      engine_args+=("--include=*.ts" "--include=*.tsx") ;;
        js)      engine_args+=("--include=*.js" "--include=*.jsx" "--include=*.mjs") ;;
        sh|bash) engine_args+=("--include=*.sh" "--include=*.bash") ;;
        cpp|cxx) engine_args+=("--include=*.cpp" "--include=*.cc" "--include=*.cxx" "--include=*.h" "--include=*.hpp") ;;
        c)       engine_args+=("--include=*.c" "--include=*.h") ;;
        go)      engine_args+=("--include=*.go") ;;
        ruby|rb) engine_args+=("--include=*.rb") ;;
        md)      engine_args+=("--include=*.md") ;;
        toml)    engine_args+=("--include=*.toml") ;;
        yaml|yml)engine_args+=("--include=*.yml" "--include=*.yaml") ;;
        json)    engine_args+=("--include=*.json") ;;
        *)
          warn "Unknown type '$type_name' for grep fallback. Install rg for full --type support."
          return 1
          ;;
      esac
    fi
  else
    # Ext list path
    IFS=',' read -ra EXTS <<< "$ext_or_type"
    if [ "$ENGINE" = "rg" ]; then
      for e in "${EXTS[@]}"; do
        engine_args+=(--glob "*.${e}")
      done
    else
      for e in "${EXTS[@]}"; do
        engine_args+=("--include=*.${e}")
      done
    fi
  fi

  # Mode selection
  case "$mode" in
    json)
      if [ "$ENGINE" = "rg" ]; then
        rg --color=never --no-heading --json --smart-case \
          -g '!node_modules' -g '!target' -g '!dist' -g '!.git' \
          "${engine_args[@]}" -- "$pattern" "$path" 2>/dev/null
      else
        warn "--json mode requires rg; falling back to standard"
      fi
      return 0
      ;;
    files)
      # "What files WOULD be searched?" — debug glob/ignore rules
      if [ "$ENGINE" = "rg" ]; then
        rg --files --color=never \
          -g '!node_modules' -g '!target' -g '!dist' -g '!.git' \
          "${engine_args[@]}" "$path" 2>/dev/null
      else
        find "$path" -type f ! -path '*/node_modules/*' ! -path '*/target/*' ! -path '*/dist/*' ! -path '*/.git/*' 2>/dev/null
      fi
      return 0
      ;;
    stats)
      # Match counts only
      if [ "$ENGINE" = "rg" ]; then
        rg --color=never --no-heading --count-matches --smart-case \
          -g '!node_modules' -g '!target' -g '!dist' -g '!.git' \
          "${engine_args[@]}" -- "$pattern" "$path" 2>/dev/null
      else
        grep -rn -c "${engine_args[@]}" --color=never "$pattern" "$path" 2>/dev/null
      fi
      return 0
      ;;
  esac

  # Standard mode
  if [ "$ENGINE" = "rg" ]; then
    # When path is a single file, rg omits the path: prefix. Use --with-filename
    # to force it for parser consistency.
    rg --color=never --no-heading --line-number --smart-case --with-filename \
      -g '!node_modules' -g '!target' -g '!dist' -g '!.git' \
      "${engine_args[@]}" -- "$pattern" "$path" 2>/dev/null
  else
    grep -rnH "${engine_args[@]}" --color=never \
      "$pattern" "$path" 2>/dev/null | grep -v '/node_modules/' | grep -v '/target/' | grep -v '/dist/'
  fi
  return 0  # never let exit-1 (no matches) propagate
}

# Helper used by domain-specific commands (physics/events/css-vars/config) that
# build their own grep -E pattern. Returns include args as one string for those
# legacy callers; safe because they pass the args verbatim to grep -rn at the
# command line where bash globbing is OK in their narrow scope. Kept for
# backward compatibility with the v2 cmd_physics/etc bodies.
build_engine_args() {
  local ext_csv="$1"
  local args=""
  IFS=',' read -ra EXTS <<< "$ext_csv"
  if [ "$ENGINE" = "rg" ]; then
    for e in "${EXTS[@]}"; do args="$args --glob '*.${e}'"; done
  else
    for e in "${EXTS[@]}"; do args="$args --include='*.${e}'"; done
  fi
  echo "$args"
}

# Cap output to LIMIT, with truncation note.
cap_output() {
  local input="$1"; local total="$2"
  if [ "$total" -le "$SOMA_CODE_LIMIT" ]; then
    echo "$input"
  else
    echo "$input" | head -n "$SOMA_CODE_LIMIT"
    echo ""
    dim "─── capped at $SOMA_CODE_LIMIT/$total hits ───"
    dim "narrow scope:  soma-code <cmd> '<pattern>' <path> <ext>"
  fi
}

# Suggest alternative invocations on no-results.
suggest() {
  echo -e "\n${YELLOW}💡 Try instead:${NC}" >&2
  for s in "$@"; do
    echo -e "  ${DIM}→${NC} $s" >&2
  done
  echo "" >&2
}

no_results() {
  local cmd="$1"; local target="$2"; local path="$3"; local ext="${4:-}"
  echo -e "\n${YELLOW}⚠${NC}  No results for ${BOLD}$target${NC} in ${DIM}$path${NC}${ext:+ (ext: ${ext})}" >&2

  case "$cmd" in
    find)
      suggest \
        "soma-code find '$target' .                ${DIM}# wider scope${NC}" \
        "soma-code find '$target' . $ALL_EXTS  ${DIM}# all file types${NC}" \
        "soma-code refs '$target' .                ${DIM}# try as a symbol${NC}"
      ;;
    refs)
      suggest \
        "soma-code find '$target'              ${DIM}# broader (any text match)${NC}" \
        "soma-code blast '$target'             ${DIM}# blast radius analysis${NC}" \
        "soma-code refs '${target%.*}'         ${DIM}# strip extension if any${NC}"
      ;;
    blast)
      suggest \
        "soma-code refs '$target'              ${DIM}# all references${NC}" \
        "soma-code find '$target' . $ALL_EXTS  ${DIM}# any text match${NC}"
      ;;
    *)
      suggest "soma-code find '$target' '$path'"
      ;;
  esac
}

# Per-command help — show usage + 3 working examples + notes.
# Note: using echo -e because heredoc <<EOF doesn't expand \033 escape codes.
cmd_help() {
  local cmd="${1:-}"
  case "$cmd" in
    find)
      echo -e "\n${BOLD}σ soma-code find${NC} ${DIM}— search code for a pattern${NC}\n"
      echo -e "${BOLD}USAGE:${NC}"
      echo -e "  soma-code find <pattern> [path] [ext]\n"
      echo -e "${BOLD}EXAMPLES:${NC}"
      echo -e "  soma-code find \"console.log\"                   ${DIM}# auto-detect ext from cwd${NC}"
      echo -e "  soma-code find \"tokio\" . rs                    ${DIM}# narrow to Rust${NC}"
      echo -e "  soma-code find \"TODO\" src                      ${DIM}# narrow to src/ subtree${NC}"
      echo -e "  soma-code find \"fn main\" . rs,toml             ${DIM}# multiple ext${NC}\n"
      echo -e "${BOLD}NOTES:${NC}"
      echo -e "  • Default ext auto-detects from cwd (Cargo.toml → rs, package.json → ts/js)."
      echo -e "  • Output capped at ${SOMA_CODE_LIMIT} hits — narrow with explicit path/ext to see more."
      echo -e "  • Backed by ${ENGINE}; respects .gitignore + skips node_modules, target, dist."
      echo -e "  • Hard timeout: ${SOMA_CODE_TIMEOUT}s. Stutter abort: ${SOMA_CODE_STUTTER}s without progress.\n"
      ;;
    map)
      echo -e "\n${BOLD}σ soma-code map${NC} ${DIM}— function/struct/section index for a file${NC}\n"
      echo -e "${BOLD}USAGE:${NC}"
      echo -e "  soma-code map <file>"
      echo -e "  soma-code map <directory>           ${DIM}# maps every source file in dir${NC}\n"
      echo -e "${BOLD}EXAMPLES:${NC}"
      echo -e "  soma-code map src/lib.rs            ${DIM}# Rust: fn / struct / impl / trait${NC}"
      echo -e "  soma-code map core/init.ts          ${DIM}# TS: export / class / function${NC}"
      echo -e "  soma-code map scripts/release.sh    ${DIM}# Bash: function defs + case branches${NC}"
      echo -e "  soma-code map Cargo.toml            ${DIM}# TOML: [section] / [[arrays]]${NC}"
      echo -e "  soma-code map README.md             ${DIM}# Markdown: heading hierarchy${NC}\n"
      echo -e "${BOLD}LANGUAGES:${NC}"
      echo -e "  TS/JS/JSX, Rust, Python, Bash, CSS/SCSS, Astro/Svelte/Vue,"
      echo -e "  TOML, YAML, JSON, Markdown.\n"
      ;;
    refs)
      echo -e "\n${BOLD}σ soma-code refs${NC} ${DIM}— all references to a symbol (DEF/IMP/USE)${NC}\n"
      echo -e "${BOLD}USAGE:${NC}"
      echo -e "  soma-code refs <symbol> [path]\n"
      echo -e "${BOLD}EXAMPLES:${NC}"
      echo -e "  soma-code refs MyClass              ${DIM}# every file mentioning MyClass${NC}"
      echo -e "  soma-code refs handleClick src/     ${DIM}# narrow to src/${NC}"
      echo -e "  soma-code refs spawn somadian/      ${DIM}# Rust symbol in subtree${NC}\n"
      echo -e "${BOLD}NOTES:${NC}"
      echo -e "  • Classifies hits as DEF (definition), IMP (import), USE (call/reference)."
      echo -e "  • For deletion blast-radius, see: soma-code blast <symbol>.\n"
      ;;
    blast)
      echo -e "\n${BOLD}σ soma-code blast${NC} ${DIM}— blast radius before deletion or rename${NC}\n"
      echo -e "${BOLD}USAGE:${NC}"
      echo -e "  soma-code blast <symbol> [path]\n"
      echo -e "${BOLD}EXAMPLES:${NC}"
      echo -e "  soma-code blast MyDeprecatedAPI     ${DIM}# how many files break if I delete this?${NC}"
      echo -e "  soma-code blast oldFn src/          ${DIM}# narrowed${NC}\n"
      echo -e "${BOLD}OUTPUT:${NC}"
      echo -e "  • Files affected (count + risk: low/med/high)."
      echo -e "  • First reference per file (line + content).\n"
      ;;
    structure|lines|replace|events|css-vars|config|tsc-errors|physics)
      echo "${BOLD}soma-code $cmd${NC} ${DIM}— see top-level help${NC}"
      cmd_top_help
      ;;
    "")
      cmd_top_help
      ;;
    *)
      err "no help for unknown command: $cmd"
      cmd_top_help
      ;;
  esac
}

cmd_top_help() {
  local kind=$(detect_project_kind)
  local default_ext=$(detect_default_ext)
  echo ""
  echo -e "  ${SOMA_CYAN}σ${SOMA_NC} ${SOMA_BOLD}soma-code${SOMA_NC} ${SOMA_DIM}v3.0.0 — fast codebase navigator${SOMA_NC}"
  echo -e "  ${SOMA_DIM}──────────────────────────────────────${SOMA_NC}"
  echo ""
  echo -e "  ${SOMA_DIM}Detected project: ${SOMA_NC}${kind}${SOMA_DIM}  •  default ext: ${default_ext}${SOMA_NC}"
  echo -e "  ${SOMA_DIM}Search engine: ${ENGINE}  •  timeout: ${SOMA_CODE_TIMEOUT}s  •  limit: ${SOMA_CODE_LIMIT} hits${SOMA_NC}"
  echo ""
  echo -e "  ${SOMA_GREEN}find${SOMA_NC} <pattern> [path] [ext]     ${SOMA_DIM}grep with file:line format${SOMA_NC}"
  echo -e "  ${SOMA_GREEN}lines${SOMA_NC} <file> <start> [end]      ${SOMA_DIM}show exact lines${SOMA_NC}"
  echo -e "  ${SOMA_GREEN}map${SOMA_NC} <file|dir>                  ${SOMA_DIM}function/class/section map (12 langs)${SOMA_NC}"
  echo -e "  ${SOMA_GREEN}refs${SOMA_NC} <symbol> [path]            ${SOMA_DIM}all references (DEF/IMP/USE)${SOMA_NC}"
  echo -e "  ${SOMA_GREEN}blast${SOMA_NC} <symbol> [path]           ${SOMA_DIM}blast radius (files × risk)${SOMA_NC}"
  echo -e "  ${SOMA_GREEN}replace${SOMA_NC} <file> <ln> <old> <new> ${SOMA_DIM}line-specific sed${SOMA_NC}"
  echo -e "  ${SOMA_GREEN}structure${SOMA_NC} [path]                ${SOMA_DIM}file tree with sizes${SOMA_NC}"
  echo -e "  ${SOMA_GREEN}events${SOMA_NC} [path]                   ${SOMA_DIM}listeners + dispatchers${SOMA_NC}"
  echo -e "  ${SOMA_GREEN}css-vars${SOMA_NC} [path]                 ${SOMA_DIM}custom property audit${SOMA_NC}"
  echo -e "  ${SOMA_GREEN}config${SOMA_NC} [path]                   ${SOMA_DIM}settings/options objects${SOMA_NC}"
  echo -e "  ${SOMA_GREEN}tsc-errors${SOMA_NC} [path]               ${SOMA_DIM}TypeScript errors with context${SOMA_NC}"
  echo -e "  ${SOMA_GREEN}physics${SOMA_NC} [path]                  ${SOMA_DIM}animation/spring/scroll code${SOMA_NC}"
  echo -e "  ${SOMA_GREEN}files${SOMA_NC} [path] [ext]              ${SOMA_DIM}list files that WOULD be searched (debug)${SOMA_NC}"
  echo -e "  ${SOMA_GREEN}stats${SOMA_NC} <pattern> [path] [ext]    ${SOMA_DIM}match counts only${SOMA_NC}"
  echo -e "  ${SOMA_GREEN}types${SOMA_NC} [name]                    ${SOMA_DIM}list rg type aliases (use as type=NAME)${SOMA_NC}"
  echo ""
  echo -e "  ${SOMA_DIM}Tip:${SOMA_NC}  ext can be a list (rs,py) or a type alias (type=rust, t=cpp)"
  echo -e "  ${SOMA_DIM}Per-command help:${SOMA_NC}  soma-code <cmd> --help"
  echo -e "  ${SOMA_DIM}Regex flavor:${SOMA_NC}  Rust regex (rg) or POSIX (grep) — use ${BOLD}|${NC} not ${BOLD}\\|${NC} for alternation"
  echo -e "  ${SOMA_DIM}Env knobs:${SOMA_NC}  SOMA_CODE_TIMEOUT, SOMA_CODE_STUTTER, SOMA_CODE_LIMIT, SOMA_CODE_QUIET"
  echo ""
  echo -e "  ${SOMA_DIM}MIT © meetsoma${SOMA_NC}"
  type soma_seams >/dev/null 2>&1 && soma_seams "soma-code.sh" "map before editing. refs before renaming. blast before deleting."
  echo ""
}

# Fuzzy-match an unknown command to nearest known command.
fuzzy_correct() {
  local input="$1"
  local known=(find lines map refs replace structure physics events css-vars config tsc-errors blast help)
  local best=""
  local best_score=999
  for k in "${known[@]}"; do
    # Levenshtein-light: compare lengths + first-letter + substring distance
    local a="$input"; local b="$k"
    local la=${#a}; local lb=${#b}
    local diff=$((la - lb))
    [ $diff -lt 0 ] && diff=$((-diff))
    [ $diff -gt 3 ] && continue
    # Same first letter is a strong signal
    if [ "${a:0:1}" = "${b:0:1}" ]; then
      diff=$((diff - 1))
    fi
    # Substring containment
    if [[ "$b" == *"$a"* ]] || [[ "$a" == *"$b"* ]]; then
      diff=$((diff - 1))
    fi
    if [ $diff -lt $best_score ]; then
      best_score=$diff
      best="$k"
    fi
  done
  [ "$best_score" -le 2 ] && echo "$best"
}

# ── Commands ─────────────────────────────────────────────────────────────

cmd_find() {
  # Per-command help shortcut
  [ "${1:-}" = "--help" ] && { cmd_help find; return 0; }

  if [ -z "${1:-}" ]; then
    err "soma-code find: missing <pattern>"
    cmd_help find
    return 2
  fi
  local pattern="$1"
  local path="${2:-$SHELL_DIR}"
  local ext="${3:-$(detect_default_ext)}"

  header "🔍 find: '$pattern' in $path ${DIM}(ext: $ext)${NC}"

  # Run with progressive monitoring
  local tmpfile
  tmpfile=$(mktemp -t soma-code.XXXXXX)
  trap 'rm -f "$tmpfile"' RETURN

  # v3.1: call run_search directly (it's defined in this script's scope).
  # Pass through with_progress for timeout/stutter monitoring.
  with_progress "$tmpfile" "$SOMA_CODE_TIMEOUT" "$SOMA_CODE_STUTTER" \
    run_search "$pattern" "$path" "$ext"
  local progress_status=$?

  local results
  results=$(cat "$tmpfile")

  if [ -z "$results" ]; then
    no_results "find" "$pattern" "$path" "$ext"
    return 1
  fi

  local total=$(echo "$results" | wc -l | tr -d ' ')
  local capped=$(cap_output "$results" "$total")

  echo "$capped" | while IFS=: read -r file line content; do
    local rel="${file#$SHELL_DIR/}"
    hit "$rel" "$line" "$(echo "$content" | sed 's/^[[:space:]]*//')"
  done
  echo ""
  if [ "$progress_status" = "124" ]; then
    dim "$total matches (timeout — partial results)"
  elif [ "$progress_status" = "125" ]; then
    dim "$total matches (stalled — partial results)"
  else
    dim "$total matches"
  fi
  return 0
}

cmd_refs() {
  [ "${1:-}" = "--help" ] && { cmd_help refs; return 0; }
  if [ -z "${1:-}" ]; then
    err "soma-code refs: missing <symbol>"
    cmd_help refs
    return 2
  fi
  local symbol="$1"
  local path="${2:-$SHELL_DIR}"
  local ext=$(detect_default_ext)

  header "🔗 refs: '$symbol' in $path ${DIM}(ext: $ext)${NC}"

  local tmpfile
  tmpfile=$(mktemp -t soma-code.XXXXXX)
  trap 'rm -f "$tmpfile"' RETURN

  with_progress "$tmpfile" "$SOMA_CODE_TIMEOUT" "$SOMA_CODE_STUTTER" \
    run_search "$symbol" "$path" "$ext"

  local results
  results=$(cat "$tmpfile")

  if [ -z "$results" ]; then
    no_results "refs" "$symbol" "$path" "$ext"
    return 1
  fi

  local total=$(echo "$results" | wc -l | tr -d ' ')
  local capped=$(cap_output "$results" "$total")

  echo "$capped" | while IFS=: read -r file line content; do
    local rel="${file#$SHELL_DIR/}"
    local trimmed="$(echo "$content" | sed 's/^[[:space:]]*//')"
    if echo "$trimmed" | grep -qE "^(export |const |let |var |function |class |interface |type |enum |fn |struct |trait |impl |def |pub )" && echo "$trimmed" | grep -qE "${symbol}\b"; then
      echo -e "${GREEN}DEF${NC}  ${CYAN}$rel${NC}:${YELLOW}$line${NC}: $trimmed"
    elif echo "$trimmed" | grep -qE "^(import |use |from |require)"; then
      echo -e "${CYAN}IMP${NC}  ${CYAN}$rel${NC}:${YELLOW}$line${NC}: $trimmed"
    else
      echo -e "${DIM}USE${NC}  ${CYAN}$rel${NC}:${YELLOW}$line${NC}: $trimmed"
    fi
  done
  echo ""
  dim "$total refs across $(echo "$results" | cut -d: -f1 | sort -u | wc -l | tr -d ' ') files"
}

cmd_blast() {
  [ "${1:-}" = "--help" ] && { cmd_help blast; return 0; }
  if [ -z "${1:-}" ]; then
    err "soma-code blast: missing <symbol>"
    cmd_help blast
    return 2
  fi
  local symbol="$1"
  local path="${2:-$SHELL_DIR}"
  local ext=$(detect_default_ext)

  header "💥 blast radius: '$symbol' in $path ${DIM}(ext: $ext)${NC}"
  echo ""

  local tmpfile
  tmpfile=$(mktemp -t soma-code.XXXXXX)
  trap 'rm -f "$tmpfile"' RETURN

  with_progress "$tmpfile" "$SOMA_CODE_TIMEOUT" "$SOMA_CODE_STUTTER" \
    run_search "$symbol" "$path" "$ext"

  local results
  results=$(cat "$tmpfile")

  if [ -z "$results" ]; then
    no_results "blast" "$symbol" "$path" "$ext"
    return 1
  fi

  local files
  files=$(echo "$results" | cut -d: -f1 | sort -u)
  local file_count
  file_count=$(echo "$files" | wc -l | tr -d ' ')

  echo -e "${BOLD}Files affected: $file_count${NC}"
  echo ""

  echo "$files" | while read -r file; do
    [ -z "$file" ] && continue
    local rel="${file#$SHELL_DIR/}"
    local count
    count=$(echo "$results" | grep -c "^${file}:" || echo 0)
    local first_match
    first_match=$(echo "$results" | grep "^${file}:" | head -1)
    local fline=$(echo "$first_match" | cut -d: -f2)
    local fcontent=$(echo "$first_match" | cut -d: -f3- | sed 's/^[[:space:]]*//')

    local risk="${DIM}low${NC}"
    if [ "$count" -gt 10 ]; then risk="${RED}high${NC}";
    elif [ "$count" -gt 3 ]; then risk="${YELLOW}med${NC}"; fi

    echo -e "  ${risk}  ${CYAN}$rel${NC}  ${DIM}($count refs)${NC}"
    [ -n "$fcontent" ] && echo -e "       ${DIM}:$fline  $fcontent${NC}"
  done
  echo ""
  local total
  total=$(echo "$results" | wc -l | tr -d ' ')
  dim "$total total references across $file_count files"
}

cmd_lines() {
  [ "${1:-}" = "--help" ] && { cmd_help lines; return 0; }
  if [ -z "${1:-}" ] || [ -z "${2:-}" ]; then
    err "soma-code lines: missing args"
    cat <<EOF

${BOLD}USAGE:${NC} soma-code lines <file> <start> [end]

${BOLD}EXAMPLES:${NC}
  soma-code lines core/init.ts 100        ${DIM}# 100..120 (default 20-line window)${NC}
  soma-code lines core/init.ts 100 150    ${DIM}# 100..150${NC}
EOF
    return 2
  fi
  local file="$1"
  [[ ! "$file" = /* ]] && file="$SHELL_DIR/$file"
  local start="$2"
  local end="${3:-}"
  [[ -z "$end" ]] && end=$((start + 20))

  if [[ ! -f "$file" ]]; then
    err "File not found: $file"
    suggest "ls '$(dirname "$file")'" "soma-code structure '$(dirname "$file")'"
    return 1
  fi

  header "lines ${file#$SHELL_DIR/} $start-$end"
  awk -v s="$start" -v e="$end" 'NR>=s && NR<=e { printf "\033[0;33m%4d\033[0m │ %s\n", NR, $0 }' "$file"
}

cmd_map() {
  [ "${1:-}" = "--help" ] && { cmd_help map; return 0; }
  if [ -z "${1:-}" ]; then
    err "soma-code map: missing <file>"
    cmd_help map
    return 2
  fi
  local file="$1"
  [[ ! "$file" = /* ]] && file="$SHELL_DIR/$file"

  if [[ ! -f "$file" ]]; then
    if [[ -d "$file" ]]; then
      warn "'$file' is a directory. Mapping all source files in it:"
      find "$file" -maxdepth 2 -type f \( \
        -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.mts' \
        -o -name '*.rs' -o -name '*.py' -o -name '*.sh' -o -name '*.bash' \
        -o -name '*.css' -o -name '*.scss' -o -name '*.toml' -o -name '*.yml' -o -name '*.yaml' \
        \) ! -path '*/node_modules/*' ! -path '*/target/*' ! -path '*/__pycache__/*' \
        | sort | while read -r f; do
        echo -e "\n${DIM}──${NC} ${CYAN}${f#$SHELL_DIR/}${NC}"
        cmd_map "$f" 2>/dev/null | tail -n +2 | head -20
      done
      return 0
    fi
    err "File not found: $file"
    suggest "soma-code structure '$(dirname "$file")'" "find . -name '$(basename "$file")'"
    return 1
  fi

  local ext="${file##*.}"
  header "🗺️  map: ${file#$SHELL_DIR/}"

  case "$ext" in
    js|ts|tsx|jsx|mjs|mts)
      awk '
        /^export (class|function|const|let|var|interface|type|enum|abstract) / { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^(class|function|interface|type|enum|abstract) / { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^const [A-Z_]/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^export default / { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^  (public |private |protected |readonly |static |abstract |async )*[a-zA-Z_]+\(/ { printf "\033[0;33m%4d\033[0m │   \033[0;36m%s\033[0m\n", NR, $0; next }
        /^  (get |set |async )[a-zA-Z]/ { printf "\033[0;33m%4d\033[0m │   \033[0;36m%s\033[0m\n", NR, $0; next }
        /^  _[a-zA-Z_]+\(/ { printf "\033[0;33m%4d\033[0m │   \033[0;90m%s\033[0m\n", NR, $0; next }
        /registerApp\(|PluginRegistry\.register/ { printf "\033[0;33m%4d\033[0m │ \033[0;32m%s\033[0m\n", NR, $0; next }
        /^[[:space:]]*pi\.registerTool\(/ || /^[[:space:]]*pi\.registerCommand\(/ || /^[[:space:]]*somaRegisterTool\(/ { printf "\033[0;33m%4d\033[0m │ \033[0;32m%s\033[0m\n", NR, $0; next }
        /^[[:space:]]*name:[[:space:]]*"[a-zA-Z_][a-zA-Z0-9_]*"/ { printf "\033[0;33m%4d\033[0m │     \033[0;32m%s\033[0m\n", NR, $0; next }
        /^[[:space:]]*\/\/ ══/ || /^[[:space:]]*\/\/ ──/ { printf "\033[0;33m%4d\033[0m │   \033[0;90m%s\033[0m\n", NR, $0; next }
        /^[[:space:]]*\/\/ [A-Z][A-Z_ ]+[A-Z]$/ { printf "\033[0;33m%4d\033[0m │   \033[1;37m%s\033[0m\n", NR, $0; next }
      ' "$file"
      ;;
    rs)
      # Rust: pub fn, fn, struct, trait, impl, enum, mod, type, macro_rules!, sections
      awk '
        /^(pub )?(unsafe )?(async )?fn [a-zA-Z_][a-zA-Z0-9_]*/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^[[:space:]]+(pub )?(unsafe )?(async )?fn [a-zA-Z_]/ { printf "\033[0;33m%4d\033[0m │   \033[0;36m%s\033[0m\n", NR, $0; next }
        /^(pub )?(struct|enum|trait|union) [A-Z]/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^impl[[:space:]<]/ { printf "\033[0;33m%4d\033[0m │ \033[1;37m%s\033[0m\n", NR, $0; next }
        /^(pub )?mod [a-z]/ { printf "\033[0;33m%4d\033[0m │ \033[0;32m%s\033[0m\n", NR, $0; next }
        /^(pub )?type [A-Z]/ { printf "\033[0;33m%4d\033[0m │ \033[0;33m%s\033[0m\n", NR, $0; next }
        /^(pub )?(const|static) [A-Z_]/ { printf "\033[0;33m%4d\033[0m │ \033[0;33m%s\033[0m\n", NR, $0; next }
        /^macro_rules!/ { printf "\033[0;33m%4d\033[0m │ \033[0;32m%s\033[0m\n", NR, $0; next }
        /^\/\/ ══/ || /^\/\/ ──/ { printf "\033[0;33m%4d\033[0m │ \033[0;90m%s\033[0m\n", NR, $0; next }
      ' "$file"
      ;;
    py)
      # Python: def, async def, class, decorators, top-level constants, sections
      awk '
        /^class [A-Z]/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^(async )?def [a-zA-Z_]/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^[[:space:]]+(async )?def [a-zA-Z_]/ { printf "\033[0;33m%4d\033[0m │   \033[0;36m%s\033[0m\n", NR, $0; next }
        /^@[a-zA-Z_]/ { printf "\033[0;33m%4d\033[0m │ \033[0;90m%s\033[0m\n", NR, $0; next }
        /^[A-Z_][A-Z0-9_]* = / { printf "\033[0;33m%4d\033[0m │ \033[0;33m%s\033[0m\n", NR, $0; next }
        /^# ══/ || /^# ──/ { printf "\033[0;33m%4d\033[0m │ \033[0;90m%s\033[0m\n", NR, $0; next }
      ' "$file"
      ;;
    go)
      # Go: func, type X struct/interface, package, var/const blocks, sections
      awk '
        /^package [a-z]/ { printf "\033[0;33m%4d\033[0m │ \033[0;32m%s\033[0m\n", NR, $0; next }
        /^func [(a-zA-Z_]/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^type [A-Z][a-zA-Z0-9_]* (struct|interface)/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^type [A-Z][a-zA-Z0-9_]+ / { printf "\033[0;33m%4d\033[0m │ \033[0;33m%s\033[0m\n", NR, $0; next }
        /^(var|const) \(/ { printf "\033[0;33m%4d\033[0m │ \033[0;33m%s\033[0m\n", NR, $0; next }
        /^(var|const) [A-Z_]/ { printf "\033[0;33m%4d\033[0m │ \033[0;33m%s\033[0m\n", NR, $0; next }
        /^\/\/ ══/ || /^\/\/ ──/ { printf "\033[0;33m%4d\033[0m │ \033[0;90m%s\033[0m\n", NR, $0; next }
      ' "$file"
      ;;
    java)
      # Java: class/interface/enum/record + method signatures
      awk '
        /^(public |private |protected |abstract |final |static )*(class|interface|enum|record) / { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^[[:space:]]+(public |private |protected |static |final )+([A-Z][a-zA-Z0-9<>,]*|void|int|long|String|boolean|byte|double|float|char) [a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*\(/ { printf "\033[0;33m%4d\033[0m │   \033[0;36m%s\033[0m\n", NR, $0; next }
        /^package / { printf "\033[0;33m%4d\033[0m │ \033[0;32m%s\033[0m\n", NR, $0; next }
        /^\/\/ ══/ || /^\/\/ ──/ { printf "\033[0;33m%4d\033[0m │ \033[0;90m%s\033[0m\n", NR, $0; next }
      ' "$file"
      ;;
    c|h|cpp|cc|cxx|hpp|hxx)
      # C/C++: typedef, struct/class/namespace/enum/template, #define, function defs (heuristic)
      awk '
        /^(typedef |struct |class |namespace |enum |union |template)[A-Za-z<]/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^#define [A-Z_][A-Z0-9_]+/ { printf "\033[0;33m%4d\033[0m │   \033[0;36m%s\033[0m\n", NR, $0; next }
        /^[a-zA-Z_][\w *&:<>]+[[:space:]]+[a-zA-Z_]\w*[[:space:]]*\([^;]*\)[[:space:]]*\{?[[:space:]]*$/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^\/\/ ══/ || /^\/\/ ──/ { printf "\033[0;33m%4d\033[0m │ \033[0;90m%s\033[0m\n", NR, $0; next }
      ' "$file"
      ;;
    rb)
      # Ruby: def, class, module
      awk '
        /^class [A-Z]/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^module [A-Z]/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^[[:space:]]*def [a-z_]/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^# ══/ || /^# ──/ { printf "\033[0;33m%4d\033[0m │ \033[0;90m%s\033[0m\n", NR, $0; next }
      ' "$file"
      ;;
    sh|bash)
      awk '
        /^[a-zA-Z_][a-zA-Z0-9_-]*\(\)/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^  [a-zA-Z_][a-zA-Z0-9_|-]*\)/ { printf "\033[0;33m%4d\033[0m │   \033[0;36m%s\033[0m\n", NR, $0; next }
        /^# ──/ || /^# ══/ { printf "\033[0;33m%4d\033[0m │ \033[0;90m%s\033[0m\n", NR, $0; next }
        /^CMD=/ || /^case / { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
      ' "$file"
      ;;
    css|scss)
      awk '
        /^[.#@:[]/ { printf "\033[0;33m%4d\033[0m │ %s\n", NR, $0 }
        /^\/\* ──/ || /^\/\* ══/ { printf "\033[0;33m%4d\033[0m │ \033[0;90m%s\033[0m\n", NR, $0 }
      ' "$file"
      ;;
    astro|svelte|vue)
      awk '
        /^---/ { printf "\033[0;33m%4d\033[0m │ \033[0;90m%s\033[0m\n", NR, $0; next }
        /^<script/ || /^<style/ || /^<template/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^import / { printf "\033[0;33m%4d\033[0m │ \033[0;36m%s\033[0m\n", NR, $0; next }
        /^export / { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^const / { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
      ' "$file"
      ;;
    toml)
      awk '
        /^\[\[/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^\[/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^[a-zA-Z_][a-zA-Z0-9_-]* = / { printf "\033[0;33m%4d\033[0m │   \033[0;36m%s\033[0m\n", NR, $0; next }
      ' "$file"
      ;;
    yml|yaml)
      awk '
        /^[a-zA-Z_][a-zA-Z0-9_-]*:/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^- name:/ || /^- id:/ { printf "\033[0;33m%4d\033[0m │   \033[0;36m%s\033[0m\n", NR, $0; next }
        /^# ──/ || /^# ══/ { printf "\033[0;33m%4d\033[0m │ \033[0;90m%s\033[0m\n", NR, $0; next }
      ' "$file"
      ;;
    json)
      awk '
        /^[[:space:]]*"[a-zA-Z_][a-zA-Z0-9_-]*"[[:space:]]*:/ && /\{|\[/ { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^[[:space:]]{0,2}"[a-zA-Z_][a-zA-Z0-9_-]*"[[:space:]]*:/ { printf "\033[0;33m%4d\033[0m │   \033[0;36m%s\033[0m\n", NR, $0; next }
      ' "$file"
      ;;
    md)
      awk '
        /^---$/ { printf "\033[0;33m%4d\033[0m │ \033[0;90m%s\033[0m\n", NR, $0; next }
        /^# / { printf "\033[0;33m%4d\033[0m │ \033[1m%s\033[0m\n", NR, $0; next }
        /^## / { printf "\033[0;33m%4d\033[0m │ \033[1;37m%s\033[0m\n", NR, $0; next }
        /^### / { printf "\033[0;33m%4d\033[0m │   \033[0;36m%s\033[0m\n", NR, $0; next }
        /^#### / { printf "\033[0;33m%4d\033[0m │     \033[0;90m%s\033[0m\n", NR, $0; next }
      ' "$file"
      ;;
    *)
      warn "Unknown file type: .$ext"
      suggest "soma-code lines '$file' 1 50" "cat '$file' | head -50"
      return 1
      ;;
  esac

  dim "$(wc -l < "$file" | tr -d ' ') total lines"
}

cmd_replace() {
  [ "${1:-}" = "--help" ] && { cmd_help replace; return 0; }
  local file="${1:?file required}"
  [[ ! "$file" = /* ]] && file="$SHELL_DIR/$file"
  local line="${2:?line number required}"
  local old="${3:?old text required}"
  local new="${4:?new text required}"

  if [[ ! -f "$file" ]]; then
    err "File not found: $file"
    return 1
  fi

  local current
  current=$(awk -v n="$line" 'NR==n' "$file")
  if ! echo "$current" | grep -qF "$old"; then
    err "Text '$old' not found on line $line"
    echo -e "${DIM}  Line $line: $current${NC}"
    suggest "soma-code lines '$file' $((line-2)) $((line+2))" "soma-code find '$old' '$file'"
    return 1
  fi

  echo -e "${RED}OLD${NC} line $line: $current"
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "${line}s|${old}|${new}|" "$file"
  else
    sed -i "${line}s|${old}|${new}|" "$file"
  fi
  echo -e "${GREEN}NEW${NC} line $line: $(awk -v n="$line" 'NR==n' "$file")"
}

cmd_structure() {
  [ "${1:-}" = "--help" ] && { cmd_help structure; return 0; }
  local path="${1:-$SHELL_DIR}"
  header "📁 structure: $path"
  find "$path" -maxdepth 3 \( \
    -name '*.js' -o -name '*.ts' -o -name '*.tsx' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.mts' \
    -o -name '*.rs' -o -name '*.py' -o -name '*.sh' -o -name '*.bash' \
    -o -name '*.css' -o -name '*.scss' -o -name '*.html' -o -name '*.astro' -o -name '*.svelte' -o -name '*.vue' \
    -o -name '*.toml' -o -name '*.yml' -o -name '*.yaml' -o -name '*.md' \
    \) ! -path '*/node_modules/*' ! -path '*/dist/*' ! -path '*/.git/*' ! -path '*/target/*' ! -path '*/__pycache__/*' \
    -exec ls -lh {} \; 2>/dev/null | \
    awk '{ printf "\033[0;33m%6s\033[0m  %s\n", $5, $NF }' | sort -t/ -k2
}

# ── Domain-specific helpers (unchanged from v2 behavior, light cleanup) ──
# These use grep directly (small scope, pattern-specific). Not progressive.

cmd_physics() {
  [ "${1:-}" = "--help" ] && { echo "${BOLD}σ soma-code physics${NC} ${DIM}— animation/spring/scroll patterns${NC}"; return 0; }
  local path="${1:-$SHELL_DIR}"
  local includes=$(build_engine_args "$TS_EXTS,$WEB_EXTS")
  header "⚡ physics/animation code in $path"
  echo ""
  dim "── Spring / Damping / Velocity ──"
  if [ "$ENGINE" = "rg" ]; then
    rg --color=never --no-heading --line-number $includes -e "(damping|springK|velocity|momentum|bounce|rubber|resistance|friction|settle|snap|physics|edgeDamping|edgeResistance|lerp)" "$path" 2>/dev/null | head -50
  else
    grep -rn $includes --color=never -E "(damping|springK|velocity|momentum|bounce|rubber|resistance|friction|settle|snap|physics|edgeDamping|edgeResistance|lerp)" "$path" 2>/dev/null | grep -v node_modules | head -50
  fi
  echo ""
  dim "── requestAnimationFrame / transitions ──"
  if [ "$ENGINE" = "rg" ]; then
    rg --color=never --no-heading --line-number $includes -e "(requestAnimationFrame|cancelAnimationFrame|transition:|animation:|@keyframes|will-change)" "$path" 2>/dev/null | head -50
  else
    grep -rn $includes --color=never -E "(requestAnimationFrame|cancelAnimationFrame|transition:|animation:|@keyframes|will-change)" "$path" 2>/dev/null | grep -v node_modules | head -50
  fi
}

cmd_events() {
  [ "${1:-}" = "--help" ] && { echo "${BOLD}σ soma-code events${NC} ${DIM}— event listeners + dispatchers${NC}"; return 0; }
  local path="${1:-$SHELL_DIR}"
  local includes=$(build_engine_args "$TS_EXTS")
  header "📡 events in $path"
  dim "── addEventListener ──"
  if [ "$ENGINE" = "rg" ]; then
    rg --color=never --no-heading --line-number $includes -e "addEventListener" "$path" 2>/dev/null | head -50
  else
    grep -rn $includes --color=never "addEventListener" "$path" 2>/dev/null | grep -v node_modules | head -50
  fi
  echo ""
  dim "── dispatchEvent / CustomEvent / _emit ──"
  if [ "$ENGINE" = "rg" ]; then
    rg --color=never --no-heading --line-number $includes -e "(dispatchEvent|CustomEvent|_emit\(|\.emit\()" "$path" 2>/dev/null | head -50
  else
    grep -rn $includes --color=never -E "(dispatchEvent|CustomEvent|_emit\(|\.emit\()" "$path" 2>/dev/null | grep -v node_modules | head -50
  fi
}

cmd_css_vars() {
  [ "${1:-}" = "--help" ] && { echo "${BOLD}σ soma-code css-vars${NC} ${DIM}— CSS custom property audit${NC}"; return 0; }
  local path="${1:-$SHELL_DIR}"
  local includes=$(build_engine_args "$WEB_EXTS")
  header "🎨 CSS custom properties in $path"
  dim "── Definitions (--var: value) ──"
  if [ "$ENGINE" = "rg" ]; then
    rg --color=never --no-heading --line-number $includes -e "^\s+--[a-z]" "$path" 2>/dev/null | head -50
  else
    grep -rn $includes --color=never -E "^\s+--[a-z]" "$path" 2>/dev/null | grep -v node_modules | head -50
  fi
}

cmd_config() {
  [ "${1:-}" = "--help" ] && { echo "${BOLD}σ soma-code config${NC} ${DIM}— config / options / settings objects${NC}"; return 0; }
  local path="${1:-$SHELL_DIR}"
  local includes=$(build_engine_args "$TS_EXTS")
  header "⚙️  config/options objects in $path"
  if [ "$ENGINE" = "rg" ]; then
    rg --color=never --no-heading --line-number $includes -e "(CONFIG\.|this\.opts\.|\.opts\s*=|options\.|setOptions|DEFAULT_OPTS|LAYOUT_DEFAULTS|PANE_CONFIG)" "$path" 2>/dev/null | head -50
  else
    grep -rn $includes --color=never -E "(CONFIG\.|this\.opts\.|\.opts\s*=|options\.|setOptions|DEFAULT_OPTS|LAYOUT_DEFAULTS|PANE_CONFIG)" "$path" 2>/dev/null | grep -v node_modules | head -50
  fi
}

cmd_tsc_errors() {
  [ "${1:-}" = "--help" ] && { echo "${BOLD}σ soma-code tsc-errors${NC} ${DIM}— TypeScript errors with context${NC}"; return 0; }
  local dir="${1:-.}"
  cd "$dir" || return 1
  header "🔍 TypeScript Errors: $dir"
  local errors
  errors=$(npx tsc --noEmit 2>&1 | grep "error TS" || true)
  if [ -z "$errors" ]; then
    echo -e "  ${GREEN}✅${NC} No type errors"
    return 0
  fi
  local count=$(echo "$errors" | wc -l | tr -d ' ')
  echo -e "  ${RED}❌${NC} $count errors"
  echo "$errors" | head -50
}

# ── Main ─────────────────────────────────────────────────────────────────

cmd="${1:-help}"
shift 2>/dev/null || true

# Top-level --help / --version
case "$cmd" in
  --help|-h|help|"")
    cmd_help "${1:-}"
    exit 0
    ;;
  --version|version|-v)
    echo "soma-code 3.0.0"
    exit 0
    ;;
esac

# Tier-1 wins from ripgrep study (s01-4d36c6):
#   files  — list files that would be searched (debug glob/ignore rules)
#   stats  — count matches without listing
#   types  — list rg's known --type aliases (rust, cpp, ...) for use as 'type=NAME'
cmd_files() {
  [ "${1:-}" = "--help" ] && { echo -e "\n${BOLD}σ soma-code files${NC} ${DIM}— list files that WOULD be searched${NC}\n\nUSAGE: soma-code files [path] [ext_or_type]\nEXAMPLE: soma-code files . type=rust\n"; return 0; }
  local path="${1:-$SHELL_DIR}"
  local ext="${2:-$(detect_default_ext)}"
  header "📂 files: in $path ${DIM}(scope: $ext)${NC}"
  SOMA_CODE_MODE=files run_search "" "$path" "$ext" | head -50
}

cmd_stats() {
  [ "${1:-}" = "--help" ] && { echo -e "\n${BOLD}σ soma-code stats${NC} ${DIM}— count matches without listing${NC}\n\nUSAGE: soma-code stats <pattern> [path] [ext_or_type]\nEXAMPLE: soma-code stats TODO . type=rust\n"; return 0; }
  if [ -z "${1:-}" ]; then err "soma-code stats: missing <pattern>"; cmd_help stats; return 2; fi
  local pattern="$1"
  local path="${2:-$SHELL_DIR}"
  local ext="${3:-$(detect_default_ext)}"
  header "📊 stats: '$pattern' in $path ${DIM}($ext)${NC}"
  SOMA_CODE_MODE=stats run_search "$pattern" "$path" "$ext" | head -50
}

cmd_types() {
  [ "${1:-}" = "--help" ] && { echo -e "\n${BOLD}σ soma-code types${NC} ${DIM}— list known --type aliases${NC}\n\nUSAGE: soma-code types  ${DIM}# all${NC}\n       soma-code types <name>  ${DIM}# show globs for one type${NC}\nEXAMPLE: soma-code find 'fn main' . type=rust\n"; return 0; }
  if [ "$ENGINE" = "rg" ]; then
    if [ -n "${1:-}" ]; then
      rg --type-list 2>/dev/null | grep -E "^${1}:" | head -3
    else
      header "🏷  rg type aliases (use as type=NAME or t=NAME)"
      rg --type-list 2>/dev/null | head -50
      echo ""
      dim "... (215 total types). Filter: soma-code types rust"
    fi
  else
    warn "--type-list requires rg. Install ripgrep for full type support."
    echo "Built-in fallback types: rust, py, ts, js, sh, cpp, c, go, ruby, md, toml, yaml, json"
  fi
}

case "$cmd" in
  find)        cmd_find "$@" ;;
  lines)       cmd_lines "$@" ;;
  map)         cmd_map "$@" ;;
  refs)        cmd_refs "$@" ;;
  replace)     cmd_replace "$@" ;;
  structure)   cmd_structure "$@" ;;
  physics)     cmd_physics "$@" ;;
  events)      cmd_events "$@" ;;
  css-vars)    cmd_css_vars "$@" ;;
  config)      cmd_config "$@" ;;
  tsc-errors)  cmd_tsc_errors "$@" ;;
  blast)       cmd_blast "$@" ;;
  files)       cmd_files "$@" ;;
  stats)       cmd_stats "$@" ;;
  types)       cmd_types "$@" ;;
  *)
    # Fuzzy correction for typos
    suggestion=$(fuzzy_correct "$cmd")
    err "Unknown command: '$cmd'"
    if [ -n "$suggestion" ]; then
      echo -e "  ${YELLOW}Did you mean:${NC} ${GREEN}$suggestion${NC}?"
      echo -e "  ${DIM}Run:${NC} soma-code $suggestion --help"
    else
      cmd_help
    fi
    exit 2
    ;;
esac
