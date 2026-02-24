#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "=== sp-projects セッション開始セットアップ ==="

# markdownlint-cli のインストール（Markdown 品質チェック用）
if ! command -v markdownlint &> /dev/null; then
  echo "markdownlint-cli をインストール中..."
  npm install -g markdownlint-cli
else
  echo "markdownlint-cli: インストール済み ✓"
fi

echo "=== セットアップ完了 ==="
