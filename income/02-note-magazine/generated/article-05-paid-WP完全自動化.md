---
title: WordPress記事投稿を完全自動化した全手順【Claude Code × REST API × GAS】
type: paid
price: 980
estimated_read_time: 15分
publish_date: 2026-03-03
---

# WordPress記事投稿を完全自動化した全手順【Claude Code × REST API × GAS】

ニッチスポーツの情報メディアをWordPressで運営している。2026年3月時点で大会情報の登録件数は550件を超えた。

550件。手動で入力していたら何時間かかるか考えたくもない。実際にはその大半をClaude Code + WP REST API + GASの組み合わせで自動投稿している。

この記事では、その全手順を公開する。使っている技術はWordPress REST API、アプリケーションパスワード、Google Apps Script（GAS）、Claude Code（ターミナル版）。特殊なプラグインやSaaSは一切使っていない。

---

## 課題：手動投稿の限界

自分のメディアでは日本全国の大会情報を掲載している。情報源は公式サイト、こくちーず、X（旧Twitter）の3つ。

問題は情報量だ。毎日のようにどこかで新しい大会の告知が出る。これを発見して、記事を作成して、WordPressに投稿して、SNSで告知する。全部手動でやっていたら1日の作業時間の大半が大会情報の更新で消える。

最初はそうしていた。毎日30分〜1時間かけて大会情報を手動で更新していた。月に換算すると15〜30時間。年間で180〜360時間。これはまずい。

解決策はシンプルだ。**全自動化する。**

自動化後の結果：
- 情報収集: GASが毎日9時に自動実行（RSS + こくちーず + IFTTT経由のX監視）
- 記事生成: Claude Codeが情報を整形してWP記事に変換
- 投稿: WP REST APIで自動投稿
- 手動作業: ゼロ

月15〜30時間の作業が文字通りゼロになった。

---

## 自動化で得られた成果

数字で示す。

| 指標 | 自動化前 | 自動化後 |
|------|---------|---------|
| 大会情報の更新頻度 | 週2〜3回 | 毎日 |
| 月あたりの新規登録数 | 10〜15件 | 40〜60件 |
| 1件あたりの作業時間 | 15分 | 0分（完全自動） |
| 月あたりの作業時間 | 15〜30時間 | 0時間 |
| 累計登録数（6ヶ月） | 150件 | 550件以上 |

更新頻度が上がったことでGoogleの評価も上がった。ターゲットキーワードで検索すると、自分のメディアが上位に表示されるようになった。情報の鮮度と量がSEOに直結している。

ここまでが成果の話。ここからは具体的な手順を全部書く。

---

**ここから有料（¥980）**

---

## ステップ1: WP REST APIの有効化とアプリケーションパスワード

### 1-1. REST APIの確認

WordPress 4.7以降であればREST APIはデフォルトで有効だ。まず動作確認する。

```bash
curl https://あなたのサイト.com/wp-json/wp/v2/posts?per_page=1
```

JSONが返ってくればREST APIは有効。403やHTMLが返ってくる場合はセキュリティプラグインがブロックしている可能性がある（後述のSiteGuard対策を参照）。

### 1-2. アプリケーションパスワードの設定

WordPress管理画面 → ユーザー → プロフィール → 「アプリケーションパスワード」セクション。

名前に「Claude Code自動投稿」と入力して「新しいアプリケーションパスワードを追加」をクリック。生成されたパスワードをメモする。**このパスワードは一度しか表示されない。**

```bash
# .envに保存（gitignore必須）
WP_URL=https://あなたのサイト.com
WP_USER=管理者ユーザー名
WP_APP_PASS=xxxx xxxx xxxx xxxx xxxx xxxx
```

### 1-3. 認証の動作確認

```bash
# Basic認証で記事一覧を取得（認証付き）
curl -u "ユーザー名:アプリケーションパスワード" \
  https://あなたのサイト.com/wp-json/wp/v2/posts?per_page=1&status=draft
```

ドラフト記事が返ってくれば認証成功だ。

---

## ステップ2: curlで記事を投稿する（基本）

最小構成の投稿コマンド:

```bash
curl -X POST \
  https://あなたのサイト.com/wp-json/wp/v2/posts \
  -u "ユーザー名:アプリパスワード" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "テスト記事タイトル",
    "content": "<p>テスト本文です。</p>",
    "status": "draft",
    "categories": [1],
    "tags": [10, 15]
  }'
```

`status` は必ず `"draft"` にする。いきなり `"publish"` で公開すると品質チェックができない。

### よく使うパラメータ

| パラメータ | 説明 | 例 |
|-----------|------|-----|
| title | 記事タイトル | "2026年春のモルック大会情報" |
| content | 本文（HTML） | "<h2>概要</h2><p>本文</p>" |
| status | 公開状態 | "draft" / "publish" / "private" |
| categories | カテゴリID（配列） | [5, 12] |
| tags | タグID（配列） | [10, 15, 23] |
| slug | URLスラッグ | "molkky-2026-spring" |
| featured_media | アイキャッチ画像ID | 1234 |
| meta | カスタムフィールド | {"event_date": "2026-04-01"} |

