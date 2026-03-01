# 大会情報投稿スキル

## 概要
XのURL or ウェブページURLから大会情報を抽出し、MOLKKY HUB (WordPress) に投稿する。

## 使い方
- `/tournament <URL>` — URLから大会情報を抽出してWP投稿
- `/tournament queue` — Firebase キューの未処理URLを一括処理
- `/tournament check` — 直近の投稿済み大会一覧を表示
- `/tournament search <キーワード>` — WP上の大会を検索
- `/tournament cleanup` — 終了済み大会を検出してdraftに変更

## 処理フロー

### Step 1: URL種別を判定
- `x.com` or `twitter.com` → X（Twitter）のツイート
- それ以外 → ウェブページ

### Step 2: コンテンツ取得

#### Xツイートの場合
ツイートIDを抽出して syndication API を使う:
```bash
TWEET_ID=$(echo "$URL" | grep -o '/status/[0-9]*' | grep -o '[0-9]*')
curl -s "https://cdn.syndication.twimg.com/tweet-result?id=$TWEET_ID&token=x"
```
→ JSON の `text` フィールドがツイート本文。`entities.urls` に添付リンクあり。

ツイートに添付画像がある場合（チラシ等）、`mediaDetails[].media_url_https` で画像URLを取得。
画像にはイベント詳細が含まれることが多いので、Read ツールで画像を確認する。

#### ウェブページの場合
WebFetch ツールで内容を取得する。

### Step 3: 情報抽出
以下のフィールドをコンテンツから抽出する:

| フィールド | ACFキー | 形式 | 例 |
|-----------|---------|------|-----|
| 大会名 | (post_title) | テキスト | 第10回モルック鴻ノ池カップ |
| 開催日 | event_date | YYYYMMDD | 20260418 |
| 開催地（都道府県） | location | テキスト | 奈良 |
| 主催者 | organizer | テキスト | 大和郡山モルッカーズ |
| SNSリンク | sns_link | URL | https://x.com/... |
| 詳細リンク | detail_link | URL | エントリーフォーム等 |
| 規模 | scale | テキスト | 50チーム |
| 初心者歓迎 | beginner_friendly | boolean | true/false |
| 公式大会 | official | boolean | true/false |

抽出時のルール:
- 開催地は都道府県名で統一（市町村は含めない）
- 規模が不明なら空欄
- 初心者歓迎は「初心者OK」「ビギナー歓迎」等の文言があればtrue
- 公式大会は日本モルック協会(JMA)主催の場合のみtrue
- detail_linkはGoogleフォーム、molkky.jp等のエントリー/詳細ページ
- sns_linkは元のXツイートURL

### Step 4: ユーザー確認
抽出結果をAskUserQuestionで表示し、修正があれば反映する。

```
📋 抽出結果:
  大会名: 第10回モルック鴻ノ池カップ
  開催日: 2026/04/18
  場所: 奈良
  主催: 奈良市総合財団
  規模: 36チーム
  初心者: ✅
  公式: ❌
  SNS: https://x.com/...
  詳細: https://molkky.jp/...

この内容でWPに投稿しますか？
```

### Step 5: WP投稿

#### 5a. 重複チェック（3段階）

投稿前に以下の3段階で重複をチェックする。いずれかでヒットした場合はユーザーに報告し、更新 or スキップ or 新規作成を選択させる。

**段階1: URL完全一致（Firebaseキュー内）**
```bash
# キュー内で同じURLが既にposted状態かチェック
curl -s "https://viisi-master-app-default-rtdb.firebaseio.com/tournament-queue.json?orderBy=%22url%22&equalTo=%22<URL>%22"
```
→ `status: "posted"` のエントリがあれば重複。

**段階2: タイトル部分一致 + event_date一致（WP API）**
```bash
source /Users/shumpei/sp-projects/.env
# タイトルで検索
curl -s "https://molkky-hub.com/wp-json/wp/v2/tournament?search=<大会名キーワード>&per_page=10&_fields=id,title,acf,status,link" \
  -u "$WP_USER:$WP_APP_PASSWORD"
```
→ 検索結果の中で `acf.event_date` が同じものがあれば重複。

