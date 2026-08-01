#!/usr/bin/env bash
# ---
# name: soma-plans
# description: Read the plan before building. Archive when done. Plans rot — verify on exhale.
# tags: [plans, lifecycle, tracking, archival]
# related-protocols: [plan-hygiene, maps]
# ---
# soma-plans.sh — plan lifecycle management
#
# USE WHEN: checking plan budget (≤12 active), finding stale/overlapping plans,
#   archiving completed work, scanning remaining tasks, building preloads from plans.
#
# Related muscles: plan-lifecycle (full workflow), task-tooling (map before work)
# Related scripts: soma-verify.sh (health checks), soma-ship.sh (post-ship cleanup)
# Related protocols: plan-hygiene (plans rot — keep them alive)
#
# Usage:
#   soma-plans.sh status              — active plan count + budget check
#   soma-plans.sh scan                — list all plans with status/lines/topics
#   soma-plans.sh stale [--days N]    — find plans not updated in N days (default: 7)
#   soma-plans.sh overlap             — detect plans with overlapping topics
#   soma-plans.sh consolidate         — interactive: review stale/complete plans for archival
#   soma-plans.sh archive <file>      — mark complete + move to _archive/
#   soma-plans.sh remaining           — show all plans with remaining items
#   soma-plans.sh preload <plan>      — generate a targeted preload from a plan's remaining items
#
# The plan lifecycle: idea → plan → pre-flight → kanban → targeted preload → execute → consolidate

set -euo pipefail

# ── Theme ──
_sd="$(dirname "$0")"
if [ -f "$_sd/soma-theme.sh" ]; then source "$_sd/soma-theme.sh"; fi
SOMA_BOLD="${SOMA_BOLD:-\033[1m}"; SOMA_DIM="${SOMA_DIM:-\033[2m}"; SOMA_NC="${SOMA_NC:-\033[0m}"; SOMA_CYAN="${SOMA_CYAN:-\033[0;36m}"
SOMA_DIR=""
for d in .soma "$HOME/.soma"; do
  [[ -d "$d" ]] && SOMA_DIR="$d" && break
done
[[ -z "$SOMA_DIR" ]] && echo "No .soma/ found" && exit 1

PLAN_DIRS=("$SOMA_DIR/docs/plans" "$SOMA_DIR/releases")
BUDGET=12
TODAY=$(date +%Y-%m-%d)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
DIM='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ──────────────────────────────────────────────────────────────

find_plans() {
  for dir in "${PLAN_DIRS[@]}"; do
    [[ -d "$dir" ]] || continue
    find "$dir" -name "*.md" -not -path "*/_archive/*" -not -name "_kanban*" -not -name "README*"
  done
}

get_field() {
  # Always return 0 — missing field = empty string, not an error.
  # (pipefail + set -e otherwise kills callers in while-loops.)
  local file="$1" field="$2"
  grep -m1 "^${field}:" "$file" 2>/dev/null | sed "s/^${field}: *//" | tr -d '"' || true
}

get_topics() {
  local file="$1"
  # Extract from scope, tags, or filename
  local scope=$(get_field "$file" "scope" | tr -d '[]')
  local tags=$(get_field "$file" "tags" | tr -d '[]')
  local name=$(basename "$file" .md)
  echo "${scope:-}${tags:+, $tags}" | tr ',' '\n' | sed 's/^ *//' | sort -u | tr '\n' ',' | sed 's/,$//'
}

days_since() {
  local date_str="$1"
  [[ -z "$date_str" ]] && echo "999" && return
  local then_ts=$(date -j -f "%Y-%m-%d" "$date_str" +%s 2>/dev/null || echo "0")
  local now_ts=$(date +%s)
  echo $(( (now_ts - then_ts) / 86400 ))
}

short_path() {
  echo "$1" | sed "s|^$SOMA_DIR/||"
}

# ── Commands ─────────────────────────────────────────────────────────────

cmd_status() {
  local active=0 draft=0 blocked=0 complete=0 total=0
  while IFS= read -r f; do
    total=$((total + 1))
    local status=$(get_field "$f" "status")
    case "$status" in
      active) active=$((active + 1)) ;;
      draft) draft=$((draft + 1)) ;;
      blocked) blocked=$((blocked + 1)) ;;
      complete) complete=$((complete + 1)) ;;
    esac
  done < <(find_plans)

  echo -e "${BOLD}σ  Plan Status${NC}"
  echo ""
  if [[ $active -le $BUDGET ]]; then
    echo -e "  Active: ${GREEN}${active}${NC} / ${BUDGET} budget"
  else
    echo -e "  Active: ${RED}${active}${NC} / ${BUDGET} budget ${RED}(over!)${NC}"
  fi
  echo -e "  Draft:  ${DIM}${draft}${NC}"
  echo -e "  Blocked: ${YELLOW}${blocked}${NC}"
  echo -e "  Complete: ${DIM}${complete}${NC} (should be archived)"
  echo -e "  Total:  ${total} (excl. archived)"

  # Warn about complete plans that should be archived
  if [[ $complete -gt 0 ]]; then
    echo ""
    echo -e "  ${YELLOW}⚠${NC}  $complete complete plan(s) should be archived:"
    while IFS= read -r f; do
      [[ "$(get_field "$f" "status")" == "complete" ]] && echo -e "    ${DIM}$(short_path "$f")${NC}"
    done < <(find_plans)
  fi
}

