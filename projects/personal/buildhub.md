# BuildHub

> Claude Code・AI開発ツールの最新情報を届ける独立メディア

## 概要

Claude Code・AI開発ツール・Anthropicの最新情報を日次で自動収集・要約・投稿するメディア。
SPのAI知識基盤 + ブランディング拠点として構築。運営名義は「BuildHub編集部」（SP個人名は裏に控える）。

## 基本情報

| 項目 | 内容 |
|------|------|
| URL | https://www.buildhub.jp |
| ステータス | 自動運用中（毎朝7時JST投稿） |
| 運営名義 | BuildHub編集部 |
| サーバー | ConoHa WING |
| 技術スタック | WordPress + SWELL |
| 構築日 | 2026-03-09 |
| 分析 | GA4 設置済み |

## システム構成

```
[収集層]
  GAS (claude-tips-collector/main.gs)  ←  Reddit / HN / Zenn / Qiita / dev.to / GitHub releases
  IFTTT アプレット                       ←  X (Twitter) 23アカウント監視

      ↓ Firebase RTDB (/buildhub-queue) に pending 保存

[投稿層]
  ConoHa WING cron (buildhub-cron.php)  ←  毎朝7時JST
      ↓
  Firebase pending取得 → Gemini 2.5-flash で要約生成
      ↓
  Pexels API でアイキャッチ取得
      ↓
  WordPress REST API で投稿（公開）
```

## 収集ソース一覧

| ソース | 内容 | 収集方法 |
|--------|------|---------|
| Reddit r/ClaudeAI | Claude全般の話題 | GAS (6時間おき) |
| Reddit r/ClaudeCode | Claude Code専門 | GAS (6時間おき) |
| Hacker News | AI開発系HNスレ | GAS (6時間おき) |
| Zenn | 日本語技術記事 | GAS (6時間おき) |
| Qiita | 日本語技術記事 | GAS (6時間おき) |
| dev.to | claudecode / claude-code タグ | GAS (6時間おき) |
| GitHub releases | claude-codeリリースノート | GAS (6時間おき) |
| X (Twitter) | 23アカウント監視 | IFTTT → Firebase |

### X監視アカウント（IFTTT経由）
human_bridger / jicchan50 / oochanoo2022 / molkkydome / neko_1234 / yokohamasport 他

## スコアリング

記事の優先度をスコアで判定し、高スコア記事を優先投稿。

| 条件 | 加点 |
|------|------|
| 海外ソース（Reddit/HN/dev.to） | +50 |
| コードブロックあり | +20 |
| GitHub URL含む | +15 |
| github-releases（固定） | 60 |

## WordPress構造

| 項目 | 内容 |
|------|------|
| WP認証 | user=buildhub260309 / app_pass=Yd0M 1DCr chXR KF3P 5JFT Bbmf |
| カテゴリ | Claude Code(2) / AI開発ツール(3) / ニュース(4) / まとめ記事(1) |
| タグ | Claude Code(6) / HN(7) / Reddit(8) / Zenn(9) / Qiita(10) / dev.to(11) / AI開発(12) / Anthropic(13) / X(Twitter)(15) / GitHub(16) |
| ロゴ/ファビコン | 設定済み（#0073aa背景に白字BH） |
| SEO | SEO SIMPLE PACK 導入済み |
| WAF | SiteGuard（GoogleIP/MicrosoftIPブロック → GAS不可、PHP必須） |

## 関連ファイル（sp-projectsリポジトリ）

| ファイル | 役割 |
|---------|------|
| `gas/claude-tips-collector/main.gs` | コンテンツ収集GAS（6時間おき） |
| `tools/buildhub-digest.py` | ローカルから手動投稿するスクリプト |
| `deploy/buildhub-cron.php` | ConoHa WINGのcronファイル（最新版） |
| `tools/buildhub-swell-init.php` | SWELL初期設定用 |
| `data/buildhub/IFTTT_X_SETUP.md` | IFTTTアプレット設定手順 |

## ローカル実行コマンド

```bash
# ドライラン（WP投稿・Firebase更新なし）
GEMINI_API_KEY=... python3 tools/buildhub-digest.py --dry-run

# 本番実行
GEMINI_API_KEY=... BUILDHUB_WP_USER=... BUILDHUB_WP_APP_PASS=... PEXELS_API_KEY=... python3 tools/buildhub-digest.py
```

環境変数はすべて `.env` に記載済み。

## 収益化戦略（2026-03-10チーム決定）

### 基本方針
- Claude/Cursor公式アフィリなし → アフィリ単体モデルは不成立
- **ニュースレター × スポンサーシップ（TLDR AI型）** を目指す

### フェーズ別ロードマップ

| フェーズ | 期間 | 施策 |
|---------|------|------|
| Phase 1 | 〜3ヶ月 | beehiiv登録フォーム設置 + Vercel v0アフィリ ($5/リード+30%) |
| Phase 2 | 3〜6ヶ月 | ElevenLabs(22%/12ヶ月) / RunPod(10%) / Udemy(50%) |
| Phase 3 | 6ヶ月〜 | 読者5,000人でスポンサー営業 ($300-500/掲載) |

### SEOリスク対策
- 自動生成のみはGoogleペナルティ対象 → 編集部コメント（AI生成）で対応済み

## 現在のTODO

- [ ] ConoHa WINGのcronファイルを `deploy/buildhub-cron.php` に更新（FTP/SFTP）← SP作業
- [ ] sitemap.xml復旧（WP管理画面→設定→パーマリンク→保存）← SP作業
- [ ] beehiivニュースレター登録フォームの設置
- [ ] Phase 1アフィリエイトリンクの埋め込み

## メモ

- ConoHa WINGはGoogleIP/MicrosoftIPを全ブロック → GASから直接投稿不可、サーバー内PHP必須
- Gemini APIキーは `.env` の `GEMINI_API_KEY`
- GitHub PAT: macOS Keychain `gh_pat_sp_projects` から取得可能
