# セットアップガイド — 30分で全自動収入エンジンを起動する

> これを全部やれば、あとはほぼ自動で動く。

## Step 1: 環境変数を設定する（5分）

```bash
# ~/.bashrc または ~/.zshrc に追記
export ANTHROPIC_API_KEY="sk-ant-api03-..."    # 必須
export AMAZON_ASSOCIATE_TAG="xxx-22"            # Amazon アソシエイト
export WP_API_URL="https://molkky-hub.com/wp-json/wp/v2"  # WordPress API
export WP_USERNAME="your-wp-username"
export WP_APP_PASSWORD="xxxx xxxx xxxx xxxx"   # WPアプリパスワード
export TWITTER_API_KEY="..."                    # X API (Premiumが必要)
export TWITTER_API_SECRET="..."
export TWITTER_ACCESS_TOKEN="..."
export TWITTER_ACCESS_SECRET="..."

# 設定を反映
source ~/.bashrc
```

## Step 2: 依存関係をインストール（2分）

```bash
cd /home/user/sp-projects/income

# Node.js 依存関係
npm init -y
npm install @anthropic-ai/sdk

# X投稿を使う場合
npm install twitter-api-v2
```

## Step 3: 動作確認（3分）

```bash
# アフィリエイト記事1本生成してみる
node 01-molkky-affiliate/article-generator.js

# X投稿文を生成（投稿はしない）
node 06-x-auto-post/x-affiliate-poster.js --dry-run

# note記事を生成
node 02-note-magazine/content-generator.js --id=1
```

## Step 4: cron で全自動化（5分）

```bash
crontab -e
```

以下を追記:
```cron
# 毎朝9時: X投稿 + 記事生成
0 9 * * * cd /home/user/sp-projects && bash income/run-all.sh morning >> income/logs/cron.log 2>&1

# 毎夜18時: X投稿 + note記事生成
0 18 * * * cd /home/user/sp-projects && bash income/run-all.sh evening >> income/logs/cron.log 2>&1

# 毎週日曜 0時: ブログ記事バッチ生成
0 0 * * 0 cd /home/user/sp-projects && bash income/run-all.sh weekly >> income/logs/cron.log 2>&1
```

## Step 5: 各プラットフォームの初期設定

### BOOTH (デジタル商品販売)
1. [booth.pm](https://booth.pm) でアカウント作成
2. 「ショップ開設」→ 商品登録
3. `03-booth-prompts/` で生成したPDFをアップロード
4. 価格: ¥1,500〜¥2,000

### note (有料マガジン)
1. [note.com](https://note.com) でアカウント作成
2. 「マガジン作成」→ 有料設定 (¥1,980/月)
3. `02-note-magazine/generated/` の記事をpublish
4. 最初の2〜3記事は無料 → マガジン誘導

### Amazon アソシエイト
1. [associates.amazon.co.jp](https://associates.amazon.co.jp) で申請
2. 承認後、AMAZON_ASSOCIATE_TAG を設定
3. 既存のMOLKKY HUBにリンクを追加

### Google AdSense
1. [adsense.google.com](https://adsense.google.com) で申請
2. MOLKKY HUBに広告コードを追加
3. 承認まで1〜2週間

---

## 収益が入ってくるまでの目安

| ストリーム | 収益開始まで | 月収目標 |
|-----------|------------|---------|
| MOLKKY HUB アフィリエイト | すぐ | ¥10,000 → ¥30,000 |
| MOLKKY HUB AdSense | 1〜2週間 | ¥5,000 → ¥20,000 |
| BOOTH プロンプト集 | 1日（商品登録後） | ¥10,000 → ¥20,000 |
| note 有料マガジン | 1週間 | ¥10,000 → ¥30,000 |
| アフィリエイトブログ | 3〜6ヶ月（SEO） | ¥30,000〜 |
| スポーツSaaS | 1ヶ月（営業後） | ¥30,000〜 |

## よくある質問

**Q: Anthropic APIのコストは？**
A: claude-haiku-4-5-20251001 で記事1本あたり約0.5〜2円。月100記事生成しても200円以内。

**Q: 完全に自動化できる？**
A: 記事生成・X投稿は100%自動化可能。noteへの投稿は確認後手動（月2時間以内）。

**Q: 最初に何から始めるべき？**
A: BOOTH商品の登録 → MOLKKY HUBにアフィリエイトリンク追加 → この2つが最速。
