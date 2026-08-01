#!/usr/bin/env bash
# ---
# name: soma-reflect
# description: Reflect at exhale. Patterns become muscles. Corrections become identity.
# tags: [reflection, patterns, sessions, observations, gaps]
# related-muscles: [session-log-format, bubble-patterns]
# related-protocols: [detection-triggers, pattern-evolution]
# ---
# soma-reflect.sh — Parse session logs for observations, gaps, and recurring patterns
#
# When to use: at session start to orient from past lessons, mid-session to check
#   if a current issue was seen before, at exhale to surface patterns worth crystallizing.
#
# Related muscles: session-log-format (log structure), bubble-patterns (maturation),
#   chain-of-thought (blog seeds from sessions)
# Related scripts: soma-threads.sh (blog-seed focused session search),
#   soma-query.sh sessions (raw grep session search)
# Related protocols: detection-triggers (when to capture), pattern-evolution (maturation layers)
#
# How this differs from similar tools:
#   soma-reflect.sh  = structured extraction (observations, gaps, corrections, patterns)
#   soma-threads.sh  = blog seed extraction (💭 Chain of Thought, → Ref:)
#   soma-query.sh sessions = raw grep for any term in session logs
#   → Use reflect for learning, threads for writing, query for searching.
#
# Session log formats supported:
#   1. Structured headers: "#### Observations", "#### Gaps" (legacy)
#   2. Named sections: "## Observations", "### Patterns Noticed" etc.
#   3. Time-based entries: "## HH:MM" with signal bullets (current standard)
#      Signal bullets contain: ✗, bug, fix, root cause, gap, learning, pattern,
#      correction, insight, connection, warning, [domain-tag]
#
# Usage:
#   soma-reflect.sh                        # all signals from last 7 days
#   soma-reflect.sh --since 2026-03-12     # signals since date
#   soma-reflect.sh --gaps                 # gaps, bugs & fixes only
#   soma-reflect.sh --observations         # observations & insights only
#   soma-reflect.sh --corrections          # corrections & learnings only
#   soma-reflect.sh --domain workflow      # filter by [domain] tag
#   soma-reflect.sh --recurring            # find patterns mentioned 2+ times
#   soma-reflect.sh --search "sync"        # search across all sessions
#   soma-reflect.sh --unresolved           # gaps without corresponding fixes
#   soma-reflect.sh --summary              # condensed view for preload/identity review
#   soma-reflect.sh --transcript <file.jsonl>  # mine CC JSONL transcript
#   soma-reflect.sh --transcript <file.jsonl> --search 'Kelly'
#   soma-reflect.sh --help

set -uo pipefail

# ── Theme ──
_sd="$(dirname "$0")"
if [ -f "$_sd/soma-theme.sh" ]; then source "$_sd/soma-theme.sh"; fi
SOMA_BOLD="${SOMA_BOLD:-\033[1m}"; SOMA_DIM="${SOMA_DIM:-\033[2m}"; SOMA_NC="${SOMA_NC:-\033[0m}"; SOMA_CYAN="${SOMA_CYAN:-\033[0;36m}"
SOMA_GREEN="${SOMA_GREEN:-\033[0;32m}"; SOMA_RED="${SOMA_RED:-\033[0;31m}"; SOMA_YELLOW="${SOMA_YELLOW:-\033[0;33m}"; SOMA_MAGENTA="${SOMA_MAGENTA:-\033[0;35m}"
BOLD="${SOMA_BOLD:-\033[1m}"
DIM="${SOMA_DIM:-\033[2m}"
NC="${SOMA_NC:-\033[0m}"
CYAN="${SOMA_CYAN:-\033[0;36m}"
GREEN="${SOMA_GREEN:-\033[0;32m}"
RED="${SOMA_RED:-\033[0;31m}"
YELLOW="${SOMA_YELLOW:-\033[0;33m}"
MAGENTA="${SOMA_MAGENTA:-\033[0;35m}"

