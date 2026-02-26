# チャプ会 議事録処理スキル

## 概要
Google Meetの文字起こし（Geminiメモ）をチャプ会の議事録フォーマットに変換する。

## 使い方
- `/chapche-minutes` — 最新の文字起こしをDriveからDL→処理
- `/chapche-minutes 2026-02-19` — 指定日の文字起こしを処理
- `/chapche-minutes <ファイルパス>` — ローカルファイルを処理

## 処理フロー

### Step 1: 文字起こしファイルの取得
引数に応じて以下のいずれかを実行:

**日付指定なしの場合:**
```bash
python3 /Users/shumpei/sp-projects/data/list_drive_transcripts.py list
```
最新のファイルを表示し、ユーザーに確認してからダウンロード。

**日付指定の場合:**
ローカルに `data/meet_transcripts/meeting_{日付}.txt` があればそれを使用。
なければDriveからダウンロード。

### Step 2: ノート部分の抽出
```bash
python3 /Users/shumpei/sp-projects/data/extract_meeting_notes.py <ファイル> summary
python3 /Users/shumpei/sp-projects/data/extract_meeting_notes.py <ファイル> details
python3 /Users/shumpei/sp-projects/data/extract_meeting_notes.py <ファイル> next_steps
```

### Step 3: 議事録フォーマットに変換
抽出したノートを以下のチャプ会議事録フォーマットに変換する:

```
# YYMMDD_打合せ

## チャプ会 議事録
- **日時**: YYYY年M月D日（曜日）HH:MM〜
- **参加**: 中 / ししょー（master morikawa）/ サノ（SP）
- **形式**: 音声メモ＋Geminiメモ統合版

## プロジェクト進捗報告会

### [担当者名]担当
#### [プロジェクト名]
- 進捗内容（箇条書き、簡潔に）

## 決定事項
- 決まったこと（箇条書き）

## アクションアイテム
- [ ] 誰が / 何を / いつまでに

## 次回予定
- 日時: YYYY/MM/DD
```

### 変換ルール
1. Geminiの「まとめ」「詳細」からプロジェクト別の進捗をまとめる
2. 「推奨される次のステップ」からアクションアイテムを抽出
3. 冗長な説明は削り、1行で簡潔に表現する
4. 人名はNotionの表記に合わせる:
   - 「モルックドーム」「中博司」→「中」
   - 「master morikawa」「マスターモリカワ」→「ししょー」
   - 「SP」「サノ」→「サノ」
   - 「atsuko watanabe」→「あっちゃん」（ゆい）
5. タイムスタンプ (00:xx:xx) は削除する
6. 文字起こし部分は含めない（ノート部分のみ処理）

### Step 4: 出力
変換した議事録を表示する。ユーザーが確認後:
- Notionに投稿（NOTION_TOKEN が .env にあれば）
- または Markdown ファイルとして保存

### Step 5: ダッシュボード更新
`data/chapche/dashboard.json` を更新:
- meetingHistory に追加
- openActionItems を更新
- recentDecisions を更新

## 注意
- Google Drive共有フォルダ: https://drive.google.com/drive/u/1/folders/1MgcgluSov3L68oTWhtfDjgOlxoRNRwEa
- チャプ会の参加者は通常3人: 中・ししょー・サノ
- ファイルサイズが大きい場合、ノート部分（「📖 文字起こし」より前）のみ処理する
