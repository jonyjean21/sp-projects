---
name: tournament
description: モルック大会情報の投稿・管理スキル。URLから大会を登録、Firebaseキューの一括処理、大会の検索・確認を行う。
argument-hint: "<URL> | queue | check | search <キーワード> | cleanup"
---

# モルック大会情報スキル

## 引数に応じて処理を分岐

### `queue` — Firebaseキューの一括処理（AUTO-PROCESS時に使用）

**処理フロー:**

1. Firebase `/tournament-queue` の `status=pending` を全件取得
2. 各エントリのURLからツイート内容を取得（X syndication API: `https://cdn.syndication.twimg.com/tweet-result?id={ID}&token=x`）
3. 大会情報かどうか判定（日付・場所・大会名が含まれるか）
4. 大会情報と判定 → WP投稿（後述）
5. 大会情報でない → Firebase のstatusを `skipped` に更新
6. 処理結果を最後にまとめて報告

**大会情報の判定基準:**
- ✅ 大会名・開催日・会場（または都道府県）が読み取れる
- ❌ サークル勧誘、アプリ宣伝、漫画更新、返信ツイート、感想

**重複チェック（3段階）:**
1. Firebaseキュー内のURL重複確認
2. WP APIで大会名の部分一致確認: `GET /wp/v2/tournament?search={name}&per_page=5`
3. ACF event_dateとlocationの組み合わせ確認

### `<URL>` — URLから大会情報を抽出してWP投稿

URLがXの場合:
- tweet ID を抽出 → syndication API でツイート内容取得
- チラシ画像があれば Read ツールで読み取り（OCR的に情報抽出）

他のURL（peatix, livepocket等）:
- WebFetch でイベントページから情報抽出

### `check` — 直近の投稿済み大会一覧

`GET /wp/v2/tournament?orderby=meta_value&meta_key=event_date&order=desc&per_page=10`

### `search <キーワード>` — 大会を検索

`GET /wp/v2/tournament?search={キーワード}&per_page=10`

### `cleanup` — 終了済み大会をdraftに変更

終了日（event_date）が7日以上前の published 大会を draft に変更。

---

## WP投稿の仕様

### エンドポイント
`POST https://molkky-hub.com/wp-json/wp/v2/tournament`

### 認証
`.env` から `WP_USER` / `WP_APP_PASSWORD` を取得:
```bash
source /dev/stdin <<'EOF'
$(grep -E "^WP_USER=|^WP_APP_PASSWORD=" /Users/shumpei/sp-projects/.env)
EOF
```
※ パスワードにスペースがあるため `source .env` 不可。curl に直接渡す。

### 投稿ボディ（JSON）
```json
{
  "title": "大会名",
  "status": "publish",
  "meta": {
    "event_date": "YYYYMMDD",
    "location": "会場名（都道府県＋会場）",
    "organizer": "主催者名",
    "sns_link": "ツイートURL",
    "detail_link": "申込URL（あれば）",
    "beginner_friendly": false,
    "official": false
  }
}
```

### ACFフィールドの送り方
ACFはREST APIで `meta` キーとして送れる。ただし ACF Pro が REST API integration を有効にしている必要がある。
代替: `acf` フィールドとして送る:
```json
{
  "acf": {
    "event_date": "20260320",
    "location": "東京臨海広域防災公園",
    "organizer": "ナイモル実行委員会"
  }
}
```

### area タクソノミー
都道府県スラッグ → IDの対応（主要）:
- 東京: `tokyo`
- 神奈川: `kanagawa`
- 大阪: `osaka`
- etc. (WP APIで取得: `GET /wp/v2/area?per_page=100`)

```json
{
  "area": [area_id]
}
```

---

## Firebase ステータス更新

```bash
curl -s -X PATCH \
  "https://viisi-master-app-default-rtdb.firebaseio.com/tournament-queue/{KEY}.json" \
  -H "Content-Type: application/json" \
  -d '{"status": "posted", "wp_id": 1234}'
```

ステータス種別: `pending` / `posted` / `skipped` / `error`

---

## 現在のキュー処理（AUTO-PROCESS）

フックが `大会情報 (N件)` を検知した場合、このスキルの `queue` 処理を自動実行する。
確認不要で処理を進め、最後に結果サマリを報告する。
