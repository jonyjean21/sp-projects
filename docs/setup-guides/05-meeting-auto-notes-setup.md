# 手順書⑤: チャプチェ会 打合せメモ自動化

> 所要時間: 約20分 / 費用: 無料

## やること

Google Drive の打合せ文字起こしファイルを自動で読み取り、
Gemini AI で議事録に構造化して Notion に自動投稿する。

## 前提

- 中さんが Google Meet の音声メモを Google Drive フォルダに保存してくれている
- Notion Integration トークンが発行済み（中さん対応済み）

## 手順

### Step 1: Gemini API キーを取得（5分）

1. <https://aistudio.google.com/apikey> にアクセス
2. Google アカウントでログイン
3. 「Create API Key」をクリック
4. 表示された API キーをコピーしてメモ
   - 無料枠: 15リクエスト/分、100万トークン/日（十分すぎる）

### Step 2: Google Apps Script プロジェクトを作成（3分）

1. <https://script.google.com> にアクセス
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を「チャプチェ会 議事録自動化」に変更
4. `scripts/meeting-auto-notes.gs` の中身を全部コピーしてエディタに貼り付け
5. 保存（Ctrl+S）

### Step 3: スクリプトプロパティを設定（5分）

1. 左メニュー「⚙ プロジェクトの設定」をクリック
2. 一番下の「スクリプト プロパティ」セクションで「スクリプト プロパティを追加」
3. 以下の4つを追加:

| プロパティ | 値 |
|-----------|-----|
| `NOTION_TOKEN` | Notion Integration トークン（ntn_で始まる） |
| `NOTION_PAGE_ID` | `273d31a2c3eb804bb3f0e66775ba8b14` |
| `DRIVE_FOLDER_ID` | `1MgcgluSov3L68oTWhtfDjgOlxoRNRwEa` |
| `GEMINI_API_KEY` | Step 1 で取得した API キー |

4. 「スクリプト プロパティを保存」をクリック

### Step 4: 動作確認（5分）

#### 4-1. フォルダ接続確認

1. エディタに戻る
2. 上部のドロップダウンで `listFiles` を選択
3. 「実行」をクリック
4. 初回は権限の承認ダイアログが出る → 「許可」
5. ログにフォルダ内のファイル一覧が表示されれば OK

#### 4-2. 議事録生成テスト

1. ドロップダウンで `processLatest` を選択
2. 「実行」をクリック
3. ログに「Notion 投稿完了」が出れば成功
4. Notion の打合せメモページに議事録が追加されていることを確認

### Step 5: 自動化を有効にする（2分）

1. ドロップダウンで `setupTrigger` を選択
2. 「実行」をクリック
3. 「トリガー設定完了: 毎日 9:00」のログが出れば完了

これで毎朝 9 時に自動チェックが走り、新しいファイルがあれば
自動的に議事録を構造化して Notion に投稿される。

## 使い方

### 自動モード（設定後は何もしなくてOK）

- 中さんが Google Drive に音声メモ/文字起こしを保存
- 翌朝 9 時に自動処理 → Notion に議事録が追加される

### 手動モード（会議直後にすぐ反映したい場合）

1. Apps Script エディタを開く
2. `processLatest` を選択して「実行」
3. 最新ファイルが処理されて Notion に投稿される

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| 「スクリプトプロパティが未設定」 | Step 3 を再確認 |
| Notion API エラー 401 | NOTION_TOKEN が正しいか確認 |
| Notion API エラー 400 (validation) | ページIDが正しいか、Integrationがページに接続されているか確認 |
| Gemini API エラー | GEMINI_API_KEY を確認、または未設定でも動作する（AI構造化なし） |
| 同じファイルが二重処理される | `resetProcessedFiles` を実行してから `processNewMeetings` を再実行 |
| ファイルが読み取れない | `listFiles` でファイル形式を確認（Google Docs/テキスト/Word に対応） |
