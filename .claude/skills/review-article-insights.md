# 記事インサイト レビュースキル

## 概要
MOLKKY HUBの月次パフォーマンスを分析し、具体的な改善アクションを提案する。
GA4スプレッドシートデータ + Search Console APIを統合して月次レポートを生成。

## 使い方
- `/review-article-insights` — 先月分の月次レポートを生成
- `/review-article-insights 2026-02` — 指定月のレポートを生成
- `/review-article-insights check` — データ取得状況を確認
- `/review-article-insights quick` — 直近データのみ即時サマリー表示

---

## 必要な環境変数（.env）

```
# Google Sheets API（GA4エクスポート先スプシ読み取り）
GOOGLE_API_KEY=AIzaSy...
GA4_SPREADSHEET_ID=1xxxxx...  # GASのエクスポート先スプシID

# Search Console（サービスアカウント方式 or キー方式）
SEARCH_CONSOLE_SITE_URL=sc-domain:molkky-hub.com
GSC_SERVICE_ACCOUNT_JSON=/home/user/sp-projects/.gsc-service-account.json
```

> セットアップ手順: `docs/setup-guides/05-review-article-insights-setup.md`

---

## 処理フロー

### Step 1: 対象月の決定

```bash
# 引数なし → 先月
TARGET_MONTH=$(date -d "$(date +%Y-%m-01) -1 day" +%Y-%m)
# 引数あり → 指定月（例: 2026-02）
TARGET_MONTH="$1"
```

### Step 2: GA4データ取得（Sheets API）

`.env` から認証情報を読み取り:
```bash
source /home/user/sp-projects/.env
```

#### 2a. 月次サマリーシートを取得
```bash
curl -sf "https://sheets.googleapis.com/v4/spreadsheets/${GA4_SPREADSHEET_ID}/values/%E6%9C%88%E6%AC%A1%E3%82%B5%E3%83%9E%E3%83%AA%E3%83%BC?key=${GOOGLE_API_KEY}" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
rows = data.get('values', [])
headers = rows[0] if rows else []
for row in rows[1:]:
    d = dict(zip(headers, row))
    print(json.dumps(d, ensure_ascii=False))
"
```

取得する列: `年月`, `総セッション`, `総PV`, `総イベント数`, `新規ユーザー`, `エンゲージメント率`

#### 2b. チャネル別シートを取得
```bash
curl -sf "https://sheets.googleapis.com/v4/spreadsheets/${GA4_SPREADSHEET_ID}/values/%E3%83%81%E3%83%A3%E3%83%8D%E3%83%AB%E5%88%A5?key=${GOOGLE_API_KEY}" \
  | python3 -c "..."
```

取得する列: `年月`, `チャネル`, `セッション`, `PV`, `新規ユーザー`

#### 2c. ページ別シートを取得
```bash
curl -sf "https://sheets.googleapis.com/v4/spreadsheets/${GA4_SPREADSHEET_ID}/values/%E3%83%9A%E3%83%BC%E3%82%B8%E5%88%A5?key=${GOOGLE_API_KEY}" \
  | python3 -c "..."
```

取得する列: `年月`, `ページパス`, `ページタイトル`, `表示回数`, `セッション`

#### フォールバック（Sheets APIが使えない場合）
`data/ga4/YYYY-MM.json` にエクスポート済みファイルがあれば読み取る:
```bash
cat /home/user/sp-projects/data/ga4/${TARGET_MONTH}.json
```
ファイルがない場合はユーザーに以下を案内:
```
📋 GA4データが取得できませんでした。

以下のどちらかで対応してください:
1. .env に GOOGLE_API_KEY と GA4_SPREADSHEET_ID を設定する
2. GAスプレッドシートを開き、シートをJSONでエクスポートして
   data/ga4/${TARGET_MONTH}.json に保存する
```

---

### Step 3: Search Console データ取得

サービスアカウントJSONが存在する場合:

```bash
# アクセストークンを取得
ACCESS_TOKEN=$(python3 /home/user/sp-projects/scripts/get-gsc-token.py)

# クエリデータ（TOP50、表示回数降順）
curl -sf -X POST \
  "https://searchconsole.googleapis.com/webmasters/v3/sites/${SEARCH_CONSOLE_SITE_URL}/searchAnalytics/query" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"startDate\": \"${TARGET_MONTH}-01\",
    \"endDate\": \"${TARGET_MONTH}-$(cal $(echo $TARGET_MONTH | tr - ' ') | awk 'NF{f=$NF} END{print f}')\",
    \"dimensions\": [\"query\"],
    \"rowLimit\": 50,
    \"orderBy\": [{\"fieldName\": \"impressions\", \"sortOrder\": \"DESCENDING\"}]
  }"
```

取得する: クエリ, 表示回数, クリック数, CTR, 平均掲載順位

フォールバック（Search Consoleが設定されていない場合）:
`data/search-console/YYYY-MM.json` からローカル読み取り、
または分析をGA4のみで実施。

---

### Step 4: データ分析

python3スクリプトでインサイトを生成:

```python
# 分析項目:
# 1. 月次サマリーの前月比（セッション・PV・エンゲージメント率）
# 2. チャネル別の伸び / 下落ランキング
# 3. ページ別: TOP5 の前月比変動
# 4. ページ別: 大幅下落ページ（-20%以上）の特定
# 5. Search Console: 高表示・低CTRの「機会キーワード」抽出
#    → 条件: 表示回数 > 50 AND CTR < 5%
# 6. Search Console: 掲載順位 4〜10位のキーワード（フロントページ候補）
```

分析ロジック:
- 前月比は同月・前月のデータを比較（Sheetsの全データから抽出）
- 機会キーワード = `impressions > 50 AND ctr < 0.05`（タイトル改善で即効果あり）
- 掲載4〜10位 = あと少しで1ページ目 → 内部リンク強化で上位狙える

---

### Step 5: レポート生成

`docs/monthly-reports/YYYY-MM.md` に保存:

```markdown
# MOLKKY HUB 月次レポート: YYYY年MM月

> 生成日: YYYY-MM-DD | 分析期間: YYYY/MM/01〜YYYY/MM/DD

## サマリー

| 指標 | 今月 | 先月 | 前月比 |
|------|------|------|--------|
| 総セッション | X,XXX | X,XXX | ±X% |
| 総PV | X,XXX | X,XXX | ±X% |
| 新規ユーザー | X,XXX | X,XXX | ±X% |
| エンゲージメント率 | XX% | XX% | ±X pt |

## チャネル別セッション

| チャネル | セッション | 前月比 |
|---------|-----------|--------|
| Organic Social (X) | XXX | +X% |
| Organic Search | XXX | ±X% |
| Direct | XXX | ±X% |

## ページ別 TOP10

| ページ | PV | 前月比 |
|--------|-----|--------|
| /event/tournament/... | XXX | +X% |
| ... | ... | ... |

## 🔴 下落ページ（要対応）

| ページ | 今月PV | 先月PV | 変化 | 推奨アクション |
|--------|--------|--------|------|--------------|
| /rules/... | XXX | XXX | -XX% | タイトル改善・内部リンク強化 |

## 🟡 機会キーワード（CTR改善余地あり）

> 表示回数は多いがCTRが低い = タイトル変更だけで流入増の可能性

| キーワード | 表示回数 | CTR | 掲載順位 | 推奨アクション |
|-----------|---------|-----|---------|--------------|
| モルック ルール | XXX | 2.1% | 3.2 | タイトルに年度追加: 【2026年最新版】 |
| モルック 大会 | XXX | 1.8% | 5.1 | meta description改善 |

## 🟢 フロントページ候補（もう少しで1ページ目）

> 掲載順位4〜10位 = 内部リンク強化で上位狙える

| キーワード | 現在順位 | 表示回数 | アクション |
|-----------|---------|---------|----------|
| モルック チーム | 7.2 | XXX | 内部リンク追加 |

## 今月のアクションリスト

- [ ] （機会KWに基づくタイトル改善）
- [ ] （下落ページへの内部リンク強化）
- [ ] （その他）

---

_自動生成: /review-article-insights_
```

---

### Step 6: 保存・コミット

```bash
mkdir -p /home/user/sp-projects/docs/monthly-reports

# レポート保存
# ... (レポートMDファイルを書き込み)

# gitコミット
cd /home/user/sp-projects
git add docs/monthly-reports/${TARGET_MONTH}.md
git commit -m "docs: ${TARGET_MONTH} 月次インサイトレポート追加"
git push -u origin $(git branch --show-current)
```

---

## `/review-article-insights check` の場合

データ取得環境の状態を確認する:

```
📋 データ取得状況

GA4スプレッドシート:
  ✅ GOOGLE_API_KEY — 設定済み
  ✅ GA4_SPREADSHEET_ID — 設定済み
  ✅ データ取得 — 直近: 2026-02（3シート取得可能）

Search Console:
  ❌ GSC_SERVICE_ACCOUNT_JSON — 未設定
  → 設定手順: docs/setup-guides/05-review-article-insights-setup.md

ローカルキャッシュ:
  ✅ data/ga4/2026-02.json — あり
  ❌ data/search-console/2026-02.json — なし

既存レポート:
  ✅ docs/monthly-reports/2026-01.md
  ❌ docs/monthly-reports/2026-02.md — 未生成
```

---

## 注意事項

- API認証情報は `.env` から読み取る（ハードコードしない）
- レポートは `docs/monthly-reports/` に保存（gitに含める）
- `.env` や `.gsc-service-account.json` は gitignore済み
- GA4スプレッドシートは「リンクを知っている人が閲覧可」に設定が必要（GOOGLE_API_KEYのみ使う場合）
- サービスアカウント方式なら非公開スプシでもOK

## 関連ファイル
- `scripts/ga4-monthly-export.gs` — GA4データをスプシにエクスポートするGAS
- `docs/seo-improvement-plan.md` — SEO改善の全体方針
- `docs/monthly-reports/` — 過去レポートのアーカイブ
- `data/ga4/` — GA4データのローカルキャッシュ
- `data/search-console/` — Search Consoleデータのローカルキャッシュ
