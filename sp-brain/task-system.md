# タスク管理システム設計

## コンセプト
「ふとしたメモ」→「実行可能なタスク」→「完了報告」を自動化する。
SPが考えるのは「メモを残す」だけ。あとはAI秘書が全部やる。

---

## メモの入口（3つのチャネル）

### 1. LINE（外出先）
```
SP「覚えて：来週の記事でモルック練習場の比較記事書きたい」
→ Firebase /line-memories に保存
→ 次セッション開始時にタスク化
```

### 2. Inbox（セッション間）
```
sp-brain/inbox/memo-2026-03-09-比較記事.md
→ session-start.sh が検知
→ タスクに変換
```

### 3. 口頭（セッション中）
```
SP「あ、そういえばパートナーの〇〇さんに連絡せなあかんわ」
→ AI秘書が即座に sp-brain/inbox/ にメモ保存
→ 「覚えた。いつまでに連絡する？」と確認
```

---

## タスクのライフサイクル

```
メモ → [トリアージ] → タスク → [実行] → 完了 → [報告]

1. メモ受信
   └─ LINE / inbox / 口頭 で受け取る

2. トリアージ（AI秘書が自動判断）
   ├─ 緊急度: 今日 / 今週 / いつか
   ├─ 担当: AI秘書で完結 / SP確認が必要
   └─ カテゴリ: HUB / マルタ村 / 収益 / 開発 / その他

3. タスク化
   └─ tasks/current.md に追加（優先度順）

4. 実行
   ├─ AI秘書で完結するもの → 自動実行
   └─ SP確認が必要なもの → inbox に [REVIEW] で置く

5. 完了
   ├─ tasks/current.md のステータス更新
   ├─ sp-brain/memory/learnings/ に学びを記録（あれば）
   └─ LINE で完了通知（Lv.1）
```

---

## タスクの形式（tasks/current.md 統一フォーマット）

```markdown
## 今日やること
- [x] 大会情報キュー処理 @hub #auto
- [ ] モルック練習場比較記事の構成案 @hub #content [REVIEW]
- [ ] パートナー〇〇さんへ連絡 @partner #urgent

## 今週やること
- [ ] BOOTH新商品ページ作成 @revenue #create
- [ ] GA4レポート確認 @hub #analytics
- [ ] sp-brain/ の記憶を追加 @clone #meta

## いつか
- [ ] Kindle ebook 構成検討 @revenue #plan
- [ ] YouTube分析ダッシュボード改善 @dev #improve
```

### タグルール
- `@hub` `@marutamura` `@revenue` `@dev` `@clone` — プロジェクト
- `#auto` — AI秘書が自動処理
- `#content` `#analytics` `#create` — タスク種別
- `#urgent` — 緊急
- `[REVIEW]` — SP確認待ち

---

## リマインド機能

### 自動リマインド
- `#urgent` タグのタスクが24時間未処理 → LINE通知
- 「今週やること」が金曜に残っている → 週次レポートでハイライト
- Firebase のメモが3日間タスク化されていない → inbox に [REVIEW]

### 定期チェック
- 毎セッション開始時: `tasks/current.md` を確認
- 月曜: 先週の未完了を確認、今週に繰り越し
- 月初: 「いつか」リストを棚卸。不要なものは削除

---

## Firebase スキーマ（メモ・タスク用）

### /line-memories（LINEからのメモ）
```json
{
  "content": "来週の記事でモルック練習場の比較記事書きたい",
  "userId": "U1234...",
  "timestamp": "2026-03-09T10:30:00Z",
  "processed": false,
  "taskCreated": false
}
```

### /task-log（タスク完了ログ）
```json
{
  "task": "大会情報キュー処理",
  "project": "hub",
  "completedAt": "2026-03-09T15:00:00Z",
  "autoCompleted": true,
  "notes": "3件処理済み"
}
```
