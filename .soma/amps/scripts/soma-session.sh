#!/usr/bin/env bash
# ---
# name: soma-session
# description: Session maintenance — strip images, list sizes, clean old sessions
# tags: [session, maintenance, clean, images, jsonl]
# ---

set -uo pipefail

# ── Theme ────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
THEME="$SCRIPT_DIR/soma-theme.sh"
[[ -f "$THEME" ]] && source "$THEME"
BOLD="${SOMA_BOLD:-\033[1m}"
DIM="${SOMA_DIM:-\033[2m}"
GREEN="${SOMA_GREEN:-\033[32m}"
YELLOW="${SOMA_YELLOW:-\033[33m}"
RED="${SOMA_RED:-\033[31m}"
CYAN="${SOMA_CYAN:-\033[36m}"
RESET="${SOMA_NC:-\033[0m}"
σ() { echo -e "${BOLD}σ $*${RESET}"; }

# ── Seams ────────────────────────────────────────────────────────────────
type soma_seams &>/dev/null && soma_seams "soma-session.sh"

# ── Paths ────────────────────────────────────────────────────────────────
SESSIONS_DIR="${SOMA_CODING_AGENT_DIR:-$HOME/.soma/agent}/sessions"

# ── Helpers ──────────────────────────────────────────────────────────────
usage() {
  σ "soma-session — session maintenance"
  echo ""
  echo -e "  ${BOLD}Commands${RESET}"
  echo -e "    strip-images [session]     Strip base64 image data from JSONL sessions"
  echo -e "    list                       List sessions with sizes"
  echo -e "    stats [session]            Image/message count for a session"
  echo -e ""
  echo -e "  ${BOLD}Options${RESET}"
  echo -e "    --all                      Apply to all sessions (strip-images)"
  echo -e "    --dry-run                  Show what would change without modifying"
  echo -e "    --no-backup                Skip creating .bak files"
  echo -e ""
  echo -e "  ${BOLD}Examples${RESET}"
  echo -e "    soma session list"
  echo -e "    soma session stats                    ${DIM}# latest session${RESET}"
  echo -e "    soma session strip-images             ${DIM}# strip latest session${RESET}"
  echo -e "    soma session strip-images --all       ${DIM}# strip all sessions${RESET}"
  echo -e "    soma session strip-images /path/to/session.jsonl"
}

find_latest_session() {
  if [[ ! -d "$SESSIONS_DIR" ]]; then
    echo ""
    return
  fi
  find "$SESSIONS_DIR" -name "*.jsonl" -not -name "*.bak" -type f 2>/dev/null | \
    xargs ls -t 2>/dev/null | head -1
}

find_project_sessions() {
  local project_dir
  project_dir=$(pwd)
  # Pi session dirs use -- as separator: --Users-user-project--
  local encoded
  encoded=$(echo "$project_dir" | sed 's|/|--|g; s|^-*||')
  local session_subdir="$SESSIONS_DIR/--${encoded}--"
  if [[ -d "$session_subdir" ]]; then
    find "$session_subdir" -name "*.jsonl" -not -name "*.bak" -type f 2>/dev/null | sort
  fi
}

