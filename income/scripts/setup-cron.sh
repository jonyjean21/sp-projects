#!/bin/bash
# cron設定スクリプト
# 実行: bash income/scripts/setup-cron.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE="/usr/local/bin/node"

echo "現在のcron設定:"
crontab -l 2>/dev/null || echo "(なし)"
echo ""

# 既存のSP自動化cron行を削除
EXISTING=$(crontab -l 2>/dev/null | grep -v "sp-income-engine")

# 新しいcron設定を追加
NEW_CRON="${EXISTING}
# SP収益自動化エンジン
0 9 * * * cd ${SCRIPT_DIR} && bash run-all.sh morning >> logs/cron.log 2>&1
0 18 * * * cd ${SCRIPT_DIR} && bash run-all.sh evening >> logs/cron.log 2>&1
0 0 * * 0 cd ${SCRIPT_DIR} && bash run-all.sh weekly >> logs/cron.log 2>&1"

echo "$NEW_CRON" | crontab -

echo "✅ cron設定完了!"
echo ""
crontab -l | grep -A2 -B2 "SP"
