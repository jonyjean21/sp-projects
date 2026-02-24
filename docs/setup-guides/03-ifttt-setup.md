# 手順書③: IFTTT Pro 設定（大会情報の自動収集 Phase 2）

> 所要時間: 約30分 / 費用: $2.99/月（約450円）

## やること

IFTTT Pro で X（Twitter）上のモルック関連投稿を自動でスプレッドシートに記録する。

## IFTTT Pro 料金（2026年2月確認済み）

| プラン | 月額 | Applet数 | ポーリング間隔 |
|--------|------|---------|--------------|
| Free | $0 | 2個まで | 1時間ごと |
| Pro | $2.99 | 20個まで | 5分ごと |
| Pro+ | $8.99 | 無制限 | 5分ごと |

Pro で十分。 20個あれば余裕。年払いだと $2.49/月程度に割引あり。7日間無料トライアル付き。

## 手順

### Step 1: IFTTT アカウント作成 & Pro 登録（5分）

1. https://ifttt.com/ にアクセス
2. Google アカウントでサインアップ（既存なら不要）
3. https://ifttt.com/plans から Pro プラン を選択
4. 支払い情報を入力（7日間無料トライアルあり）

### Step 2: X（Twitter）アカウントを接続（3分）

1. https://ifttt.com/twitter にアクセス
2. 「Connect」 をクリック
3. X（Twitter）の認証画面でログイン → 許可

### Step 3: Google Sheets を接続（3分）

1. https://ifttt.com/google_sheets にアクセス
2. 「Connect」 をクリック
3. Google アカウントで認証

### Step 4: Applet を作成（各3〜5分）

以下の6つのAppletを作成する。

---

#### Applet 1: 「#モルック」検索 → スプシ

1. https://ifttt.com/create にアクセス
2. 「If This」 → X (Twitter) → 「New tweet from search」
3. 検索クエリ: `#モルック -is:retweet`
4. 「Then That」 → Google Sheets → 「Add row to spreadsheet」
5. 設定:
   - Spreadsheet name: `IFTTT_モルック収集`
   - Formatted row: `{{CreatedAt}} ||| {{UserName}} ||| {{Text}} ||| {{LinkToTweet}}`
   - Drive folder path: `IFTTT/Molkky`
6. 「Continue」→「Finish」

---

#### Applet 2: @Molkky_Japan 監視 → スプシ

1. 「If This」 → X (Twitter) → 「New tweet from search」
2. 検索クエリ: `from:Molkky_Japan`
3. 「Then That」 → Google Sheets → Add row to spreadsheet
4. 設定:
   - Spreadsheet name: `IFTTT_モルック収集`
   - Formatted row: `{{CreatedAt}} ||| {{UserName}} ||| {{Text}} ||| {{LinkToTweet}}`
   - Drive folder path: `IFTTT/Molkky`

---

#### Applet 3: @molkkycalendar 監視 → スプシ

1. 検索クエリ: `from:molkkycalendar`
2. 他はApplet 2と同じ設定

---

#### Applet 4: 「モルック 大会」検索 → スプシ

1. 検索クエリ: `モルック 大会 -is:retweet`
2. 他はApplet 1と同じ設定

---

#### Applet 5: 「モルック 参加者募集」検索 → スプシ

1. 検索クエリ: `モルック 参加者募集 -is:retweet`
2. 他はApplet 1と同じ設定

---

#### Applet 6: 全国モルックカレンダーのRSS → スプシ

1. 「If This」 → RSS Feed → 「New feed item」
2. Feed URL: `https://blog.jajapatatas.com/rss`
3. 「Then That」 → Google Sheets → Add row to spreadsheet
4. 設定:
   - Spreadsheet name: `IFTTT_モルック収集`
   - Formatted row: `{{EntryPublished}} ||| RSS ||| {{EntryTitle}} ||| {{EntryUrl}}`
   - Drive folder path: `IFTTT/Molkky`

---

### Step 5: 動作確認（5分）

1. Applet一覧で全6つが 「Connected」 になっていることを確認
2. 「Check now」ボタンを押して手動で即時チェック
3. Google Drive → `IFTTT/Molkky` フォルダに `IFTTT_モルック収集` スプシが作成されていればOK
4. 数時間後に再確認 → データが追記されていれば完了

## 検索クエリの書き方（メモ）

2026年現在、X API の仕様変更で書き方が変わっている:

| やりたいこと | 検索クエリ |
|-------------|-----------|
| キーワード検索 | `モルック 大会` |
| ハッシュタグ検索 | `#モルック` |
| 特定ユーザー監視 | `from:Molkky_Japan` |
| 特定ユーザー + キーワード | `from:Molkky_Japan 大会` |
| OR検索 | `from:Molkky_Japan (大会 OR イベント)` |
| リツイート除外 | `#モルック -is:retweet` |
| 引用ツイート除外 | `#モルック -is:quote` |

注意: `min_faves:` と `filter:` は廃止。`-filter:retweets` → `-is:retweet` に変更。

## 運用上の注意

| ポイント | 内容 |
|---------|------|
| 2,000行制限 | シートが2,000行に達すると新しいスプシが自動作成される |
| 重複 | 複数Appletが同じツイートを拾う可能性あり → 後で重複排除が必要 |
| ノイズ | 「モルック」を含む無関係なツイートも入る → 目視確認 or GASフィルタ |
| Pro 上限 | 20 Applet まで。6つ使っても残り14あるので余裕 |

## 完了後

- X上のモルック関連投稿が5分ごとに自動でスプシに蓄積される
- Google Alerts（Phase 1）と合わせて、ウェブ+SNS両方の情報が自動収集される
- スプシに溜まったデータを見て、大会情報スプシに転記 → GAS → WordPress自動投稿

## 次のステップ

→ [手順書④: SEOクイックウィン](04-seo-quickwin-guide.md) に進む