cmd_scan() {
  echo -e "${BOLD}σ  Plan Scan${NC}"
  echo ""
  printf "  %-10s %-50s %5s  %s\n" "STATUS" "PATH" "LINES" "TOPICS"
  printf "  %-10s %-50s %5s  %s\n" "──────" "────" "─────" "──────"

  while IFS= read -r f; do
    local status=$(get_field "$f" "status")
    local lines=$(wc -l < "$f" | tr -d ' ')
    local topics=$(get_topics "$f")
    local path=$(short_path "$f")

    local color="$NC"
    case "$status" in
      active) color="$GREEN" ;;
      draft|seed|scaffolding) color="$DIM" ;;
      blocked) color="$YELLOW" ;;
      complete) color="$RED" ;;
    esac

    printf "  ${color}%-10s${NC} %-50s %5s  ${DIM}%s${NC}\n" "${status:-?}" "$path" "$lines" "$topics"
  done < <(find_plans | sort)
}

cmd_stale() {
  local threshold="${1:-7}"
  echo -e "${BOLD}σ  Stale Plans (>${threshold} days)${NC}"
  echo ""

  local found=0
  while IFS= read -r f; do
    local status=$(get_field "$f" "status")
    [[ "$status" != "active" && "$status" != "draft" ]] && continue

    local updated=$(get_field "$f" "updated")
    [[ -z "$updated" ]] && updated=$(get_field "$f" "created")
    local age=$(days_since "$updated")

    if [[ $age -ge $threshold ]]; then
      found=$((found + 1))
      local lines=$(wc -l < "$f" | tr -d ' ')
      local remaining_count=$(grep -c "^  - " "$f" 2>/dev/null || echo "0")
      echo -e "  ${YELLOW}${age}d${NC}  [${status}] $(short_path "$f") (${lines} lines, ${remaining_count} remaining items)"
    fi
  done < <(find_plans | sort)

  [[ $found -eq 0 ]] && echo -e "  ${GREEN}✓${NC} No stale plans"
  echo ""
  echo "  $found stale plan(s) found"
}

cmd_overlap() {
  # Portable rewrite — no `declare -A` (bash 3.2 on macOS).
  # Emit one "topic<TAB>path" line per (topic, plan), sort, group consecutive.
  echo -e "${BOLD}σ  Plan Overlap Detection${NC}"
  echo ""

  local tmp; tmp=$(mktemp)
  while IFS= read -r f; do
    local status; status=$(get_field "$f" "status")
    [[ "$status" != "active" && "$status" != "draft" ]] && continue
    local path; path=$(short_path "$f")
    local topics; topics=$(get_topics "$f")
    [[ -z "$topics" ]] && continue
    # bash 3.2 safe: guard empty-array expansion with ${arr[@]+...}
    IFS=',' read -ra TOPICS <<< "$topics" || true
    for t in ${TOPICS[@]+"${TOPICS[@]}"}; do
      t=$(echo "$t" | xargs)
      [[ -z "$t" ]] && continue
      printf '%s\t%s\n' "$t" "$path" >> "$tmp"
    done
  done < <(find_plans)

  local overlaps=0
  local prev=""
  local group=""
  local count=0

  _flush() {
    if [[ $count -ge 2 ]]; then
      overlaps=$((overlaps + 1))
      echo -e "  ${YELLOW}${prev}${NC} (${count} plans):"
      printf '%s' "$group" | while IFS= read -r p; do
        [[ -z "$p" ]] && continue
        echo -e "    ${DIM}$p${NC}"
      done
      echo ""
    fi
  }

  if [[ -s "$tmp" ]]; then
    while IFS=$'\t' read -r topic path; do
      if [[ "$topic" == "$prev" ]]; then
        group="${group}${path}"$'\n'
        count=$((count + 1))
      else
        _flush
        prev="$topic"
        group="${path}"$'\n'
        count=1
      fi
    done < <(sort "$tmp")
    _flush
  fi

  rm -f "$tmp"
  [[ $overlaps -eq 0 ]] && echo -e "  ${GREEN}✓${NC} No overlapping topics"
}

cmd_remaining() {
  echo -e "${BOLD}σ  Plans with Remaining Items${NC}"
  echo ""

  while IFS= read -r f; do
    local status=$(get_field "$f" "status")
    [[ "$status" != "active" ]] && continue

    local remaining=$(awk '/^remaining:/{found=1; next} found && /^  - /{print; next} found{exit}' "$f")
    if [[ -n "$remaining" ]]; then
      echo -e "  ${GREEN}[active]${NC} $(short_path "$f")"
      echo "$remaining" | while read -r line; do
        echo -e "    ${DIM}$line${NC}"
      done
      echo ""
    fi
  done < <(find_plans | sort)
}

