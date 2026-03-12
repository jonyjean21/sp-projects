#!/bin/bash
set -euo pipefail

# Remote環境のみ: markdownlint セットアップ
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  if ! command -v markdownlint &> /dev/null; then
    npm install -g markdownlint-cli 2>/dev/null
  fi
fi

FIREBASE_URL="https://viisi-master-app-default-rtdb.firebaseio.com"

# --- .env 自動復元（Firebase暗号化保存から） ---
# $CLAUDE_ENV_FILE対応: 復元した変数は全bashコマンドで自動利用可能
if [ ! -f ".env" ]; then
  # v2（PBKDF2+HMAC）を優先、v1にフォールバック
  ENV_V2=$(curl -sf --max-time 5 "${FIREBASE_URL}/config/env-store-v2.json" 2>/dev/null || echo "null")
  ENV_V1=$(curl -sf --max-time 5 "${FIREBASE_URL}/config/env-store.json" 2>/dev/null || echo "null")

  if { [ "$ENV_V2" != "null" ] && [ -n "$ENV_V2" ] && [ "$ENV_V2" != "{}" ]; } || \
     { [ "$ENV_V1" != "null" ] && [ -n "$ENV_V1" ] && [ "$ENV_V1" != "{}" ]; }; then
    python3 tools/env-setup.py --restore 2>/dev/null && \
      echo "[env] .env を自動復元しました" || true
  fi
fi

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

# --- セッション開始ログ（即時記録・クラッシュ対策） ---
SESSION_LOG_DIR="sp-brain/memory/sessions"
SESSION_LOG="${SESSION_LOG_DIR}/$(TZ=Asia/Tokyo date +%Y%m%d).md"
SESSION_TIME="$(TZ=Asia/Tokyo date '+%H:%M')"

if [ ! -f "$SESSION_LOG" ]; then
  # 新規ログファイル作成
  cat > "$SESSION_LOG" << EOF
# セッションログ: $(TZ=Asia/Tokyo date '+%Y-%m-%d')

## セッション記録
EOF
fi

# セッション開始を追記（複数セッション対応）
echo "" >> "$SESSION_LOG"
echo "### ${SESSION_TIME} セッション開始" >> "$SESSION_LOG"
echo "- 作業内容: （セッション中に随時更新）" >> "$SESSION_LOG"

# --- 月曜: 週間大会まとめ自動公開 ---
if [ "$(TZ=Asia/Tokyo date +%u)" = "1" ]; then
  echo ""
  echo "===== AUTO-PROCESS: 週間大会まとめ ====="
  echo "実行: python3 tools/weekly-roundup-gen.py"
  echo "$(printf '=%.0s' {1..40})"
  echo ""
fi