# Defaults
SINCE=""
MODE="all"
DOMAIN=""
SEARCH_TERM=""
DAYS=7
TRANSCRIPT=""

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --since) SINCE="$2"; shift 2 ;;
    --gaps) MODE="gaps"; shift ;;
    --observations) MODE="observations"; shift ;;
    --corrections) MODE="corrections"; shift ;;
    --recurring) MODE="recurring"; shift ;;
    --search) MODE="search"; SEARCH_TERM="$2"; shift 2 ;;
    --unresolved) MODE="unresolved"; shift ;;
    --summary) MODE="summary"; shift ;;
    --transcript) TRANSCRIPT="$2"; shift 2 ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --days) DAYS="$2"; shift 2 ;;
    --help|-h)
      echo "soma-reflect.sh — Parse session logs for observations, gaps, recurring patterns"
      echo ""
      echo "Usage:"
      echo "  soma-reflect.sh                        # last 7 days, all signals"
      echo "  soma-reflect.sh --since 2026-03-12     # since specific date"
      echo "  soma-reflect.sh --days 14              # last 14 days"
      echo "  soma-reflect.sh --gaps                 # gaps, bugs & fixes"
      echo "  soma-reflect.sh --observations         # observations & insights"
      echo "  soma-reflect.sh --corrections          # corrections & learnings"
      echo "  soma-reflect.sh --domain workflow      # filter by [domain] tag"
      echo "  soma-reflect.sh --recurring            # patterns mentioned 2+ times"
      echo "  soma-reflect.sh --search 'sync'        # keyword search across all"
      echo "  soma-reflect.sh --unresolved           # gaps without fixes"
      echo "  soma-reflect.sh --summary              # condensed for preload review"
      echo ""
      echo "  # Claude Code JSONL transcript mining:"
      echo "  soma-reflect.sh --transcript <file.jsonl>              # extract decisions, insights, corrections"
      echo "  soma-reflect.sh --transcript <file.jsonl> --search X   # search transcript for keyword"
      echo "  soma-reflect.sh --transcript <file.jsonl> --summary    # condensed transcript summary"
      echo "  soma-reflect.sh --transcript <file.jsonl> --gaps       # errors, failures, fixes from transcript"
      echo ""
      echo "Signal categories:"
      echo "  gaps        ✗, bug, gap, CRITICAL, HUGE, broken, missing"
      echo "  fixes       fix, fixed, resolved, shipped, root cause"
      echo "  corrections Correction, learning, Key learning, should have"
      echo "  patterns    pattern, recurring, noticed, insight, connection"
      echo "  observations [domain-tag] bullets, ## Observations sections"
      echo ""
      echo "Domains: architecture, workflow, meta, testing, api-design, etc."
      echo ""
      soma_seams "soma-reflect.sh" 2>/dev/null || true
      exit 0
      ;;
    *) echo "Unknown: $1. Use --help"; exit 1 ;;
  esac
done

# ── Transcript mode (CC JSONL) ──
# Handles Claude Code conversation transcripts (.jsonl files)
# These are NOT Soma session logs — different format, different extraction.

if [[ -n "$TRANSCRIPT" ]]; then
  if [[ ! -f "$TRANSCRIPT" ]]; then
    echo "ERROR: Transcript file not found: $TRANSCRIPT"
    exit 1
  fi

  if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 required for JSONL transcript parsing"
    exit 1
  fi

  case "$MODE" in
    search)
      echo -e "${BOLD}━━━ Transcript Search: \"$SEARCH_TERM\" ━━━${NC}"
      echo -e "${DIM}File: $TRANSCRIPT${NC}"
      echo ""
      python3 - "$TRANSCRIPT" "$SEARCH_TERM" << 'PYEOF'
import json, sys, re

transcript_file = sys.argv[1]
search_term = sys.argv[2]
pattern = re.compile(search_term, re.IGNORECASE)