**段階3: 開催地+開催日+主催者のファジーマッチ（WP API + area）**
```bash
# エリアタクソノミーで絞り込み
curl -s "https://molkky-hub.com/wp-json/wp/v2/tournament?area=<エリアID>&per_page=50&_fields=id,title,acf,status,link" \
  -u "$WP_USER:$WP_APP_PASSWORD"
```
→ 同一エリアで `acf.event_date` が同じ投稿があれば、タイトルや主催者が異なっても重複の可能性として報告。
→ 判定基準: event_dateが完全一致 AND (タイトルに共通キーワード2語以上 OR 主催者名が部分一致)

重複ヒット時の表示:
```
⚠️ 重複の可能性:
  既存: [ID:5678] 第10回モルック鴻ノ池カップ (2026/04/18) [publish]
  新規: 第10回鴻ノ池モルックカップ (2026/04/18)

どうしますか？
  1. 既存を更新
  2. スキップ（投稿しない）
  3. 別の大会として新規投稿
```

#### 5b. エリアタクソノミーIDを取得
都道府県 → slug → taxonomy ID のマッピング:
```
北海道→hokkaido(58), 青森→aomori(69), 岩手→iwate(70), 宮城→miyagi(71),
秋田→akita(72), 山形→yamagata(73), 福島→fukushima(74), 茨城→ibaraki(75),
栃木→tochigi(76), 群馬→gunma(77), 埼玉→saitama(78), 千葉→chiba(79),
東京→tokyo(80), 神奈川→kanagawa(81), 山梨→yamanashi(82), 新潟→niigata(83),
長野→nagano(84), 富山→toyama(85), 石川→ishikawa(86), 福井→fukui(87),
岐阜→gifu(88), 静岡→shizuoka(89), 愛知→aichi(90), 三重→mie(91),
滋賀→shiga(92), 京都→kyoto(93), 大阪→osaka(94), 兵庫→hyogo(95),
奈良→nara(96), 和歌山→wakayama(97), 鳥取→tottori(98), 島根→shimane(99),
岡山→okayama(100), 広島→hiroshima(101), 山口→yamaguchi(102),
徳島→tokushima(103), 香川→kagawa(104), 愛媛→ehime(105), 高知→kochi(106),
福岡→fukuoka(107), 佐賀→saga(108), 長崎→nagasaki(109), 熊本→kumamoto(110),
大分→oita(111), 宮崎→miyazaki(112), 鹿児島→kagoshima(113), 沖縄→okinawa(114)
```

#### 5c. 投稿実行
```bash
source /Users/shumpei/sp-projects/.env
curl -s -X POST "https://molkky-hub.com/wp-json/wp/v2/tournament" \
  -u "$WP_USER:$WP_APP_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "<大会名>",
    "status": "publish",
    "area": [<エリアID>],
    "acf": {
      "event_date": "<YYYYMMDD>",
      "location": "<都道府県>",
      "organizer": "<主催者>",
      "sns_link": "<SNSリンク>",
      "detail_link": "<詳細リンク>",
      "scale": "<規模>",
      "beginner_friendly": <true/false>,
      "official": <true/false>
    }
  }'
```

### Step 6: 完了報告 + ログ保存
投稿結果を表示:
```
✅ 投稿完了！
  Post ID: XXXX
  タイトル: 第10回モルック鴻ノ池カップ
  URL: https://molkky-hub.com/event/tournament/XXXX/
```

処理ログを `data/tournament-logs/YYYY-MM-DD.json` に保存:
```bash
# ログディレクトリ作成（なければ）
mkdir -p /Users/shumpei/sp-projects/data/tournament-logs

# ログファイルに追記（既存ファイルがあればマージ）
# ファイル形式:
# {
#   "date": "2026-03-01",
#   "processed": [
#     {
#       "url": "https://...",
#       "title": "大会名",
#       "action": "posted|skipped|error|duplicate",
#       "post_id": 1234,
#       "source": "manual|rss-auto-JMA公式|ifttt-x-search",
#       "timestamp": "2026-03-01T10:00:00+09:00"
#     }
#   ]
# }
```

