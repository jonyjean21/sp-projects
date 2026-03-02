#!/bin/bash
# ====================================================
# SP 全自動収入エンジン — 毎日実行スクリプト
# ====================================================
#
# cron設定:
#   0 9 * * * bash /home/user/sp-projects/income/run-all.sh morning
#   0 18 * * * bash /home/user/sp-projects/income/run-all.sh evening
#   0 0 * * 0 bash /home/user/sp-projects/income/run-all.sh weekly
#
# 実行前に必要な環境変数を設定:
#   export ANTHROPIC_API_KEY=sk-ant-...
#   export AMAZON_ASSOCIATE_TAG=xxx-22
#   export TWITTER_API_KEY=...

set -e

# Node.js パスを明示的に設定
export PATH="/usr/local/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/$(date +%Y-%m-%d).log"
MODE="${1:-morning}"

log() {
  echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# === 環境変数読み込み + チェック ===
check_env() {
  # .env を自動読み込み
  if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
  fi

  if [ -z "$ANTHROPIC_API_KEY" ]; then
    log "❌ ANTHROPIC_API_KEY が設定されていません"
    log "   income/.env に ANTHROPIC_API_KEY=sk-ant-... を設定してください"
    exit 1
  fi
  log "✅ 環境変数 OK (ANTHROPIC_API_KEY設定済み)"
}

# === 朝の処理 (9:00) ===
morning_tasks() {
  log "🌅 朝の処理開始"

  # 1. MOLKKY HUB 記事生成 → WP自動下書き投稿（週3回）
  DAY_OF_WEEK=$(date +%u)
  if [ "$DAY_OF_WEEK" -eq 1 ] || [ "$DAY_OF_WEEK" -eq 3 ] || [ "$DAY_OF_WEEK" -eq 5 ]; then
    log "📝 MOLKKY HUB 記事生成 → WP下書き投稿"
    node "$SCRIPT_DIR/01-molkky-affiliate/article-generator.js" 2>&1 | tee -a "$LOG_FILE" || log "⚠️  記事生成スキップ"
  fi

  # 2. クラウドワークス案件スキャン + 提案文生成（毎日）
  log "💼 クラウドワークス 提案文生成"
  node "$SCRIPT_DIR/tools/crowdworks-proposal-generator.js" 2>&1 | tee -a "$LOG_FILE" || log "⚠️  CWスキャンスキップ"

  # 3. X投稿文生成 → Buffer用ファイルに追記（毎日）
  log "📣 X投稿文生成 (Buffer用)"
  node "$SCRIPT_DIR/06-x-auto-post/x-affiliate-poster.js" 2>&1 | tee -a "$LOG_FILE" || log "⚠️  X投稿文生成スキップ"

  log "✅ 朝の処理完了"
}

# === 夜の処理 (18:00) ===
evening_tasks() {
  log "🌆 夜の処理開始"

  # 1. X 自動投稿（情報系）
  log "📣 X自動投稿 (夜)"
  node "$SCRIPT_DIR/06-x-auto-post/x-affiliate-poster.js" --type=info 2>&1 | tee -a "$LOG_FILE" || log "⚠️  X投稿スキップ"

  # 2. note記事生成（週2回）
  DAY_OF_WEEK=$(date +%u)
  if [ "$DAY_OF_WEEK" -eq 2 ] || [ "$DAY_OF_WEEK" -eq 4 ]; then
    log "✍️  note記事生成"
    node "$SCRIPT_DIR/02-note-magazine/content-generator.js" 2>&1 | tee -a "$LOG_FILE" || log "⚠️  note記事生成スキップ"
  fi

  log "✅ 夜の処理完了"
}

# === 週次処理 (日曜 0:00) ===
weekly_tasks() {
  log "📅 週次処理開始"

  # 1. アフィリエイトブログ バッチ生成（週5記事）
  log "📚 アフィリエイトブログ 5記事バッチ生成"
  node "$SCRIPT_DIR/05-affiliate-blogs/blog-generator.js" --blog=1 --batch=3 2>&1 | tee -a "$LOG_FILE" || log "⚠️  ブログ生成スキップ"
  node "$SCRIPT_DIR/05-affiliate-blogs/blog-generator.js" --blog=2 --batch=2 2>&1 | tee -a "$LOG_FILE" || log "⚠️  ブログ生成スキップ"

  # 2. 週次パフォーマンスレポート生成
  log "📊 週次レポート生成"
  generate_weekly_report

  log "✅ 週次処理完了"
}

# === 週次レポート生成 ===
generate_weekly_report() {
  REPORT_FILE="$LOG_DIR/weekly-report-$(date +%Y-%W).txt"
  cat > "$REPORT_FILE" << EOF
============================
SP 週次収益レポート
期間: $(date -d 'last sunday' +%Y/%m/%d) 〜 $(date +%Y/%m/%d)
============================

## 今週の活動
- X投稿: $(grep "X自動投稿" "$LOG_FILE" 2>/dev/null | wc -l) 回
- 記事生成: $(grep "記事生成完了\|バッチ生成完了" "$LOG_FILE" 2>/dev/null | wc -l) 本
- note記事: $(grep "note記事生成" "$LOG_FILE" 2>/dev/null | wc -l) 本

## チェックすること
1. Amazonアソシエイト管理画面 → クリック数・収益確認
2. note → 購読者数・収益確認
3. BOOTH → 販売数確認
4. AdSense → 収益確認

## 来週のタスク
- [ ] 先週生成した記事をWordPressに投稿
- [ ] note記事を手動でpublish（確認後）
- [ ] X投稿のエンゲージメント確認

EOF
  log "✅ 週次レポート: $REPORT_FILE"
}

# === メイン ===
log "=============================="
log "SP 全自動収入エンジン 起動"
log "モード: $MODE"
log "=============================="

check_env

case "$MODE" in
  morning) morning_tasks ;;
  evening) evening_tasks ;;
  weekly) weekly_tasks ;;
  all)
    morning_tasks
    evening_tasks
    weekly_tasks
    ;;
  *)
    echo "使い方: $0 [morning|evening|weekly|all]"
    exit 1
    ;;
esac

log "🎉 完了"