with open(transcript_file) as f:
    for i, line in enumerate(f):
        try:
            msg = json.loads(line)
            msg_type = msg.get('type', '')
            if msg_type not in ('user', 'assistant'):
                continue
            content = msg.get('message', {}).get('content', [])
            if isinstance(content, str):
                blocks = [{'type': 'text', 'text': content}]
            elif isinstance(content, list):
                blocks = content
            else:
                continue
            for block in blocks:
                if not isinstance(block, dict) or block.get('type') != 'text':
                    continue
                text = block['text']
                if text.startswith('<system-reminder>'):
                    continue
                matches = list(pattern.finditer(text))
                if matches:
                    role = '👤 USER' if msg_type == 'user' else '🤖 ASSISTANT'
                    print(f'\033[1m{role} (line {i})\033[0m')
                    # Show context around each match
                    for m in matches[:3]:
                        start = max(0, m.start() - 80)
                        end = min(len(text), m.end() + 80)
                        snippet = text[start:end].replace('\n', ' ')
                        if start > 0:
                            snippet = '...' + snippet
                        if end < len(text):
                            snippet = snippet + '...'
                        print(f'  {snippet}')
                    print()
        except:
            pass
PYEOF
      ;;

    gaps)
      echo -e "${BOLD}━━━ Transcript: Errors, Failures & Fixes ━━━${NC}"
      echo -e "${DIM}File: $TRANSCRIPT${NC}"
      echo ""
      python3 - "$TRANSCRIPT" << 'PYEOF'
import json, sys, re

error_patterns = re.compile(r'error|ERROR|failed|FAILED|panic|broken|missing|not found|cannot|can\'t|bug|issue|wrong|incorrect', re.IGNORECASE)
fix_patterns = re.compile(r'fix|fixed|resolved|root cause|workaround|the issue was|the problem was', re.IGNORECASE)

with open(sys.argv[1]) as f:
    for i, line in enumerate(f):
        try:
            msg = json.loads(line)
            if msg.get('type') != 'assistant':
                continue
            content = msg.get('message', {}).get('content', [])
            if not isinstance(content, list):
                continue
            for block in content:
                if not isinstance(block, dict) or block.get('type') != 'text':
                    continue
                text = block['text']
                if text.startswith('<system-reminder>') or len(text) < 50:
                    continue
                # Check for error/fix patterns
                has_error = bool(error_patterns.search(text))
                has_fix = bool(fix_patterns.search(text))
                if has_error or has_fix:
                    tag = '[fix]' if has_fix else '[error]'
                    # Extract relevant sentences
                    for sentence in re.split(r'[.\n]', text):
                        sentence = sentence.strip()
                        if len(sentence) > 20 and (error_patterns.search(sentence) or fix_patterns.search(sentence)):
                            color = '\033[0;32m' if has_fix else '\033[0;31m'
                            print(f'{color}{tag}\033[0m (line {i}) {sentence[:200]}')
        except:
            pass
PYEOF
      ;;

    summary)
      echo -e "${BOLD}━━━ Transcript Summary ━━━${NC}"
      echo -e "${DIM}File: $TRANSCRIPT${NC}"
      echo ""
      python3 - "$TRANSCRIPT" << 'PYEOF'
import json, sys

user_msgs = []
assistant_texts = []
tool_uses = 0
total_lines = 0

with open(sys.argv[1]) as f:
    for i, line in enumerate(f):
        total_lines = i + 1
        try:
            msg = json.loads(line)
            msg_type = msg.get('type', '')

            if msg_type == 'user':
                content = msg.get('message', {}).get('content', '')
                if isinstance(content, str) and len(content) > 30 and not content.startswith('<system-reminder>') and not content.startswith('<task-notification>'):
                    user_msgs.append(content[:300])
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get('type') == 'text':
                            text = block['text']
                            if len(text) > 30 and not text.startswith('<system-reminder>') and not text.startswith('<task-notification>'):
                                user_msgs.append(text[:300])

            elif msg_type == 'assistant':
                content = msg.get('message', {}).get('content', [])
                if isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict):
                            if block.get('type') == 'text' and len(block.get('text', '')) > 100:
                                text = block['text']
                                if not text.startswith('<') and not text.startswith('{'):
                                    assistant_texts.append(text)
                            elif block.get('type') == 'tool_use':
                                tool_uses += 1
        except:
            pass

