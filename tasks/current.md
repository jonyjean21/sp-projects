# 今やること・次やること

> 最終更新: 2026-02-24

PC を開いたらまずここを見る。上から優先度が高い順。

手順書が全部揃ってる → 順番にやるだけ: [docs/setup-guides/](../docs/setup-guides/README.md)

---

## すぐやる（PC開いたらこれ）

### ⓪ GitHub Pages を有効にする（1分）
- [ ] https://github.com/jonyjean21/sp-projects にアクセス → Settings → Pages
- [ ] Branch を選択（mainにマージ後なら main）→ Save
- [ ] ダッシュボードURL確認: https://jonyjean21.github.io/sp-projects/docs/chapche-dashboard.html

---

## セットアップ系（手順書あり → 順番にやるだけ）

### ① GA4 自動エクスポート設定（30分）
- [ ] 手順書に従って設定: [01-ga4-export-setup.md](../docs/setup-guides/01-ga4-export-setup.md)
- [ ] GASスクリプト: [scripts/ga4-monthly-export.gs](../scripts/ga4-monthly-export.gs)（コピペするだけ）
- これが動けばチャットで「先月どうだった？」と聞くだけで分析できる

### ② Google Alerts 設定（10分）
- [ ] 手順書に従って設定: [02-google-alerts-setup.md](../docs/setup-guides/02-google-alerts-setup.md)
- ウェブ上の大会情報が自動でスプシに入る

### ③ IFTTT Pro 設定（30分）
- [ ] 手順書に従って設定: [03-ifttt-setup.md](../docs/setup-guides/03-ifttt-setup.md)
- X上のモルック投稿が5分ごとにスプシに自動記録される
- 費用: $2.99/月（承認済み）

### ④ SEO クイックウィン（30〜40分）
- [ ] 手順書に従って実施: [04-seo-quickwin-guide.md](../docs/setup-guides/04-seo-quickwin-guide.md)
- Search Consoleで「表示多い × CTR低い」キーワード → タイトル改善
- SEO SIMPLE PACK 導入済み ✓

---

## 今月中にやる（各2〜4時間）

### 大会情報収集の自動化（Phase 2）
- [ ] IFTTT Pro 登録（$2.99/月≒450円）← 承認済み
- [ ] X検索「#モルック 大会」→ スプシ連携のApplet作成
- [ ] @Molkky_Japan 監視のApplet作成

### 記事半自動化
- [ ] チーム紹介テンプレートのHTML設計（SWELL対応）
- [ ] AI下書き用のプロンプトテンプレート作成
- 詳細: [docs/article-automation-design.md](../docs/article-automation-design.md)

### SEO 追加施策
- [ ] 主要ページ TOP10 の meta description 最適化
- [ ] 内部リンクの強化（PV多いページ → 他記事へのリンク追加）
- [ ] SWELL設定 > 構造化データに運営組織情報を登録
- [ ] SWELL設定 > 高速化タブの全項目をONにする

---

## 寄稿フロー（急がない → 寄稿者増えたら着手）

- [ ] Google Docs の寄稿テンプレートを作成
- [ ] 共有フォルダの構成を決める
- [ ] GAS → WP REST API の連携スクリプト開発
- 現状（LINE/DM）で回っているので急がない
- 詳細: [docs/contribution-flow-design.md](../docs/contribution-flow-design.md)

---

## マルタ村共同プロジェクト

### ★ ポータルアプリ開発（最優先）

設計書: [docs/portal-app-design.md](../docs/portal-app-design.md)

Phase 1: 運営ポータル MVP
- [ ] marutamura org に `marutamura-portal` リポジトリ作成
- [ ] プロジェクトの初期セットアップ（React 19 + Express + tRPC + Drizzle）
- [ ] 認証（3人限定の簡易認証）
- [ ] タスク管理画面（担当別ボード ← Notionの「やることリスト」代替）
- [ ] ダッシュボード
- [ ] Notionの既存データを初期データとしてDB投入
- [ ] チャプチェ会でお披露目

Phase 2: プロジェクト管理 + アプリ管理
- [ ] プロジェクト一覧（全カテゴリ）
- [ ] アプリステータス一覧
- [ ] GitHub API連携

Phase 3: チャプチェ会 + ドーム運営
- [ ] 議事録管理
- [ ] 検討ボックス
- [ ] ドーム運営タスク管理

Phase 4: ユーザーポータル
- [ ] マルタ村トップページ
- [ ] サービスハブ（全アプリ導線）
- [ ] モルックドーム情報ページ

Phase 5: LINE Bot 連携復活
- [ ] ポータルAPI → LINE Botからタスク追加
- [ ] Notion連携は不要（ポータルが代替）

### その他
- [ ] 中さんとの役割分担・進捗共有フローを整備する
- [ ] 「モルハブ × モルックドーム」連携の具体施策を検討
- Notionから全PJ一覧を取得済み → [projects/molkky-dome/README.md](../projects/molkky-dome/README.md)

---

## 月次ルーチン（毎月初・30分 → GAS設定後は自動化）

- [ ] GA のチャネル別セッション数を確認・記録
- [ ] Search Console のクエリTOP20 を確認
- [ ] 主要ページの表示回数TOP5 の変動確認
- [ ] 対応判断（タイトル改善、リライト等）