---

## ステップ3: Claude Codeから記事を自動生成して投稿する

実際に使っているワークフローはこうだ。

```
情報ソース（RSS/X/手動URL）
  ↓
Firebase キューに登録
  ↓
Claude Codeがキューを取得
  ↓
URLからイベント情報を抽出
  ↓
WP記事用のHTMLを生成
  ↓
WP REST APIで下書き投稿
  ↓
（オプション）確認後に公開
```

### Claude Codeへの指示プロンプト

```
以下のURLから大会情報を取得して、WordPressの記事として投稿してください。

URL: https://example.com/tournament/12345

投稿ルール:
- タイトル: 「【大会名】開催情報まとめ」の形式
- 本文: 開催日、場所、参加費、申込方法、定員を含める
- カテゴリID: 5（大会情報）
- ステータス: draft
- スラッグ: 大会名をローマ字で（例: molkky-tokyo-2026）

投稿先:
- URL: $WP_URL
- 認証: $WP_USER / $WP_APP_PASS

投稿後、記事IDとURLを教えてください。
```

Claude Codeはこの指示を受けると、URLにアクセスして情報を抽出し、HTMLを組み立て、curlでWP REST APIに投稿する。全自動だ。

---

## ステップ4: GASで定期実行する

情報ソースの監視をGASで自動化する。

### GASスクリプト（RSS監視）

```javascript
function checkRSSFeeds() {
  const feeds = [
    { name: "JMA公式", url: "https://www.molkky.jp/feed/" },
    { name: "こくちーず", url: "https://www.kokuchpro.com/rss/search/?keyword=モルック" }
  ];

  const processed = getProcessedURLs(); // スプシまたはFirebaseから取得

  feeds.forEach(feed => {
    const xml = UrlFetchApp.fetch(feed.url).getContentText();
    const document = XmlService.parse(xml);
    const items = document.getRootElement()
      .getChild("channel")
      .getChildren("item");

    items.forEach(item => {
      const link = item.getChildText("link");
      const title = item.getChildText("title");

      if (!processed.includes(link)) {
        // Firebaseのキューに追加
        addToQueue({
          url: link,
          title: title,
          source: feed.name,
          status: "pending",
          created_at: new Date().toISOString()
        });
      }
    });
  });
}

function addToQueue(data) {
  const fbUrl = "https://your-project.firebaseio.com/tournament-queue.json";
  UrlFetchApp.fetch(fbUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(data)
  });
}

// 毎日9時に実行するトリガー
function createDailyTrigger() {
  ScriptApp.newTrigger("checkRSSFeeds")
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();
}
```

### GASの設定手順

1. https://script.google.com で新規プロジェクトを作成
2. 上記コードを貼り付け
3. `createDailyTrigger()` を1回実行してトリガーを設定
4. 以降は毎日9時に自動実行される

---

## ステップ5: SiteGuard WAFの罠と回避方法

ここが最大のハマりポイントだ。**SiteGuard WP Plugin**を入れているサイトでは、REST APIの一部メソッドがWAFにブロックされる。

### 症状

```bash
# PUTで記事を更新しようとすると...
curl -X PUT https://サイト.com/wp-json/wp/v2/posts/123 \
  -u "user:pass" \
  -d '{"title":"更新テスト"}'

# → 403 Forbidden が返る
```

PUT、PATCH、DELETEメソッドがWAFのルールに引っかかる。SiteGuardの管理画面で個別にルールをOFFにする方法もあるが、セキュリティ的に推奨しない。

### 解決策: POSTだけで全操作する

WordPressのREST APIには裏技がある。**POSTメソッドに `_method` パラメータを付けることで、PUT/PATCH/DELETEをエミュレートできる。**

ただし、これもSiteGuardがブロックする場合がある。俺が実際に採用している方法はもっとシンプルだ。

**記事の更新もPOSTで行う。**

```bash
# 既存記事の更新（POSTメソッドで）
curl -X POST \
  https://サイト.com/wp-json/wp/v2/posts/123 \
  -u "user:pass" \
  -H "Content-Type: application/json" \
  -d '{"title":"更新後のタイトル","content":"更新後の本文"}'
```

WordPressのREST APIは、`/wp/v2/posts/{id}` に対するPOSTリクエストを記事の更新として処理する。PUT/PATCHは不要だ。

### もう一つの罠: `<script>`タグのブロック

記事本文に `<script>` タグを含めるとWAFがブロックする。JavaScriptを埋め込みたい場合は `<details>` / `<summary>` タグでインタラクティブな要素を代替する。

```html
<!-- NGパターン（WAFがブロック） -->
<script>document.getElementById('toggle').addEventListener('click', ...)</script>

<!-- OKパターン -->
<details>
  <summary>クリックして詳細を表示</summary>
  <div>折りたたみコンテンツ</div>
</details>
```

---

## ステップ6: ACF（Advanced Custom Fields）の操作

大会情報には「開催日」「場所」「参加費」などのカスタムフィールドがある。ACFを使っている場合、REST APIからカスタムフィールドを操作するには追加設定が必要だ。