ログ保存のルール:
- 日付ファイルが既に存在する場合は `processed` 配列にマージする
- action: `posted`（新規投稿）、`updated`（既存更新）、`skipped`（重複スキップ）、`error`（エラー）
- queue処理でもmanual処理でも必ずログを保存する

## 複数URL一括処理
URLを複数渡された場合は、1件ずつ情報抽出→確認→投稿を繰り返す。
まとめて確認することも可能（一覧表示してOKなら全件投稿）。

## キュー処理（`/tournament queue`）

### Firebase RTDB キュー
- DB: `https://viisi-master-app-default-rtdb.firebaseio.com`
- パス: `/tournament-queue`
- 投稿ページ: `https://jonyjean21.github.io/sp-projects/tournament-submit/`

### キュー処理フロー
1. Firebase から `status: "pending"` のエントリを取得:
```bash
curl -s "https://viisi-master-app-default-rtdb.firebaseio.com/tournament-queue.json?orderBy=%22status%22&equalTo=%22pending%22"
```
2. 各URLに対して通常の処理フロー（Step 1〜6）を実行
3. 処理完了後、ステータスを更新:
```bash
curl -s -X PATCH "https://viisi-master-app-default-rtdb.firebaseio.com/tournament-queue/{KEY}.json" \
  -d '{"status":"posted","post_id":XXXX,"processed_at":"2026-02-26T..."}'
```
4. エラーの場合:
```bash
curl -s -X PATCH "https://viisi-master-app-default-rtdb.firebaseio.com/tournament-queue/{KEY}.json" \
  -d '{"status":"error","error":"エラー内容"}'
```

### キュー一覧表示
処理前にまず一覧を表示して、ユーザーに処理対象を確認:
```
📋 未処理キュー: 3件
  1. https://x.com/molkkydome/status/... (2026-02-26 受付)
  2. https://x.com/molkky_osaka/status/... (2026-02-26 受付)
  3. https://molkky.jp/tournament/... (2026-02-25 受付)

全て処理しますか？
```

## 終了済み大会のクリーンアップ（`/tournament cleanup`）

### 処理フロー
1. 今日の日付を取得し、WP APIで公開中の大会を取得:
```bash
source /Users/shumpei/sp-projects/.env
# 公開中の全大会を取得（per_page=100で複数ページ対応）
curl -s "https://molkky-hub.com/wp-json/wp/v2/tournament?status=publish&per_page=100&_fields=id,title,acf,link" \
  -u "$WP_USER:$WP_APP_PASSWORD"
```

2. `acf.event_date` < 今日の日付 の投稿を抽出:
```
📋 終了済み大会: X件
  1. [ID:5678] 第10回モルック鴻ノ池カップ (2026/02/15) — 奈良
  2. [ID:5690] モルック新宿大会 (2026/01/20) — 東京
  ...

これらをdraft（下書き）に変更しますか？
  1. 全てdraftに変更
  2. 個別に選択
  3. キャンセル
```

3. ユーザー確認後、POSTでステータスを更新:
```bash
# SiteGuard WAFはPOSTのみ通過するため、POST + _method=PUT は使わず直接POSTで更新
# 注: tournament CPTの場合は /wp-json/wp/v2/tournament/{ID} に POST で更新可能
curl -s -X POST "https://molkky-hub.com/wp-json/wp/v2/tournament/<ID>" \
  -u "$WP_USER:$WP_APP_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"status": "draft"}'
```

4. 処理結果を表示し、ログに保存:
```
✅ クリーンアップ完了:
  draft変更: X件
  スキップ: Y件
```

### 注意事項
- `event_date` が空の投稿はスキップする
- 数日前の大会は複数日開催の可能性があるため、7日以上前の大会のみ対象とする
- WP SiteGuard WAFの制約で PUT/PATCH/DELETE は 403 → POST を使用

## 注意事項
- WP認証情報は `.env` から読み取る（ハードコードしない）
- 画像のアップロードは対象外（テキスト情報のみ）
- 同一大会の複数日程（Day1/Day2）は別投稿にする場合あり（ユーザーに確認）
- 投稿後のスプレッドシート更新は不要（WP直接管理に移行）
- Firebase RTDB: viisi-master-app プロジェクト（5先王・partner-portalと共有）