print(f'JSONL lines: {total_lines}')
print(f'User messages: {len(user_msgs)}')
print(f'Assistant responses with text: {len(assistant_texts)}')
print(f'Tool uses: {tool_uses}')
print()

if user_msgs:
    print('\033[1m## User Messages\033[0m')
    for i, msg in enumerate(user_msgs):
        clean = msg.replace('\n', ' ')[:200]
        print(f'  {i+1}. {clean}')
    print()

if assistant_texts:
    print('\033[1m## Key Assistant Responses (>100 chars)\033[0m')
    for i, text in enumerate(assistant_texts):
        # First meaningful line
        first_line = ''
        for line in text.split('\n'):
            line = line.strip()
            if len(line) > 20 and not line.startswith('#'):
                first_line = line[:150]
                break
        if not first_line:
            first_line = text[:150].replace('\n', ' ')
        print(f'  {i+1}. {first_line}')
PYEOF
      ;;

    all|*)
      echo -e "${BOLD}━━━ Transcript: Decisions, Insights & Corrections ━━━${NC}"
      echo -e "${DIM}File: $TRANSCRIPT${NC}"
      echo ""
      python3 - "$TRANSCRIPT" << 'PYEOF'
import json, sys, re

decision_patterns = re.compile(r'decision|chose|decided|because|rationale|trade-?off|key (insight|finding|discovery)|critical|important|architecture|the reason|this means', re.IGNORECASE)
correction_patterns = re.compile(r'correction|should have|mistake|wrong|oops|actually|I was wrong|not (?:correct|right)|let me fix', re.IGNORECASE)
insight_patterns = re.compile(r'insight|discovery|finding|learned|realized|turns out|interesting|note:|important:|critical:|key:', re.IGNORECASE)

sections = {'decisions': [], 'corrections': [], 'insights': []}

with open(sys.argv[1]) as f:
    for i, line in enumerate(f):
        try:
            msg = json.loads(line)
            if msg.get('type') != 'assistant':
                continue
            content = msg.get('message', {}).get('content', [])
            if not isinstance(content, list):
                continue
            for block in content:
                if not isinstance(block, dict) or block.get('type') != 'text':
                    continue
                text = block['text']
                if text.startswith('<system-reminder>') or len(text) < 80:
                    continue

                # Extract paragraph-level signals
                for para in re.split(r'\n\n+', text):
                    para = para.strip()
                    if len(para) < 40 or para.startswith('<') or para.startswith('{') or para.startswith('```'):
                        continue
                    if correction_patterns.search(para):
                        sections['corrections'].append((i, para[:250]))
                    elif decision_patterns.search(para):
                        sections['decisions'].append((i, para[:250]))
                    elif insight_patterns.search(para):
                        sections['insights'].append((i, para[:250]))
        except:
            pass

for section_name, items in sections.items():
    if items:
        color = {'decisions': '\033[0;36m', 'corrections': '\033[0;33m', 'insights': '\033[0;35m'}[section_name]
        print(f'{color}\033[1m## {section_name.title()}\033[0m')
        for line_num, text in items:
            clean = text.replace('\n', ' ')
            print(f'  (line {line_num}) {clean}')
        print()

total = sum(len(v) for v in sections.values())
print(f'\033[2m{total} signals extracted\033[0m')
PYEOF
      ;;
  esac

  echo ""
  echo -e "${DIM}━━━${NC}"
  echo -e "${DIM}Transcript: $(wc -l < "$TRANSCRIPT" | tr -d ' ') JSONL lines${NC}"
  exit 0
fi

# ── Session log mode (Soma .md files) ──

SESSIONS_DIR=""
for d in ".soma/memory/sessions" "memory/sessions"; do
  if [[ -d "$d" ]]; then
    SESSIONS_DIR="$d"
    break
  fi
done

if [[ -z "$SESSIONS_DIR" ]]; then
  echo "ERROR: No sessions directory found (and no --transcript provided)"
  exit 1
fi

