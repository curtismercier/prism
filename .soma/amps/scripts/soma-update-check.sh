#!/usr/bin/env bash
# ---
# name: soma-update-check
# description: Check for updates after install. Keep muscles and protocols current.
# tags: [updates, hub, sync, versions]
# ---
# σ Soma Update Check
# Compare local protocol/muscle versions against the hub.
# Fetches hub-index.json from GitHub, diffs against local frontmatter versions.
#
# Usage:
#   bash soma-update-check.sh [.soma-dir]
#   bash soma-update-check.sh --json        # machine-readable output
#   bash soma-update-check.sh --update      # pull updates for outdated items
set -o pipefail

# Help first — don't require a .soma/ to read the usage.
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" || "${1:-}" == "help" ]]; then
  sed -n '7,14p' "$0" | sed 's/^# \?//'
  exit 0
fi

SOMA_DIR="${1:-.soma}"
[[ "${1:-}" == "--json" || "${1:-}" == "--update" ]] && SOMA_DIR=".soma"
JSON_MODE=false
UPDATE_MODE=false
[[ "$*" == *"--json"* ]] && JSON_MODE=true
[[ "$*" == *"--update"* ]] && UPDATE_MODE=true

# Resolve .soma dir
if [ ! -d "$SOMA_DIR/protocols" ]; then
  # Try parent dirs
  dir="$(pwd)"
  while [ "$dir" != "/" ]; do
    [ -d "$dir/.soma/protocols" ] && SOMA_DIR="$dir/.soma" && break
    dir="$(dirname "$dir")"
  done
fi

[ ! -d "$SOMA_DIR/protocols" ] && echo "No .soma/protocols/ found" && exit 1

HUB_INDEX_URL="https://raw.githubusercontent.com/meetsoma/community/main/hub-index.json"
RAW_BASE="https://raw.githubusercontent.com/meetsoma/community/main"

# ── Fetch hub index ──────────────────────────────────────────────

hub_json=$(curl -sf "$HUB_INDEX_URL" 2>/dev/null)
if [ -z "$hub_json" ]; then
  echo "⚠ Could not fetch hub-index.json — offline or rate-limited"
  exit 1
fi

# ── Parse local versions ─────────────────────────────────────────

extract_version() {
  awk '/^---$/{n++; next} n==1{print}' "$1" | grep -i "^version:" | head -1 | sed 's/^version: *//i' | tr -d '"'"'"
}

extract_name() {
  awk '/^---$/{n++; next} n==1{print}' "$1" | grep -i "^name:" | head -1 | sed 's/^name: *//i' | tr -d '"'"'"
}

OUTDATED=0
UP_TO_DATE=0
LOCAL_ONLY=0
TOTAL=0
UPDATES=""
JSON_ITEMS=""

for dir_type in "protocols:protocol" "memory/muscles:muscle"; do
  local_dir="$SOMA_DIR/${dir_type%%:*}"
  hub_type="${dir_type#*:}"
  [ ! -d "$local_dir" ] && continue

  for f in "$local_dir"/*.md; do
    [ ! -f "$f" ] && continue
    fname=$(basename "$f" .md)
    [[ "$fname" == _* ]] && continue
    [[ "$fname" == "README" ]] && continue

    local_name=$(extract_name "$f")
    [ -z "$local_name" ] && local_name="$fname"
    local_version=$(extract_version "$f")
    [ -z "$local_version" ] && local_version="0.0.0"

    TOTAL=$((TOTAL + 1))

    # Look up in hub index
    hub_version=$(echo "$hub_json" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data.get('items', []):
    if item.get('slug') == '$fname' and item.get('type') == '$hub_type':
        print(item.get('version', ''))
        break
" 2>/dev/null)

    if [ -z "$hub_version" ]; then
      LOCAL_ONLY=$((LOCAL_ONLY + 1))
      continue
    fi

    # Compare versions
    if [ "$local_version" = "$hub_version" ]; then
      UP_TO_DATE=$((UP_TO_DATE + 1))
    else
      # Simple version comparison (works for semver)
      local_major=${local_version%%.*}
      hub_major=${hub_version%%.*}
      local_rest=${local_version#*.}
      hub_rest=${hub_version#*.}
      local_minor=${local_rest%%.*}
      hub_minor=${hub_rest%%.*}
      local_patch=${local_rest#*.}
      hub_patch=${hub_rest#*.}

      is_outdated=false
      if [ "$hub_major" -gt "$local_major" ] 2>/dev/null; then
        is_outdated=true
      elif [ "$hub_major" -eq "$local_major" ] 2>/dev/null && [ "$hub_minor" -gt "$local_minor" ] 2>/dev/null; then
        is_outdated=true
      elif [ "$hub_major" -eq "$local_major" ] 2>/dev/null && [ "$hub_minor" -eq "$local_minor" ] 2>/dev/null && [ "$hub_patch" -gt "$local_patch" ] 2>/dev/null; then
        is_outdated=true
      fi

      if $is_outdated; then
        OUTDATED=$((OUTDATED + 1))
        UPDATES="${UPDATES}\n  ↑ ${hub_type}/${fname}: v${local_version} → v${hub_version}"
        JSON_ITEMS="${JSON_ITEMS}{\"type\":\"${hub_type}\",\"slug\":\"${fname}\",\"local\":\"${local_version}\",\"hub\":\"${hub_version}\"},"

        # Pull update if requested
        if $UPDATE_MODE; then
          if [ "$hub_type" = "protocol" ]; then
            hub_path="${RAW_BASE}/protocols/${fname}.md"
          else
            hub_path="${RAW_BASE}/muscles/${fname}.md"
          fi
          
          updated=$(curl -sf "$hub_path" 2>/dev/null)
          if [ -n "$updated" ]; then
            echo "$updated" > "$f"
            UPDATES="${UPDATES} ✅ updated"
          else
            UPDATES="${UPDATES} ⚠ fetch failed"
          fi
        fi
      else
        # Local is newer or same — fine
        UP_TO_DATE=$((UP_TO_DATE + 1))
      fi
    fi
  done
done

# ── Output ───────────────────────────────────────────────────────

if $JSON_MODE; then
  # Strip trailing comma
  JSON_ITEMS="${JSON_ITEMS%,}"
  echo "{\"total\":$TOTAL,\"upToDate\":$UP_TO_DATE,\"outdated\":$OUTDATED,\"localOnly\":$LOCAL_ONLY,\"items\":[${JSON_ITEMS}]}"
  exit $( [ $OUTDATED -gt 0 ] && echo 1 || echo 0 )
fi

echo ""
echo "σ Update Check — $TOTAL items checked"
echo "═══════════════════════════════════════"

if [ $OUTDATED -eq 0 ]; then
  echo "  ✅ All ${UP_TO_DATE} hub items up to date"
else
  echo "  ↑ ${OUTDATED} update(s) available"
  echo -e "$UPDATES"
fi

[ $LOCAL_ONLY -gt 0 ] && echo "  ◇ ${LOCAL_ONLY} local-only (not on hub)"
echo "═══════════════════════════════════════"

if [ $OUTDATED -gt 0 ] && ! $UPDATE_MODE; then
  echo ""
  echo "  Run with --update to pull latest versions"
fi

exit $( [ $OUTDATED -gt 0 ] && echo 1 || echo 0 )
