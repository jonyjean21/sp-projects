# チャプ会 議事録処理スキル

## 概要
Google Meetの文字起こし（Geminiメモ）をチャプ会の議事録フォーマットに変換する。
GASが新しいファイルを自動検知→Firebaseキューに登録→このスキルで処理。

## 使い方
- `/chapche-minutes` — 最新の文字起こしをDriveからDL→処理
- `/chapche-minutes queue` — Firebaseキューの未処理分を一括処理
- `/chapche-minutes 2026-02-19` — 指定日の文字起こしを処理
- `/chapche-minutes <ファイルパス>` — ローカルファイルを処理

## キュー処理（`/chapche-minutes queue`）

### Firebase キュー
- DB: `https://viisi-master-app-default-rtdb.firebaseio.com`
- パス: `/chapche-queue`
- GAS（1時間おき）がDriveフォルダを監視し、新規Geminiメモをキューに登録
- セッション開始時にフックが自動チェックし、未処理があれば通知

### キュー処理フロー
1. Firebase から `status: "pending"` のエントリを取得:
```bash
curl -s "https://viisi-master-app-default-rtdb.firebaseio.com/chapche-queue.json?orderBy=%22status%22&equalTo=%22pending%22"
```
2. 各エントリの `export_url` からテキストをダウンロード:
```bash
curl -sL "<export_url>" -o data/meet_transcripts/meeting_<date>.txt
```
3. 通常の議事録処理フロー（Step 1〜5）を実行
4. 処理完了後、ステータスを更新:
```bash
curl -s -X PATCH "https://viisi-master-app-default-rtdb.firebaseio.com/chapche-queue/<dateLabel>.json" \
  -d '{"status":"processed","processed_at":"<ISO datetime>","notion_page_id":"<page_id>"}'
```

## 通常処理フロー

### Step 1: 文字起こしファイルの取得
引数に応じて以下のいずれかを実行:

**日付指定なしの場合:**
Drive の embeddedfolderview からファイル一覧を取得:
```
https://drive.google.com/embeddedfolderview?id=1MgcgluSov3L68oTWhtfDjgOlxoRNRwEa
```
最新のファイルをダウンロード。

**日付指定の場合:**
ローカルに `data/meet_transcripts/meeting_{日付}.txt` があればそれを使用。
なければDriveからダウンロード（export URL: `https://docs.google.com/document/d/{DOC_ID}/export?format=txt`）。

### Step 2: ノート部分の抽出
ファイルの「📖 文字起こし」より前の部分だけを使う。
「まとめ」「詳細」「推奨される次のステップ」の3セクションが主な情報源。

### Step 3: 議事録フォーマットに変換
抽出したノートを以下のチャプ会議事録フォーマットに変換する:

```
# YYMMDD_打合せ

## チャプ会 議事録
- **日時**: YYYY年M月D日（曜日）HH:MM〜
- **参加**: 中 / ししょー / サノ
- **形式**: Geminiメモ統合版

## プロジェクト進捗報告会

### [担当者名]担当
#### [プロジェクト名]
- 進捗内容（箇条書き、簡潔に）

## 議論トピック
### [トピック名]
- 議論内容

## 決定事項
- 決まったこと（箇条書き）

## アクションアイテム
- [ ] 誰：何を

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

### Step 4: Notion投稿
NOTION_TOKEN（.env）を使ってNotionに投稿:
- 親ページ: 打合せメモ (273d31a2-c3eb-804b-b3f0-e66775ba8b14)
- タイトル: `YYMMDD_打合せ`
- Notion APIでブロック形式に変換して投稿

### Step 5: ローカル保存 & コミット
- Markdownファイル: `data/chapche/YYMMDD_打合せ.md`
- git add → commit → push

## 自動化パイプライン
```
[Google Meet終了]
  ↓ Gemini が自動で文字起こし → Drive フォルダに保存
  ↓ GAS（1時間おき）が新ファイル検知 → Firebase /chapche-queue に登録
  ↓ Claude Code セッション開始時にフックが通知
  ↓ /chapche-minutes queue で一括処理
  ↓ Notion投稿 + ローカル保存 + git push
```

## GASプロジェクト
- Script ID: 1JsGv7breY0MXAz9sXF7olPv_qE3nQYpHqiUKTCbHQqoMJVYIhDmSMUSC
- ソース: `gas/chapche-auto/main.gs`
- トリガー: 1時間おきの時間駆動
- デプロイ: `clasp push --force`

## 注意
- Google Drive共有フォルダ: https://drive.google.com/drive/u/1/folders/1MgcgluSov3L68oTWhtfDjgOlxoRNRwEa
- チャプ会の参加者は通常3人: 中・ししょー・サノ
- ファイルサイズが大きい場合、ノート部分（「📖 文字起こし」より前）のみ処理する
- Firebase RTDB: viisi-master-app プロジェクト
