# 05. 月次インサイトレポート セットアップ

> `/review-article-insights` スキルを動かすための設定手順

---

## 必要なもの

| 項目 | 用途 | 取得先 |
|------|------|--------|
| Google API キー | Sheets API（GA4スプシ読み取り） | Google Cloud Console |
| GA4 スプレッドシートID | GA4エクスポート先 | GASで作成済みのスプシURL |
| Search Console サービスアカウント | SC APIアクセス | Google Cloud Console |

---

## Step 1: GA4スプレッドシートの設定

### 1a. GASを実行してスプシを作成
`scripts/ga4-monthly-export.gs` を参照。
GAS内の `GA4_PROPERTY_ID` を自分のGA4プロパティIDに書き換えて実行。

### 1b. スプレッドシートIDを確認
スプシURLの形式: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`
`{}` 内の文字列が `GA4_SPREADSHEET_ID`。

### 1c. スプシの共有設定（APIキー方式の場合）
スプシを開く → 共有 → 「リンクを知っている全員」が「閲覧者」に設定。

---

## Step 2: Google API キーの取得

1. [Google Cloud Console](https://console.cloud.google.com) を開く
2. プロジェクトを選択（または新規作成）
3. 「APIとサービス」→「ライブラリ」→「Google Sheets API」を有効化
4. 「認証情報」→「認証情報を作成」→「APIキー」
5. APIキーの制限（推奨）: Sheets API のみに制限

---

## Step 3: Search Console API の設定（オプション）

CTRや検索クエリのデータも取得したい場合のみ。

1. Google Cloud Console → 「サービスアカウント」を作成
2. サービスアカウントのJSONキーをダウンロード
3. ダウンロードしたJSONを `/home/user/sp-projects/.gsc-service-account.json` に配置
4. [Search Console](https://search.google.com/search-console) → 設定 → ユーザーと権限
5. サービスアカウントのメールアドレスを「制限付き」権限で追加

---

## Step 4: .env に追記

```bash
# GA4インサイト
GOOGLE_API_KEY=AIzaSy...
GA4_SPREADSHEET_ID=1xxxxx...

# Search Console（オプション）
SEARCH_CONSOLE_SITE_URL=sc-domain:molkky-hub.com
GSC_SERVICE_ACCOUNT_JSON=/home/user/sp-projects/.gsc-service-account.json
```

---

## Step 5: 動作確認

```
/review-article-insights check
```

全ての項目に ✅ がつけばOK。

---

## よくある問題

| エラー | 原因 | 対処 |
|--------|------|------|
| `403 Forbidden` | スプシの共有設定 | 「リンクを知っている全員」に変更 |
| `API key not valid` | APIキーの制限 | Sheets APIを許可リストに追加 |
| SC APIで `Permission denied` | SC権限なし | サービスアカウントをSCに追加 |
