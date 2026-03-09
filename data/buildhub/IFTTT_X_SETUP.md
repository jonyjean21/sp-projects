# IFTTT × X(Twitter) → BuildHub 収集セットアップ手順

## 概要

XのClaude Codeバズ投稿を自動収集してBuildhubダイジェストに含める。
IFTTTが新しいツイートを検知 → Firebase /claude-tips-queue にPUSHするだけ。
コード側（GAS/Python）は対応済み。

## IFTTT設定（5分で完了）

### 1. IFTTT にログイン
- URL: https://ifttt.com
- アカウント: molkkyhub@gmail.com（Pro契約済み）

### 2. 新規アプレット作成

**Trigger（If This）:**
- サービス: X (Twitter)
- イベント: New tweet from search
- Search for: `"claude code" lang:ja -is:retweet`
  - 日本語限定・リツイート除外
  - 英語も含めたい場合: `"claude code" -is:retweet min_faves:10`

**Action（Then That）:**
- サービス: Webhooks
- イベント: Make a web request
- URL: `https://viisi-master-app-default-rtdb.firebaseio.com/claude-tips-queue.json`
- Method: POST
- Content Type: application/json
- Body:
```json
{
  "url": "{{LinkToTweet}}",
  "title": "{{Text}}",
  "source": "x-twitter",
  "score": {{FavoriteCount}},
  "content_preview": "{{Text}}",
  "status": "pending",
  "collected_at": "{{CreatedAt}}"
}
```

### 3. 保存して完了

アプレットをONにすれば自動収集開始。

## 動作確認

Firebase Console → viisi-master-app-default-rtdb → /claude-tips-queue に
source="x-twitter" のエントリが入ることを確認。

## GAS・Pythonの対応状況

- `gas/claude-tips-collector/daily-digest.gs` → SOURCE_LABELS/TAG_MAP に x-twitter 追加済み
- `tools/buildhub-digest.py` → 同上
- `deploy/buildhub-cron.php` → 次回ConoHa更新時に対応予定

## 注意

- IFTTTのX連携はPro以上で利用可能（現在Pro契約あり）
- ツイートが英語・日本語混在になる可能性あり（Geminiが日本語に翻訳してくれる）
- スコアが低いツイートは selectTopItems のボーナスなしで自動的に後回しになる
