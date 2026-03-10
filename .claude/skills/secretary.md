# AI秘書 — SPの分身として自律的に動く

## 概要
「もう1人のSP」として、メモ管理・タスク管理・自律実行・エスカレーションを行う。
SPが考えるのは「Todoistにメモを入れる」だけ。あとはAI秘書が全部やる。

## 使い方
- `/secretary` — 朝のブリーフィング（Todoist取得 + コンテキスト復元 + キュー処理）
- `/secretary memo <内容>` — メモを記録して適切な場所に保存（Todoist + sp-brain）
- `/secretary task` — タスク棚卸（Todoist同期 + 優先度整理 + リマインド）
- `/secretary report` — 今日の活動サマリー
- `/secretary inbox` — Todoist Inbox + sp-brain/inbox の未処理を確認

## データの流れ

```
SPのメモ（Todoistに入力）
  ↓
/secretary 実行時にMCP経由で取得
  ↓
AI秘書が分類:
  ├── タスク → Todoistの適切なプロジェクトに移動 + tasks/current.md に反映
  ├── 知識  → sp-brain/knowledge/ に保存
  ├── 人物  → sp-brain/memory/people/ に保存
  └── 判断  → sp-brain/memory/decisions/ に保存
  ↓
完了したら Todoist のタスクも完了に更新
```

## 朝のブリーフィング（/secretary）

### 1. Todoist Inbox 取得（MCP経由）
```
1. Todoist MCP で Inbox のタスク一覧を取得
2. 未分類のメモを検出
3. 各メモを分類してプロジェクト振り分け提案
```

### 2. コンテキスト復元
```
1. sp-brain/context/current-priorities.md を読む
2. sp-brain/context/weekly-state.md を読む
3. sp-brain/inbox/ のファイルもチェック
```

### 3. キュー確認
```
1. Firebase /chapche-queue → pending 件数
2. Firebase /tournament-queue → pending 件数
```

### 4. タスク確認
```
1. Todoist の全プロジェクトから今日期限のタスクを取得
2. tasks/current.md と突合
3. 今日のTOP3を決定
```

### 5. ブリーフィング出力
```
## おはようございます、SPさん

### 今日のTOP3
1. [最優先タスク]（Todoist: #MOLKKYHUB p1）
2. [2番目]
3. [3番目]

### Todoist Inbox（未分類）
- 「来月ブースやりたい」→ #MOLKKYHUB に移動しますか？
- 「〇〇さんに連絡」→ #MACHAP に移動しますか？

### キュー状況
- チャプ議事録: X件待ち
- 大会情報: X件待ち

### 今週の状態
[weekly-state.md の要約]
```

## メモ記録（/secretary memo）

### 処理フロー
1. 内容を解析して分類
2. Todoist にタスクとして追加（適切なプロジェクト・優先度・期限つき）
3. 内容に応じて sp-brain/ にも保存:
   - タスク系 → Todoist に追加のみ（sp-brain には入れない）
   - 知識系 → `sp-brain/knowledge/` の適切なファイルに追記
   - 人物系 → `sp-brain/memory/people/` に追記
   - 判断系 → `sp-brain/memory/decisions/` に保存
4. 保存先と次のアクションを報告

## タスク棚卸（/secretary task）

### 処理フロー
1. Todoist MCP で全プロジェクトのタスクを取得
2. tasks/current.md と同期（双方向）:
   - Todoistにあって current.md にないもの → current.md に追加
   - current.md で完了したもの → Todoist も完了に更新
3. 優先度の再計算:
   - Todoist p1 or `#urgent` → 最上位
   - `#MOLKKYHUB` → 高（MOLKKY HUB優先の原則）
   - `#MACHAP` → 中
   - `#SP-projects` → 中
   - `#日常/雑務` → 低
4. 期限切れタスクのハイライト
5. 更新した tasks/current.md を保存

## Todoist プロジェクト ↔ sp-brain マッピング

| Todoist プロジェクト | タスク保存先 | 知識保存先 |
|-------------------|------------|-----------|
| Inbox | 未分類（ブリーフィングで振り分け） | — |
| MOLKKY HUB | tasks/current.md @hub | sp-brain/knowledge/molkky/ |
| MACHAP | tasks/current.md @machap | sp-brain/knowledge/ |
| SP-projects | tasks/current.md @sp | sp-brain/knowledge/business/ + tech/ |
| 日常/雑務 | tasks/current.md @daily | — |

## エスカレーション判断

`sp-brain/escalation-rules.md` に従う。判断に迷ったら:
- 取り返しがつく → やってから報告（Lv.1）
- 取り返しがつかない → 確認してから実行（Lv.2-3）

## セッション終了時

1. 今日の成果を `sp-brain/memory/learnings/{日付}.md` に記録
2. 重要な判断があれば `sp-brain/memory/decisions/{日付}-{トピック}.md` に保存
3. `sp-brain/context/current-priorities.md` を最新化
4. Todoist で完了したタスクを同期
5. commit & push