### ACFのREST API有効化

ACFの設定画面でフィールドグループを編集 → 「REST APIで表示」をONにする。

これを忘れると、APIから `meta` パラメータを送っても無視される。俺はこれで半日悩んだ。

### カスタムフィールド付きの投稿

```bash
curl -X POST \
  https://サイト.com/wp-json/wp/v2/posts \
  -u "user:pass" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "第10回モルック大会 in 東京",
    "content": "<p>大会詳細...</p>",
    "status": "draft",
    "categories": [5],
    "acf": {
      "event_date": "2026-04-15",
      "event_location": "東京都港区",
      "entry_fee": "3000",
      "max_participants": "48",
      "registration_url": "https://example.com/entry"
    }
  }'
```

`acf` キーの中にフィールド名と値を入れる。フィールド名はACFの管理画面で設定した「フィールド名」と一致させる必要がある。

---

## ステップ7: アイキャッチ画像の自動設定

記事にアイキャッチ画像を設定するには、まず画像をメディアライブラリにアップロードして、そのIDを記事の `featured_media` に指定する。

### 画像のアップロード

```bash
# ローカルの画像ファイルをWPにアップロード
curl -X POST \
  https://サイト.com/wp-json/wp/v2/media \
  -u "user:pass" \
  -H "Content-Disposition: attachment; filename=tournament-tokyo.jpg" \
  -H "Content-Type: image/jpeg" \
  --data-binary @/path/to/tournament-tokyo.jpg
```

レスポンスに含まれる `id` がメディアIDだ。

### アイキャッチの設定

```bash
# 記事にアイキャッチを設定
curl -X POST \
  https://サイト.com/wp-json/wp/v2/posts/456 \
  -u "user:pass" \
  -H "Content-Type: application/json" \
  -d '{"featured_media": 789}'
```

これを自動化パイプラインに組み込めば、記事投稿時にアイキャッチ画像も自動で設定される。

---

## ステップ8: 全体のパイプラインを組み合わせる

最終的なパイプラインの全体像はこうなる。

```
[GAS] RSS/こくちーず を毎日9時にチェック
  ↓ 新規URLを検出
[Firebase] /tournament-queue に pending で登録
  ↓
[IFTTT] Xキーワード監視（5分おき）
  ↓ モルック大会関連ツイートを検出
[Firebase] /tournament-queue に pending で登録
  ↓
[Claude Code] キューの pending を取得
  ↓ URL先の情報を抽出
[Claude Code] WP記事用HTMLを生成
  ↓
[WP REST API] draft で自動投稿
  ↓ タグ・カテゴリ・ACF・アイキャッチを同時設定
[Firebase] ステータスを completed に更新
```

1回のキュー処理でかかる時間は1件あたり約30秒。50件溜まっていても25分で全処理が完了する。

### Firebaseキューの構造

```json
{
  "tournament-queue": {
    "-Nxxxxxx1": {
      "url": "https://example.com/event/123",
      "title": "第10回モルック大会",
      "source": "JMA公式",
      "status": "pending",
      "created_at": "2026-03-01T09:00:00Z"
    },
    "-Nxxxxxx2": {
      "url": "https://kokuchpro.com/event/456",
      "title": "モルック体験会",
      "source": "こくちーず",
      "status": "completed",
      "wp_post_id": 5601,
      "processed_at": "2026-03-01T10:15:00Z"
    }
  }
}
```

`status` が `pending` のものだけを処理する。処理完了後に `completed` に更新して二重処理を防ぐ。

---

## コスト

この全自動パイプラインの月額コストを整理する。

| 項目 | 月額 |
|------|------|
| WordPress サーバー（さくら） | ¥1,500 |
| Firebase（Spark無料枠） | ¥0 |
| GAS（Google無料枠） | ¥0 |
| IFTTT Pro（X監視） | ¥450（$2.99） |
| Claude Code API（処理分） | ¥500〜1,000 |
| **合計** | **¥2,450〜2,950** |

月3,000円以下で550件以上の大会情報を自動管理している。手動でやったら月30時間。時給1,000円でも月30,000円相当の作業を3,000円で回している。

---

## まとめ: 自動化の順序

全部を一気にやる必要はない。段階的に進める。

**Phase 1（1日で完了）:** アプリケーションパスワード設定 → curlで手動投稿テスト

**Phase 2（3日で完了）:** Claude Codeにプロンプトを渡して記事生成 → 自動投稿

**Phase 3（1週間で完了）:** GASでRSS監視 → Firebaseキュー → 自動処理パイプライン

**Phase 4（2週間で完了）:** IFTTT追加 → X監視 → 3ルート自動収集体制

Phase 1だけでも手動投稿の時間が半分になる。Phase 4まで行けば完全自動化だ。

俺はPhase 4まで到達するのに約1ヶ月かかった。でも一度仕組みを作れば、あとは放置しても毎日動き続ける。1ヶ月の投資で毎月30時間が生まれる。投資対効果としてはこれ以上ないと思っている。
