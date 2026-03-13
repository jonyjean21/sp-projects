# 進行中プロジェクト一覧

> 最終更新: 2026-03-13

## MOLKKY HUB（最優先）
- 状態: 運用中（月間3Kセッション）
- やること: SEO改善、エリア記事拡充、アフィリエイト最適化
- 技術: WordPress + SWELL @ ConoHa
- 自動化: GAS(大会情報収集) + Claude(/tournament queue) + 週間まとめ月曜自動

## マルタ村 / MACHAP（本格始動）
- 状態: **アクティブ**（2026-03-12深夜に中さんと共同プロジェクト正式決定）
- 体制: SP（推進・管理）× 中さん（つながり・ハコ・アイデア）、収益按分
- 直近: **4/12 気球イベント**（初の共同プロジェクト、サポーター＆スタッフとして参画）
- やること: イベント企画・運営テンプレート化、ポータルサイト構築、収支管理
- チャプチェ会: 週次運営継続
- 自動化: GAS→Claude→Notion 議事録全自動
- 方針: イベント運営を記録→再現可能なテンプレートに→頻発させる

## トクラシ（母艦 - 幅広いカテゴリ）
- 状態: 運用中（36本公開）+ **完全自動パイプライン稼働開始**
- URL: https://www.tokurashi.com
- 役割: 旅行・ホテル・ガジェット等を幅広く網羅（経費化+AdSense+中単価アフィ）
- 進捗: プレミアムウォーター承認済 / 残9件審査中
- 自動化: GAS autopilot(月曜5時トピック選定) → Firebase queue → ConoHa PHP(水・土8時記事生成+WP公開)
- 次: 3/15初回自動公開確認、承認ASPテキストリンク埋め込み

## TikTok退職代行アフィリエイト（ニッチ特化 第1弾）
- 状態: **戦略・事業計画・パイプライン設計完了 → Python実装フェーズ**
- 攻め方: TikTok短尺動画（15-30秒）→ lit.link → ASP（退職代行案件）
- ペルソナ: A:新卒逃走(35%) B:パワハラ限界(25%) C:業種特化(20%) D:バイト(15%)
- 自動化: Gemini Flash（台本）→ AivisSpeech（音声）→ MoviePy（動画）= **月額$0**
- 収益見込: Month 1 ¥0-5K → Month 3 ¥5-15K → Month 6 ¥15-50K（承認率込み）
- ポータル: https://jonyjean21.github.io/sp-projects/apps/tiktok-taishoku/
- 詳細: sp-brain/content/tiktok-taishoku/ (business-plan.md, video-pipeline.md, scripts.md, asp-strategy.md)
- 次: **Pythonスクリプト実装** → AivisSpeechセットアップ → テスト動画10本 → TikTok投稿開始

## ニッチ特化サイト群（第2弾以降）
- 状態: 戦略策定完了、退職代行の成果を見て横展開
- 攻め順: ②バーチャルオフィス(A) → ③探偵(A) → ④VPN(B+)
- 収益目標: 3ヶ月後 月7万 / 6ヶ月後 月27万
- 詳細: sp-brain/knowledge/niche-affiliate-execution-plan.md

## BuildHub（収益化 - ニュースレター）
- 状態: 運用中（全自動パイプライン稼働）
- URL: https://www.buildhub.jp
- 自動化: GAS(6時間収集) + ConoHa PHP cron(毎朝7時WP投稿)
- 収益モデル: beehiivニュースレター × スポンサーシップ
- 次: Vercel v0アフィリ登録、読者1,000人でスポンサー営業
- cron: 毎朝7時JST稼働確認済み（ConoHa PHP、beehiivURL正常）

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
