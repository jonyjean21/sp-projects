#!/bin/bash
set -euo pipefail

# Remote環境のみ: markdownlint セットアップ
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  if ! command -v markdownlint &> /dev/null; then
    npm install -g markdownlint-cli 2>/dev/null
  fi
fi

# ===== チャプ会議事録キューの自動チェック =====
FIREBASE_URL="https://viisi-master-app-default-rtdb.firebaseio.com"
QUEUE=$(curl -sf "${FIREBASE_URL}/chapche-queue.json?orderBy=%22status%22&equalTo=%22pending%22" 2>/dev/null || echo "{}")

if [ "$QUEUE" != "{}" ] && [ "$QUEUE" != "null" ]; then
  # pending な項目を抽出
  PENDING=$(echo "$QUEUE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data:
    for key, val in data.items():
        y = val.get('year','')
        m = val.get('month','')
        d = val.get('day','')
        print(f'  - {y}/{m}/{d} ({key})')
" 2>/dev/null)

  if [ -n "$PENDING" ]; then
    echo ""
    echo "===== 未処理のチャプ会議事録があります ====="
    echo "$PENDING"
    echo ""
    echo "→ /chapche-minutes queue で処理できます"
    echo "============================================"
    echo ""
  fi
fi
