#!/usr/bin/env bash
# ---
# name: validate-content
# description: Validate before sharing to hub. Fix privacy issues before submitting.
# tags: [validation, hub, privacy, quality]
# related-protocols: [community-safe, hub-sharing]
# ---
# validate-content.sh — validate AMPS content files before submitting a PR
#
# Usage:
#   bash scripts/validate-content.sh <file.md>           # validate one file
#   bash scripts/validate-content.sh <directory>          # validate all .md in dir
#   bash scripts/validate-content.sh --type protocol .    # filter by type
#
# Checks:
#   - Valid YAML frontmatter (type, name, status, heat-default)
#   - Breadcrumb present and under 200 chars
#   - TL;DR section (protocols)
#   - Digest markers (muscles)
#   - File naming (kebab-case)
#   - No PII patterns (emails, API keys)
#   - applies-to is valid array

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0 FAIL=0 WARN=0 TOTAL=0
pass()  { PASS=$((PASS + 1)); TOTAL=$((TOTAL + 1)); echo -e "  ${GREEN}✓${NC} $1"; }
fail()  { FAIL=$((FAIL + 1)); TOTAL=$((TOTAL + 1)); echo -e "  ${RED}✗${NC} $1"; }
warn()  { WARN=$((WARN + 1)); TOTAL=$((TOTAL + 1)); echo -e "  ${YELLOW}⚠${NC} $1"; }

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------

TYPE_FILTER=""
FILES=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --help|-h|help)
            sed -n '8,23p' "$0" | sed 's/^# \?//'
            exit 0
            ;;
        --type) TYPE_FILTER="$2"; shift 2 ;;
        *) FILES+=("$1"); shift ;;
    esac
done

if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "Usage: validate-content.sh [--type protocol|muscle|automation|skill] <file-or-dir>"
    exit 1
fi

# Expand directories to .md files
EXPANDED=()
for f in "${FILES[@]}"; do
    if [[ -d "$f" ]]; then
        while IFS= read -r md; do
            EXPANDED+=("$md")
        done < <(find "$f" -name "*.md" -not -name "_*" -not -path "*/_archive/*" | sort)
    elif [[ -f "$f" ]]; then
        EXPANDED+=("$f")
    else
        echo -e "${RED}Not found: $f${NC}"
    fi
done