# Calculate date filter
if [[ -n "$SINCE" ]]; then
  DATE_FILTER="$SINCE"
else
  if command -v gdate &>/dev/null; then
    DATE_FILTER=$(gdate -d "-${DAYS} days" +%Y-%m-%d)
  else
    DATE_FILTER=$(date -v-${DAYS}d +%Y-%m-%d 2>/dev/null || date -d "-${DAYS} days" +%Y-%m-%d 2>/dev/null || echo "2020-01-01")
  fi
fi

# Collect relevant session files
FILES=()
for f in "$SESSIONS_DIR"/*.md; do
  [[ -f "$f" ]] || continue
  fname=$(basename "$f")
  file_date=$(echo "$fname" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}' || echo "")
  [[ -z "$file_date" ]] && continue
  [[ "$fname" == "scratchpad.md" ]] && continue
  if [[ "$file_date" > "$DATE_FILTER" || "$file_date" == "$DATE_FILTER" ]]; then
    FILES+=("$f")
  fi
done

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No session logs found since $DATE_FILTER"
  exit 0
fi

IFS=$'\n' FILES=($(sort <<< "${FILES[*]}")); unset IFS

# ── Signal extraction ──
# Each function outputs tagged lines: [filename] [category] content

# Extract from structured headers (legacy: #### Observations, #### Gaps)
# AND named sections (## Observations, ### Patterns Noticed, etc.)
extract_structured() {
  local file="$1"
  local fname=$(basename "$file")
  local in_section=""

  while IFS= read -r line; do
    # Detect structured sections
    if echo "$line" | grep -qiE "^#{2,4} (Observations?|Patterns? Noticed|Insights?)"; then
      in_section="observation"
      continue
    fi
    if echo "$line" | grep -qiE "^#{2,4} (Gaps?|Bugs?|Issues?)"; then
      in_section="gap"
      continue
    fi
    if echo "$line" | grep -qiE "^#{2,4} (Corrections?|Learnings?|Lessons?)"; then
      in_section="correction"
      continue
    fi

    # End section on next header (but not sub-headers within)
    if [[ -n "$in_section" ]] && echo "$line" | grep -qE "^#{1,3} [^#]"; then
      in_section=""
      continue
    fi

    # Emit bullets from active section
    if [[ -n "$in_section" ]] && echo "$line" | grep -qE "^- "; then
      echo "[$fname] [$in_section] $line"
    fi
  done < "$file"
}

# Extract signal bullets from ## HH:MM time sections
extract_signals() {
  local file="$1"
  local fname=$(basename "$file")

  while IFS= read -r line; do
    # Only process bullet lines
    echo "$line" | grep -qE "^- " || continue

    # Gap signals: bugs, failures, missing things
    if echo "$line" | grep -qiE "✗|\\bbug\\b|\\bgap\\b|CRITICAL|HUGE.*gap|broken|missing|fails|failure|not working|doesn't work"; then
      echo "[$fname] [gap] $line"
      continue
    fi

    # Fix signals: resolutions
    if echo "$line" | grep -qiE "\\bfix\\b|\\bfixed\\b|resolved|shipped|root cause|Root cause"; then
      echo "[$fname] [fix] $line"
      continue
    fi

    # Correction signals: learnings from mistakes
    if echo "$line" | grep -qiE "Correction|Key learning|learning:|should have|lesson|corrected"; then
      echo "[$fname] [correction] $line"
      continue
    fi

    # Pattern signals: noticed patterns
    if echo "$line" | grep -qiE "pattern|recurring|noticed|insight|connection|surfaced|Same.*pattern"; then
      echo "[$fname] [pattern] $line"
      continue
    fi

    # Domain-tagged observations: [architecture], [workflow], [meta], etc.
    if echo "$line" | grep -qE "^\- \[[a-z-]+\]"; then
      echo "[$fname] [observation] $line"
      continue
    fi
  done < "$file"
}

# Combined extraction
extract_all() {
  local file="$1"
  extract_structured "$file"
  extract_signals "$file"
}

# ── Domain filter ──
apply_domain_filter() {
  if [[ -n "$DOMAIN" ]]; then
    grep -i "\[$DOMAIN\]" || true
  else
    cat
  fi
}

# ── Modes ──

case "$MODE" in
  all)
    echo -e "${BOLD}━━━ Session Reflections (since $DATE_FILTER) ━━━${NC}"
    echo ""

    echo -e "${CYAN}## Gaps & Bugs${NC}"
    for f in "${FILES[@]}"; do
      extract_all "$f" | grep -E "\[(gap)\]" | apply_domain_filter
    done
    echo ""

    echo -e "${GREEN}## Fixes${NC}"
    for f in "${FILES[@]}"; do
      extract_all "$f" | grep -E "\[(fix)\]" | apply_domain_filter
    done
    echo ""

    echo -e "${YELLOW}## Corrections & Learnings${NC}"
    for f in "${FILES[@]}"; do
      extract_all "$f" | grep -E "\[(correction)\]" | apply_domain_filter
    done
    echo ""

    echo -e "${MAGENTA}## Patterns & Insights${NC}"
    for f in "${FILES[@]}"; do
      extract_all "$f" | grep -E "\[(pattern|observation)\]" | apply_domain_filter
    done
    ;;

  gaps)
    echo -e "${BOLD}━━━ Gaps & Bugs (since $DATE_FILTER) ━━━${NC}"
    echo ""
    for f in "${FILES[@]}"; do
      extract_all "$f" | grep -E "\[(gap)\]" | apply_domain_filter
    done
    ;;

  observations)
    echo -e "${BOLD}━━━ Observations & Insights (since $DATE_FILTER) ━━━${NC}"
    if [[ -n "$DOMAIN" ]]; then echo "  Filtered: [$DOMAIN]"; fi
    echo ""
    for f in "${FILES[@]}"; do
      extract_all "$f" | grep -E "\[(observation|pattern)\]" | apply_domain_filter
    done
    ;;

  corrections)
    echo -e "${BOLD}━━━ Corrections & Learnings (since $DATE_FILTER) ━━━${NC}"
    echo ""
    for f in "${FILES[@]}"; do
      extract_all "$f" | grep -E "\[(correction)\]" | apply_domain_filter
    done
    ;;

  recurring)
    echo -e "${BOLD}━━━ Recurring Patterns (since $DATE_FILTER) ━━━${NC}"
    echo ""

    # Collect all signals
    ALL_SIGNALS=""
    for f in "${FILES[@]}"; do
      ALL_SIGNALS+="$(extract_all "$f")"
      ALL_SIGNALS+=$'\n'
    done

    echo -e "${CYAN}### Signal Counts${NC}"
    echo "$ALL_SIGNALS" | grep -oE '\[(gap|fix|correction|pattern|observation)\]' | sort | uniq -c | sort -rn | while read count tag; do
      echo "  $tag × $count"
    done

    echo ""
    echo -e "${CYAN}### Domain Tags${NC}"
    # Extract [domain] from observation bullets AND from all bullets
    echo "$ALL_SIGNALS" | grep -oE '\[[a-z][a-z-]*\]' | grep -vE '\[(gap|fix|correction|pattern|observation)\]' | sort | uniq -c | sort -rn | while read count tag; do
      [[ -z "$count" ]] && continue
      echo "  $tag × $count"
    done

    echo ""
    echo -e "${CYAN}### Repeated Concepts (3+ mentions across signals)${NC}"
    echo "$ALL_SIGNALS" | tr '[:upper:]' '[:lower:]' | \
      grep -oE '\b[a-z]{4,}\b' | \
      grep -vE '^(this|that|with|from|have|been|will|would|should|could|when|what|they|them|their|than|then|more|also|just|only|into|each|some|most|very|much|same|other|about|these|those|does|make|like|over|such|after|before|first|where|here|back|even|still|want|need|next|were|done|used|added|moved|file|path|line|both|true|false|updated|created|using|runs|test)$' | \
      sort | uniq -c | sort -rn | head -20 | while read count word; do
        [[ $count -ge 3 ]] && echo "  $word × $count"
      done
    ;;

  search)
    echo -e "${BOLD}━━━ Search: \"$SEARCH_TERM\" (since $DATE_FILTER) ━━━${NC}"
    echo ""
    for f in "${FILES[@]}"; do
      fname=$(basename "$f")
      results=$(grep -in "$SEARCH_TERM" "$f" | head -10)
      if [[ -n "$results" ]]; then
        echo -e "${CYAN}### $fname${NC}"
        echo "$results"
        echo ""
      fi
    done
    ;;

  unresolved)
    echo -e "${BOLD}━━━ Unresolved Gaps (since $DATE_FILTER) ━━━${NC}"
    echo ""
    echo "(Gaps without corresponding fix in the same or later session)"
    echo ""
    for f in "${FILES[@]}"; do
      extract_all "$f" | grep -E "\[(gap)\]" | while IFS= read -r line; do
        # Check if a fix exists with similar keywords
        # Extract key words from the gap line
        keywords=$(echo "$line" | tr '[:upper:]' '[:lower:]' | grep -oE '\b[a-z]{5,}\b' | head -3)
        has_fix=false
        for kw in $keywords; do
          for ff in "${FILES[@]}"; do
            if extract_all "$ff" | grep -E "\[(fix)\]" | grep -qi "$kw"; then
              has_fix=true
              break 2
            fi
          done
        done
        if ! $has_fix; then
          echo "$line"
        fi
      done
    done
    ;;

  summary)
    echo -e "${BOLD}━━━ Reflection Summary (since $DATE_FILTER) ━━━${NC}"
    echo ""

    # Collect all signals
    ALL_SIGNALS=""
    for f in "${FILES[@]}"; do
      ALL_SIGNALS+="$(extract_all "$f")"
      ALL_SIGNALS+=$'\n'
    done

    gap_count=$(echo "$ALL_SIGNALS" | grep -c "\[gap\]" || echo 0)
    fix_count=$(echo "$ALL_SIGNALS" | grep -c "\[fix\]" || echo 0)
    correction_count=$(echo "$ALL_SIGNALS" | grep -c "\[correction\]" || echo 0)
    pattern_count=$(echo "$ALL_SIGNALS" | grep -c "\[pattern\]\|\[observation\]" || echo 0)
    total=$((gap_count + fix_count + correction_count + pattern_count))

    echo "Files scanned: ${#FILES[@]} session logs"
    echo "Total signals: $total"
    echo "  Gaps/bugs: $gap_count"
    echo "  Fixes: $fix_count"
    echo "  Corrections: $correction_count"
    echo "  Patterns/observations: $pattern_count"
    echo ""

    echo -e "${CYAN}### Domain Activity${NC}"
    echo "$ALL_SIGNALS" | grep -oE '\[[a-z][a-z-]*\]' | grep -vE '\[(gap|fix|correction|pattern|observation)\]' | sort | uniq -c | sort -rn | head -5 | while read count tag; do
      [[ -n "$count" ]] && echo "  $tag × $count"
    done

    echo ""
    echo -e "${YELLOW}### Recent Corrections${NC}"
    echo "$ALL_SIGNALS" | grep "\[correction\]" | tail -5

    echo ""
    echo -e "${RED}### Unresolved Gaps (last 3)${NC}"
    echo "$ALL_SIGNALS" | grep "\[gap\]" | tail -3

    echo ""
    echo -e "${MAGENTA}### Candidate Muscles (corrections that appear 2+ times)${NC}"
    echo "$ALL_SIGNALS" | grep "\[correction\]" | tr '[:upper:]' '[:lower:]' | \
      grep -oE '\b[a-z]{5,}\b' | sort | uniq -c | sort -rn | head -5 | while read count word; do
        [[ $count -ge 2 ]] && echo "  $word × $count — may warrant a muscle"
      done
    ;;
esac

echo ""
echo -e "${DIM}━━━${NC}"
echo -e "${DIM}${#FILES[@]} session logs scanned (since $DATE_FILTER)${NC}"