cmd_archive() {
  local file="$1"
  [[ -z "$file" ]] && echo "Usage: soma-plans.sh archive <file>" && exit 1
  [[ ! -f "$file" ]] && echo "File not found: $file" && exit 1

  # Update frontmatter
  if grep -q "^status:" "$file"; then
    sed -i '' 's/^status: .*/status: archived/' "$file"
  fi
  sed -i '' "s/^updated: .*/updated: $TODAY/" "$file" 2>/dev/null

  # Move to _archive/
  local dir=$(dirname "$file")
  local archive_dir="$dir/_archive"
  mkdir -p "$archive_dir"
  mv "$file" "$archive_dir/"
  echo -e "${GREEN}✓${NC} Archived: $(basename "$file") → $(short_path "$archive_dir")/"
}

cmd_consolidate() {
  echo -e "${BOLD}σ  Plan Consolidation Review${NC}"
  echo ""

  # 1. Complete plans that should be archived
  echo -e "  ${BOLD}1. Complete plans (should archive):${NC}"
  local complete_found=0
  while IFS= read -r f; do
    [[ "$(get_field "$f" "status")" == "complete" ]] || continue
    complete_found=$((complete_found + 1))
    echo -e "    $(short_path "$f")"
  done < <(find_plans)
  [[ $complete_found -eq 0 ]] && echo -e "    ${GREEN}✓${NC} None"
  echo ""

  # 2. Stale active plans (>7 days)
  echo -e "  ${BOLD}2. Stale active plans (>7 days):${NC}"
  local stale_found=0
  while IFS= read -r f; do
    local status=$(get_field "$f" "status")
    [[ "$status" != "active" ]] && continue
    local updated=$(get_field "$f" "updated")
    [[ -z "$updated" ]] && updated=$(get_field "$f" "created")
    local age=$(days_since "$updated")
    if [[ $age -ge 7 ]]; then
      stale_found=$((stale_found + 1))
      local remaining_count=$(awk '/^remaining:/{found=1; next} found && /^  - /{count++; next} found{exit} END{print count+0}' "$f")
      echo -e "    ${YELLOW}${age}d${NC} $(short_path "$f") (${remaining_count} remaining)"
    fi
  done < <(find_plans)
  [[ $stale_found -eq 0 ]] && echo -e "    ${GREEN}✓${NC} None"
  echo ""

  # 3. Budget check
  local active=$(find_plans | while read f; do
    [[ "$(get_field "$f" "status")" == "active" ]] && echo "$f"
  done | wc -l | tr -d ' ')
  echo -e "  ${BOLD}3. Budget:${NC} ${active} / ${BUDGET} active plans"
  [[ $active -gt $BUDGET ]] && echo -e "    ${RED}⚠ Over budget by $((active - BUDGET))${NC}"
  echo ""

  # 4. Overlap detection
  echo -e "  ${BOLD}4. Overlapping topics:${NC}"
  cmd_overlap 2>/dev/null | grep -v "^σ\|^$" | head -20
}

cmd_preload() {
  local plan="$1"
  [[ -z "$plan" ]] && echo "Usage: soma-plans.sh preload <plan-file>" && exit 1
  [[ ! -f "$plan" ]] && echo "File not found: $plan" && exit 1

  echo -e "${BOLD}σ  Generating Targeted Preload from Plan${NC}"
  echo ""
  echo "## Orient From"
  echo "- \`$(short_path "$plan")\`"
  echo ""
  echo "## Remaining Items"
  awk '/^remaining:/{found=1; next} found && /^  - /{print; next} found{exit}' "$plan"
  echo ""
  echo "## Tooling"
  awk '/^tooling:/{found=1; next} found && /^  [a-z]/{print; next} found && /^    /{print; next} found{exit}' "$plan"
  echo ""
  echo -e "${DIM}# Add file:line references for each remaining item to make this surgical${NC}"
}

# ── Main ─────────────────────────────────────────────────────────────────

case "${1:-}" in
  status)       cmd_status ;;
  scan)         cmd_scan ;;
  stale)
    # Accept: `stale`, `stale N`, `stale --days N`
    shift
    days=7
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --days) days="${2:-7}"; shift 2 ;;
        --days=*) days="${1#--days=}"; shift ;;
        [0-9]*) days="$1"; shift ;;
        *) shift ;;
      esac
    done
    cmd_stale "$days"
    ;;
  overlap)      cmd_overlap ;;
  consolidate)  cmd_consolidate ;;
  archive)      cmd_archive "${2:-}" ;;
  remaining)    cmd_remaining ;;
  preload)      cmd_preload "${2:-}" ;;
  *)
    echo "σ  soma-plans — plan lifecycle management"
    echo ""
    echo "  status              active count + budget check"
    echo "  scan                list all plans with status/lines/topics"
    echo "  stale [--days N]    find plans not updated in N days (default: 7)"
    echo "  overlap             detect overlapping topic coverage"
    echo "  consolidate         full review: complete, stale, budget, overlap"
    echo "  archive <file>      mark complete + move to _archive/"
    echo "  remaining           show plans with remaining items"
    echo "  preload <plan>      generate targeted preload skeleton from plan"
    echo ""
    soma_seams "soma-plans.sh" 2>/dev/null || true
    ;;
esac
