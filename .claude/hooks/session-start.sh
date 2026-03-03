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
    echo "===== AUTO-PROCESS: チャプ会議事録 ====="
    echo "未処理の議事録が検出されました。自動で処理してください:"
    echo "$PENDING"
    echo ""
    echo "処理内容: Firebaseキューからpending取得 → テキストDL → 議事録変換 → Notion投稿 → ローカル保存 → git push"
    echo "スキル: /chapche-minutes queue の手順に従って、ユーザーに確認せず自動実行すること"
    echo "========================================"
    echo ""
  fi
fi

# ===== 月次インサイトレポートのリマインダー =====
TODAY=$(date +%d)
CURRENT_MONTH=$(date +%Y-%m)
REPORT_FILE="/home/user/sp-projects/docs/monthly-reports/${CURRENT_MONTH}.md"
PREV_MONTH=$(date -d "$(date +%Y-%m-01) -1 day" +%Y-%m 2>/dev/null || date -v-1m +%Y-%m 2>/dev/null || echo "")

# 月初1〜7日で、今月のレポートがまだない場合に通知
if [ "$TODAY" -le 7 ] && [ -n "$PREV_MONTH" ] && [ ! -f "$REPORT_FILE" ]; then
  echo ""
  echo "===== 月次レポート未作成 ====="
  echo "先月（${PREV_MONTH}）の記事インサイトレポートがまだ生成されていません。"
  echo ""
  echo "実行コマンド: /review-article-insights"
  echo "内容: GA4データ + Search Console → 月次レポート生成 → docs/monthly-reports/${PREV_MONTH}.md に保存"
  echo "=============================="
  echo ""
fi

# ===== 大会情報キューの自動チェック =====
T_QUEUE=$(curl -sf "${FIREBASE_URL}/tournament-queue.json?orderBy=%22status%22&equalTo=%22pending%22" 2>/dev/null || echo "{}")

if [ "$T_QUEUE" != "{}" ] && [ "$T_QUEUE" != "null" ]; then
  T_PENDING=$(echo "$T_QUEUE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data:
    for key, val in data.items():
        title = val.get('title','(不明)')[:40]
        src = val.get('source','')
        print(f'  - {title} [{src}]')
" 2>/dev/null)

  if [ -n "$T_PENDING" ]; then
    T_COUNT=$(echo "$T_QUEUE" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
    echo ""
    echo "===== AUTO-PROCESS: 大会情報 ====="
    echo "未処理の大会情報が ${T_COUNT}件 検出されました。自動で処理してください:"
    echo "$T_PENDING"
    echo ""
    echo "処理内容: /tournament queue の手順に従って一括処理"
    echo "スキル: /tournament queue を実行すること"
    echo "=================================="
    echo ""
  fi
fi
