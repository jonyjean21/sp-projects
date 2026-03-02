# 引き継ぎドキュメント — 次のClaudeセッションへ

> 最終更新: 2026-03-02
> このファイルを読めば「今どこまで進んでいるか」が全部わかる

---

## 🎯 ミッション
**3月中に¥100,000を稼ぐ**
詳細: [MARCH-BATTLE-PLAN.md](./MARCH-BATTLE-PLAN.md)

---

## 📁 プロジェクト構成

```
income/
├── README.md                    ← 20ストリームの全体戦略
├── MARCH-BATTLE-PLAN.md         ← 3月¥100,000作戦（これを毎回読む）
├── SESSION-HANDOFF.md           ← このファイル（引き継ぎ）
├── SETUP.md                     ← 環境構築手順
├── package.json                 ← npm scripts
├── run-all.sh                   ← cron用全自動スケジューラー
│
├── 01-molkky-affiliate/         ← MOLKKY HUB SEO記事量産
│   └── article-generator.js
├── 02-note-magazine/            ← note有料マガジン記事生成
│   ├── content-generator.js
│   └── generated/               ← 生成済み記事（ここにある）
├── 03-booth-prompts/            ← BOOTH商品生成
│   ├── generate-product.js
│   └── generated/               ← 生成済みプロンプト集
├── 04-sports-saas/              ← スポーツ大会SaaS
│   └── tournament-saas.js
├── 05-affiliate-blogs/          ← アフィリエイトブログ量産
│   └── blog-generator.js
├── 06-x-auto-post/              ← X自動投稿Bot
│   └── x-affiliate-poster.js
└── tools/
    ├── freelance-auto-apply.js  ← クラウドワークス提案文生成
    ├── keigo-saas/              ← 敬語変換AI (GitHub Pages公開予定)
    │   └── index.html
    └── generated-proposals/     ← 生成済み提案文
```

---

## ✅ 完了済み（コミット済み）

| 日付 | 内容 |
|------|------|
| 2026-03-02 | income/ ディレクトリ全体を作成・コミット |
| 2026-03-02 | 全自動化スクリプト8本を実装 |
| 2026-03-02 | 3月¥100,000作戦計画書を作成 |
| 2026-03-02 | BOOTH商品コンテンツ生成（agent実行中） |
| 2026-03-02 | note記事3本生成（agent実行中） |
| 2026-03-02 | クラウドワークス提案文生成（agent実行中） |

---

## ⏳ 実行中・待機中のタスク

### Agent が生成中のファイル（完了したらここに追記）
- [ ] `03-booth-prompts/generated/claude-code-副業プロンプト大全50選.md`
- [ ] `02-note-magazine/generated/article-01-free-収益公開.md`
- [ ] `02-note-magazine/generated/article-02-paid-記事量産.md`
- [ ] `02-note-magazine/generated/article-03-paid-BOOTH.md`
- [ ] `tools/generated-proposals/proposal-A-業務自動化.md`
- [ ] `tools/generated-proposals/proposal-B-LINEBot.md`
- [ ] `tools/generated-proposals/proposal-C-WordPress自動化.md`
- [ ] `tools/generated-proposals/self-intro.md`

---

## 🔴 SPがやること（未完了）

### 最優先（今すぐ）
- [ ] **ANTHROPIC_API_KEY を .env に設定** → `echo "ANTHROPIC_API_KEY=sk-ant-xxx" >> income/.env`
- [ ] **BOOTH アカウント作成** → booth.pm でサインアップ → ショップ開設
- [ ] **noteアカウント 有料コンテンツ設定** → note.com でマガジン作成 (¥1,980/月)
- [ ] **クラウドワークス登録** → crowdworks.jp → プロフィール設定

### 今週中
- [ ] **Amazon アソシエイト申請** → associates.amazon.co.jp
- [ ] **Google AdSense申請** → MOLKKY HUBに貼る
- [ ] **Xプレミアム登録** → API使うため ($8/月 = 約¥1,200)

---

## 💰 現在の収益状況

| ストリーム | 3月開始時 | 現在 | 目標 |
|-----------|---------|------|------|
| MOLKKY HUBアフィリエイト | ¥3,000 | ¥3,000 | ¥30,000 |
| BOOTH | ¥0 | ¥0 | ¥40,000 |
| note | ¥0 | ¥0 | ¥20,000 |
| クラウドワークス | ¥0 | ¥0 | ¥50,000 |
| その他 | ¥0 | ¥0 | ¥10,000 |
| **合計** | **¥3,000** | **¥3,000** | **¥150,000** |

> ← この表は毎週更新する

---

## 🔑 重要な設定値（環境変数）

```bash
# income/.env に設定（絶対にコミットしない）
ANTHROPIC_API_KEY=sk-ant-...
AMAZON_ASSOCIATE_TAG=xxx-22    ← アソシエイトID
WP_API_URL=https://molkky-hub.com/wp-json/wp/v2
WP_USERNAME=your-wp-username
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_SECRET=...
```

---

## 📋 次のClaudeセッションがやること

### セッション開始時の確認コマンド

```bash
# 現在の状況を確認
cat /home/user/sp-projects/income/SESSION-HANDOFF.md

# 今週の進捗確認
ls /home/user/sp-projects/income/02-note-magazine/generated/
ls /home/user/sp-projects/income/03-booth-prompts/generated/
ls /home/user/sp-projects/income/tools/generated-proposals/

# .envの設定確認（キーが設定されているか）
cat /home/user/sp-projects/income/.env 2>/dev/null | grep -v "=.*" | head

# cronの設定確認
crontab -l 2>/dev/null
```

### 次にやること（優先順）
1. 上記の⏳のファイルがあればコミット
2. SPが登録したアカウント情報を確認して、次のステップへ
3. 収益テーブルを更新
4. 次週の作業を自動化

---

## 🧠 重要な文脈

### SPについて
- MOLKKY HUB (molkky-hub.com) を運営 — モルックの情報メディア
- 月3,000セッション、主要流入はX (Twitter)
- Claude Code を使いこなせる → スクリプト実行OK
- 時間が少ない → 全自動化が必須
- マルタ村というコミュニティでも活動中

### 使用している技術
- Claude API (claude-opus-4-6) でコンテンツ生成
- GitHub Pages でツール公開
- Firebase でデータ管理
- Google Apps Script (GAS) で自動化
- WordPress + SWELL テーマ (MOLKKY HUB)

### 収益化済みのもの
- Amazon アソシエイト (MOLKKY HUB) — ¥3,000/月
- これを基盤にスケールさせる

---

## 🚀 クイックスタートコマンド集

```bash
cd /home/user/sp-projects/income

# BOOTH商品を今すぐ生成
npm run booth

# note記事を生成 (記事番号1から)
npm run note

# X投稿文をドライランで生成・確認
npm run tweet:dry

# フリーランス提案文を生成
npm run freelance

# MOLKKY HUB記事1本生成
npm run article

# 全部まとめて動かす
bash run-all.sh all
```

---

## 📅 月次チェックポイント

### 3月15日時点の目標
- BOOTH: 10件販売以上 (¥20,000)
- クラウドワークス: 1件受注 (¥50,000)
- note: 5人購読 (¥9,900)
- 合計: ¥80,000 以上

### 3月31日の目標
- 合計: ¥100,000 以上 → **達成！**
