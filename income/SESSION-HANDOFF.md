# 引き継ぎドキュメント — 次のターミナルセッションへ

> 最終更新: 2026-03-02
> **ターミナルで `claude` を起動したら最初にこれを読め**

---

## 🎯 ミッション

**3月中に ¥100,000 を稼ぐ**

合言葉: 手間をかけない・AIフル稼働・とにかく数を打つ・全部やる

---

## ⚡ セッション開始時の最初のコマンド

```bash
# 状況を一気に把握する
cd /home/user/sp-projects
git pull origin claude/automated-income-tools-UMGxy
cat income/SESSION-HANDOFF.md
ls income/02-note-magazine/generated/
ls income/03-booth-prompts/generated/
ls income/tools/generated-proposals/
```

---

## ✅ 完了済み（コミット済み）

| 内容 | ファイル |
|------|---------|
| 全自動化スクリプト8本 | `income/` 配下 |
| 3月¥100,000作戦計画書 | `income/MARCH-BATTLE-PLAN.md` |
| note記事3本（無料1 + 有料2） | `income/02-note-magazine/generated/` |
| クラウドワークス提案文4本 | `income/tools/generated-proposals/` |
| 敬語変換AI (SaaS) | `income/tools/keigo-saas/index.html` |

### 生成済み・すぐ使えるもの

**note記事（コピペしてpublishするだけ）:**
```bash
cat income/02-note-magazine/generated/article-01-free-収益公開.md   # 無料公開用
cat income/02-note-magazine/generated/article-02-paid-記事量産.md   # 有料 ¥500
cat income/02-note-magazine/generated/article-03-paid-BOOTH.md      # 有料 ¥500
```

**クラウドワークス提案文（コピペして即応募）:**
```bash
cat income/tools/generated-proposals/self-intro.md           # プロフィール自己PR
cat income/tools/generated-proposals/proposal-A-業務自動化.md  # GAS/API案件 ¥50,000
cat income/tools/generated-proposals/proposal-B-LINEBot.md   # LINE Bot案件 ¥100,000
cat income/tools/generated-proposals/proposal-C-WordPress自動化.md # WP案件 ¥30,000
```

---

## ⏳ ターミナルセッションで最初にやること

### 1. 環境構築（5分）

```bash
cd /home/user/sp-projects/income
npm install @anthropic-ai/sdk

# .envを作成（キーを設定）
cat > .env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-ここに貼る
AMAZON_ASSOCIATE_TAG=ここにアソシエイトIDを貼る
EOF
```

### 2. 動作確認（3分）

```bash
# X投稿文を生成してみる（投稿しない）
node 06-x-auto-post/x-affiliate-poster.js --dry-run

# MOLKKY HUB用記事を1本生成
node 01-molkky-affiliate/article-generator.js
```

### 3. cron を設定（2分）

```bash
crontab -e
```

以下を追記:
```
0 9 * * * cd /home/user/sp-projects && bash income/run-all.sh morning >> income/logs/cron.log 2>&1
0 18 * * * cd /home/user/sp-projects && bash income/run-all.sh evening >> income/logs/cron.log 2>&1
0 0 * * 0 cd /home/user/sp-projects && bash income/run-all.sh weekly >> income/logs/cron.log 2>&1
```

### 4. BOOTH商品コンテンツを確認・PDF化

```bash
# ファイルが生成されていれば:
cat income/03-booth-prompts/generated/claude-code-副業プロンプト大全50選.md

# PDF化 (pandocがあれば)
pandoc income/03-booth-prompts/generated/claude-code-副業プロンプト大全50選.md \
  -o /tmp/claude-code-prompts.pdf
# → これをBOOTHにアップロード
```

---

## 📋 SPがやること（人間の作業）

### 今日中（各10〜20分）

| # | タスク | 備考 |
|---|--------|------|
| 1 | `.env` に API キーを設定 | console.anthropic.com でキー確認 |
| 2 | Amazon アソシエイト ID を `.env` に追記 | associates.amazon.co.jp でID確認 |
| 3 | **BOOTH アカウント作成 + 商品登録** | booth.pm → ¥1,980で「プロンプト大全50選」を登録 |
| 4 | **note マガジン開設 + 記事1本 publish** | note.com → 無料記事をpublish → Xで告知 |
| 5 | **クラウドワークス登録 + 3件応募** | crowdworks.jp → 自己PR + 提案文をコピペ |

