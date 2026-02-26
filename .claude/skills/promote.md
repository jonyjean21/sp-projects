# 記事プロモーション スキル

## 概要
MOLKKY HUB の記事URLを渡すと、X（Twitter）ポスト文面を自動生成する。
UTMトラッキング付きURLを自動付与し、GA4でチャネル効果を計測できるようにする。

## 使い方
- `/promote <URL>` — 記事URLからXポスト案を2〜3パターン生成
- `/promote latest` — 直近の公開記事からXポスト案を生成
- `/promote <URL> --short` — 短めの1パターンのみ生成

## 処理フロー

### Step 1: 記事情報を取得

URLからスラッグまたはpost IDを抽出し、WP REST APIで記事データを取得:

```bash
# .envから認証情報を読み取り
WP_USER=$(grep '^WP_USER=' /Users/shumpei/sp-projects/.env | cut -d= -f2)
WP_APP_PASSWORD=$(grep '^WP_APP_PASSWORD=' /Users/shumpei/sp-projects/.env | cut -d= -f2-)

# URLからスラッグを抽出してAPI取得
SLUG=$(echo "$URL" | sed 's|.*/||;s|/$||')
curl -sf -u "$WP_USER:$WP_APP_PASSWORD" \
  "https://molkky-hub.com/wp-json/wp/v2/posts?slug=$SLUG&_embed"
```

※ `tournament` カスタム投稿の場合:
```bash
curl -sf -u "$WP_USER:$WP_APP_PASSWORD" \
  "https://molkky-hub.com/wp-json/wp/v2/tournament?slug=$SLUG"
```

取得する情報:
- タイトル（`title.rendered`）
- 本文（`content.rendered` — HTMLタグを除去してテキスト化）
- カテゴリID（`categories`）
- タグ（`tags`）
- 抜粋（`excerpt.rendered`）
- 公開日（`date`）
- アイキャッチ画像URL（`_embedded.wp:featuredmedia[0].source_url`）

### Step 2: カテゴリを判定してトーン・ハッシュタグを決定

カテゴリIDとXポスト設定のマッピング:

| カテゴリID | カテゴリ名 | トーン | ハッシュタグ |
|---|---|---|---|
| 122, 126, 125, 123, 127 | 寄稿（いとゆう/かずえ/ソウタ/ナイモル） | 知的・読み応え訴求。著者名を出す | `#モルック #モルハブ #molkky` |
| 8 | 大会情報 | 速報・情報提供系。開催日・場所を明記 | `#モルック #大会情報 #molkky` |
| 56 | チーム紹介 | 親しみやすい・応援系 | `#モルック #チーム紹介 #molkky` |
| 2 | ルール・遊び方 | 初心者歓迎・わかりやすさ重視 | `#モルック #モルックとは #molkky #初心者` |
| 117 | 商品紹介 | 実用性訴求・比較検討系 | `#モルック #モルック購入 #molkky` |
| 57 | YouTube | エンタメ・視覚訴求 | `#モルック #molkky #YouTube` |

寄稿カテゴリの著者名マッピング:
- 126 → いとゆう
- 125 → かずえ
- 123 → ソウタ
- 127 → ナイモル

### Step 3: UTM付きURLを生成

```
{元URL}?utm_source=twitter&utm_medium=social&utm_campaign={campaign_name}
```

campaign_name の命名規則:
- 寄稿記事: `contribute-{著者slug}-{vol}`（例: `contribute-itoyu-1`）
- 大会情報: `tournament-{YYYYMM}`（例: `tournament-202603`）
- その他: `article-{slug}`

### Step 4: Xポスト文面を生成

記事のタイトル・本文・カテゴリ情報を元に、**2〜3パターン**のXポスト案を生成する。

#### 生成ルール
1. **文字数**: 各案 200〜260文字程度（URL・ハッシュタグ込みで280文字以内）
2. **構成**: フック（1行目で興味を引く）→ 要約 → URL → ハッシュタグ
3. **トーン**: 標準語で書く。関西弁は使わない
4. **パターンの差**: 切り口を変える（問いかけ型 / 要約型 / 引用型 など）
5. **URL**: UTM付きURLを使用
6. **ハッシュタグ**: カテゴリに応じたものを末尾に配置
7. **改行**: 読みやすいように適度に改行を入れる

#### パターン例（寄稿記事の場合）

**パターンA: 問いかけ型**
```
【新連載スタート】

いとゆう連載『モルック学入門』Vol.1
テーマ：ミスをしないこと

「そんなの当たり前でしょ！」って思った？
でもこれ、モルックにおける"最強の戦略"。

たった1回のミスで勝者と敗者が入れ替わる——
ルール構造から紐解く、戦略の土台。

▶︎ {UTM付きURL}

#モルック #モルハブ #molkky
```

**パターンB: 要約型**
```
モルックの戦略を大学の講義形式で学ぶ新連載。

Vol.1は「ミスをしないこと」の本質に迫る。
- たった1回のミスで勝敗が逆転する
- 3回連続ミスの失格ルールが戦略を変える
- "見えないディスアドバンテージ"とは？

▶︎ {UTM付きURL}

#モルック #モルハブ #molkky
```

**パターンC: 引用型**
```
"「ミスをしないこと」は、モルックにおける最も基本的な、かつ最強の戦略"

京大モルックサークルAnkka会長・いとゆうが贈る
『モルック学入門』Vol.1

初心者から上級者まで、必読の一本。

▶︎ {UTM付きURL}

#モルック #モルハブ #molkky
```

### Step 5: ユーザーに提示

AskUserQuestion で3パターンを提示し、選択・修正してもらう:

```
📱 Xポスト案（3パターン）

【A】問いかけ型
{パターンA}

【B】要約型
{パターンB}

【C】引用型
{パターンC}

どれを使いますか？（修正も可能です）
```

### Step 6: 最終出力

選択されたポスト文面をそのままコピペできる形で出力:

```
━━━ Xポスト（コピペ用） ━━━

{選択されたポスト文面}

━━━━━━━━━━━━━━━━━

文字数: XXX文字
UTM: utm_source=twitter / utm_campaign=xxx
```

## `/promote latest` の場合

直近の公開記事を自動取得:
```bash
curl -sf -u "$WP_USER:$WP_APP_PASSWORD" \
  "https://molkky-hub.com/wp-json/wp/v2/posts?status=publish&per_page=1&orderby=date&order=desc"
```

## 大会情報（tournament カスタム投稿）の場合

大会情報記事のXポストは簡潔な速報スタイル:

```
📣 大会情報

{大会名}
📅 {開催日}
📍 {場所}
{初心者歓迎なら「🔰 初心者歓迎！」}

エントリー・詳細はこちら ▶︎ {UTM付きURL}

#モルック #大会情報 #molkky
```

## 注意事項
- WP認証情報は `.env` から読み取る（ハードコードしない）
- Xポストの文字数上限は280文字（日本語）を目安に
- 標準語で書く（関西弁は使わない）
- 記事本文を要約する際、原文の主張を曲げないこと
- UTMパラメータは全て小文字で統一
- アイキャッチ画像URLはポストに含めない（Xがog:imageを自動取得する）
