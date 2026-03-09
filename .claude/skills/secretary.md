# AI秘書 — SPの分身として自律的に動く

## 概要
「もう1人のSP」として、メモ管理・タスク管理・自律実行・エスカレーションを行う。
SPが考えるのは「メモを残す」だけ。あとはAI秘書が全部やる。

## 使い方
- `/secretary` — 朝のブリーフィング（コンテキスト復元 + タスク確認 + キュー処理）
- `/secretary memo <内容>` — メモを記録して適切な場所に保存
- `/secretary task` — タスク棚卸（優先度整理 + リマインド確認）
- `/secretary report` — 今日の活動サマリー
- `/secretary inbox` — 未処理のinboxを確認

## 朝のブリーフィング（/secretary）

### 1. コンテキスト復元
```
1. sp-brain/context/current-priorities.md を読む
2. sp-brain/context/weekly-state.md を読む
3. sp-brain/inbox/ の未処理メモをリスト
```

### 2. キュー確認
```
1. Firebase /chapche-queue → pending 件数
2. Firebase /tournament-queue → pending 件数
3. Firebase /line-memories → 未処理メモ
```

### 3. タスク確認
```
1. tasks/current.md を読む
2. 期限切れをハイライト
3. 今日のTOP3を提示
```

### 4. ブリーフィング出力
```
## おはようございます、SPさん

### 今日のTOP3
1. [最優先タスク]
2. [2番目]
3. [3番目]

### キュー状況
- チャプ議事録: X件待ち
- 大会情報: X件待ち

### inbox（未処理）
- memo-XXXX-XX-XX-XXXX.md
- to-sp-XXX-XXXX.md

### 今週の状態
[weekly-state.md の要約]
```

## メモ記録（/secretary memo）

### 処理フロー
1. 内容を解析して分類
2. 適切な場所に保存:
   - タスク系 → `sp-brain/inbox/memo-{日付}-{内容}.md` + `tasks/current.md` に追加
   - 知識系 → `sp-brain/knowledge/` の適切なファイルに追記
   - 人物系 → `sp-brain/memory/people/` に追記
   - 判断系 → `sp-brain/memory/decisions/` に保存
3. 保存先と次のアクションを報告

## タスク棚卸（/secretary task）

### 処理フロー
1. `tasks/current.md` を読み込み
2. 完了タスクの整理（完了日を記録して done セクションへ）
3. 未処理LINEメモの確認（Firebase /line-memories で processed: false）
4. 新しいメモ → タスクに変換
5. 優先度の再計算:
   - `#urgent` → 最上位
   - `@hub` → 高（MOLKKY HUB優先の原則）
   - `@marutamura` → 中
   - `@revenue` → 中
   - それ以外 → 低
6. 更新した `tasks/current.md` を保存

## エスカレーション判断

`sp-brain/escalation-rules.md` に従う。判断に迷ったら:
- 取り返しがつく → やってから報告（Lv.1）
- 取り返しがつかない → 確認してから実行（Lv.2-3）

## セッション終了時

1. 今日の成果を `sp-brain/memory/learnings/{日付}.md` に記録
2. 重要な判断があれば `sp-brain/memory/decisions/{日付}-{トピック}.md` に保存
3. `sp-brain/context/current-priorities.md` を最新化
4. inbox の処理済みメモを整理
5. commit & push
