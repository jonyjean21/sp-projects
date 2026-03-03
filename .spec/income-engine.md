# SP全自動収入エンジン

## ステータス: active

## 概要
20の収益ストリームを Claude API + Node.js で自動運用し、月額¥290kを目指す収入自動化システム。

## 目的・背景
- 手作業のコンテンツ作成を自動化
- 複数の収益源を並行運用
- 朝・夕・週次のスケジュール自動実行

## 技術スタック
- Node.js（ES Modules）
- @anthropic-ai/sdk（Claude API: claude-opus-4-6）
- Bash スクリプト（オーケストレーション）
- cron（スケジュール実行）

## 機能一覧（収益ストリーム）

| # | ストリーム | 説明 | NPMコマンド | 状態 |
|---|-----------|------|------------|------|
| 01 | モルックアフィリエイト | MOLKKY HUB SEO記事 | `npm run article` | 準備完了 |
| 02 | note マガジン | 有料マガジンコンテンツ | `npm run note` | 準備完了 |
| 03 | BOOTH プロダクト | プロンプト・テンプレート販売 | `npm run booth` | 準備完了 |
| 04 | スポーツSaaS | 大会管理ツール | - | 企画段階 |
| 05 | アフィリエイトブログ | 複数トピックブログ | `npm run blog` | 準備完了 |
| 06 | X自動投稿 | Twitter/X 自動ポスト | `npm run tweet` | 準備完了 |

## スケジュール

| タイミング | コマンド | 内容 |
|-----------|---------|------|
| 朝 | `npm run morning` | 記事投稿、SNS投稿 |
| 夕 | `npm run evening` | エンゲージメント確認、追加投稿 |
| 週次 | `npm run weekly` | 振り返り、翌週計画 |

## 外部連携
- WordPress REST API（MOLKKY HUB）
- note.com API
- BOOTH API
- X/Twitter API
- Claude API（コンテンツ生成）

## 制約・ルール
- APIキーは全て `.env` 管理（絶対にコミットしない）
- `--dry` オプションで本番投稿前にプレビュー可能
- 自動投稿はスパムにならない頻度を維持

## 今後の方針
- cron スケジュールの本番設定
- 収益トラッキングダッシュボード
- 各ストリームのROI計測・改善