if [[ ${#EXPANDED[@]} -eq 0 ]]; then
    echo -e "${RED}No .md files found${NC}"
    exit 1
fi

# ---------------------------------------------------------------------------
# Validate each file
# ---------------------------------------------------------------------------

for file in "${EXPANDED[@]}"; do
    # Extract frontmatter
    if ! head -1 "$file" | grep -q "^---"; then
        continue  # Skip non-frontmatter files
    fi

    fm=$(sed -n '/^---$/,/^---$/p' "$file" | head -50)
    body=$(sed '1,/^---$/!d; 1d' "$file" | tail -n +2)  # after second ---
    full_body=$(tail -n +2 "$file" | sed '1,/^---$/d')

    # Extract frontmatter fields
    fm_type=$(echo "$fm" | grep "^type:" | head -1 | sed 's/type:\s*//' | tr -d ' "'"'"'')
    fm_name=$(echo "$fm" | grep "^name:" | head -1 | sed 's/name:\s*//' | tr -d ' "'"'"'')
    fm_status=$(echo "$fm" | grep "^status:" | head -1 | sed 's/status:\s*//' | tr -d ' "'"'"'')
    fm_heat=$(echo "$fm" | grep "^heat-default:" | head -1 | sed 's/heat-default:\s*//' | tr -d ' "'"'"'')
    fm_breadcrumb=$(echo "$fm" | grep "^breadcrumb:" | head -1 | sed 's/breadcrumb:\s*//')
    fm_applies=$(echo "$fm" | grep "^applies-to:" | head -1)

    # Type filter
    if [[ -n "$TYPE_FILTER" && "$fm_type" != "$TYPE_FILTER" ]]; then
        continue
    fi

    echo -e "\n${CYAN}── $(basename "$file") ──${NC} (${fm_type:-unknown})"

    # --- Required fields ---
    if [[ -n "$fm_type" ]]; then
        pass "type: $fm_type"
    else
        fail "missing: type"
    fi

    if [[ -n "$fm_name" ]]; then
        pass "name: $fm_name"
    else
        fail "missing: name"
    fi

    if [[ -n "$fm_status" ]]; then
        case "$fm_status" in
            active|draft|deprecated|experimental) pass "status: $fm_status" ;;
            *) warn "unusual status: $fm_status (expected: active|draft|deprecated|experimental)" ;;
        esac
    else
        fail "missing: status"
    fi

    # --- Type-specific checks ---
    case "$fm_type" in
        protocol)
            # heat-default required
            if [[ -n "$fm_heat" ]]; then
                case "$fm_heat" in
                    hot|warm|cold) pass "heat-default: $fm_heat" ;;
                    *) fail "invalid heat-default: $fm_heat (expected: hot|warm|cold)" ;;
                esac
            else
                fail "missing: heat-default (required for protocols)"
            fi

            # breadcrumb required
            if [[ -n "$fm_breadcrumb" ]]; then
                bc_len=${#fm_breadcrumb}
                if [[ $bc_len -gt 200 ]]; then
                    warn "breadcrumb too long (${bc_len} chars, max 200)"
                else
                    pass "breadcrumb present (${bc_len} chars)"
                fi
            else
                fail "missing: breadcrumb (required for protocols — the warm fallback when there's no ## TL;DR)"
            fi

            # applies-to required
            if [[ -n "$fm_applies" ]]; then
                pass "applies-to present"
            else
                fail "missing: applies-to"
            fi

            # TL;DR section
            if echo "$full_body" | grep -q "^## TL;DR"; then
                pass "has TL;DR section"
            else
                warn "missing TL;DR section (recommended for protocols)"
            fi

            # Rule section
            if echo "$full_body" | grep -q "^## Rule\|^## Rules"; then
                pass "has Rule section"
            else
                warn "missing Rule section"
            fi
            ;;

        muscle)
            # Digest markers
            if grep -q "<!-- digest -->\|<!-- /digest -->" "$file"; then
                pass "has digest markers"
            else
                warn "missing digest markers (<!-- digest --> ... <!-- /digest -->)"
            fi

            # topic field
            if echo "$fm" | grep -q "^topic:"; then
                pass "has topic field"
            else
                warn "missing: topic (helps with discovery)"
            fi

            # keywords field
            if echo "$fm" | grep -q "^keywords:"; then
                pass "has keywords field"
            else
                warn "missing: keywords"
            fi
            ;;

        automation)
            # steps or procedure section
            if echo "$full_body" | grep -qi "^## Steps\|^## Procedure\|^## Workflow"; then
                pass "has Steps/Procedure section"
            else
                warn "missing Steps/Procedure section"
            fi
            ;;

        skill)
            # Knowledge content check
            if [[ $(wc -l < "$file") -lt 10 ]]; then
                warn "very short skill ($(wc -l < "$file") lines) — is there enough content?"
            else
                pass "skill has content ($(wc -l < "$file") lines)"
            fi
            ;;
    esac

    # --- File naming ---
    basename_file=$(basename "$file" .md)
    if echo "$basename_file" | grep -qE '^[a-z0-9]+(-[a-z0-9]+)*$'; then
        pass "filename: kebab-case ✓"
    else
        warn "filename '$basename_file' — convention is kebab-case (e.g., my-protocol)"
    fi

    # --- PII / secrets scan ---
    if grep -qiE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' "$file" 2>/dev/null; then
        # Exclude frontmatter author fields
        if grep -v "^author:" "$file" | grep -qiE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' 2>/dev/null; then
            warn "possible email address in content (check for PII)"
        fi
    fi

    if grep -qiE 'sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[0-9A-Z]{16}' "$file" 2>/dev/null; then
        fail "POSSIBLE API KEY/SECRET detected — do NOT commit this"
    fi

    # --- Size check ---
    lines=$(wc -l < "$file" | tr -d ' ')
    if [[ $lines -gt 300 ]]; then
        warn "large file ($lines lines) — consider splitting"
    fi

done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo "═══════════════════════════════════════"
if [[ $FAIL -eq 0 && $WARN -eq 0 ]]; then
    echo -e "  ${GREEN}All clear: $PASS passed, $TOTAL total${NC}"
elif [[ $FAIL -eq 0 ]]; then
    echo -e "  ${YELLOW}$PASS passed, $WARN warnings, $TOTAL total${NC}"
else
    echo -e "  ${RED}$PASS passed, $FAIL failed, $WARN warnings, $TOTAL total${NC}"
fi
echo "═══════════════════════════════════════"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
