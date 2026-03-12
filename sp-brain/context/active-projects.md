# 進行中プロジェクト一覧

> 最終更新: 2026-03-12

## MOLKKY HUB（最優先）
- 状態: 運用中（月間3Kセッション）
- やること: SEO改善、エリア記事拡充、アフィリエイト最適化
- 技術: WordPress + SWELL @ ConoHa
- 自動化: GAS(大会情報収集) + Claude(/tournament queue) + 週間まとめ月曜自動

## マルタ村 / MACHAP
- 状態: 開発中
- やること: チャプチェ会週次運営、ポータルMVP
- チーム: SP + 中さん + ししょー
- 自動化: GAS→Claude→Notion 議事録全自動

## トクラシ（収益化 - アフィリエイト）
- 状態: 運用中（35本公開）
- URL: https://www.tokurashi.com
- 目標: ASP成約（プレミアムウォーター・さとふる・じゃらん等）
- 進捗: プレミアムウォーター承認済 / 残9件審査中
- 次: テキストリンク埋め込み（承認次第）、週1-2本ペースで記事追加

## BuildHub（収益化 - ニュースレター）
- 状態: 運用中（全自動パイプライン稼働）
- URL: https://www.buildhub.jp
- 自動化: GAS(6時間収集) + ConoHa PHP cron(毎朝7時WP投稿)
- 収益モデル: beehiivニュースレター × スポンサーシップ
- 次: Vercel v0アフィリ登録、読者1,000人でスポンサー営業
- ブロッカー: ConoHa FTP更新（buildhub-cron.php）→ SP手動

## AIクローン（もう1人のSP）
- 状態: Phase 1（記憶層）+ Phase 3（自律稼働）完成・稼働中
- Phase 2（LINE Bot）: スキップ決定（必要性なし）
- 稼働中の自動化:
  - 日報生成: 毎朝4時（GAS → Gemini → Firebase）
  - BuildHub投稿: 毎朝7時（ConoHa PHP cron）
  - 大会情報収集: 6時間おき（GAS）
  - Claude Tips収集: 6時間おき（GAS）
- 記憶: sp-brain/（MD + Git、蒸留済みMEMORY.md）

## X個人ブランド（副業X）
- 状態: 戦略確定、ポスト案ストック済み、アカウント未作成
- コンセプト: 副業×AI×メディアの過程をリアルタイム公開
- ポスト案: sp-brain/content/x-drafts/queue.md（初週12本ストック）
- 次: アカウント作成 → プロフィール設定 → gas/x-revenue デプロイ

## GitHub Pages アプリ群
- 状態: 運用中（40+アプリ）
- やること: 保守・機能追加（都度）
- 技術: バニラHTML/CSS/JS + Firebase
