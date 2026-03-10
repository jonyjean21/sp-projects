# デイリールーティン

## 朝（セッション開始時）

### 1. コンテキスト復元
- `sp-brain/context/current-priorities.md` を読む
- `sp-brain/context/weekly-state.md` を読む
- `sp-brain/inbox/` に未処理のメモがないかチェック

### 2. キュー処理チェック
- Firebase `/chapche-queue` → pending があれば処理
- Firebase `/tournament-queue` → pending があれば処理
- Firebase `/contribution-queue` → pending があれば処理

### 3. タスク棚卸
- `tasks/current.md` を確認
- 期限切れ・優先度変更があれば更新
- 今日やるべきことを3つに絞る

### 4. SP へのブリーフィング
- 上記を1画面でサマリー表示
- `[URGENT]` な inbox があればハイライト

## 夕方（セッション終了時）

### 1. セッションログ作成
- `sp-brain/memory/sessions/YYYYMMDD.md` を作成（テンプレート: SESSION-TEMPLATE.md）
- やったこと、判断、学び、未完了を記録
- 重要な判断は別途 `sp-brain/memory/decisions/` にも保存

### 2. 記憶への反映チェック
- decisions/ に保存すべき判断があるか → 保存
- learnings/ に保存すべき学びがあるか → 保存
- people/ を更新すべき人物情報があるか → 更新
- knowledge/ を更新すべきドメイン知識があるか → 更新

### 3. コンテキスト更新
- `sp-brain/context/current-priorities.md` を最新化
- 明日のアクションを `tasks/current.md` に追記

### 4. Inbox整理
- 処理済みのメモを `inbox/done/` に移動
- 未処理のSP向け相談があれば `[REVIEW]` で残す
