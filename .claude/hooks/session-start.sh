#!/bin/bash
set -euo pipefail

# Remote環境のみ: markdownlint セットアップ
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  if ! command -v markdownlint &> /dev/null; then
    npm install -g markdownlint-cli 2>/dev/null
  fi
fi

FIREBASE_URL="https://viisi-master-app-default-rtdb.firebaseio.com"

# --- 汎用キューチェック関数 ---
check_queue() {
  local path="$1" name="$2" python_fmt="$3" instructions="$4"
  local queue
  queue=$(curl -sf "${FIREBASE_URL}/${path}.json?orderBy=%22status%22&equalTo=%22pending%22" 2>/dev/null || echo "{}")

  { [ "$queue" = "{}" ] || [ "$queue" = "null" ]; } && return 0

  local items count
  items=$(echo "$queue" | python3 -c "$python_fmt" 2>/dev/null)
  count=$(echo "$queue" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)

  if [ -n "$items" ]; then
    echo ""
    echo "===== AUTO-PROCESS: ${name} (${count}件) ====="
    echo "$items"
    echo ""
    echo "$instructions"
    echo "$(printf '=%.0s' {1..40})"
    echo ""
  fi
}

# --- 3キュー一括チェック ---
check_queue "chapche-queue" "チャプ会議事録" "
import sys, json
for k,v in json.load(sys.stdin).items():
    print(f'  - {v.get(\"year\",\"\")}/{v.get(\"month\",\"\")}/{v.get(\"day\",\"\")} ({k})')
" "スキル: /chapche-minutes queue を自動実行"

check_queue "tournament-queue" "大会情報" "
import sys, json
for k,v in json.load(sys.stdin).items():
    print(f'  - {v.get(\"title\",\"(不明)\")[:40]} [{v.get(\"source\",\"\")}]')
" "スキル: /tournament queue を実行"

check_queue "contribution-queue" "寄稿原稿" "
import sys, json
for k,v in json.load(sys.stdin).items():
    vol = f' Vol.{v[\"vol\"]}' if v.get('vol') else ''
    print(f'  - {v.get(\"filename\",\"(不明)\")[:40]} (著者: {v.get(\"author\",\"不明\")}{vol}) [{k}]')
" "原稿DL → 画像抽出 → WPメディアアップ → 記事HTML → 下書き投稿（公開はSP確認後）"

check_queue "claude-tips-queue" "Claude Code Tips" "
import sys, json
for k,v in json.load(sys.stdin).items():
    print(f'  - {v.get(\"title\",\"(不明)\")[:50]} ({v.get(\"source\",\"\")})')
" "/claude-tips-queue を確認してください"

# --- 月曜: 週間大会まとめ自動公開 ---
if [ "$(TZ=Asia/Tokyo date +%u)" = "1" ]; then
  echo ""
  echo "===== AUTO-PROCESS: 週間大会まとめ ====="
  echo "実行: python3 tools/weekly-roundup-gen.py"
  echo "$(printf '=%.0s' {1..40})"
  echo ""
fi
