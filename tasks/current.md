# 今やること・次やること

> 最終更新: 2026-02-24

PC を開いたらまずここを見る。上から優先度が高い順。

---

## すぐやる（各15〜30分）

### GA4 自動エクスポート設定
- [ ] GA4 のプロパティIDを確認（GA管理画面 → プロパティ設定）
- [ ] スプレッドシートにGASスクリプトを設定
- [ ] 毎月1日のトリガーを設定
- これが動けばチャットで「先月どうだった？」と聞くだけで分析できる
- 詳細: [docs/ga-auto-export-design.md](../docs/ga-auto-export-design.md)

### 大会情報収集の自動化（Phase 1）
- [ ] Google Alerts を設定（「モルック 大会」「モルック 参加者募集」「モルック 開催」）
- [ ] スプレッドシートに IMPORTFEED 関数を追加
- 詳細: [docs/tournament-collection-design.md](../docs/tournament-collection-design.md)

### SEO クイックウィン
- [ ] Search Console で「表示回数多い × CTR低い」クエリを確認
- [ ] 該当ページのタイトル・meta description を改善
- SEO SIMPLE PACK 導入済みを確認 ✓
- 詳細: [docs/seo-improvement-plan.md](../docs/seo-improvement-plan.md)

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

- [ ] Notion のプロジェクト一覧をさらに詳細化（各PJの状況・優先度を整理）
- [ ] 中さんとの役割分担・進捗共有フローを整備する
- [ ] 「モルハブ × モルックドーム」連携の具体施策を検討
- Notionから全PJ一覧を取得済み → [projects/molkky-dome/README.md](../projects/molkky-dome/README.md)

---

## 月次ルーチン（毎月初・30分 → GAS設定後は自動化）

- [ ] GA のチャネル別セッション数を確認・記録
- [ ] Search Console のクエリTOP20 を確認
- [ ] 主要ページの表示回数TOP5 の変動確認
- [ ] 対応判断（タイトル改善、リライト等）