### 今週中

| # | タスク | 備考 |
|---|--------|------|
| 6 | Xプレミアム登録 (任意) | API使った自動投稿が可能になる ($8/月) |
| 7 | WordPress にアフィリエイトリンクを追加 | 生成された記事をMOLKKY HUBに投稿 |
| 8 | Google AdSense 申請 | molkky-hub.com に掲載 |

---

## 💰 収益トラッキング（毎週更新）

| ストリーム | 3/2 時点 | 目標(3/31) |
|-----------|---------|-----------|
| MOLKKY HUB アフィリエイト | ¥3,000 | ¥15,000 |
| BOOTH プロンプト集 | ¥0 | ¥40,000 |
| note 有料マガジン | ¥0 | ¥20,000 |
| クラウドワークス受託 | ¥0 | ¥50,000 |
| X アフィリエイト | ¥0 | ¥5,000 |
| その他 | ¥0 | ¥10,000 |
| **合計** | **¥3,000** | **¥140,000** |

---

## 🤖 Claude Code チームの役割

| 役割 | 毎日やること | コマンド |
|------|------------|---------|
| Content | SEO記事・note記事を生成 | `npm run article` / `npm run note` |
| Sales | 提案文・営業メールを生成 | `npm run freelance` |
| X Bot | アフィリエイト投稿文を生成 | `npm run tweet:dry` で確認後 投稿 |
| Scheduler | 全部を毎日自動実行 | cron で `run-all.sh` |

---

## 🧠 SPについて（コンテキスト）

- **MOLKKY HUB** (molkky-hub.com) 運営 — モルック情報メディア、月3,000セッション
- **技術スタック**: WordPress + SWELL / GAS / Firebase / Node.js / GitHub Pages
- **収益**: アフィリエイト ¥3,000/月（Amazon アソシエイト登録済み）
- **X**: MOLKKY HUB 公式アカウントあり（Organic Social が最大の集客源）
- **時間制約**: PC作業時間が限られている → 全自動化が命

---

## 📂 プロジェクト全体マップ

```
sp-projects/
├── CLAUDE.md                        ← プロジェクト全体のルール
├── income/                          ← 副業自動化エンジン（メイン）
│   ├── README.md                    ← 20ストリーム戦略
│   ├── MARCH-BATTLE-PLAN.md         ← 3月¥100,000作戦
│   ├── SESSION-HANDOFF.md           ← このファイル
│   ├── SETUP.md                     ← 環境構築手順
│   ├── package.json                 ← npm scripts
│   ├── run-all.sh                   ← 全自動cronスケジューラー
│   ├── .env                         ← APIキー（git管理外）
│   ├── 01-molkky-affiliate/         ← MOLKKY HUB SEO記事量産
│   ├── 02-note-magazine/generated/  ← note記事3本（すぐ使える）
│   ├── 03-booth-prompts/generated/  ← BOOTHプロンプト集
│   ├── 04-sports-saas/              ← スポーツ大会SaaS
│   ├── 05-affiliate-blogs/          ← アフィリエイトブログ量産
│   ├── 06-x-auto-post/              ← X自動投稿Bot
│   └── tools/generated-proposals/  ← クラウドワークス提案文4本
├── projects/personal/molkky-hub.md  ← MOLKKY HUBの詳細
├── tasks/current.md                 ← 全体タスク管理
└── scripts/                        ← 既存スクリプト
```

---

## ❗ 注意事項

- `.env` は **絶対にコミットしない**（.gitignore済み）
- スクリプト実行前に必ず `.env` の設定を確認
- X自動投稿は最初 `--dry-run` で確認してから本番投稿
- クラウドワークスの提案文は**そのままコピペせず、案件に合わせて微調整**

---

## 🚀 次のターミナルセッションでの一言指示

ターミナルで `claude` を起動した後、こう言うだけでOK:

> 「income/SESSION-HANDOFF.mdを読んで、今日やることを教えて。まず環境構築から始めよう。」