# ── strip-images ─────────────────────────────────────────────────────────
do_strip_images() {
  local target="$1"
  local dry_run="${2:-false}"
  local no_backup="${3:-false}"

  if [[ ! -f "$target" ]]; then
    echo -e "  ${RED}✗${RESET} File not found: $target"
    return 1
  fi

  local orig_size
  orig_size=$(du -h "$target" | awk '{print $1}')

  # Count images first
  local img_count
  img_count=$(python3 -c "
import json, sys
count = 0
with open('$target') as f:
    for line in f:
        try:
            entry = json.loads(line.strip())
        except: continue
        msg = entry.get('message', {})
        content = msg.get('content', [])
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    if block.get('type') == 'image': count += 1
                    if block.get('type') == 'tool_result' and isinstance(block.get('content'), list):
                        for sub in block['content']:
                            if isinstance(sub, dict) and sub.get('type') == 'image': count += 1
print(count)
" 2>/dev/null)

  if [[ "${img_count:-0}" -eq 0 ]]; then
    echo -e "  ${GREEN}✓${RESET} No images in $(basename "$target") ($orig_size)"
    return 0
  fi

  if [[ "$dry_run" == "true" ]]; then
    echo -e "  ${YELLOW}○${RESET} Would strip $img_count images from $(basename "$target") ($orig_size)"
    return 0
  fi

  # Backup
  if [[ "$no_backup" != "true" ]]; then
    cp "$target" "${target}.bak"
  fi

  # Strip
  python3 -c "
import json, os

infile = '$target'
outfile = infile + '.clean'
stripped = 0

with open(infile) as f, open(outfile, 'w') as out:
    for line in f:
        try:
            entry = json.loads(line.strip())
        except:
            out.write(line)
            continue
        msg = entry.get('message', {})
        content = msg.get('content', [])
        changed = False
        if isinstance(content, list):
            for i, block in enumerate(content):
                if isinstance(block, dict):
                    if block.get('type') == 'image':
                        mime = block.get('mimeType', '?')
                        content[i] = {'type': 'text', 'text': f'[image stripped — {mime}]'}
                        stripped += 1
                        changed = True
                    elif block.get('type') == 'tool_result' and isinstance(block.get('content'), list):
                        for j, sub in enumerate(block['content']):
                            if isinstance(sub, dict) and sub.get('type') == 'image':
                                mime = sub.get('mimeType', '?')
                                block['content'][j] = {'type': 'text', 'text': f'[image stripped — {mime}]'}
                                stripped += 1
                                changed = True
        if changed:
            msg['content'] = content
            entry['message'] = msg
        out.write(json.dumps(entry) + '\n')

os.replace(outfile, infile)
orig = os.path.getsize(infile + '.bak') if os.path.exists(infile + '.bak') else 0
clean = os.path.getsize(infile)
if orig > 0:
    print(f'{stripped}|{orig}|{clean}')
else:
    print(f'{stripped}|0|{clean}')
" 2>/dev/null

  local result
  result=$(python3 -c "
import os
orig = os.path.getsize('${target}.bak') if os.path.exists('${target}.bak') else 0
clean = os.path.getsize('$target')
reduction = int((1 - clean / orig) * 100) if orig > 0 else 0
print(f'{orig}|{clean}|{reduction}')
" 2>/dev/null)

  local orig_bytes clean_bytes reduction
  orig_bytes=$(echo "$result" | cut -d'|' -f1)
  clean_bytes=$(echo "$result" | cut -d'|' -f2)
  reduction=$(echo "$result" | cut -d'|' -f3)

  local clean_size
  clean_size=$(du -h "$target" | awk '{print $1}')

  echo -e "  ${GREEN}✓${RESET} Stripped $img_count images from $(basename "$target")"
  echo -e "    ${DIM}${orig_size} → ${clean_size} (${reduction}% smaller)${RESET}"
  if [[ "$no_backup" != "true" ]]; then
    echo -e "    ${DIM}Backup: ${target}.bak${RESET}"
  fi
}

# ── list ─────────────────────────────────────────────────────────────────
do_list() {
  if [[ ! -d "$SESSIONS_DIR" ]]; then
    echo -e "  ${YELLOW}⚠${RESET} No sessions directory: $SESSIONS_DIR"
    return
  fi

  σ "Sessions"
  echo ""

  local total=0
  while IFS= read -r dir; do
    local project
    project=$(basename "$dir" | sed 's/^--//; s/--$//; s/--/\//g')
    local count
    count=$(find "$dir" -name "*.jsonl" -not -name "*.bak" 2>/dev/null | wc -l | tr -d ' ')
    local size
    size=$(du -sh "$dir" 2>/dev/null | awk '{print $1}')
    if [[ "$count" -gt 0 ]]; then
      echo -e "  ${CYAN}${count}${RESET} sessions  ${size}  ${DIM}${project}${RESET}"
      total=$((total + count))
    fi
  done < <(find "$SESSIONS_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort)

  echo ""
  echo -e "  ${BOLD}${total}${RESET} total sessions"
  local total_size
  total_size=$(du -sh "$SESSIONS_DIR" 2>/dev/null | awk '{print $1}')
  echo -e "  ${BOLD}${total_size}${RESET} total size"
}

# ── stats ────────────────────────────────────────────────────────────────
do_stats() {
  local target="$1"

  if [[ ! -f "$target" ]]; then
    echo -e "  ${RED}✗${RESET} File not found: $target"
    return 1
  fi

  σ "Session stats: $(basename "$target")"
  echo ""

  python3 -c "
import json, struct, base64

images = []
messages = 0
tools = 0

with open('$target') as f:
    for line in f:
        try:
            entry = json.loads(line.strip())
        except: continue
        msg = entry.get('message', {})
        messages += 1
        content = msg.get('content', [])
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    if block.get('type') == 'tool_use': tools += 1
                    if block.get('type') == 'image':
                        data = block.get('data', '')
                        mime = block.get('mimeType', '?')
                        size_kb = len(data) * 3 / 4 / 1024
                        # Read actual dimensions
                        w, h = '?', '?'
                        try:
                            raw = base64.b64decode(data[:200])
                            if raw[0:1] == b'\x89':
                                w = struct.unpack('>I', raw[16:20])[0]
                                h = struct.unpack('>I', raw[20:24])[0]
                            elif raw[0:2] == b'\xff\xd8':
                                full = base64.b64decode(data[:15000])
                                for i in range(2, len(full)-9):
                                    if full[i] == 0xff and full[i+1] in (0xc0, 0xc2):
                                        h = struct.unpack('>H', full[i+5:i+7])[0]
                                        w = struct.unpack('>H', full[i+7:i+9])[0]
                                        break
                        except: pass
                        over = ' ⚠️ >2000px' if (isinstance(w,int) and w > 2000) or (isinstance(h,int) and h > 2000) else ''
                        images.append((w, h, size_kb, mime, over))
                    if block.get('type') == 'tool_result' and isinstance(block.get('content'), list):
                        for sub in block['content']:
                            if isinstance(sub, dict) and sub.get('type') == 'image':
                                data = sub.get('data', '')
                                mime = sub.get('mimeType', '?')
                                size_kb = len(data) * 3 / 4 / 1024
                                w, h = '?', '?'
                                try:
                                    raw = base64.b64decode(data[:200])
                                    if raw[0:1] == b'\x89':
                                        w = struct.unpack('>I', raw[16:20])[0]
                                        h = struct.unpack('>I', raw[20:24])[0]
                                    elif raw[0:2] == b'\xff\xd8':
                                        full = base64.b64decode(data[:15000])
                                        for i in range(2, len(full)-9):
                                            if full[i] == 0xff and full[i+1] in (0xc0, 0xc2):
                                                h = struct.unpack('>H', full[i+5:i+7])[0]
                                                w = struct.unpack('>H', full[i+7:i+9])[0]
                                                break
                                except: pass
                                over = ' ⚠️ >2000px' if (isinstance(w,int) and w > 2000) or (isinstance(h,int) and h > 2000) else ''
                                images.append((w, h, size_kb, mime, over))

import os
file_size = os.path.getsize('$target') / 1024 / 1024

print(f'  Messages:   {messages}')
print(f'  Tool calls: {tools}')
print(f'  Images:     {len(images)}')
print(f'  File size:  {file_size:.1f}MB')
if images:
    total_img = sum(s for _,_,s,_,_ in images)
    print(f'  Image data: {total_img/1024:.1f}MB ({total_img/1024/file_size*100:.0f}% of file)')
    print()
    oversized = [i for i in images if i[4]]
    if oversized:
        print(f'  ⚠️  {len(oversized)} images exceed 2000px (Anthropic many-image limit)')
    print(f'  {\"W\":>6} {\"H\":>6} {\"Size\":>8} Format')
    print(f'  {\"-\"*40}')
    for w, h, size, mime, over in images:
        fmt = 'jpeg' if 'jpeg' in mime else 'png' if 'png' in mime else mime
        print(f'  {str(w):>6} {str(h):>6} {size:>7.0f}KB {fmt}{over}')
else:
    print()
    print('  No images in this session.')
" 2>/dev/null
}

# ── Main ─────────────────────────────────────────────────────────────────
CMD="${1:-}"
shift 2>/dev/null || true

case "$CMD" in
  strip-images|strip|clean)
    DRY_RUN=false
    NO_BACKUP=false
    ALL=false
    TARGET=""

    for arg in "$@"; do
      case "$arg" in
        --dry-run) DRY_RUN=true ;;
        --no-backup) NO_BACKUP=true ;;
        --all) ALL=true ;;
        *) TARGET="$arg" ;;
      esac
    done

    σ "Strip images from sessions"
    echo ""

    if [[ -n "$TARGET" ]]; then
      do_strip_images "$TARGET" "$DRY_RUN" "$NO_BACKUP"
    elif [[ "$ALL" == "true" ]]; then
      find "$SESSIONS_DIR" -name "*.jsonl" -not -name "*.bak" -type f 2>/dev/null | while read -r f; do
        do_strip_images "$f" "$DRY_RUN" "$NO_BACKUP"
      done
    else
      # Strip from current project's latest session, or global latest
      local_sessions=$(find_project_sessions)
      if [[ -n "$local_sessions" ]]; then
        latest=$(echo "$local_sessions" | xargs ls -t 2>/dev/null | head -1)
      else
        latest=$(find_latest_session)
      fi
      if [[ -n "$latest" ]]; then
        do_strip_images "$latest" "$DRY_RUN" "$NO_BACKUP"
      else
        echo -e "  ${YELLOW}⚠${RESET} No sessions found"
      fi
    fi
    ;;

  list|ls)
    do_list
    ;;

  stats|info)
    TARGET="${1:-}"
    if [[ -n "$TARGET" && -f "$TARGET" ]]; then
      do_stats "$TARGET"
    else
      local_sessions=$(find_project_sessions)
      if [[ -n "$local_sessions" ]]; then
        latest=$(echo "$local_sessions" | xargs ls -t 2>/dev/null | head -1)
      else
        latest=$(find_latest_session)
      fi
      if [[ -n "$latest" ]]; then
        do_stats "$latest"
      else
        echo -e "  ${YELLOW}⚠${RESET} No sessions found"
      fi
    fi
    ;;

  --help|-h|"")
    usage
    ;;

  *)
    echo -e "  ${RED}✗${RESET} Unknown command: $CMD"
    echo ""
    usage
    ;;
esac
