# 大会情報投稿スキル

## 使い方
- `/tournament <URL>` — URLから大会情報を抽出してWP投稿
- `/tournament queue` — Firebase キューの未処理URLを一括処理
- `/tournament check` — 直近の投稿済み大会一覧を表示
- `/tournament search <キーワード>` — WP上の大会を検索
- `/tournament cleanup` — 終了済み大会（7日以上前）をdraftに変更

## 処理フロー

### 1. コンテンツ取得
- **Xツイート**: syndication API `https://cdn.syndication.twimg.com/tweet-result?id={TWEET_ID}&token=x` でテキスト＋画像取得。チラシ画像はReadツールで確認
- **ウェブページ**: WebFetchツールで取得

### 2. 情報抽出
ACFフィールドに対応する情報を抽出:

| フィールド | ACFキー | ルール |
|-----------|---------|--------|
| 大会名 | post_title | そのまま |
| 開催日 | event_date | YYYYMMDD形式 |
| 開催地 | location | 都道府県名のみ |
| 主催者 | organizer | |
| SNSリンク | sns_link | 元ツイートURL等 |
| 詳細リンク | detail_link | エントリーフォーム等 |
| 規模 | scale | 不明なら空 |
| 初心者歓迎 | beginner_friendly | 「初心者OK」等の文言でtrue |
| 公式大会 | official | JMA主催のみtrue |

### 3. 確認 → AskUserQuestionで抽出結果を表示し確認

### 4. 重複チェック（3段階）
1. **URL一致**: Firebase `/tournament-queue` で同URLが `posted` かチェック
2. **タイトル+日付**: WP APIで `search=<キーワード>` → event_date一致で判定
3. **エリア+日付**: 同エリア内でevent_date一致 AND (タイトル共通語2語以上 OR 主催者部分一致)

ヒット時 → 既存更新 / スキップ / 新規作成 を選択させる

### 5. WP投稿
- 投稿タイプ: `tournament`（REST: `/wp-json/wp/v2/tournament`）
- エリアtaxonomy: 都道府県slug→ID（hokkaido:58 〜 okinawa:114）
- 認証: `.env` の WP_USER / WP_APP_PASSWORD
- **SiteGuard WAF制約**: POSTのみ使用可（PUT/PATCH/DELETE→403）

### 6. ログ保存
`data/tournament-logs/YYYY-MM-DD.json` に処理結果を記録
- action: posted / updated / skipped / error
- queue処理・manual処理どちらも必ず記録

## キュー処理（`/tournament queue`）
- Firebase: `viisi-master-app` → `/tournament-queue`
- `status: "pending"` を取得 → 各URLに通常フロー実行
- 完了後: PATCH で `status: "posted"` + `post_id` + `processed_at` を更新
- エラー時: PATCH で `status: "error"` + `error` を更新

## クリーンアップ（`/tournament cleanup`）
- WP APIで `status=publish` の全大会取得
- `event_date` が7日以上前 → draftに変更（POSTで更新）
- event_date空はスキップ

## 注意
- 画像アップロードは対象外（テキスト情報のみ）
- 同一大会の複数日程（Day1/Day2）は別投稿の可能性あり（要確認）
- Firebase RTDB: viisi-master-appプロジェクト
